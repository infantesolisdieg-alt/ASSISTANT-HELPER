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

/**
 * El contenido del selector es de Google (un iframe) y no se puede cambiar. Lo que sí es nuestro:
 * el marco y el fondo (styles.css, .picker-dialog) y este letrero de la app encima del selector.
 */
function showBanner(): { remove: () => void } {
  const el = document.createElement('div');
  el.className = 'picker-banner';
  el.setAttribute('role', 'status');
  el.innerHTML =
    '<img src="/logo-mark.svg" alt="" width="28" height="28" />' +
    '<span><strong>Assistant Helper</strong> · Choose the student files to analyze. ' +
    'Only the files you select are shared with the app.</span>';
  el.hidden = true;
  document.body.appendChild(el);
  let frame = 0;
  let tries = 0;
  // Se coloca justo arriba de la ventana de Google cuando aparece (si hay espacio)
  const place = () => {
    const dialog = document.querySelector<HTMLElement>('.picker-dialog');
    const rect = dialog?.getBoundingClientRect();
    if (rect && rect.width > 0) {
      const room = rect.top;
      if (room >= 52) {
        el.style.left = rect.left + 'px';
        el.style.width = rect.width + 'px';
        el.style.top = Math.max(8, rect.top - 43) + 'px';
        el.hidden = false;
      } else {
        el.hidden = true;
      }
    }
    if (tries++ < 600) frame = requestAnimationFrame(place);
  };
  frame = requestAnimationFrame(place);
  const onResize = () => {
    tries = 0;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(place);
  };
  window.addEventListener('resize', onResize);
  return {
    remove: () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      el.remove();
    },
  };
}

function pick(accessToken: string): Promise<PickedFile[]> {
  return new Promise((resolve, reject) => {
    const g = window.google.picker;
    const mimes = MIME_TYPES.join(',');
    // Algunas versiones del selector no tienen setLabel: se usa solo si existe
    const label = (view: any, text: string) => (typeof view.setLabel === 'function' ? view.setLabel(text) : view);

    // Vista de lista (nombre, dueño, fecha): las miniaturas salen vacías con el permiso drive.file
    const docs = () => new g.DocsView(g.ViewId.DOCS).setMimeTypes(mimes).setMode(g.DocsViewMode.LIST);
    const myDrive = label(docs().setIncludeFolders(true).setSelectFolderEnabled(false).setParent('root'), 'My Drive');
    const recent = label(docs(), 'All files');
    const shared = label(docs().setOwnedByMe(false), 'Shared with me');
    const starred = label(docs().setStarred(true), 'Starred');
    const drives = label(docs().setEnableDrives(true).setIncludeFolders(true).setSelectFolderEnabled(false), 'Shared drives');
    const upload = label(new g.DocsUploadView().setIncludeFolders(true), 'Upload to Drive');

    const banner = showBanner();
    const done = () => banner.remove();

    try {
      const picker = new g.PickerBuilder()
        .addView(myDrive)
        .addView(recent)
        .addView(shared)
        .addView(starred)
        .addView(drives)
        .addView(upload)
        .enableFeature(g.Feature.MULTISELECT_ENABLED)
        .enableFeature(g.Feature.SUPPORT_DRIVES)
        .setSelectableMimeTypes(mimes)
        .setMaxItems(MAX_PICK)
        .setOAuthToken(accessToken)
        .setDeveloperKey(firebaseConfig.apiKey)
        .setAppId(GOOGLE_APP_ID)
        .setTitle('Select student work · up to ' + MAX_PICK + ' files')
        .setLocale('en')
        .setCallback((data: any) => {
          const action = data[g.Response.ACTION];
          if (action === g.Action.PICKED || action === g.Action.CANCEL) done();
          if (action === g.Action.PICKED) {
            resolve(
              (data[g.Response.DOCUMENTS] as any[]).map((doc) => ({
                id: doc[g.Document.ID],
                name: doc[g.Document.NAME],
                mimeType: doc[g.Document.MIME_TYPE],
                sizeBytes: Number(doc.sizeBytes ?? 0),
              })),
            );
          } else if (action === g.Action.CANCEL) {
            reject(new DriveCancelled());
          }
        })
        .build();
      picker.setVisible(true);
    } catch (e) {
      done();
      reject(e instanceof Error ? e : new Error('Google Drive could not be opened.'));
    }
  });
}

/** Máximo de archivos por selección (para no saturar el navegador). */
export const MAX_PICK = 30;

const EXT_BY_MIME: Record<string, string> = {
  [DOCX]: '.docx',
  [GOOGLE_DOC]: '.docx',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

/**
 * Nombre con la extensión correcta según el tipo real del archivo: los Google Docs se descargan
 * como .docx, y a los archivos de Drive sin extensión ("Ensayo", "IMG_2041") se les agrega.
 */
export function downloadName(f: PickedFile): string {
  const ext = EXT_BY_MIME[f.mimeType];
  if (!ext) return f.name;
  if (f.mimeType === GOOGLE_DOC) return /\.docx$/i.test(f.name) ? f.name : f.name + ext;
  const lower = f.name.toLowerCase();
  const ok = ext === '.jpg' ? /\.(jpe?g)$/.test(lower) : lower.endsWith(ext);
  return ok ? f.name : f.name + ext;
}

/** Revisa un archivo elegido antes de descargarlo. Devuelve el motivo si no se puede usar. */
export function driveProblem(f: PickedFile): string | null {
  if (!MIME_TYPES.includes(f.mimeType)) return f.name + ': only ' + ACCEPTED_LABEL + ' and Google Docs are supported.';
  if (f.sizeBytes > MAX_FILE_MB * 1024 * 1024) return f.name + ': the file is larger than ' + MAX_FILE_MB + ' MB.';
  return null;
}

/** Abre el selector de Google Drive (pide el permiso la primera vez) y devuelve lo que se eligió. */
export async function chooseFromDrive(hint?: string): Promise<{ picked: PickedFile[]; token: string }> {
  if (!driveEnabled) throw new Error('Google Drive is not configured for this site.');
  const [accessToken] = await Promise.all([getToken(hint), loadPicker()]);
  const picked = await pick(accessToken);
  return { picked, token: accessToken };
}

/** Descarga un archivo de Drive al navegador, avisando el avance (0 a 1) cuando se conoce el tamaño. */
export async function downloadDriveFile(f: PickedFile, accessToken: string, onProgress?: (p: number) => void): Promise<File> {
  const base = 'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(f.id);
  const url = f.mimeType === GOOGLE_DOC ? base + '/export?mimeType=' + encodeURIComponent(DOCX) : base + '?alt=media&supportsAllDrives=true';
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: 'Bearer ' + accessToken } });
  } catch {
    throw new Error('No internet connection while downloading from Google Drive.');
  }
  if (!res.ok) {
    if (res.status === 401) {
      token = null;
      throw new Error('The Google Drive permission expired. Choose the file again.');
    }
    if (res.status === 403 && f.mimeType === GOOGLE_DOC) throw new Error('This Google Doc is too large to convert to Word (Google limit: 10 MB).');
    throw new Error('Could not be downloaded from Google Drive (error ' + res.status + ').');
  }
  const total = Number(res.headers.get('content-length')) || f.sizeBytes || 0;
  let blob: Blob;
  if (res.body && total > 0 && onProgress) {
    const reader = res.body.getReader();
    const chunks: BlobPart[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      onProgress(Math.min(1, received / total));
    }
    blob = new Blob(chunks);
  } else {
    blob = await res.blob();
  }
  return new File([blob], downloadName(f), { type: f.mimeType === GOOGLE_DOC ? DOCX : f.mimeType });
}
