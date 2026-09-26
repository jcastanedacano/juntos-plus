/**
 * Aritmetica del cuestionario de alineacion: repartir 100 puntos y comparar dos
 * repartos. Sin red ni estado, para poder probarlo.
 *
 * Cada persona reparte exactamente 100 puntos entre las mismas areas. Como las
 * dos respuestas suman lo mismo, se pueden comparar de tu a tu: una no «vale
 * mas» que la otra.
 */

export type Puntos = Record<string, number>;

export const TOTAL_PUNTOS = 100;

/** De cuanto en cuanto suben y bajan los botones. */
export const PASO = 5;

/** A partir de cuantos puntos de distancia una diferencia merece conversarse. */
export const UMBRAL_DIFERENCIA = 10;

export function sumar(p: Puntos): number {
  return Object.values(p).reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
}

export function restantes(p: Puntos): number {
  return TOTAL_PUNTOS - sumar(p);
}

/**
 * Pone `nuevo` puntos en una area, sin dejar que el total pase de 100: el
 * maximo es lo que ya tenia mas lo que queda por repartir. Siempre un entero
 * no negativo. No modifica el original.
 */
export function ajustar(p: Puntos, id: string, nuevo: number): Puntos {
  const actual = p[id] || 0;
  const tope = actual + Math.max(0, restantes(p));
  const limpio = Number.isFinite(nuevo) ? Math.round(nuevo) : 0;
  return { ...p, [id]: Math.min(tope, Math.max(0, limpio)) };
}

/** Todos a cero, en el orden de las areas. */
export function vacio(ids: string[]): Puntos {
  return Object.fromEntries(ids.map(id => [id, 0]));
}

/**
 * Reparte 100 por igual. Si no sale exacto, los que sobran van de uno en uno a
 * las primeras areas: 100 entre 8 son 12 y 4 areas con 13.
 */
export function repartirParejo(ids: string[]): Puntos {
  if (ids.length === 0) return {};
  const base = Math.floor(TOTAL_PUNTOS / ids.length);
  const sobra = TOTAL_PUNTOS - base * ids.length;
  return Object.fromEntries(ids.map((id, i) => [id, base + (i < sobra ? 1 : 0)]));
}

/**
 * Cuanto coinciden dos repartos, de 0 a 100: la suma, area por area, de lo
 * MENOR que puso cada uno. Dos repartos iguales dan 100; dos que no comparten
 * ni un punto dan 0. Equivale a 100 menos la mitad de las distancias, y tiene
 * lectura directa: «el 72 % de lo que quieren es lo mismo».
 */
export function solapamiento(a: Puntos, b: Puntos, ids: string[]): number {
  return ids.reduce((s, id) => s + Math.min(a[id] || 0, b[id] || 0), 0);
}

export type NivelAlineacion = 'alta' | 'media' | 'baja';

export function nivelDeAlineacion(pct: number): NivelAlineacion {
  if (pct >= 75) return 'alta';
  if (pct >= 50) return 'media';
  return 'baja';
}

export interface Diferencia {
  id: string;
  yo: number;
  pareja: number;
  /** Distancia absoluta en puntos. */
  distancia: number;
}

/**
 * Area por area, de la que mas separa a la que menos. Los empates conservan
 * el orden de las areas, para que la lista no baile entre pantallas.
 */
export function diferencias(yo: Puntos, pareja: Puntos, ids: string[]): Diferencia[] {
  return ids
    .map((id, i) => ({ id, i, yo: yo[id] || 0, pareja: pareja[id] || 0 }))
    .map(d => ({ ...d, distancia: Math.abs(d.yo - d.pareja) }))
    .sort((x, y) => (y.distancia - x.distancia) || (x.i - y.i))
    .map(({ id, yo: a, pareja: b, distancia }) => ({ id, yo: a, pareja: b, distancia }));
}

/** Las diferencias que merecen una conversacion: de a `umbral` puntos o mas. */
export function paraConversar(difs: Diferencia[], max = 3, umbral = UMBRAL_DIFERENCIA): Diferencia[] {
  return difs.filter(d => d.distancia >= umbral).slice(0, max);
}

export interface Cambio {
  id: string;
  antes: number;
  ahora: number;
  /** Positivo si ahora pone mas puntos que antes. */
  delta: number;
}

/**
 * Como cambio UNA persona respecto a la ronda anterior: solo las areas que se
 * movieron, de la que mas a la que menos.
 */
export function cambios(antes: Puntos, ahora: Puntos, ids: string[]): Cambio[] {
  return ids
    .map((id, i) => ({ id, i, antes: antes[id] || 0, ahora: ahora[id] || 0 }))
    .map(c => ({ ...c, delta: c.ahora - c.antes }))
    .filter(c => c.delta !== 0)
    .sort((x, y) => (Math.abs(y.delta) - Math.abs(x.delta)) || (x.i - y.i))
    .map(({ id, antes: a, ahora: n, delta }) => ({ id, antes: a, ahora: n, delta }));
}

/** Cuanto subio o bajo la alineacion entre dos rondas, en puntos. */
export function evolucion(previa: { yo: Puntos; pareja: Puntos }, actual: number, ids: string[]): number {
  return actual - solapamiento(previa.yo, previa.pareja, ids);
}
