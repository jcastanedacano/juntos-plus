import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// salir.ts toca el navegador (window, fetch) y trae MSAL por la cadena de
// imports: se sustituye lo de fuera para probar solo el orden y los plazos.
vi.mock('../../utils/storageAPI', () => ({ getAPIUrl: () => 'http://x.test/api' }));
const clearLoginHint = vi.fn();
vi.mock('../msalConfig', () => ({ clearLoginHint: () => clearLoginHint() }));

import { cerrarSesion, ESPERA_LOGOUT_MS } from '../salir';

const ventana = { location: { origin: 'http://x.test', href: 'http://x.test/algo' } };

/** Un fetch que no responde nunca, salvo que lo cancelen. */
const fetchColgado = () => vi.fn((_url: string, init?: RequestInit) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('abortado', 'AbortError')));
  }));

const cuenta = (logoutRedirect: () => Promise<void>) => ({
  getActiveAccount: () => ({ username: 'a@b.c' }),
  getAllAccounts: () => [],
  logoutRedirect,
}) as never;

beforeEach(() => {
  vi.useFakeTimers();
  clearLoginHint.mockClear();
  ventana.location.href = 'http://x.test/algo';
  vi.stubGlobal('window', ventana);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('cerrar sesion', () => {
  it('borra primero la pista de login y avisa al servidor', async () => {
    const fetchOk = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal('fetch', fetchOk);
    await cerrarSesion();
    expect(clearLoginHint).toHaveBeenCalledTimes(1);
    expect(fetchOk).toHaveBeenCalledWith('http://x.test/auth/logout', expect.objectContaining({ method: 'POST', credentials: 'include' }));
  });

  it('con respuesta rapida no espera el plazo y no deja temporizadores sueltos', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })));
    await cerrarSesion();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('un servidor que no responde no cuelga el cierre: tras el plazo sigue con Microsoft', async () => {
    const fetchSinRespuesta = fetchColgado();
    vi.stubGlobal('fetch', fetchSinRespuesta);
    const logoutRedirect = vi.fn(async () => {});

    const cierre = cerrarSesion(cuenta(logoutRedirect));
    await vi.advanceTimersByTimeAsync(ESPERA_LOGOUT_MS - 1);
    expect(logoutRedirect).not.toHaveBeenCalled();   // todavia esperando

    await vi.advanceTimersByTimeAsync(1);
    await cierre;
    expect(logoutRedirect).toHaveBeenCalledTimes(1);
    // La peticion se cancelo de verdad, no se dejo abierta.
    const senal = (fetchSinRespuesta.mock.calls[0][1] as RequestInit).signal as AbortSignal;
    expect(senal.aborted).toBe(true);
  });

  it('sin cuenta de Microsoft y con el servidor colgado, recarga tras el plazo', async () => {
    vi.stubGlobal('fetch', fetchColgado());
    const cierre = cerrarSesion();
    await vi.advanceTimersByTimeAsync(ESPERA_LOGOUT_MS);
    await cierre;
    expect(ventana.location.href).toBe('http://x.test');
  });

  it('sin red tambien sigue: el fallo del fetch no impide cerrar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const logoutRedirect = vi.fn(async () => {});
    await cerrarSesion(cuenta(logoutRedirect));
    expect(logoutRedirect).toHaveBeenCalledTimes(1);
  });

  it('si Microsoft rechaza el cierre, el error llega a quien llamo (para poder reactivar el boton)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })));
    const logoutRedirect = vi.fn(async () => { throw new Error('interaction_in_progress'); });
    await expect(cerrarSesion(cuenta(logoutRedirect))).rejects.toThrow('interaction_in_progress');
  });
});
