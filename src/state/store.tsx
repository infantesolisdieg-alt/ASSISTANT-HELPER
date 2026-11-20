// Estado de la sesión (useReducer). En modo local todo vive en memoria y se pierde al cerrar la
// pestaña. Con cuenta de Google, CloudSync guarda los trabajos analizados en Firestore.

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { analyzeAll, type SessionAnalysis } from '../analysis';
import { cloudEnabled } from '../cloud/config';
import { DEFAULT_SETTINGS, type Settings } from '../settings';
import { cleanGroup, releaseDoc, type DocItem, type Note, type ReviewStatus, type TeacherProfile } from '../types';

export type View = 'dashboard' | 'upload' | 'review' | 'plagiarism' | 'ai' | 'settings';

interface State {
  /** Profesor de la sesión (sin contraseña ni servidor). null = mostrar la bienvenida. */
  profile: TeacherProfile | null;
  docs: DocItem[];
  settings: Settings;
  view: View;
  selectedId: string | null;
  toast: { id: number; message: string } | null;
  /** 'checking' mientras Firebase revisa si hay una sesión de Google guardada. */
  auth: 'checking' | 'ready';
  cloud: CloudStatus;
  /** Sube cada vez que la docente pide reintentar el guardado. */
  cloudRetry: number;
}

export interface CloudStatus {
  state: 'off' | 'loading' | 'saving' | 'saved' | 'error';
  message?: string;
  savedAt?: number;
}

type Action =
  | { type: 'addDocs'; docs: DocItem[] }
  | { type: 'updateDoc'; id: string; patch: Partial<DocItem> }
  | { type: 'removeDoc'; id: string }
  | { type: 'analyzeStaged' }
  | { type: 'addNote'; id: string; note: Note }
  | { type: 'completeReview'; id: string; decision: Exclude<ReviewStatus, 'pending'>; comment: string }
  | { type: 'clearAll' }
  | { type: 'setSettings'; settings: Settings }
  | { type: 'navigate'; view: View; selectedId?: string | null }
  | { type: 'toast'; message: string }
  | { type: 'signIn'; profile: TeacherProfile }
  | { type: 'signOut' }
  | { type: 'updateProfile'; patch: Partial<TeacherProfile> }
  | { type: 'hydrate'; profile: TeacherProfile; settings: Settings | null; docs: DocItem[] }
  | { type: 'authReady' }
  | { type: 'cloudStatus'; status: CloudStatus }
  | { type: 'cloudRetry' };

const initialState: State = {
  profile: null,
  docs: [],
  settings: DEFAULT_SETTINGS,
  view: 'dashboard',
  selectedId: null,
  toast: null,
  auth: cloudEnabled ? 'checking' : 'ready',
  cloud: { state: 'off' },
  cloudRetry: 0,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'addDocs':
      return { ...state, docs: [...state.docs, ...action.docs] };
    case 'updateDoc':
      return { ...state, docs: state.docs.map((d) => (d.id === action.id ? { ...d, ...action.patch } : d)) };
    case 'removeDoc':
      return {
        ...state,
        docs: state.docs.filter((d) => d.id !== action.id),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      };
    case 'analyzeStaged':
      return {
        ...state,
        docs: state.docs.map((d) =>
          d.state === 'ready' && !d.analyzed
            ? {
                ...d,
                analyzed: true,
                studentName: d.studentName.replace(/\s+/g, ' ').trim(),
                group: d.isReference ? '' : cleanGroup(d.group ?? ''),
                assignmentTitle: d.assignmentTitle.trim() || d.fileName,
              }
            : d,
        ),
      };
    case 'addNote':
      return {
        ...state,
        docs: state.docs.map((d) => (d.id === action.id ? { ...d, notes: [...d.notes, action.note] } : d)),
      };
    case 'completeReview':
      return {
        ...state,
        docs: state.docs.map((d) =>
          d.id === action.id
            ? { ...d, reviewStatus: action.decision, finalComment: action.comment, reviewedAt: Date.now() }
            : d,
        ),
      };
    case 'clearAll':
      // La configuración de criterios y el perfil se conservan: no son archivos temporales.
      return {
        ...initialState,
        profile: state.profile,
        settings: state.settings,
        auth: state.auth,
        cloud: state.cloud,
        cloudRetry: state.cloudRetry,
      };
    case 'signIn':
      return { ...initialState, auth: 'ready', profile: action.profile };
    case 'signOut':
      // Cambiar de profesor termina la sesión local: archivos, resultados y criterios.
      // (Con cuenta de Google, lo guardado sigue en la nube.)
      return { ...initialState, auth: 'ready' };
    case 'updateProfile':
      return state.profile ? { ...state, profile: { ...state.profile, ...action.patch } } : state;
    case 'hydrate':
      return {
        ...initialState,
        auth: 'ready',
        profile: action.profile,
        settings: action.settings ?? DEFAULT_SETTINGS,
        docs: action.docs,
        cloud: { state: 'saved', savedAt: Date.now() },
      };
    case 'authReady':
      return { ...state, auth: 'ready' };
    case 'cloudStatus':
      return { ...state, cloud: action.status };
    case 'cloudRetry':
      return { ...state, cloudRetry: state.cloudRetry + 1 };
    case 'setSettings':
      return { ...state, settings: action.settings };
    case 'navigate':
      return {
        ...state,
        view: action.view,
        selectedId: action.selectedId !== undefined ? action.selectedId : state.selectedId,
      };
    case 'toast':
      return { ...state, toast: { id: Date.now(), message: action.message } };
  }
}

interface StoreValue {
  state: State;
  dispatch: React.Dispatch<Action>;
  analysis: SessionAnalysis;
  /** Entregas analizadas (sin archivos de referencia), en orden de carga. */
  submissions: DocItem[];
  docById: (id: string) => DocItem | undefined;
  go: (view: View, selectedId?: string | null) => void;
  notify: (message: string) => void;
  /** ¿El documento sigue en la sesión? (para tareas asíncronas que terminan tarde) */
  hasDoc: (id: string) => boolean;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const analyzedDocs = useMemo(() => state.docs.filter((d) => d.analyzed && d.state === 'ready'), [state.docs]);
  const docsRef = useRef(analyzedDocs);
  docsRef.current = analyzedDocs;
  // El análisis solo se recalcula si cambia el contenido o la configuración (no al agregar notas)
  const contentKey = analyzedDocs.map((d) => `${d.id}:${d.isReference ? 'r' : 's'}`).join('|');
  const analysis = useMemo(
    () => analyzeAll(docsRef.current, state.settings),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contentKey, state.settings],
  );

  const submissions = useMemo(() => analyzedDocs.filter((d) => !d.isReference), [analyzedDocs]);
  const docById = useCallback((id: string) => state.docs.find((d) => d.id === id), [state.docs]);
  const go = useCallback((view: View, selectedId?: string | null) => dispatch({ type: 'navigate', view, selectedId }), []);
  const notify = useCallback((message: string) => dispatch({ type: 'toast', message }), []);

  // Todos los documentos actuales (incluye los que se están leyendo)
  const allDocsRef = useRef(state.docs);
  allDocsRef.current = state.docs;
  const hasDoc = useCallback((id: string) => allDocsRef.current.some((d) => d.id === id), []);

  // Libera las URLs temporales (archivo original, imágenes) de los documentos que se quitaron
  const prevDocs = useRef<DocItem[]>([]);
  useEffect(() => {
    const now = new Set(state.docs.map((d) => d.id));
    for (const d of prevDocs.current) if (!now.has(d.id)) releaseDoc(d);
    prevDocs.current = state.docs;
  }, [state.docs]);
  // Y todas al cerrar la app
  useEffect(() => () => prevDocs.current.forEach(releaseDoc), []);

  const value = useMemo(
    () => ({ state, dispatch, analysis, submissions, docById, go, notify, hasDoc }),
    [state, analysis, submissions, docById, go, notify, hasDoc],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error('useStore must be used inside StoreProvider');
  return v;
}

/** Siguiente entrega pendiente después de `afterId` (da la vuelta a la lista). */
export function nextPending(submissions: DocItem[], afterId?: string | null): DocItem | undefined {
  const start = afterId ? submissions.findIndex((d) => d.id === afterId) : -1;
  for (let k = 1; k <= submissions.length; k++) {
    const d = submissions[(start + k + submissions.length) % submissions.length];
    if (d && d.reviewStatus === 'pending' && d.id !== afterId) return d;
  }
  return undefined;
}

let counter = 0;
export function newId(prefix = 'doc'): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

export function docLabel(d: DocItem | undefined): string {
  if (!d) return 'Removed document';
  return d.isReference ? `Reference: ${d.assignmentTitle}` : `${d.studentName} — ${d.assignmentTitle}`;
}
