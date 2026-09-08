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
  autenticado: false, hogarId: null, correo: null, nombre: null,
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
    // Un 401 es «no se quien eres» y lleva al login; cualquier otro fallo es
    // del servidor y no debe expulsar a quien si tiene sesion.
    if (r.status === 401 || r.status === 403) return ANONIMO;
    if (!r.ok) return { ...ANONIMO, autenticado: true };
    return { ...ANONIMO, autenticado: true, ...(await r.json()) };
  } catch {
    return ANONIMO;
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

export const crearHogar = (nombre: string) => accion('/hogar', { nombre });
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
};

export function explicar(codigo: string): string {
  return MOTIVOS[codigo] || 'No se pudo completar la operación.';
}
