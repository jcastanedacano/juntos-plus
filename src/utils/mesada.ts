import { Transaction } from '../types';
import { parseDateOnly } from './stableDate';

/**
 * Mesada: un monto fijo al mes que cada persona puede gastar sin rendir
 * cuentas. Lo que apunta como suyo se descuenta de ahi; lo compartido no.
 *
 * Todo recibe los movimientos YA en la moneda del hogar: aqui no se convierte.
 */

export type Persona = 'me' | 'partner';

/** A partir de este avance se avisa de que la mesada se acaba. */
export const UMBRAL_AVISO = 0.8;

export type EstadoMesada = 'sin_mesada' | 'dentro' | 'cerca' | 'excedida';

export interface Mesada {
  persona: Persona;
  /** Lo asignado al mes; 0 si no se ha fijado. */
  asignada: number;
  gastado: number;
  /** Lo que queda; negativo cuando se pasa. */
  restante: number;
  /** gastado / asignada, o null si no hay mesada con la que comparar. */
  avance: number | null;
  estado: EstadoMesada;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Un monto que no sea un numero finito y positivo no es una mesada. */
export function normalizarMesada(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? round2(n) : 0;
}

/**
 * Lo que una persona gasto en el mes con lo que marco como SUYO.
 *
 * - Solo gastos con su nombre: lo compartido sale de la casa, no de su
 *   mesada, y lo de la otra persona no es asunto suyo.
 * - Los ajustes de saldo (`adj_...`) no son gasto: los genera la conciliacion.
 */
export function gastoPersonalDelMes(
  transacciones: Transaction[],
  persona: Persona,
  mes: Date = new Date(),
): number {
  let total = 0;
  for (const t of transacciones) {
    if (t.type !== 'expense' || t.owner !== persona) continue;
    if (String(t.id).startsWith('adj_')) continue;
    const f = parseDateOnly(t.date);
    if (Number.isNaN(f.getTime())) continue;
    if (f.getFullYear() !== mes.getFullYear() || f.getMonth() !== mes.getMonth()) continue;
    total += t.amount;
  }
  return round2(total);
}

export function estadoDe(asignada: number, gastado: number): EstadoMesada {
  if (!(asignada > 0)) return 'sin_mesada';
  if (gastado > asignada) return 'excedida';
  return gastado / asignada >= UMBRAL_AVISO ? 'cerca' : 'dentro';
}

export function calcularMesada(
  transacciones: Transaction[],
  persona: Persona,
  asignada: unknown,
  mes: Date = new Date(),
): Mesada {
  const monto = normalizarMesada(asignada);
  const gastado = gastoPersonalDelMes(transacciones, persona, mes);
  return {
    persona,
    asignada: monto,
    gastado,
    restante: round2(monto - gastado),
    avance: monto > 0 ? gastado / monto : null,
    estado: estadoDe(monto, gastado),
  };
}

export interface MesadasDelHogar {
  me: Mesada;
  partner: Mesada;
}

export function calcularMesadas(
  transacciones: Transaction[],
  config: { mesadaMe?: unknown; mesadaPartner?: unknown },
  mes: Date = new Date(),
): MesadasDelHogar {
  return {
    me: calcularMesada(transacciones, 'me', config.mesadaMe, mes),
    partner: calcularMesada(transacciones, 'partner', config.mesadaPartner, mes),
  };
}
