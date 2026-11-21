// Conexión con Firebase: inicio de sesión con Google y guardado en Firestore.
// Se carga solo si hay un proyecto configurado (ver config.ts), para no hacer pesada la app.
//
// Estructura en Firestore (reglas en firestore.rules: cada usuario solo ve lo suyo):
//   users/{uid}                     → perfil y configuración
//   users/{uid}/submissions/{docId} → cada trabajo analizado

import { firebaseConfig } from './config';
import type { CloudAccount, CloudSubmission } from './serialize';

type AuthMod = typeof import('firebase/auth');
type StoreMod = typeof import('firebase/firestore/lite');

interface Services {
  auth: import('firebase/auth').Auth;
  db: import('firebase/firestore/lite').Firestore;
  authMod: AuthMod;
  fs: StoreMod;
}

let services: Promise<Services> | null = null;

function init(): Promise<Services> {
  if (!services) {
    services = (async () => {
      const [{ initializeApp }, authMod, fs] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
        import('firebase/firestore/lite'),
      ]);
      const app = initializeApp(firebaseConfig);
      return { auth: authMod.getAuth(app), db: fs.getFirestore(app), authMod, fs };
    })();
    services.catch(() => {
      services = null;
    });
  }
  return services;
}

export interface CloudUser {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
}

/** Avisa cada vez que cambia la sesión de Google (también al abrir la app con sesión guardada). */
export async function watchAuth(cb: (user: CloudUser | null) => void): Promise<() => void> {
  const { auth, authMod } = await init();
  return authMod.onAuthStateChanged(auth, (u) =>
    cb(u ? { uid: u.uid, name: u.displayName ?? u.email ?? 'Teacher', email: u.email ?? '', photoURL: u.photoURL ?? '' } : null),
  );
}

/** Mensajes claros para los errores comunes de Firebase. */
export function friendlyError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code.includes('popup-closed') || code.includes('cancelled-popup')) return '';
  if (code.includes('popup-blocked')) return 'The browser blocked the Google window. Allow pop-ups for this site and try again.';
  if (code.includes('unauthorized-domain'))
    return 'This website is not authorized in Firebase yet. Add it under Authentication → Settings → Authorized domains.';
  if (code.includes('network-request-failed') || code.includes('unavailable')) return 'No internet connection. Check your connection and try again.';
  if (code.includes('permission-denied')) return 'Firebase rejected the request. Check the Firestore security rules.';
  if (code.includes('resource-exhausted') || code.includes('quota'))
    return 'The free daily limit of the cloud was reached. Your work is kept on this screen; saving will continue tomorrow.';
  if (code.includes('operation-not-allowed')) return 'Google sign-in is not enabled in Firebase (Authentication → Sign-in method).';
  return e instanceof Error ? e.message : 'Something went wrong with the cloud.';
}

export async function signInWithGoogle(): Promise<void> {
  const { auth, authMod } = await init();
  const provider = new authMod.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await authMod.signInWithPopup(auth, provider);
}

export async function signOutCloud(): Promise<void> {
  const { auth, authMod } = await init();
  await authMod.signOut(auth);
}

export async function loadAccount(
  uid: string,
): Promise<{ account: Partial<CloudAccount> | null; submissions: { id: string; rec: CloudSubmission }[] }> {
  const { db, fs } = await init();
  const userRef = fs.doc(db, 'users', uid);
  const [snap, subs] = await Promise.all([fs.getDoc(userRef), fs.getDocs(fs.collection(db, 'users', uid, 'submissions'))]);
  const submissions = subs.docs
    .map((d) => ({ id: d.id, rec: d.data() as CloudSubmission }))
    .sort((a, b) => (a.rec.createdAt ?? 0) - (b.rec.createdAt ?? 0));
  return { account: snap.exists() ? (snap.data() as Partial<CloudAccount>) : null, submissions };
}

export async function saveAccount(uid: string, account: CloudAccount): Promise<void> {
  const { db, fs } = await init();
  await fs.setDoc(fs.doc(db, 'users', uid), { ...account, updatedAt: Date.now() }, { merge: true });
}

export async function saveSubmission(uid: string, id: string, rec: CloudSubmission): Promise<void> {
  const { db, fs } = await init();
  await fs.setDoc(fs.doc(db, 'users', uid, 'submissions', id), { ...rec, updatedAt: Date.now() });
}

/** Borra todo lo guardado de la cuenta: los trabajos y el perfil con la configuración. */
export async function deleteAccountData(uid: string): Promise<void> {
  const { db, fs } = await init();
  const subs = await fs.getDocs(fs.collection(db, 'users', uid, 'submissions'));
  for (const d of subs.docs) await fs.deleteDoc(d.ref);
  await fs.deleteDoc(fs.doc(db, 'users', uid));
}

export async function deleteSubmission(uid: string, id: string): Promise<void> {
  const { db, fs } = await init();
  await fs.deleteDoc(fs.doc(db, 'users', uid, 'submissions', id));
}
