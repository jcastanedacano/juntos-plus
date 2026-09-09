import { useEffect, useState } from 'react';
import { Transaction, RecurringTransaction, Budget, SavingsGoal, CurrencyType } from '../types';
import { tokenOpcional } from '../auth/getToken';
import { getAPIUrl } from './storageAPI';

export type { FxRates } from './fxTasas';
export {
  DEFAULT_FX_RATES, simboloDe, relativas, aPen,
  localeDe, localeActual, getMonedaBase,
} from './fxTasas';
import {
  FxRates, DEFAULT_FX_RATES, relativas, aPen, getMonedaBase,
  convertirImporte, proyectarABase, proyectarMetaABase,
  fijarMonedaBase as fijarMonedaBaseSinAvisar,
} from './fxTasas';

const STORAGE_KEY = 'juntos:fxRates';
const CHANGE_EVENT = 'juntos:fxRates:change';

function readFromStorage(): FxRates {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FX_RATES };
    const parsed = JSON.parse(raw) as Partial<FxRates>;
    return {
      PEN: 1,                                           // base is always 1
      USD: Number(parsed.USD) > 0 ? Number(parsed.USD) : DEFAULT_FX_RATES.USD,
      EUR: Number(parsed.EUR) > 0 ? Number(parsed.EUR) : DEFAULT_FX_RATES.EUR,
    };
  } catch {
    return { ...DEFAULT_FX_RATES };
  }
}

export interface FxMeta {
  /** true = el usuario fijo la tasa a mano y no se actualiza sola. */
  manual: boolean;
  updatedAt?: string;
  source?: string;
}

const REFRESH_EVERY_MS = 6 * 60 * 60 * 1000; // 6 horas

function writeStorage(rates: FxRates, meta: Partial<FxMeta>): void {
  const current = (() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return {}; }
  })();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...rates, ...meta }));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

/**
 * Fija la moneda del hogar Y avisa a quien la este mirando.
 *
 * fxTasas.fijarMonedaBase() solo muta una variable de modulo: no dice a nadie
 * que cambio. useFxRates() cachea la tasa en un estado de React que solo se
 * recalcula si oye CHANGE_EVENT, asi que sin este aviso quedaba con la tasa
 * de la moneda por defecto para siempre --hasta el proximo reload, o hasta
 * que alguien editara el tipo de cambio a mano por otro motivo.
 *
 * Medido en el navegador: un hogar en euros mostraba «$50 -> 167,72 €»,
 * exactamente 50 * 3.3543 --la tasa ANCLADA A SOLES, sin dividir entre el
 * valor del euro-- porque useFxRates() se habia quedado con la tasa de
 * cuando la base todavia era el valor por defecto.
 */
export function fijarMonedaBase(c: string | undefined): void {
  fijarMonedaBaseSinAvisar(c);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

/** Las tasas tal cual se guardan: soles por unidad. */
export function getFxEnPen(): FxRates {
  return readFromStorage();
}

/** Las tasas en la moneda del hogar, que es lo que la interfaz debe enseñar. */
export function getFxRates(): FxRates {
  return relativas(readFromStorage(), getMonedaBase());
}

/** Recibe lo que el usuario escribio --en la moneda del hogar-- y lo ancla. */
export function setFxRates(rates: Partial<FxRates>): void {
  const enBase = { ...getFxRates(), ...rates, [getMonedaBase()]: 1 } as FxRates;
  const merged = aPen(enBase);
  // Editar a mano marca el override: a partir de aca la actualizacion
  // automatica deja de pisar el valor hasta que se vuelva a activar.
  writeStorage(merged, { manual: true, updatedAt: new Date().toISOString(), source: 'manual' });
}

/** Metadatos de la ultima actualizacion (manual o automatica). */
export function getFxMeta(): FxMeta {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { manual: false };
    const parsed = JSON.parse(raw) as Partial<FxMeta>;
    return {
      manual: Boolean(parsed.manual),
      updatedAt: parsed.updatedAt,
      source: parsed.source,
    };
  } catch {
    return { manual: false };
  }
}

/** Vuelve a la tasa automatica y descarta el override manual. */
export async function clearFxOverride(): Promise<FxRates> {
  const current = readFromStorage();
  writeStorage(current, { manual: false });
  return refreshFxRates(true);
}

/**
 * Trae la tasa del servidor y la guarda, salvo que haya override manual.
 * Falla en silencio: sin red la app sigue con la ultima tasa conocida.
 */
export async function refreshFxRates(force = false): Promise<FxRates> {
  const meta = getFxMeta();
  if (meta.manual && !force) return readFromStorage();

  const last = meta.updatedAt ? Date.parse(meta.updatedAt) : 0;
  if (!force && last && Date.now() - last < REFRESH_EVERY_MS) return readFromStorage();

  try {
    const token = await tokenOpcional();
    const res = await fetch(`${getAPIUrl()}/fx`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const body = await res.json() as { rates: FxRates; updatedAt: string; source: string };
    if (!body.rates || !(Number(body.rates.USD) > 0)) throw new Error('respuesta invalida');

    const next: FxRates = { PEN: 1, USD: Number(body.rates.USD), EUR: Number(body.rates.EUR) };
    writeStorage(next, { manual: false, updatedAt: body.updatedAt, source: body.source });
    return next;
  } catch {
    return readFromStorage();
  }
}

/** Convierte un importe a la moneda del hogar. */
export function toBase(amount: number, currency: CurrencyType | undefined, rates?: FxRates): number {
  return convertirImporte(amount, currency, getMonedaBase(), rates || getFxRates());
}

/** Convenience for transactions — returns the base-currency-equivalent amount. */
export function txBaseAmount(tx: Pick<Transaction, 'amount' | 'currency'>, rates?: FxRates): number {
  return toBase(tx.amount, tx.currency as CurrencyType | undefined, rates);
}

/**
 * Proyecta transacciones, recurrentes o presupuestos a la moneda del hogar:
 * mismos objetos, importe convertido, moneda puesta a la base. Sirve para
 * alimentar los calculos que asumen una sola moneda --disponible real, ritmo,
 * 50/30/20-- sin que ellos tengan que saber de tipos de cambio.
 *
 * Los originales NO se mutan: quien quiera enseñar el importe y la moneda de
 * origen de una fila sigue leyendo de la lista sin proyectar.
 */
export function projectToBase(transactions: Transaction[], rates?: FxRates): Transaction[] {
  return proyectarABase(transactions, getMonedaBase(), rates || getFxRates());
}

/** Igual que projectToBase, para recurrentes. */
export function projectRecurringToBase(recurring: RecurringTransaction[], rates?: FxRates): RecurringTransaction[] {
  return proyectarABase(recurring, getMonedaBase(), rates || getFxRates());
}

/** Igual que projectToBase, para presupuestos. */
export function projectBudgetsToBase(budgets: Budget[], rates?: FxRates): Budget[] {
  return proyectarABase(budgets, getMonedaBase(), rates || getFxRates());
}

/** Metas llevan dos importes propios --meta y ahorrado--, no uno. */
export function projectGoalsToBase(goals: SavingsGoal[], rates?: FxRates): SavingsGoal[] {
  return proyectarMetaABase(goals, getMonedaBase(), rates || getFxRates());
}

// ─── React hook so components react to FX rate edits ──────────────
function subscribe(cb: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

export function useFxRates(): FxRates {
  const [rates, setRates] = useState<FxRates>(() => getFxRates());
  useEffect(() => {
    const update = () => setRates(getFxRates());
    update();
    return subscribe(update);
  }, []);
  return rates;
}
