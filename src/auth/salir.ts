import { getAPIUrl } from '../utils/storageAPI';
import { clearLoginHint } from './msalConfig';
import type { IPublicClientApplication } from '@azure/msal-browser';

/** Cuanto se espera al servidor antes de seguir con el cierre sin el. */
export const ESPERA_LOGOUT_MS = 4000;

/**
 * Cerrar sesion, venga por donde venga.
 *
 * Hay dos formas de estar dentro y cada una se cierra distinto: la de Microsoft
 * vive en MSAL, y la de Google en una cookie que emitimos nosotros. Cerrar solo
 * una deja al usuario dentro creyendo que salio, que sobre una aplicacion de
 * finanzas en un movil compartido es justo lo que no puede pasar.
 *
 * La cookie se borra SIEMPRE y primero: aunque MSAL falle o no haya cuenta, la
 * sesion del servidor tiene que quedar cerrada.
 */
export async function cerrarSesion(instance?: IPublicClientApplication): Promise<void> {
  clearLoginHint();

  // Con tope de espera: un servidor que acepta la conexion y no contesta dejaba
  // aqui al usuario colgado para siempre, sin llegar a cerrar Microsoft ni a
  // recargar, justo cuando mas necesita poder salir.
  const cancelar = new AbortController();
  const aviso = setTimeout(() => cancelar.abort(), ESPERA_LOGOUT_MS);
  try {
    await fetch(`${getAPIUrl().replace(/\/api$/, '')}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      signal: cancelar.signal,
    });
  } catch {
    // Sin red, o sin respuesta a tiempo, no se puede avisar al servidor. Se
    // sigue: al menos se sale de esta pestaña, y la cookie caduca sola.
  } finally {
    clearTimeout(aviso);
  }

  const cuenta = instance?.getActiveAccount() || instance?.getAllAccounts()?.[0];
  if (instance && cuenta) {
    await instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin });
    return;
  }

  // Sesion de Google: no hay a donde redirigir, basta con volver a empezar.
  // Recarga completa a proposito, porque storageAPI cachea los datos en el
  // modulo y ese cache es de quien acaba de salir.
  window.location.href = window.location.origin;
}
