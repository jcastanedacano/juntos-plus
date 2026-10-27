import { pedir, explicar } from './hogar';

/**
 * Cliente de "Decidir juntos". El servidor decide que se ve: el voto de la
 * otra persona solo llega aqui cuando las dos ya votaron.
 */

export interface OpcionDecision {
  id: string;
  texto: string;
}

/** votando: falta alguien. coinciden: las dos eligieron lo mismo. hablarlo: eligieron distinto. */
export type EstadoDecision = 'votando' | 'coinciden' | 'hablarlo' | 'resuelta';

export interface VistaDecision {
  id: string;
  pregunta: string;
  opciones: OpcionDecision[];
  monto: number | null;
  creada: string;
  /** La planteo quien pregunta. */
  mia: boolean;
  estado: EstadoDecision;
  yo: { opcion: string; fecha: string } | null;
  /** `opcion` solo viene cuando las dos votaron. */
  pareja: { voto: boolean; opcion?: string };
  coinciden?: boolean;
  resolucion?: { opcion: string; nota: string; fecha: string };
}

export interface VistaDecisiones {
  miembros: number;
  limites: { maxPregunta: number; maxOpcion: number; maxNota: number; minOpciones: number; maxOpciones: number };
  decisiones: VistaDecision[];
}

export type ResultadoDecisiones =
  | { ok: true; vista: VistaDecisiones }
  | { ok: false; codigo: string };

async function leer(r: Response): Promise<ResultadoDecisiones> {
  if (r.ok) return { ok: true, vista: (await r.json()) as VistaDecisiones };
  const datos = await r.json().catch(() => ({}));
  return { ok: false, codigo: datos.codigo || `http_${r.status}` };
}

async function llamar(ruta: string, cuerpo?: unknown): Promise<ResultadoDecisiones> {
  try {
    return await leer(await pedir(ruta, cuerpo === undefined ? {} : { method: 'POST', body: JSON.stringify(cuerpo) }));
  } catch {
    return { ok: false, codigo: 'sin_red' };
  }
}

export const consultarDecisiones = () => llamar('/hogar/decisiones');

export const crearDecision = (pregunta: string, opciones: string[], monto: number | null) =>
  llamar('/hogar/decisiones', { pregunta, opciones, monto });

export const votarDecision = (id: string, opcion: string) =>
  llamar(`/hogar/decisiones/${encodeURIComponent(id)}/voto`, { opcion });

export const resolverDecision = (id: string, opcion: string, nota: string) =>
  llamar(`/hogar/decisiones/${encodeURIComponent(id)}/resolver`, { opcion, nota });

const MOTIVOS: Record<string, string> = {
  pregunta_vacia: 'Escribe la pregunta.',
  pregunta_larga: 'La pregunta es demasiado larga.',
  opciones_invalidas: 'Todas las opciones necesitan un texto.',
  opciones_cantidad: 'Una decisión lleva entre 2 y 4 opciones.',
  opcion_larga: 'Alguna opción es demasiado larga.',
  opciones_repetidas: 'Las opciones no se pueden repetir.',
  monto_invalido: 'El monto tiene que ser un número mayor que cero.',
  opcion_desconocida: 'Esa opción no existe en esta decisión.',
  nota_larga: 'La nota es demasiado larga.',
  decision_cerrada: 'Esta decisión ya se cerró: los dos votaron y ya no se puede cambiar el voto.',
  faltan_votos: 'Todavía falta que voten los dos.',
  ya_coinciden: 'Los dos eligieron lo mismo: no hay nada que resolver.',
  no_existe: 'Esa decisión ya no existe.',
  demasiadas: 'Hay demasiadas decisiones guardadas.',
  no_es_miembro: 'Tu cuenta ya no forma parte de este hogar.',
  sin_hogar: 'Todavía no tienes un hogar.',
  sin_red: 'No pudimos hablar con el servidor. Revisa tu conexión y vuelve a intentarlo.',
};

export function explicarDecision(codigo: string): string {
  // Un codigo sin traducir se ensena tal cual: feo es mejor que mudo.
  return MOTIVOS[codigo] || explicar(codigo);
}
