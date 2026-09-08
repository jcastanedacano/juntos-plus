import { tokenOpcional } from '../auth/getToken';
import { getAPIUrl } from './storageAPI';

/**
 * El hogar es el dueño de los datos: uno o dos miembros que ven exactamente lo
 * mismo. Quien entra por primera vez no tiene ninguno, y el servidor responde
 * 409 a todo hasta que estrena el suyo o acepta que lo llamen a otro.
 */

export interface Invitacion {
  hogarId: string;
  nombre: string;
  /** Correo de quien invita; null si el servidor aun no lo tiene anotado. */
  de: string | null;
  creada: string;
}

export interface EstadoHogar {
  /** Si el servidor reconocio a quien pregunta, por token o por cookie. */
  autenticado: boolean;
  /**
   * El servidor no contesto o contesto mal. NO es lo mismo que «no tienes
   * hogar»: con el servidor caido no hay que ofrecer crear uno, porque la
   * peticion tampoco va a funcionar y el usuario se queda pensando que el
   * error es suyo.
   */
  problema: boolean;
  hogarId: string | null;
  correo: string | null;
  nombre: string | null;
  /** Correos de quienes comparten el hogar. */
  miembros: string[];
  /** Invitaciones que este hogar envió y siguen sin contestar. */
  enviadas: string[];
  /** Invitaciones dirigidas a quien pregunta. */
  invitaciones: Invitacion[];
}

const ANONIMO: EstadoHogar = {
  autenticado: false, problema: false, hogarId: null, correo: null, nombre: null,
  miembros: [], enviadas: [], invitaciones: [],
};

async function pedir(ruta: string, opciones: RequestInit = {}) {
  // Sin cabecera cuando no hay cuenta de Microsoft: quien entro por Google se
  // identifica con la cookie, que el navegador adjunta sola.
  const token = await tokenOpcional();
  return fetch(`${getAPIUrl()}${ruta}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opciones.headers || {}),
    },
    credentials: 'include',
    cache: 'no-store',
  });
}

/** Qué hogar tengo, si tengo, y si el servidor me reconoce siquiera. */
export async function consultarHogar(): Promise<EstadoHogar> {
  try {
    const r = await pedir('/hogar');
    // Un 401 es «no se quien eres» y lleva al login. Cualquier otro fallo es
    // del servidor: ni login ni alta, un aviso de que vuelva a intentarlo.
    if (r.status === 401 || r.status === 403) return ANONIMO;
    if (!r.ok) return { ...ANONIMO, autenticado: true, problema: true };
    return { ...ANONIMO, autenticado: true, ...(await r.json()) };
  } catch {
    // Sin red ni servidor. Tampoco es «no tienes hogar».
    return { ...ANONIMO, autenticado: true, problema: true };
  }
}

export type Resultado = { ok: true } | { ok: false; codigo: string };

async function accion(ruta: string, cuerpo: unknown): Promise<Resultado> {
  try {
    const r = await pedir(ruta, { method: 'POST', body: JSON.stringify(cuerpo) });
    if (r.ok) return { ok: true };
    const datos = await r.json().catch(() => ({}));
    return { ok: false, codigo: datos.codigo || `http_${r.status}` };
  } catch {
    return { ok: false, codigo: 'sin_red' };
  }
}

/** Las que la aplicacion sabe formatear, con su simbolo y su nombre. */
export const MONEDAS = [
  { codigo: 'PEN', simbolo: 'S/', nombre: 'Soles' },
  { codigo: 'USD', simbolo: '$', nombre: 'Dólares' },
  { codigo: 'EUR', simbolo: '€', nombre: 'Euros' },
] as const;

export const crearHogar = (nombre: string, moneda: string) =>
  accion('/hogar', { nombre, moneda });
export const invitarAlHogar = (correo: string) => accion('/hogar/invitacion', { correo });
export const aceptarInvitacion = (hogarId: string) => accion('/hogar/invitacion/aceptar', { hogarId });
export const rechazarInvitacion = (hogarId: string) => accion('/hogar/invitacion/rechazar', { hogarId });

/**
 * El texto que ve el usuario para cada código. Vive aquí y no en cada pantalla
 * para que el mismo problema se explique siempre igual, y porque un código
 * suelto en la interfaz no le dice nada a nadie.
 */
const MOTIVOS: Record<string, string> = {
  sin_cuenta: 'Esa persona todavía no ha entrado a Juntos+1. Pídele que inicie sesión una vez y vuelve a invitarla.',
  ya_es_miembro: 'Esa persona ya comparte tu hogar.',
  eres_tu: 'Ese es tu propio correo.',
  correo_invalido: 'Escribe un correo válido.',
  hogar_lleno: 'Un hogar es de dos personas, y el tuyo ya está completo.',
  sin_hogar: 'Primero crea tu hogar.',
  no_invitado: 'Esa invitación no es para ti.',
  no_existe: 'Ese hogar ya no existe.',
  destino_ilegible: 'No se pudieron leer los datos del otro hogar. No se cambió nada.',
  fusion_fallida: 'No se pudo unir la información, así que no se tocó nada. Inténtalo de nuevo.',
  sin_red: 'Sin conexión con el servidor.',
  sin_identidad: 'Tu sesión no trae un identificador utilizable. Cierra sesión y vuelve a entrar.',
  http_401: 'Tu sesión caducó. Cierra sesión y vuelve a entrar.',
  http_403: 'Tu cuenta no tiene acceso.',
  http_400: 'El servidor rechazó la petición.',
  http_500: 'Error del servidor. Inténtalo de nuevo en un momento.',
};

/**
 * Un codigo sin traducir se enseña TAL CUAL entre parentesis. Antes caia en un
 * «no se pudo completar la operación» que no decia nada: ni al usuario, que no
 * sabe que hacer, ni a quien tiene que arreglarlo, que no sabe por donde
 * empezar. Feo es mejor que mudo.
 */

export function explicar(codigo: string): string {
  if (MOTIVOS[codigo]) return MOTIVOS[codigo];
  return codigo
    ? `No se pudo completar la operación (${codigo}).`
    : 'No se pudo completar la operación.';
}
