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

// Entra External ID, opcional. Es otro tenant, con su propia autoridad y su
// propia aplicacion, y es la puerta para quien no esta en el directorio de
// trabajo: cuentas de Google, correo suelto. Sin estas variables la aplicacion
// se comporta igual que siempre y el boton ni aparece.
const EXTERNAL_CLIENT_ID = import.meta.env.VITE_EXTERNAL_CLIENT_ID;
const EXTERNAL_TENANT_ID = import.meta.env.VITE_EXTERNAL_TENANT_ID;
const EXTERNAL_SUBDOMAIN = import.meta.env.VITE_EXTERNAL_SUBDOMAIN;

export const LOGIN_EXTERNO_ACTIVO = Boolean(
  EXTERNAL_CLIENT_ID && EXTERNAL_TENANT_ID && EXTERNAL_SUBDOMAIN
);

/** Autoridad del tenant externo. Vacia si no esta configurado. */
export const AUTORIDAD_EXTERNA = LOGIN_EXTERNO_ACTIVO
  ? `https://${EXTERNAL_SUBDOMAIN}.ciamlogin.com/${EXTERNAL_TENANT_ID}`
  : '';

export const msalConfig: Configuration = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    // MSAL rechaza cualquier autoridad que no sea la suya salvo que se declare
    // aqui: ciamlogin.com no esta en su lista de confianza por defecto.
    knownAuthorities: LOGIN_EXTERNO_ACTIVO
      ? [`${EXTERNAL_SUBDOMAIN}.ciamlogin.com`]
      : [],
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
