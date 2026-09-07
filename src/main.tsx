import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PublicClientApplication, EventType } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { msalConfig, loginRequest, readLoginHint, rememberLoginHint } from './auth/msalConfig'
import { setMsalInstance, refreshAuthSilently } from './auth/getToken'
import App from './App.tsx'
import { ToastProvider } from './components/ui/Toast'
import './App.css'

const msalInstance = new PublicClientApplication(msalConfig);

async function bootstrap() {
  await msalInstance.initialize();

  // Finalize any in-flight redirect (login coming back from Microsoft).
  // Without this, the first login after a tab close can land in a half-state
  // and force a full re-login.
  try {
    const redirectResult = await msalInstance.handleRedirectPromise();
    if (redirectResult?.account) {
      msalInstance.setActiveAccount(redirectResult.account);
    }
  } catch (err) {
    console.warn('[msal] handleRedirectPromise failed', err);
  }

  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    msalInstance.setActiveAccount(accounts[0]);
    rememberLoginHint(accounts[0].username);

    // Aggressive silent refresh on app open — try the refresh token first
    // (works even when the MS session cookie has been purged by mobile
    // browser ITP), then fall back to ssoSilent. Both are best-effort:
    // a failure here doesn't redirect; getToken() will retry on demand.
    msalInstance.acquireTokenSilent({
      ...loginRequest,
      account: accounts[0],
      forceRefresh: false,
    })
      .catch(() => msalInstance.ssoSilent({
        ...loginRequest,
        account: accounts[0],
      }))
      .catch((err) => {
        console.info('[msal] silent refresh on bootstrap skipped:', err?.errorCode || err?.name);
      });
  } else {
    // No cached MSAL account — could be a fresh load OR Safari ITP /
    // mobile cleared the localStorage. Try a silent SSO using the email
    // hint we persisted across both localStorage AND cookie. If the
    // user's Microsoft session is still alive on the device, this
    // redirects back authenticated WITHOUT prompting for credentials.
    const hint = readLoginHint();
    if (hint) {
      try {
        const sso = await msalInstance.ssoSilent({
          ...loginRequest,
          loginHint: hint,
        });
        // Adopt the recovered account. Without this the account lands in
        // the MSAL cache but never becomes *active*, so anything reading
        // getActiveAccount() (owner tagging, Pareja settings) silently
        // falls back to a positional lookup.
        if (sso.account) {
          msalInstance.setActiveAccount(sso.account);
          rememberLoginHint(sso.account.username);
        }
      } catch {
        // ssoSilent failed (probably interaction required). Fall through
        // to render the LoginPage; user clicks once and from then on
        // the regular flow takes over.
      }
    }
  }

  msalInstance.addEventCallback((event) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
      const account = (event.payload as any).account;
      msalInstance.setActiveAccount(account);
      if (account?.username) rememberLoginHint(account.username);
    }
  });

  setMsalInstance(msalInstance);

  // Keep the session alive across PWA suspends. Entra caps SPA refresh
  // tokens at 24h, so the session only survives long-term if the app
  // refreshes within each window. A PWA spends most of its life
  // suspended, and its most reliable "I'm alive" signal is returning to
  // the foreground — so that's when we roll the window forward.
  // Registered after setMsalInstance so the handler can never observe a
  // half-initialized auth module. Throttled internally; safe to fire on
  // every visibility flip.
  const onForeground = () => {
    if (document.visibilityState === 'visible') {
      refreshAuthSilently().catch(() => { /* best-effort, never blocks UI */ });
    }
  };
  document.addEventListener('visibilitychange', onForeground);
  window.addEventListener('focus', onForeground);
  // Covers pages restored from the bfcache, which on iOS Safari can come
  // back without firing visibilitychange.
  window.addEventListener('pageshow', onForeground);

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <MsalProvider instance={msalInstance}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </MsalProvider>
    </StrictMode>,
  );
}

bootstrap();
