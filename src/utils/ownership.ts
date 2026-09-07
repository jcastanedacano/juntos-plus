import { Owner, Transaction } from '../types';

export const OWNER_LABEL: Record<Owner, string> = {
  shared: 'Compartido',
  me: 'Yo',
  partner: 'Pareja',
};

export const OWNER_INITIAL: Record<Owner, string> = {
  shared: 'C',
  me: 'Y',
  partner: 'P',
};

// Tinted colors using the design tokens. Soft variants are used for
// chip backgrounds; the strong color is the foreground/icon color.
export const OWNER_COLOR: Record<Owner, { fg: string; soft: string }> = {
  shared:  { fg: 'var(--accent-green)', soft: 'var(--accent-green-soft)' },
  me:      { fg: 'var(--accent-blue)',  soft: 'var(--accent-blue-soft)' },
  partner: { fg: 'var(--accent-pink)',  soft: 'var(--accent-pink-soft)' },
};

export const OWNER_OPTIONS: Owner[] = ['shared', 'me', 'partner'];

export const ownerOf = (tx: Transaction): Owner => tx.owner || 'shared';

export interface OwnershipSplit {
  shared: { income: number; expense: number; count: number };
  me:     { income: number; expense: number; count: number };
  partner:{ income: number; expense: number; count: number };
  totalIncome: number;
  totalExpense: number;
}

export function calculateOwnershipSplit(transactions: Transaction[]): OwnershipSplit {
  const out: OwnershipSplit = {
    shared:  { income: 0, expense: 0, count: 0 },
    me:      { income: 0, expense: 0, count: 0 },
    partner: { income: 0, expense: 0, count: 0 },
    totalIncome: 0,
    totalExpense: 0,
  };
  for (const tx of transactions) {
    const o = ownerOf(tx);
    out[o].count += 1;
    if (tx.type === 'income') {
      out[o].income += tx.amount;
      out.totalIncome += tx.amount;
    } else {
      out[o].expense += tx.amount;
      out.totalExpense += tx.amount;
    }
  }
  return out;
}
