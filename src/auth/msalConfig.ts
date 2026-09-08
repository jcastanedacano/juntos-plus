import { Configuration, LogLevel, BrowserCacheLocation } from '@azure/msal-browser';

// Sin valores por defecto: el tenant y la aplicacion son de quien despliega.
// Un fallback embebido hace que un build mal configurado apunte en silencio
// al directorio de otro en vez de fallar donde se ve.
const CLIENT_ID = import.meta.env.VITE_AZURE_CLIENT_ID;
const TENANT_ID = import.meta.env.VITE_AZURE_TENANT_ID;

if (!CLIENT_ID || !TENANT_ID) {
  throw new Error(
    'Faltan VITE_AZURE_CLIENT_ID y/o VITE_AZURE_TENANT_ID. ' +
    'Copia .env.example a .env y completalos antes de compilar.'
  );
}

// Quien entra con Google lo hace por la MISMA puerta: se registra como invitado
// del directorio de trabajo, asi que su token viene de la misma autoridad y con
// la misma audiencia. No hay segundo tenant ni segunda autoridad; lo unico que
// cambia es una pista que lleva al usuario directo a Google.
//
// La bandera existe para no ensenar el boton antes de que el directorio tenga
// configurado el auto-registro: seria un boton que lleva a un error.
export const LOGIN_GOOGLE_ACTIVO = import.meta.env.VITE_GOOGLE_ACTIVO === 'true';

export const msalConfig: Configuration = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    // localStorage survives a tab/browser close. With auth-code-flow + PKCE
    // (MSAL v5 default) this is what enables long-lived sessions without
    // re-prompting the user. Safari/iOS ITP can still purge it after 7d
    // of inactivity — for that we keep our own loginHint cookie mirror
    // (see rememberLoginHint / readLoginHint) so the next launch can
    // silently SSO without a credential prompt.
    cacheLocation: BrowserCacheLocation.LocalStorage,
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
      piiLoggingEnabled: false,
    },
  },
};

export const loginRequest = {
  // Explicitly include offline_access so MSAL always asks for a refresh
  // token. Critical on mobile — the refresh token (stored in localStorage)
  // is what lets the next foreground launch refresh silently without
  // bouncing the user through login.microsoftonline.com.
  scopes: ['User.Read', 'offline_access'],
};

// ─── Login-hint persistence (survives ITP localStorage purges) ──────

const HINT_KEY = 'juntos:lastLoginHint';

export function rememberLoginHint(email: string): void {
  try {
    localStorage.setItem(HINT_KEY, email);
    // Mirror to a cookie with 365d expiry so even when the browser purges
    // localStorage we can still suggest the username and trigger a silent
    // SSO without prompting for it again.
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${HINT_KEY}=${encodeURIComponent(email)}; expires=${expires}; path=/; samesite=lax`;
  } catch {
    /* ignore */
  }
}

export function readLoginHint(): string | null {
  try {
    const ls = localStorage.getItem(HINT_KEY);
    if (ls) return ls;
    const match = document.cookie.match(new RegExp(`(?:^|; )${HINT_KEY}=([^;]+)`));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

export function clearLoginHint(): void {
  try {
    localStorage.removeItem(HINT_KEY);
    document.cookie = `${HINT_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  } catch {
    /* ignore */
  }
}
