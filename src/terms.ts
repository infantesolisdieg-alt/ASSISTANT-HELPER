// Términos de uso y aviso de privacidad. El texto vive en public/terms.html (página pública que
// también se muestra dentro de la app). Si cambia algo importante, se sube la versión y la app
// vuelve a pedir la aceptación a todos.

export const TERMS_VERSION = '2026-11-20';
export const TERMS_URL = '/terms.html';

/** Aceptación hecha en la bienvenida antes de entrar con Google (se guarda al cargar la cuenta). */
let accepted: { version: string; at: number } | null = null;

export function acceptTermsNow(): { termsVersion: string; termsAcceptedAt: number } {
  accepted = { version: TERMS_VERSION, at: Date.now() };
  return { termsVersion: accepted.version, termsAcceptedAt: accepted.at };
}

export function sessionAcceptance(): { termsVersion: string; termsAcceptedAt: number } | null {
  return accepted ? { termsVersion: accepted.version, termsAcceptedAt: accepted.at } : null;
}

export function forgetAcceptance(): void {
  accepted = null;
}
