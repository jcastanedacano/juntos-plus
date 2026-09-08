import { tokenOpcional } from '../auth/getToken';
import { getAPIUrl } from './storageAPI';

/**
 * Suscripcion a notificaciones push (Web Push + VAPID).
 *
 * El servidor guarda la suscripcion y manda un resumen diario a las 09:00 de
 * Lima con los cobros de los proximos 3 dias. Todo esto solo funciona sobre
 * HTTPS y con un service worker registrado.
 */

export type PushState =
  | 'unsupported'    // el navegador no habla Web Push (Safari iOS sin PWA instalada, por ejemplo)
  | 'unconfigured'   // el servidor no tiene claves VAPID
  | 'denied'         // el usuario bloqueo los avisos
  | 'off'            // se puede activar, pero no esta activo
  | 'on';

export interface PushStatus {
  state: PushState;
  /** Motivo legible cuando algo impide activar. */
  reason?: string;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** La clave VAPID viaja en base64url; PushManager la exige como Uint8Array. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  // Respaldarlo en un ArrayBuffer concreto: PushManager no acepta el tipo
  // generico que puede ser SharedArrayBuffer.
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await tokenOpcional();
  return fetch(`${getAPIUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    credentials: 'include',
    cache: 'no-store',
  });
}

async function getServerConfig(): Promise<{ enabled: boolean; publicKey: string }> {
  const res = await authedFetch('/push/config');
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  return res.json();
}

async function getExistingSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/** Estado actual, sin pedir permisos ni cambiar nada. */
export async function getPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) {
    return {
      state: 'unsupported',
      reason: 'Este navegador no soporta notificaciones push. En iPhone hay que instalar la app en la pantalla de inicio primero.',
    };
  }
  if (Notification.permission === 'denied') {
    return {
      state: 'denied',
      reason: 'Bloqueaste las notificaciones para este sitio. Hay que reactivarlas desde los ajustes del navegador.',
    };
  }
  try {
    const cfg = await getServerConfig();
    if (!cfg.enabled) {
      return { state: 'unconfigured', reason: 'El servidor todavia no tiene claves VAPID configuradas.' };
    }
  } catch {
    return { state: 'unconfigured', reason: 'No se pudo consultar la configuracion del servidor.' };
  }

  const sub = await getExistingSubscription();
  return { state: sub ? 'on' : 'off' };
}

/** Pide permiso, se suscribe y registra el dispositivo en el servidor. */
export async function enablePush(): Promise<PushStatus> {
  if (!isPushSupported()) return getPushStatus();

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return {
      state: permission === 'denied' ? 'denied' : 'off',
      reason: permission === 'denied' ? 'Rechazaste el permiso de notificaciones.' : undefined,
    };
  }

  const cfg = await getServerConfig();
  if (!cfg.enabled || !cfg.publicKey) {
    return { state: 'unconfigured', reason: 'El servidor no devolvio una clave VAPID.' };
  }

  const reg = await navigator.serviceWorker.ready;
  // Reusar la suscripcion existente evita generar endpoints huerfanos que el
  // servidor seguiria intentando contactar.
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(cfg.publicKey),
    }));

  const res = await authedFetch('/push/subscribe', {
    method: 'POST',
    body: JSON.stringify(sub.toJSON()),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP_${res.status}`);
  }

  return { state: 'on' };
}

/** Da de baja el dispositivo en el navegador y en el servidor. */
export async function disablePush(): Promise<PushStatus> {
  const sub = await getExistingSubscription();
  if (sub) {
    // Avisar al servidor primero: si el unsubscribe local corre antes y la red
    // falla, el endpoint queda registrado sin nadie que lo escuche.
    await authedFetch('/push/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  return { state: 'off' };
}

/** Manda un aviso de prueba a los dispositivos suscritos de este usuario. */
export async function sendTestPush(): Promise<number> {
  const res = await authedFetch('/push/test', { method: 'POST' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP_${res.status}`);
  return body.sent ?? 0;
}
