// Configuración de Firebase (plan Spark gratuito: sin tarjeta y sin cobros).
// Estos valores NO son secretos: Firebase los diseña para ir en el código del navegador.
// La seguridad la dan las reglas de Firestore (cada usuario solo puede leer y escribir lo suyo).
//
// Se pueden poner aquí directamente o como variables de entorno VITE_FIREBASE_* (archivo .env.local).
// Mientras estén vacíos, la app funciona sin nube (modo local, como antes).

const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? '',
  appId: env.VITE_FIREBASE_APP_ID ?? '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
};

/** true cuando hay un proyecto de Firebase configurado: se activa el inicio de sesión con Google. */
export const cloudEnabled = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId,
);
