// @vitest-environment jsdom
// Prueba del flujo completo de la nube con Firebase simulado: iniciar sesión, cargar la cuenta,
// crear el perfil de una cuenta nueva y guardar los trabajos que se agregan.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({
  authCb: null as null | ((u: unknown) => void),
  saveAccount: vi.fn(async () => undefined),
  saveSubmission: vi.fn(async () => undefined),
  deleteSubmission: vi.fn(async () => undefined),
  loadAccount: vi.fn(async () => ({ account: null, submissions: [] as unknown[] })),
}));

vi.mock('./config', () => ({ cloudEnabled: true, firebaseConfig: {} }));
vi.mock('./cloud', () => ({
  watchAuth: async (cb: (u: unknown) => void) => {
    calls.authCb = cb;
    return () => undefined;
  },
  loadAccount: calls.loadAccount,
  saveAccount: calls.saveAccount,
  saveSubmission: calls.saveSubmission,
  deleteSubmission: calls.deleteSubmission,
  friendlyError: (e: unknown) => String(e),
}));

import { StoreProvider, useStore } from '../state/store';
import type { DocItem } from '../types';
import { CloudSync } from './CloudSync';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let api: ReturnType<typeof useStore> | null = null;
function Probe() {
  api = useStore();
  return null;
}

const doc = (id: string): DocItem => ({
  id,
  fileName: `${id}.txt`,
  kind: 'txt',
  studentName: 'Ana',
  group: '5A',
  assignmentTitle: 'Letter',
  isReference: false,
  text: 'Some text for the letter.',
  state: 'ready',
  analyzed: true,
  reviewStatus: 'pending',
  finalComment: '',
  notes: [],
});

describe('CloudSync', () => {
  let host: HTMLDivElement;
  beforeEach(async () => {
    vi.clearAllMocks();
    host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <StoreProvider>
          <CloudSync />
          <Probe />
        </StoreProvider>,
      );
    });
    await act(async () => {
      await sleep(10);
    });
  });
  afterEach(() => host.remove());

  it('creates the profile of a new account and saves added submissions', async () => {
    expect(calls.authCb).toBeTypeOf('function');
    await act(async () => {
      calls.authCb!({ uid: 'u1', name: 'Ana Teacher', email: 'ana@example.com', photoURL: '' });
      await sleep(20);
    });
    await act(async () => {
      await sleep(20);
    });
    expect(api!.state.profile?.uid).toBe('u1');

    // El perfil de la cuenta nueva se guarda solo
    await act(async () => {
      await sleep(1100);
    });
    expect(calls.saveAccount).toHaveBeenCalledTimes(1);

    // Agregar trabajos los guarda en la nube
    // (el cambio y la espera van en bloques separados para que React aplique los efectos antes de esperar)
    await act(async () => {
      api!.dispatch({ type: 'addDocs', docs: [doc('a'), doc('b')] });
    });
    await act(async () => {
      await sleep(1100);
    });
    expect(calls.saveSubmission).toHaveBeenCalledTimes(2);
    expect(api!.state.cloud.state).toBe('saved');

    // Quitar uno lo borra de la nube
    await act(async () => {
      api!.dispatch({ type: 'removeDoc', id: 'a' });
    });
    await act(async () => {
      await sleep(1100);
    });
    expect(calls.deleteSubmission).toHaveBeenCalledWith('u1', 'a');
  });
});
