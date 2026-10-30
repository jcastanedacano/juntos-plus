/**
 * La nota de un presupuesto: texto libre, escrito a mano, para recordar que
 * entra en una categoria («Salud: terapias y medicinas»).
 */

/** Lo bastante largo para una lista de conceptos, no para un diario. */
export const LIMITE_NOTA = 300;

/**
 * Lo que se guarda a partir de lo escrito: sin espacios sobrantes, sin lineas
 * en blanco seguidas, y con tope. Devuelve '' cuando no queda nada, que quien
 * guarda traduce a «sin nota».
 *
 * Los saltos de linea se conservan: una lista de dos o tres conceptos, uno por
 * linea, es lo que mas se escribe aqui.
 */
export function limpiarNota(crudo: unknown): string {
  if (typeof crudo !== 'string') return '';
  return crudo
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(linea => linea.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, LIMITE_NOTA)
    .trim();
}
