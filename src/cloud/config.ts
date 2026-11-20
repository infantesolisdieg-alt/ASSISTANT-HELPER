// Configuración de Firebase (plan Spark gratuito: sin tarjeta y sin cobros).
// Estos valores NO son secretos: Firebase los diseña para ir en el código del navegador.
// La seguridad la dan las reglas de Firestore (cada usuario solo puede leer y escribir lo suyo).
//
// Se pueden poner aquí directamente o como variables de entorno VITE_FIREBASE_* (archivo .env.local).
// Mientras estén vacíos, la app funciona sin nube (modo local, como antes).

const env = import.meta.env;

/** Proyecto de Firebase del Equipo 7 (assistant-helper-6a777, plan Spark gratuito). */
const PROJECT_CONFIG = {
  apiKey: 'AIzaSyDhxtGSQQHi9x5hh4vIby6315brnFjJpsA',
  authDomain: 'assistant-helper-6a777.firebaseapp.com',
  projectId: 'assistant-helper-6a777',
  appId: '1:648698892557:web:7c7bdfc9ae2eec878b2044',
  messagingSenderId: '648698892557',
};

// Las variables VITE_FIREBASE_* permiten usar otro proyecto (por ejemplo, uno de pruebas).
// VITE_FIREBASE_DISABLED=true apaga la nube y deja la app en modo local.
export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || PROJECT_CONFIG.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || PROJECT_CONFIG.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || PROJECT_CONFIG.projectId,
  appId: env.VITE_FIREBASE_APP_ID || PROJECT_CONFIG.appId,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || PROJECT_CONFIG.messagingSenderId,
};

const disabled = env.VITE_FIREBASE_DISABLED === 'true' || env.MODE === 'test';

/** true cuando hay un proyecto de Firebase configurado: se activa el inicio de sesión con Google. */
export const cloudEnabled =
  !disabled && Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
