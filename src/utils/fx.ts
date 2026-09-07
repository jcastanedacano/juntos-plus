import { useEffect, useState } from 'react';
import { Transaction, CurrencyType } from '../types';
import { getToken } from '../auth/getToken';
import { getAPIUrl } from './storageAPI';

/**
 * Exchange rates with PEN as the base currency. Stored in localStorage so
 * the user can override the default 3.50 PEN/USD without a code change.
 * EUR included for completeness; user can tune.
 */
export type FxRates = Record<CurrencyType, number>;

export const DEFAULT_FX_RATES: FxRates = {
  PEN: 1,
  USD: 3.50,
  EUR: 4.00,
};

export const BASE_CURRENCY: CurrencyType = 'PEN';

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

export function getFxRates(): FxRates {
  return readFromStorage();
}

export function setFxRates(rates: Partial<FxRates>): void {
  const merged = { ...readFromStorage(), ...rates, PEN: 1 };
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
    const token = await getToken();
    const res = await fetch(`${getAPIUrl()}/fx`, {
      headers: { Authorization: `Bearer ${token}` },
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

/** Convert a single amount to PEN (base). */
export function toBase(amount: number, currency: CurrencyType | undefined, rates?: FxRates): number {
  const r = rates || readFromStorage();
  const c = (currency || BASE_CURRENCY) as CurrencyType;
  const rate = r[c] || 1;
  return amount * rate;
}

/** Convenience for transactions — returns the PEN-equivalent amount. */
export function txBaseAmount(tx: Pick<Transaction, 'amount' | 'currency'>, rates?: FxRates): number {
  return toBase(tx.amount, tx.currency as CurrencyType | undefined, rates);
}

/**
 * Project a list of transactions into the base currency. The returned copies
 * have `amount` rewritten to PEN-equivalent and `currency` set to PEN — useful
 * for feeding the existing calculation helpers that assume a single currency.
 * The originals are NOT mutated; downstream UI that wants to show the source
 * amount + currency must read from the un-projected list.
 */
export function projectToBase(transactions: Transaction[], rates?: FxRates): Transaction[] {
  const r = rates || readFromStorage();
  return transactions.map(t => {
    if (!t.currency || t.currency === BASE_CURRENCY) return t;
    return { ...t, amount: txBaseAmount(t, r), currency: BASE_CURRENCY as CurrencyType };
  });
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
  const [rates, setRates] = useState<FxRates>(() => readFromStorage());
  useEffect(() => {
    const update = () => setRates(readFromStorage());
    update();
    return subscribe(update);
  }, []);
  return rates;
}
