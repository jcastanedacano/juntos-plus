import { Transaction, Investment } from '../types';
import { NetWorthBreakdown } from './netWorth';
import { parseDateOnly } from './stableDate';

/**
 * Numero de independencia financiera: cuanto patrimonio hace falta para que
 * lo que rinde cubra lo que se gasta, con la regla del 4%.
 *
 *   numero = gasto mensual promedio x 12 / tasa
 *
 * Todo lo que entra aqui viene YA en la moneda del hogar. Este modulo no
 * convierte nada: quien lo llama proyecta primero, igual que el resto de los
 * calculos que asumen una sola moneda.
 */

/** La regla clasica: retirar el 4% anual del patrimonio. */
export const TASA_POR_DEFECTO = 0.04;

/** Las que se ofrecen en pantalla. 3% es la version prudente para plazos largos. */
export const TASAS_OFRECIDAS = [0.03, 0.035, 0.04] as const;

/** Cuantos meses completos hacen falta antes de dar una cifra. */
export const MESES_MINIMOS = 3;

/** Cuantos meses completos hacia atras se promedian, como maximo. */
export const VENTANA_MESES = 6;

/**
 * Una tasa que no sea razonable --vacia, cero, negativa o absurda-- vuelve a
 * la regla del 4%. Dividir entre cero o entre 0,0001 daria un numero que
 * parece un dato y no lo es.
 */
export function normalizarTasa(t: unknown): number {
  if (t === null || t === undefined || t === '') return TASA_POR_DEFECTO;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0.01 && n <= 0.1 ? n : TASA_POR_DEFECTO;
}

export interface GastoPromedio {
  /** Gasto mensual medio de los meses con datos; 0 si no hay ninguno. */
  promedio: number;
  /** Meses completos, dentro de la ventana, en los que hubo algun gasto. */
  mesesConDatos: number;
  /** Hay meses suficientes para fiarse de la cifra. */
  suficiente: boolean;
}

const claveDeMes = (d: Date) => d.getFullYear() * 12 + d.getMonth();

/**
 * Gasto mensual medio sobre los ULTIMOS MESES COMPLETOS.
 *
 * - El mes en curso no cuenta: a mitad de mes tiene la mitad del gasto y
 *   arrastraria el promedio hacia abajo, con un numero de independencia
 *   demasiado optimista.
 * - Solo cuentan los meses en los que hubo algun gasto. Un mes sin ningun
 *   movimiento casi siempre es un mes sin apuntar --o antes de empezar a usar
 *   la aplicacion--, no un mes de gasto cero, y promediarlo como cero
 *   abarataria la meta.
 * - Los ajustes de saldo (`adj_...`) no son gasto: los genera la conciliacion
 *   de cuentas para cuadrar un saldo, no una compra.
 */
export function gastoMensualPromedio(
  transacciones: Transaction[],
  ref: Date = new Date(),
  ventana: number = VENTANA_MESES,
): GastoPromedio {
  const actual = claveDeMes(ref);
  const desde = actual - ventana;
  const porMes = new Map<number, number>();

  for (const t of transacciones) {
    if (t.type !== 'expense' || String(t.id).startsWith('adj_')) continue;
    const fecha = parseDateOnly(t.date);
    if (Number.isNaN(fecha.getTime())) continue;
    const k = claveDeMes(fecha);
    if (k < desde || k >= actual) continue;
    porMes.set(k, (porMes.get(k) || 0) + t.amount);
  }

  const meses = [...porMes.values()].filter(v => v > 0);
  const total = meses.reduce((a, b) => a + b, 0);
  return {
    promedio: meses.length > 0 ? total / meses.length : 0,
    mesesConDatos: meses.length,
    suficiente: meses.length >= MESES_MINIMOS,
  };
}

/** Cuanto patrimonio hace falta para que la tasa cubra ese gasto. */
export function numeroIndependencia(gastoMensual: number, tasa: number): number {
  return (gastoMensual * 12) / normalizarTasa(tasa);
}

/** Cuanto gasto mensual sostiene ese patrimonio con esa tasa. Nunca negativo. */
export function gastoQueSostiene(patrimonio: number, tasa: number): number {
  return (Math.max(0, patrimonio) * normalizarTasa(tasa)) / 12;
}

/** Fraccion de la meta ya cubierta (1 = cumplida), o null si no hay meta. */
export function progreso(patrimonio: number, meta: number): number | null {
  if (!(meta > 0)) return null;
  return Math.max(0, patrimonio) / meta;
}

export interface Independencia {
  tasa: number;
  gasto: GastoPromedio;
  /** null mientras falten meses: sin base, la cifra seria un numero inventado. */
  numero: number | null;
  /** Patrimonio neto: todo lo que tienes menos lo que debes. */
  patrimonioNeto: number;
  /**
   * Lo que se puede poner a rendir: el neto sin los inmuebles. Una casa no se
   * vende por trozos para pagar el mes, y contarla como si rindiera el 4%
   * adelanta la meta.
   */
  patrimonioInvertible: number;
  progresoNeto: number | null;
  progresoInvertible: number | null;
  sostieneNeto: number;
  sostieneInvertible: number;
}

export function calcularIndependencia(args: {
  transacciones: Transaction[];
  neto: NetWorthBreakdown;
  inversiones: Investment[];
  tasa?: unknown;
  ref?: Date;
}): Independencia {
  const tasa = normalizarTasa(args.tasa);
  const gasto = gastoMensualPromedio(args.transacciones, args.ref);
  const numero = gasto.suficiente ? numeroIndependencia(gasto.promedio, tasa) : null;

  const inmuebles = args.inversiones
    .filter(i => i.type === 'realestate')
    .reduce((s, i) => s + i.currentAmount, 0);
  const patrimonioNeto = args.neto.netWorth;
  const patrimonioInvertible = patrimonioNeto - inmuebles;

  return {
    tasa,
    gasto,
    numero,
    patrimonioNeto,
    patrimonioInvertible,
    progresoNeto: numero === null ? null : progreso(patrimonioNeto, numero),
    progresoInvertible: numero === null ? null : progreso(patrimonioInvertible, numero),
    sostieneNeto: gastoQueSostiene(patrimonioNeto, tasa),
    sostieneInvertible: gastoQueSostiene(patrimonioInvertible, tasa),
  };
}
