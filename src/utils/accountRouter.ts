import { Account, Transaction } from '../types';

const DEFAULT_ACCOUNT_ID = 'default';

const matchByLastFour = (accounts: Account[], lastFour?: string): Account | undefined => {
  if (!lastFour) return undefined;
  return accounts.find(a => a.lastFourDigits === lastFour);
};

const matchByType = (accounts: Account[], type: 'debit' | 'credit'): Account | undefined => {
  const pool = accounts.filter(a => a.type === type);
  if (pool.length === 1) return pool[0];
  // Multiple of the same type → user must disambiguate by lastFour; we
  // fall back to the first to avoid crashing.
  return pool[0];
};

// ─── Retroactive re-routing for already-imported transactions ──────
// Looks at the description prefix ("Débito - X", "Crédito - X", "Yape - X")
// and any "•••XXXX" / "terminada en XXXX" hint baked into the description.
// Targets only tx currently sitting on the 'default' account so we don't
// touch anything the user manually assigned.

const PREFIX_TO_TYPE: Record<string, 'debit' | 'credit'> = {
  'débito': 'debit',
  'debito': 'debit',
  'crédito': 'credit',
  'credito': 'credit',
  'yape': 'debit',
  'yapeo': 'debit',
  'qr': 'debit',
};

const LAST_FOUR_RE = /(?:terminada\s+en|terminad[ao]\s+en|•+|\*+|N[º°o]?\.?\s*)\s*(\d{4})\b/i;

function inferFromDescription(desc: string): { type: 'debit' | 'credit' | null; lastFour?: string } {
  const lower = (desc || '').toLowerCase();
  let type: 'debit' | 'credit' | null = null;
  for (const key of Object.keys(PREFIX_TO_TYPE)) {
    if (lower.startsWith(key) || lower.includes(`- ${key}`)) {
      type = PREFIX_TO_TYPE[key];
      break;
    }
  }
  const m = desc.match(LAST_FOUR_RE);
  return { type, lastFour: m ? m[1] : undefined };
}

export interface RouteRetroResult {
  updated: Transaction[];
  reassignedCount: number;
}

/**
 * Re-route every transaction currently on 'default' account based on
 * what we can infer from its description. Returns a fresh array with
 * accountId rewritten where a match was found.
 */
export function routeExistingTransactions(
  transactions: Transaction[],
  accounts: Account[]
): RouteRetroResult {
  if (accounts.length === 0) {
    return { updated: transactions, reassignedCount: 0 };
  }
  let reassigned = 0;
  const updated = transactions.map(t => {
    if (t.accountId && t.accountId !== DEFAULT_ACCOUNT_ID) return t;
    const inf = inferFromDescription(t.description);
    let target: Account | undefined = matchByLastFour(accounts, inf.lastFour);
    if (!target && inf.type) target = matchByType(accounts, inf.type);
    if (target && target.id !== t.accountId) {
      reassigned++;
      return { ...t, accountId: target.id };
    }
    return t;
  });
  return { updated, reassignedCount: reassigned };
}
