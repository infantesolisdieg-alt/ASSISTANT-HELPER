// Estado de la sesión: todo vive en memoria (useReducer). Al cerrar o recargar la pestaña
// se pierde todo; no se usa localStorage ni ningún servidor.

import { createContext, useCallback, useContext, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { analyzeAll, type SessionAnalysis } from '../analysis';
import { DEFAULT_SETTINGS, type Settings } from '../settings';
import type { DocItem, Note, ReviewStatus } from '../types';

export type View = 'dashboard' | 'upload' | 'review' | 'plagiarism' | 'ai' | 'settings';

interface State {
  docs: DocItem[];
  settings: Settings;
  view: View;
  selectedId: string | null;
  toast: { id: number; message: string } | null;
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
  | { type: 'toast'; message: string };

const initialState: State = {
  docs: [],
  settings: DEFAULT_SETTINGS,
  view: 'dashboard',
  selectedId: null,
  toast: null,
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
      return { ...state, docs: state.docs.map((d) => (d.state === 'ready' ? { ...d, analyzed: true } : d)) };
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
      // La configuración de criterios se conserva: no es un archivo temporal.
      return { ...initialState, settings: state.settings };
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

  const value = useMemo(
    () => ({ state, dispatch, analysis, submissions, docById, go, notify }),
    [state, analysis, submissions, docById, go, notify],
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
