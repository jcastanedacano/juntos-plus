import { pedir, explicar } from './hogar';
import type { Puntos } from './alineacion';

/**
 * Cliente del cuestionario de alineacion. El servidor decide que se ve: los
 * puntos de la otra persona solo llegan aqui cuando las dos ya respondieron.
 */

export interface CategoriaCuestionario {
  id: string;
  nombre: string;
  descripcion: string;
}

export interface VistaCuestionario {
  /** El año: cada año hay una ronda nueva. */
  ronda: string;
  total: number;
  categorias: CategoriaCuestionario[];
  /** Cuantas personas tiene el hogar: con una sola no hay con quien comparar. */
  miembros: number;
  /** Las dos respondieron: ya se pueden ver juntas. */
  completa: boolean;
  yo: { puntos: Puntos; fecha: string } | null;
  pareja: { respondio: boolean; puntos?: Puntos };
  /** La ronda anterior que las dos llegaron a cerrar, vista desde quien pregunta. */
  previa: { ronda: string; yo: Puntos; pareja: Puntos } | null;
}

export type ResultadoCuestionario =
  | { ok: true; vista: VistaCuestionario }
  | { ok: false; codigo: string };

async function leer(r: Response): Promise<ResultadoCuestionario> {
  if (r.ok) return { ok: true, vista: (await r.json()) as VistaCuestionario };
  const datos = await r.json().catch(() => ({}));
  return { ok: false, codigo: datos.codigo || `http_${r.status}` };
}

export async function consultarCuestionario(): Promise<ResultadoCuestionario> {
  try {
    return await leer(await pedir('/hogar/cuestionario'));
  } catch {
    return { ok: false, codigo: 'sin_red' };
  }
}

export async function responderCuestionario(puntos: Puntos): Promise<ResultadoCuestionario> {
  try {
    return await leer(await pedir('/hogar/cuestionario', { method: 'POST', body: JSON.stringify({ puntos }) }));
  } catch {
    return { ok: false, codigo: 'sin_red' };
  }
}

/** El texto que ve quien usa la aplicacion para cada codigo del servidor. */
const MOTIVOS: Record<string, string> = {
  suma_invalida: 'Los puntos tienen que sumar exactamente 100.',
  puntos_invalidos: 'Cada área lleva un número entero de puntos, de 0 a 100.',
  ronda_cerrada: 'Esta ronda ya se cerró: las dos personas respondieron y ya no se puede cambiar.',
  no_es_miembro: 'Tu cuenta ya no forma parte de este hogar.',
  sin_hogar: 'Todavía no tienes un hogar.',
  sin_red: 'No pudimos hablar con el servidor. Revisa tu conexión y vuelve a intentarlo.',
};

export function explicarCuestionario(codigo: string): string {
  // Un codigo sin traducir se ensena tal cual: feo es mejor que mudo.
  return MOTIVOS[codigo] || explicar(codigo);
}
