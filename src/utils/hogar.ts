import { getToken } from '../auth/getToken';
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

const SIN_HOGAR: EstadoHogar = {
  hogarId: null, correo: null, nombre: null,
  miembros: [], enviadas: [], invitaciones: [],
};

async function pedir(ruta: string, opciones: RequestInit = {}) {
  const token = await getToken();
  return fetch(`${getAPIUrl()}${ruta}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opciones.headers || {}),
    },
    cache: 'no-store',
  });
}

/**
 * Qué hogar tengo, si tengo. Un fallo de red devuelve `null` en hogarId, que el
 * cliente ya sabe tratar como «todavía no»: es preferible a tumbar el arranque.
 */
export async function consultarHogar(): Promise<EstadoHogar> {
  try {
    const r = await pedir('/hogar');
    if (!r.ok) return SIN_HOGAR;
    return { ...SIN_HOGAR, ...(await r.json()) };
  } catch {
    return SIN_HOGAR;
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
