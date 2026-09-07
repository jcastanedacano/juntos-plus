import { addDays, addWeeks, addMonths, addYears, differenceInDays, subDays, subWeeks, subMonths, subYears } from 'date-fns';
import { Transaction, RecurringTransaction } from '../types';
import { toStableDateISO, parseDateOnly } from './stableDate';

export interface BulkMatchResult {
  /** Transactions with sourceRecurringId set when a match was found. */
  taggedTransactions: Transaction[];
  /** Updated recurring list — matched items have advanced nextDate +
   *  isActive=false + pausedUntil set. */
  updatedRecurring: RecurringTransaction[];
  /** Matches detected, in the order they were applied. */
  matches: Array<{
    txId: string;
    recurringId: string;
    recurringDescription: string;
    newNextDate: string;
    priceChanged: boolean;
    oldAmount: number;
    newAmount: number;
  }>;
}

// Used when bulk-importing or sync'ing many transactions at once.
// Each new tx is matched at most once; each recurring item can absorb
// many transactions over time but only ONE tx per call.
export function applyEarlyPaymentMatchesBulk(
  newTxs: Transaction[],
  recurring: RecurringTransaction[]
): BulkMatchResult {
  let working = [...recurring];
  const tagged: Transaction[] = [];
  const matches: BulkMatchResult['matches'] = [];

  // Walk in chronological order so earlier dates lock the match first
  // and later identical-amount tx don't accidentally re-match the same
  // recurring item.
  const sorted = [...newTxs].sort(
    (a, b) => parseDateOnly(a.date).getTime() - parseDateOnly(b.date).getTime()
  );

  for (const tx of sorted) {
    const m = findMatchingRecurring(tx, working);
    if (!m) {
      tagged.push(tx);
      continue;
    }

    tagged.push({ ...tx, sourceRecurringId: m.recurring.id });

    const recordingPriceChange = m.priceChanged;
    const newAmount = recordingPriceChange ? tx.amount : m.recurring.amount;

    // Only advance + pause when the user paid the UPCOMING cycle (early).
    // If the match was against the PREVIOUS already-billed cycle, just
    // link + (optionally) update the price — don't touch nextDate or
    // pause the recurring, since the engine already auto-advanced.
    const newNextDateISO = m.isUpcoming
      ? toStableDateISO(advanceOnePeriod(m.recurring))
      : m.recurring.nextDate;

    working = working.map(r => {
      if (r.id !== m.recurring.id) return r;
      const base: RecurringTransaction = { ...r };
      if (m.isUpcoming) {
        base.nextDate = newNextDateISO;
        base.isActive = false;
        base.pausedUntil = newNextDateISO;
      }
      if (recordingPriceChange) {
        base.amount = tx.amount;
        const history = r.previousAmounts || [];
        base.previousAmounts = [
          ...history,
          { date: tx.date, amount: m.oldAmount },
        ];
      }
      return base;
    });

    matches.push({
      txId: tx.id,
      recurringId: m.recurring.id,
      recurringDescription: m.recurring.description,
      newNextDate: newNextDateISO,
      priceChanged: recordingPriceChange,
      oldAmount: m.oldAmount,
      newAmount,
    });
  }

  // Preserve the original order of newTxs in the return value, but with
  // any sourceRecurringId tags applied.
  const tagMap = new Map(tagged.map(t => [t.id, t]));
  const finalTxs = newTxs.map(t => tagMap.get(t.id) || t);

  return {
    taggedTransactions: finalTxs,
    updatedRecurring: working,
    matches,
  };
}

/**
 * Retroactively reconcile transactions that were imported BEFORE the
 * matcher learned to handle a particular case (e.g. tier-B price drift).
 * Targets only transactions without sourceRecurringId — those that
 * never got linked to a recurring item. Runs the same bulk matcher and
 * returns updated arrays.
 *
 * Use after a sync once the new tx have been merged in, so existing
 * un-linked rows get a fresh attempt at matching.
 */
export function reconcileUnlinkedTransactions(
  allTransactions: Transaction[],
  recurring: RecurringTransaction[]
): BulkMatchResult {
  const unlinked = allTransactions.filter(t => !t.sourceRecurringId);
  const bulk = applyEarlyPaymentMatchesBulk(unlinked, recurring);
  const tagMap = new Map(bulk.taggedTransactions.map(t => [t.id, t]));
  return {
    taggedTransactions: allTransactions.map(t => tagMap.get(t.id) || t),
    updatedRecurring: bulk.updatedRecurring,
    matches: bulk.matches,
  };
}

/**
 * Advance a recurring item's nextDate by exactly ONE frequency step.
 * Different from getNextCharge() which only advances when nextDate is in the
 * past — this one always pushes forward, which is what we want when the user
 * pays the upcoming charge early.
 */
export function advanceOnePeriod(r: RecurringTransaction): Date {
  const next = new Date(r.nextDate);
  switch (r.frequency) {
    case 'daily':   return addDays(next, 1);
    case 'weekly':  return addWeeks(next, 1);
    case 'monthly': return addMonths(next, 1);
    case 'yearly':  return addYears(next, 1);
  }
}

/** Step nextDate backwards one period — used to figure out the date the
 *  previous cycle billed on. */
function rewindOnePeriod(r: RecurringTransaction): Date {
  const next = new Date(r.nextDate);
  switch (r.frequency) {
    case 'daily':   return subDays(next, 1);
    case 'weekly':  return subWeeks(next, 1);
    case 'monthly': return subMonths(next, 1);
    case 'yearly':  return subYears(next, 1);
  }
}

const stripDescription = (s: string): string =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const tokens = (s: string): string[] =>
  stripDescription(s).split(/\s+/).filter(t => t.length >= 3);

// 0..1 — Jaccard-style overlap of meaningful tokens between two strings.
function descriptionScore(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.min(ta.size, tb.size);
}

interface MatchResult {
  recurring: RecurringTransaction;
  confidence: number;       // 0..1
  daysFromNextDate: number; // negative = early, 0 = on time, positive = late
  /** True when the matched amount drifted outside the tight ±10% band — caller
   *  should update recurring.amount and append the old value to
   *  previousAmounts to keep a price history. */
  priceChanged: boolean;
  oldAmount: number;
  /** When true, the tx is the user paying the UPCOMING cycle early — caller
   *  advances nextDate one period and pauses until then.
   *  When false, the tx matches the PREVIOUS already-billed cycle (the
   *  recurring auto-advanced to the next month already) — only link +
   *  price-update, do NOT pause or re-advance. */
  isUpcoming: boolean;
}

const AMOUNT_TOLERANCE_TIGHT = 0.10; // ±10% — same charge confidence
const AMOUNT_TOLERANCE_LOOSE = 0.30; // ±30% — only with a strong description match
const DESC_SCORE_TIGHT = 0.5;
const DESC_SCORE_STRONG = 0.7;       // required for the loose-amount tier
const WINDOW_DAYS_BEFORE = 14;
const WINDOW_DAYS_AFTER = 7;

/**
 * Decide whether `tx` looks like a payment for an active recurring item.
 * Returns the best match (if any) — caller uses this to:
 *   - link tx.sourceRecurringId
 *   - advance recurring.nextDate by one period
 *
 * Heuristic:
 *   - Same type (income/expense)
 *   - Active recurring item
 *   - Amount within ±10% of recurring.amount (or exact for small amounts)
 *   - Description tokens overlap ≥ 50% with recurring.description
 *   - Tx date within [nextDate - 14d, nextDate + 7d]
 */
export function findMatchingRecurring(
  tx: Pick<Transaction, 'type' | 'amount' | 'description' | 'date' | 'sourceRecurringId'>,
  recurring: RecurringTransaction[]
): MatchResult | null {
  // Already linked → don't try to re-match.
  if (tx.sourceRecurringId) return null;

  const txDate = parseDateOnly(tx.date);
  if (isNaN(txDate.getTime())) return null;

  let best: MatchResult | null = null;

  for (const r of recurring) {
    if (!r.isActive) continue;
    if (r.type !== tx.type) continue;

    const refAmt = r.amount;
    if (refAmt <= 0) continue;
    const diffPct = Math.abs(tx.amount - refAmt) / refAmt;

    // Two acceptance windows:
    //   - Upcoming-cycle window: txDate within [nextDate − 14d, nextDate + 7d]
    //     → user paid the next charge early
    //   - Previous-cycle window: txDate within [previousDate − 7d, previousDate + 14d]
    //     → recurring already auto-advanced; tx is the just-billed cycle
    const next = new Date(r.nextDate);
    const prev = rewindOnePeriod(r);
    const daysFromNext = differenceInDays(txDate, next);
    const daysFromPrev = differenceInDays(txDate, prev);

    const inUpcomingWindow =
      daysFromNext >= -WINDOW_DAYS_BEFORE && daysFromNext <= WINDOW_DAYS_AFTER;
    const inPreviousWindow =
      daysFromPrev >= -WINDOW_DAYS_AFTER && daysFromPrev <= WINDOW_DAYS_BEFORE;

    if (!inUpcomingWindow && !inPreviousWindow) continue;

    // Pick the window that fits better (whichever has the smaller absolute
    // distance) — feeds the "isUpcoming" flag downstream.
    const isUpcoming = inUpcomingWindow &&
      (!inPreviousWindow || Math.abs(daysFromNext) <= Math.abs(daysFromPrev));
    const days = isUpcoming ? daysFromNext : daysFromPrev;

    const descScore = descriptionScore(tx.description, r.description);

    // Two-tier acceptance:
    //   A) tight amount (≤10%) + decent description (≥0.5) — same charge.
    //   B) loose amount (≤30%) but strong description (≥0.7) — price changed.
    let acceptable: 'tight' | 'loose' | null = null;
    if (diffPct <= AMOUNT_TOLERANCE_TIGHT && descScore >= DESC_SCORE_TIGHT) {
      acceptable = 'tight';
    } else if (diffPct <= AMOUNT_TOLERANCE_LOOSE && descScore >= DESC_SCORE_STRONG) {
      acceptable = 'loose';
    }
    if (!acceptable) continue;

    // Confidence: description quality + proximity to nextDate, minus a
    // penalty for a wide amount drift (so a perfect-amount match wins
    // over a +20% drift when both have similar description).
    const proximity = 1 - Math.min(Math.abs(days) / WINDOW_DAYS_BEFORE, 1);
    const amountFit = 1 - Math.min(diffPct / AMOUNT_TOLERANCE_LOOSE, 1);
    const confidence = 0.5 * descScore + 0.3 * proximity + 0.2 * amountFit;

    if (!best || confidence > best.confidence) {
      best = {
        recurring: r,
        confidence,
        daysFromNextDate: days,
        priceChanged: acceptable === 'loose',
        oldAmount: refAmt,
        isUpcoming,
      };
    }
  }

  return best;
}
