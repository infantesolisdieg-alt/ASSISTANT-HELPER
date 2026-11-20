// Subir archivos desde Google Drive con el selector oficial de Google (Google Picker).
// Permiso usado: drive.file → la app SOLO puede abrir los archivos que el profesor elige en el
// selector; no ve el resto de su Drive. Los archivos se descargan al navegador y se analizan igual
// que los que se suben desde la computadora (no pasan por ningún servidor nuestro).

import { ACCEPTED_LABEL, MAX_FILE_MB } from '../extract';
import { firebaseConfig } from './config';

/** Número del proyecto de Google Cloud (lo pide el selector). */
const GOOGLE_APP_ID = firebaseConfig.messagingSenderId;
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

export const driveEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && import.meta.env.MODE !== 'test');

/** Tipos que se pueden elegir en Drive. Los Google Docs se convierten a Word (.docx). */
const GOOGLE_DOC = 'application/vnd.google-apps.document';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MIME_TYPES = [DOCX, 'application/pdf', 'text/plain', 'image/png', 'image/jpeg', 'image/webp', GOOGLE_DOC];

/* ------------------------------------------------------------------ */
/* Carga de los scripts de Google (solo cuando se usa Drive)           */
/* ------------------------------------------------------------------ */

const scripts = new Map<string, Promise<void>>();
function loadScript(src: string): Promise<void> {
  let p = scripts.get(src);
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        scripts.delete(src);
        reject(new Error('Google Drive could not be loaded. Check your internet connection.'));
      };
      document.head.appendChild(s);
    });
    scripts.set(src, p);
  }
  return p;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
    gapi?: any;
  }
}

async function loadPicker(): Promise<void> {
  await loadScript('https://apis.google.com/js/api.js');
  await new Promise<void>((resolve, reject) =>
    window.gapi.load('picker', { callback: resolve, onerror: () => reject(new Error('Google Picker could not be loaded.')) }),
  );
}

/** Carga los scripts de Google con anticipación (al abrir la pantalla Upload). */
export function preloadDrive(): void {
  if (!driveEnabled) return;
  getDriveAuth().catch(() => undefined);
  loadPicker().catch(() => undefined);
}

/* ------------------------------------------------------------------ */
/* Permiso de Drive (token de acceso, dura ~1 hora)                    */
/* ------------------------------------------------------------------ */

let token: { value: string; expires: number } | null = null;

// El permiso de Drive se pide con el inicio de sesión de Firebase (ya autorizado en todos los dominios
// del sitio). Se usa una instancia aparte de Firebase, en memoria, para no tocar la sesión principal.
type AuthMod = typeof import('firebase/auth');
let driveAuth: Promise<{ auth: import('firebase/auth').Auth; mod: AuthMod }> | null = null;

function getDriveAuth() {
  if (!driveAuth) {
    driveAuth = (async () => {
      const [{ initializeApp, getApps }, mod] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
      const app = getApps().find((a) => a.name === 'drive') ?? initializeApp(firebaseConfig, 'drive');
      const auth = mod.initializeAuth(app, {
        persistence: mod.inMemoryPersistence,
        popupRedirectResolver: mod.browserPopupRedirectResolver,
      });
      return { auth, mod };
    })();
    driveAuth.catch(() => {
      driveAuth = null;
    });
  }
  return driveAuth;
}

async function getToken(hint?: string): Promise<string> {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const { auth, mod } = await getDriveAuth();
  const provider = new mod.GoogleAuthProvider();
  provider.addScope(SCOPE);
  provider.setCustomParameters(hint ? { login_hint: hint } : { prompt: 'select_account' });
  try {
    const result = await mod.signInWithPopup(auth, provider);
    const accessToken = mod.GoogleAuthProvider.credentialFromResult(result)?.accessToken;
    if (!accessToken) throw new Error('Google Drive sign-in failed.');
    // Los tokens de Google duran 1 hora; se renuevan un poco antes
    token = { value: accessToken, expires: Date.now() + 55 * 60 * 1000 };
    mod.signOut(auth).catch(() => undefined);
    return accessToken;
  } catch (e) {
    const code = (e as { code?: string })?.code ?? '';
    if (code.includes('popup-closed') || code.includes('cancelled-popup')) throw new DriveCancelled();
    if (code.includes('popup-blocked')) throw new Error('The browser blocked the Google window. Allow pop-ups for this site and try again.');
    if (code.includes('unauthorized-domain')) throw new Error('This website is not authorized for Google sign-in yet.');
    throw e instanceof Error ? e : new Error('Google Drive sign-in failed.');
  }
}

/** El profesor cerró la ventana sin elegir nada: no es un error. */
export class DriveCancelled extends Error {
  constructor() {
    super('cancelled');
  }
}

/* ------------------------------------------------------------------ */
/* Selector y descarga                                                 */
/* ------------------------------------------------------------------ */

export interface PickedFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

function pick(accessToken: string): Promise<PickedFile[]> {
  return new Promise((resolve, reject) => {
    const g = window.google.picker;
    const docs = new g.DocsView(g.ViewId.DOCS).setMimeTypes(MIME_TYPES.join(',')).setIncludeFolders(true).setSelectFolderEnabled(false);
    const picker = new g.PickerBuilder()
      .addView(docs)
      .addView(new g.DocsUploadView())
      .enableFeature(g.Feature.MULTISELECT_ENABLED)
      .setOAuthToken(accessToken)
      .setDeveloperKey(firebaseConfig.apiKey)
      .setAppId(GOOGLE_APP_ID)
      .setTitle('Choose student submissions')
      .setLocale('en')
      .setCallback((data: any) => {
        const action = data[g.Response.ACTION];
        if (action === g.Action.PICKED) {
          resolve(
            (data[g.Response.DOCUMENTS] as any[]).map((d) => ({
              id: d[g.Document.ID],
              name: d[g.Document.NAME],
              mimeType: d[g.Document.MIME_TYPE],
              sizeBytes: Number(d.sizeBytes ?? 0),
            })),
          );
        } else if (action === g.Action.CANCEL) {
          reject(new DriveCancelled());
        }
      })
      .build();
    picker.setVisible(true);
  });
}

/** Nombre con la extensión correcta (los Google Docs se descargan como .docx). */
export function downloadName(f: PickedFile): string {
  if (f.mimeType === GOOGLE_DOC) return /\.docx$/i.test(f.name) ? f.name : `${f.name}.docx`;
  return f.name;
}

async function download(f: PickedFile, accessToken: string): Promise<File> {
  const base = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(f.id)}`;
  const url = f.mimeType === GOOGLE_DOC ? `${base}/export?mimeType=${encodeURIComponent(DOCX)}` : `${base}?alt=media`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    if (res.status === 401) token = null;
    throw new Error(`${f.name}: could not be downloaded from Google Drive (error ${res.status}).`);
  }
  const blob = await res.blob();
  const name = downloadName(f);
  return new File([blob], name, { type: f.mimeType === GOOGLE_DOC ? DOCX : blob.type || f.mimeType });
}

/**
 * Abre el selector de Google Drive y devuelve los archivos elegidos ya descargados.
 * Los que no se pueden usar (tipo no soportado, muy grandes, error de descarga) se informan en `problems`.
 */
export async function pickFromDrive(
  onProgress?: (label: string) => void,
  hint?: string,
): Promise<{ files: File[]; problems: string[] }> {
  if (!driveEnabled) throw new Error('Google Drive is not configured for this site.');
  onProgress?.('Opening Google Drive…');
  const [accessToken] = await Promise.all([getToken(hint), loadPicker()]);
  onProgress?.('');
  const picked = await pick(accessToken);
  const files: File[] = [];
  const problems: string[] = [];
  let i = 0;
  for (const f of picked) {
    i++;
    if (!MIME_TYPES.includes(f.mimeType)) {
      problems.push(`${f.name}: only ${ACCEPTED_LABEL} and Google Docs are supported.`);
      continue;
    }
    if (f.sizeBytes > MAX_FILE_MB * 1024 * 1024) {
      problems.push(`${f.name}: the file is larger than ${MAX_FILE_MB} MB.`);
      continue;
    }
    onProgress?.(`Downloading ${i} of ${picked.length} from Google Drive…`);
    try {
      files.push(await download(f, accessToken));
    } catch (e) {
      problems.push(e instanceof Error ? e.message : `${f.name}: could not be downloaded.`);
    }
  }
  onProgress?.('');
  return { files, problems };
}
