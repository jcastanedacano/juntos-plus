import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';
import { loginRequest, readLoginHint } from './msalConfig';

let msalInstance: PublicClientApplication | null = null;

// Avoid stampeding loginRedirect from multiple concurrent token failures.
let redirectInFlight = false;

export function setMsalInstance(instance: PublicClientApplication) {
  msalInstance = instance;
}

export function getMsalInstance(): PublicClientApplication | null {
  return msalInstance;
}

/**
 * Get a fresh ID token, trying every silent path before requiring user
 * interaction. Critical on mobile where the access token expires while the
 * PWA is suspended — we want the next foreground load to refresh
 * transparently without bouncing the user through login.microsoftonline.com.
 *
 * Order of attempts:
 *   1. acquireTokenSilent — uses the cached refresh token from localStorage
 *      (works offline-of-MS-cookies as long as the refresh token is valid,
 *      typically up to 90 days).
 *   2. ssoSilent — uses the live Microsoft session cookie (works even after
 *      refresh token rotation if the user still has an active MS session).
 *   3. Throw — caller decides whether to surface a toast and let the user
 *      manually trigger reconnectInteractive(), instead of forcing a
 *      page-level redirect from a background fetch.
 */
export async function getToken(): Promise<string> {
  if (!msalInstance) {
    throw new Error('MSAL not initialized');
  }

  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) {
    // The MSAL cache can vanish mid-session — Safari/iOS ITP purges
    // localStorage after ~7 days of inactivity, and it can land while the
    // PWA is merely suspended rather than closed. The loginHint survives
    // in a cookie, so try to rebuild the session from it before giving up
    // and making the user log in again.
    const hint = readLoginHint();
    if (hint) {
      try {
        const recovered = await msalInstance.ssoSilent({ ...loginRequest, loginHint: hint });
        if (recovered.account) msalInstance.setActiveAccount(recovered.account);
        if (recovered.idToken) return recovered.idToken;
      } catch {
        // Microsoft session is gone too — fall through to the hard error.
      }
    }
    throw new Error('No authenticated account');
  }

  // 1) Refresh-token-based silent acquire (no MS cookie required).
  try {
    const response = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account: accounts[0],
      forceRefresh: false,
    });
    return response.idToken;
  } catch (firstError) {
    if (!(firstError instanceof InteractionRequiredAuthError)) {
      // Network blip etc — bubble up.
      throw firstError;
    }
  }

  // 2) Fall back to ssoSilent — uses the live Microsoft session cookie.
  try {
    const sso = await msalInstance.ssoSilent({
      ...loginRequest,
      account: accounts[0],
    });
    if (sso.idToken) return sso.idToken;
  } catch {
    // Both silent paths failed — the caller will see a clear error and can
    // choose to call reconnectInteractive() (which will loginRedirect)
    // instead of us doing it from a background data fetch.
  }

  throw new InteractionRequiredAuthError(
    'silent_auth_failed',
    'No se pudo refrescar la sesión silenciosamente. Reconecta manualmente.'
  );
}

/**
 * Best-effort silent re-auth, safe to call opportunistically.
 *
 * WHY THIS EXISTS: this app is registered in Entra ID under the **SPA**
 * platform, and Entra caps refresh tokens issued to SPAs at **24 hours**
 * (not configurable — it's a platform rule for auth-code+PKCE in a
 * browser). So the refresh token in localStorage is only useful for a
 * day. Past that we depend on ssoSilent, which needs the live Microsoft
 * session cookie.
 *
 * The practical consequence: as long as the app is opened at least once
 * inside each 24h window, acquireTokenSilent mints a *fresh* 24h refresh
 * token and the window rolls forward indefinitely — the user never sees a
 * prompt. Calling this on every foreground is what keeps that window
 * alive for a PWA that spends most of its life suspended.
 *
 * Never redirects and never throws: a failure here just means the next
 * getToken() will surface the reconnect affordance.
 *
 * @returns true when the session was refreshed (or was already valid).
 */
let lastRefreshAt = 0;

export async function refreshAuthSilently(minIntervalMs = 5 * 60_000): Promise<boolean> {
  if (!msalInstance) return false;

  // Throttle: foreground events fire on every tab switch. Refreshing the
  // token on each one is pointless network chatter, and MSAL would serve
  // it from cache anyway until the access token nears expiry.
  const now = Date.now();
  if (now - lastRefreshAt < minIntervalMs) return true;

  const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0];
  if (!account) return false;

  lastRefreshAt = now;
  try {
    await msalInstance.acquireTokenSilent({ ...loginRequest, account, forceRefresh: false });
    return true;
  } catch {
    try {
      await msalInstance.ssoSilent({ ...loginRequest, account });
      return true;
    } catch {
      // Both silent paths are exhausted. Reset the throttle so the next
      // foreground retries instead of waiting out the interval — the user
      // may have just regained connectivity.
      lastRefreshAt = 0;
      return false;
    }
  }
}

/**
 * Manually trigger an interactive login. Call from a user-initiated
 * gesture (button click) — never from a background fetch — so mobile
 * browsers / PWAs don't classify it as an unwanted popup-redirect.
 */
export async function reconnectInteractive(): Promise<void> {
  if (!msalInstance) throw new Error('MSAL not initialized');
  if (redirectInFlight) return;
  redirectInFlight = true;
  try {
    await msalInstance.loginRedirect(loginRequest);
  } finally {
    // The redirect leaves the page; this only runs if it was cancelled.
    redirectInFlight = false;
  }
}

/**
 * El token si hay cuenta de Microsoft, y null si no la hay.
 *
 * Quien entra con Google no tiene cuenta en MSAL: su identidad viaja en una
 * cookie de sesion que el navegador adjunta sola. Pedir un token en ese caso
 * lanza, y ese error acababa presentandose como «no se pudieron cargar tus
 * datos» cuando en realidad la peticion iba a funcionar sin cabecera.
 */
export async function tokenOpcional(): Promise<string | null> {
  try {
    if (!msalInstance) return null;
    const cuenta = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0];
    if (!cuenta) return null;
    return await getToken();
  } catch {
    return null;
  }
}
