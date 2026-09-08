import { Transaction, CurrencyType } from '../types';
import { getMonedaBase } from './fxTasas';

export interface CurrencyBucket {
  currency: CurrencyType;
  income: number;
  expense: number;
  balance: number;
  count: number;
}

const CURRENCY_ORDER: CurrencyType[] = ['PEN', 'USD', 'EUR'];

/**
 * Un movimiento sin moneda esta en la del hogar. Estaba fijo en soles, y como
 * la hoja de registrar un gasto guarda sin moneda --que es el caso normal-- un
 * hogar en euros veia todos sus gastos agrupados como soles y anunciados como
 * «convertidos al tipo de cambio», con su simbolo y todo.
 */
const currencyOf = (t: Transaction): CurrencyType =>
  (t.currency as CurrencyType) || getMonedaBase();

/**
 * Split a list of transactions into per-currency aggregates. Caller decides
 * how to render (stacked, dominant + chip, etc). Buckets with zero activity
 * are dropped from the result.
 */
export function getCurrencyBreakdown(transactions: Transaction[]): CurrencyBucket[] {
  const map = new Map<CurrencyType, CurrencyBucket>();
  for (const t of transactions) {
    const c = currencyOf(t);
    const cur = map.get(c) || { currency: c, income: 0, expense: 0, balance: 0, count: 0 };
    if (t.type === 'income') cur.income += t.amount;
    else cur.expense += t.amount;
    cur.balance = cur.income - cur.expense;
    cur.count += 1;
    map.set(c, cur);
  }
  return Array.from(map.values()).sort((a, b) => {
    const ia = CURRENCY_ORDER.indexOf(a.currency);
    const ib = CURRENCY_ORDER.indexOf(b.currency);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

/** Currencies present in the data, in display order, dominant first. */
export function listCurrencies(transactions: Transaction[]): CurrencyType[] {
  const set = new Set<CurrencyType>();
  for (const t of transactions) set.add(currencyOf(t));
  return CURRENCY_ORDER.filter(c => set.has(c));
}

/** Filter transactions to a single currency. */
export function filterByCurrency(transactions: Transaction[], currency: CurrencyType): Transaction[] {
  return transactions.filter(t => currencyOf(t) === currency);
}
