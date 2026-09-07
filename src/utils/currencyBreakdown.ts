import { Transaction, CurrencyType } from '../types';

export interface CurrencyBucket {
  currency: CurrencyType;
  income: number;
  expense: number;
  balance: number;
  count: number;
}

const CURRENCY_ORDER: CurrencyType[] = ['PEN', 'USD', 'EUR'];
export const DOMINANT_CURRENCY: CurrencyType = 'PEN';

const currencyOf = (t: Transaction): CurrencyType =>
  (t.currency as CurrencyType) || DOMINANT_CURRENCY;

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
