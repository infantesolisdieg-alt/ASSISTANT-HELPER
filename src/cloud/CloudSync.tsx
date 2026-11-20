// Sincronización con la nube (solo con cuenta de Google):
// - al iniciar sesión carga el perfil, la configuración y los trabajos guardados;
// - guarda automáticamente lo que cambia (con una pausa corta para agrupar cambios);
// - borra de la nube los trabajos que la docente quita.
// No dibuja nada: solo actualiza el estado del guardado que muestra la barra lateral.

import { useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import type { DocItem, TeacherProfile } from '../types';
import { cloudEnabled } from './config';
import { accountToCloud, fromCloud, settingsFromCloud, toCloud, type CloudSubmission } from './serialize';

const DEBOUNCE_MS = 900;

export function CloudSync() {
  const { state, dispatch } = useStore();
  const stateRef = useRef(state);
  stateRef.current = state;

  // Lo último que se guardó para cada trabajo (para subir solo lo que cambió)
  const known = useRef(new Map<string, string>());
  const createdAt = useRef(new Map<string, number>());
  const knownAccount = useRef('');
  const trackedUid = useRef<string | undefined>(undefined);
  const prime = useRef(false);
  // false si la cuenta es nueva: su perfil todavía no existe en la nube y hay que crearlo
  const accountExists = useRef(true);
  const serialCache = useRef(new WeakMap<DocItem, string>());
  const busy = useRef(false);
  const again = useRef(false);

  // 1. Sesión de Google
  useEffect(() => {
    if (!cloudEnabled) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const cloud = await import('./cloud');
        unsub = await cloud.watchAuth(async (user) => {
          if (cancelled) return;
          const current = stateRef.current.profile;
          if (!user) {
            if (current?.uid) dispatch({ type: 'signOut' });
            dispatch({ type: 'authReady' });
            return;
          }
          if (current?.uid === user.uid) {
            dispatch({ type: 'authReady' });
            return;
          }
          dispatch({ type: 'cloudStatus', status: { state: 'loading' } });
          try {
            const { account, submissions } = await cloud.loadAccount(user.uid);
            const profile: TeacherProfile = {
              name: account?.profile?.name || user.name,
              role: account?.profile?.role || 'Teacher',
              group: account?.profile?.group || '',
              uid: user.uid,
              email: user.email,
              photoURL: user.photoURL,
            };
            createdAt.current = new Map(submissions.map((s) => [s.id, s.rec.createdAt ?? Date.now()]));
            prime.current = true;
            accountExists.current = !!account;
            dispatch({
              type: 'hydrate',
              profile,
              settings: settingsFromCloud(account?.settings),
              docs: submissions.map((s) => fromCloud(s.id, s.rec)),
            });
            if (submissions.length) dispatch({ type: 'toast', message: `Welcome back! ${submissions.length} saved submission(s) loaded.` });
          } catch (e) {
            console.error('Assistant Helper: cloud load failed', e);
            // Sin conexión: la docente puede trabajar y se reintenta el guardado después
            dispatch({
              type: 'hydrate',
              profile: { name: user.name, role: 'Teacher', group: '', uid: user.uid, email: user.email, photoURL: user.photoURL },
              settings: null,
              docs: [],
            });
            dispatch({ type: 'cloudStatus', status: { state: 'error', message: cloud.friendlyError(e) } });
          }
        });
      } catch {
        dispatch({ type: 'authReady' });
        dispatch({ type: 'cloudStatus', status: { state: 'error', message: 'The cloud could not be loaded. Check your internet connection.' } });
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [dispatch]);

  // 2. Guardado automático
  useEffect(() => {
    const uid = state.profile?.uid;
    if (!cloudEnabled || !uid) {
      trackedUid.current = undefined;
      return;
    }
    if (trackedUid.current !== uid) {
      // Cuenta nueva: se olvida lo anterior sin borrar nada en la nube
      trackedUid.current = uid;
      known.current = new Map();
      knownAccount.current = '';
    }

    const docs = state.docs.filter((d) => d.analyzed && d.state === 'ready');
    const serialize = (d: DocItem) => {
      let s = serialCache.current.get(d);
      if (!s) {
        if (!createdAt.current.has(d.id)) createdAt.current.set(d.id, Date.now());
        s = JSON.stringify(toCloud(d, createdAt.current.get(d.id)!));
        serialCache.current.set(d, s);
      }
      return s;
    };
    const accountJson = JSON.stringify(accountToCloud(state.profile!, state.settings));

    if (prime.current) {
      // Recién cargado desde la nube: no hay nada que subir
      prime.current = false;
      known.current = new Map(docs.map((d) => [d.id, serialize(d)]));
      // Cuenta nueva: el perfil se guarda enseguida para que exista en la nube
      knownAccount.current = accountExists.current ? accountJson : '';
      if (accountExists.current) return;
    }

    const timer = window.setTimeout(async () => {
      if (busy.current) {
        // Hay un guardado en curso: se repite al terminar
        again.current = true;
        return;
      }
      const writes = docs.filter((d) => known.current.get(d.id) !== serialize(d));
      const ids = new Set(docs.map((d) => d.id));
      const deletes = [...known.current.keys()].filter((id) => !ids.has(id));
      const accountChanged = knownAccount.current !== accountJson;
      if (!writes.length && !deletes.length && !accountChanged) return;

      busy.current = true;
      dispatch({ type: 'cloudStatus', status: { state: 'saving' } });
      try {
        const cloud = await import('./cloud');
        if (accountChanged) {
          await cloud.saveAccount(uid, JSON.parse(accountJson));
          knownAccount.current = accountJson;
        }
        for (const d of writes) {
          const json = serialize(d);
          await cloud.saveSubmission(uid, d.id, JSON.parse(json) as CloudSubmission);
          known.current.set(d.id, json);
        }
        for (const id of deletes) {
          await cloud.deleteSubmission(uid, id);
          known.current.delete(id);
        }
        if (stateRef.current.profile?.uid === uid) {
          dispatch({ type: 'cloudStatus', status: { state: 'saved', savedAt: Date.now() } });
        }
      } catch (e) {
        console.error('Assistant Helper: cloud save failed', e);
        const cloud = await import('./cloud');
        dispatch({ type: 'cloudStatus', status: { state: 'error', message: cloud.friendlyError(e) } });
      } finally {
        busy.current = false;
        if (again.current) {
          again.current = false;
          dispatch({ type: 'cloudRetry' });
        }
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [state.docs, state.profile, state.settings, state.cloudRetry, dispatch]);

  // 3. Aviso si se intenta cerrar la pestaña mientras se guarda
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (stateRef.current.cloud.state === 'saving') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  return null;
}
