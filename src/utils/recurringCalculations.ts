import { RecurringTransaction } from '../types';
import { addDays, addWeeks, addMonths, addYears, subMonths, startOfMonth, endOfMonth, isWithinInterval, differenceInDays, format } from 'date-fns';

/**
 * Convert any recurring amount to its monthly equivalent.
 */
export function toMonthlyAmount(r: RecurringTransaction): number {
  switch (r.frequency) {
    case 'daily': return r.amount * 30;
    case 'weekly': return r.amount * 4.33;
    case 'yearly': return r.amount / 12;
    default: return r.amount; // monthly
  }
}

/**
 * Get the next charge date from today (or from a reference date).
 */
export function getNextCharge(r: RecurringTransaction, from?: Date): Date {
  let next = new Date(r.nextDate);
  const ref = from || new Date();
  while (next < ref) {
    switch (r.frequency) {
      case 'daily': next = addDays(next, 1); break;
      case 'weekly': next = addWeeks(next, 1); break;
      case 'monthly': next = addMonths(next, 1); break;
      case 'yearly': next = addYears(next, 1); break;
    }
  }
  return next;
}

/**
 * Get all charge dates for a recurring transaction within a given month.
 */
export function getChargesInMonth(r: RecurringTransaction, month: Date): Date[] {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const charges: Date[] = [];

  let current = new Date(r.nextDate);
  // Rewind to before the month if needed
  while (current > end) {
    switch (r.frequency) {
      case 'daily': current = addDays(current, -1); break;
      case 'weekly': current = addWeeks(current, -1); break;
      case 'monthly': current = addMonths(current, -1); break;
      case 'yearly': current = addYears(current, -1); break;
    }
  }
  // Go back one more step to ensure we start before the month
  while (current >= start) {
    switch (r.frequency) {
      case 'daily': current = addDays(current, -1); break;
      case 'weekly': current = addWeeks(current, -1); break;
      case 'monthly': current = addMonths(current, -1); break;
      case 'yearly': current = addYears(current, -1); break;
    }
  }
  // nextDate is the FIRST upcoming charge. Anything earlier either already
  // happened — and then it lives in `transactions`, not here — or never
  // happened at all. The rewind above is only a way to find the cadence
  // anchor, so charges before nextDate are an artifact of the algorithm and
  // must not be emitted: they render as real money in the calendar and read
  // like a balance being dragged in from previous months.
  const floor = new Date(r.nextDate);

  // Now advance through the month
  while (current <= end) {
    switch (r.frequency) {
      case 'daily': current = addDays(current, 1); break;
      case 'weekly': current = addWeeks(current, 1); break;
      case 'monthly': current = addMonths(current, 1); break;
      case 'yearly': current = addYears(current, 1); break;
    }
    if (current < floor) continue;
    if (isWithinInterval(current, { start, end })) {
      charges.push(new Date(current));
    }
  }

  return charges;
}

/**
 * Health score for recurring transactions (0-100).
 * Considers: diversity, balance ratio, price increases, paused ratio.
 */
export function calculateRecurringHealthScore(recurring: RecurringTransaction[]): {
  score: number;
  label: string;
  color: string;
  alerts: string[];
} {
  if (recurring.length === 0) {
    return { score: 100, label: 'Sin datos', color: 'var(--rec-text-muted)', alerts: [] };
  }

  const alerts: string[] = [];
  const active = recurring.filter(r => r.isActive);
  const totalMonthlyIncome = active.filter(r => r.type === 'income').reduce((s, r) => s + toMonthlyAmount(r), 0);
  const totalMonthlyExpense = active.filter(r => r.type === 'expense').reduce((s, r) => s + toMonthlyAmount(r), 0);

  // 1. Balance ratio (30 pts): income should cover expenses
  let balanceScore = 30;
  if (totalMonthlyIncome > 0) {
    const ratio = totalMonthlyExpense / totalMonthlyIncome;
    balanceScore = Math.max(0, Math.min(30, (1 - ratio) * 60));
  } else if (totalMonthlyExpense > 0) {
    balanceScore = 0;
    alerts.push('No tienes ingresos recurrentes para cubrir tus gastos fijos');
  }

  // 2. Diversity (25 pts): not too concentrated in one category
  const categories = new Set(active.filter(r => r.type === 'expense').map(r => r.category));
  const diversityScore = Math.min(25, categories.size * 5);

  // 3. Price increases (25 pts): fewer is better
  let increaseCount = 0;
  for (const r of active) {
    if (r.previousAmounts && r.previousAmounts.length > 0) {
      const lastPrice = r.previousAmounts[r.previousAmounts.length - 1].amount;
      if (r.amount > lastPrice) increaseCount++;
    }
  }
  const increaseRatio = active.length > 0 ? increaseCount / active.length : 0;
  const increaseScore = Math.max(0, 25 - increaseRatio * 50);
  if (increaseCount > 0) {
    alerts.push(`${increaseCount} suscripci${increaseCount === 1 ? 'ón ha' : 'ones han'} subido de precio`);
  }

  // 4. Paused ratio (20 pts): too many paused = clutter
  const pausedRatio = recurring.length > 0 ? (recurring.length - active.length) / recurring.length : 0;
  const pausedScore = pausedRatio > 0.5 ? 10 : 20;
  if (pausedRatio > 0.3) {
    alerts.push('Considera eliminar las suscripciones pausadas que ya no necesitas');
  }

  // Duplicates check
  const dupes = detectPossibleDuplicates(recurring);
  if (dupes.length > 0) {
    alerts.push(`${dupes.length} posible${dupes.length === 1 ? '' : 's'} duplicado${dupes.length === 1 ? '' : 's'} detectado${dupes.length === 1 ? '' : 's'}`);
  }

  const score = Math.round(balanceScore + diversityScore + increaseScore + pausedScore);
  let label: string;
  let color: string;
  if (score >= 80) { label = 'Excelente'; color = 'var(--rec-success)'; }
  else if (score >= 60) { label = 'Buena'; color = 'var(--rec-info)'; }
  else if (score >= 40) { label = 'Regular'; color = 'var(--warning)'; }
  else { label = 'En riesgo'; color = 'var(--rec-danger)'; }

  return { score, label, color, alerts };
}

/**
 * Calculate how much you'd save monthly if paused items stayed paused.
 */
export function savingsIfPaused(recurring: RecurringTransaction[]): number {
  return recurring
    .filter(r => !r.isActive && r.type === 'expense')
    .reduce((sum, r) => sum + toMonthlyAmount(r), 0);
}

/**
 * Detect possible duplicates by matching description similarity.
 */
export function detectPossibleDuplicates(recurring: RecurringTransaction[]): [RecurringTransaction, RecurringTransaction][] {
  const dupes: [RecurringTransaction, RecurringTransaction][] = [];
  for (let i = 0; i < recurring.length; i++) {
    for (let j = i + 1; j < recurring.length; j++) {
      const a = recurring[i].description.toLowerCase().trim();
      const b = recurring[j].description.toLowerCase().trim();
      if (
        a === b ||
        (a.length > 3 && b.length > 3 && (a.includes(b) || b.includes(a)))
      ) {
        if (recurring[i].category === recurring[j].category) {
          dupes.push([recurring[i], recurring[j]]);
        }
      }
    }
  }
  return dupes;
}

/**
 * Get price change percentage from previous amounts.
 */
export function getPriceChangePercentage(r: RecurringTransaction): number | null {
  if (!r.previousAmounts || r.previousAmounts.length === 0) return null;
  const lastPrice = r.previousAmounts[r.previousAmounts.length - 1].amount;
  if (lastPrice === 0) return null;
  return ((r.amount - lastPrice) / lastPrice) * 100;
}

/**
 * Get monthly totals for active recurring by type over N months.
 */
export function getMonthlyTotals(
  recurring: RecurringTransaction[],
  months: number = 12,
  refDate?: Date
): { month: string; income: number; expense: number }[] {
  const ref = refDate || new Date();
  const active = recurring.filter(r => r.isActive);
  const result: { month: string; income: number; expense: number }[] = [];

  for (let i = 0; i < months; i++) {
    const m = addMonths(ref, i);
    const monthLabel = format(m, 'MMM yyyy');
    let income = 0;
    let expense = 0;

    for (const r of active) {
      const charges = getChargesInMonth(r, m);
      const total = charges.length * r.amount;
      if (r.type === 'income') income += total;
      else expense += total;
    }

    result.push({ month: monthLabel, income, expense });
  }

  return result;
}

/**
 * Generate simulated charge history (projected backward from nextDate).
 */
export function generateChargeHistory(r: RecurringTransaction, count: number = 12): { date: string; amount: number }[] {
  const history: { date: string; amount: number }[] = [];
  let current = new Date(r.nextDate);

  for (let i = 0; i < count; i++) {
    switch (r.frequency) {
      case 'daily': current = addDays(current, -1); break;
      case 'weekly': current = addWeeks(current, -1); break;
      case 'monthly': current = addMonths(current, -1); break;
      case 'yearly': current = addYears(current, -1); break;
    }

    // Use historical price if available
    const histEntry = r.previousAmounts?.find(p => {
      const pDate = new Date(p.date);
      return pDate <= current;
    });
    history.push({
      date: format(current, 'yyyy-MM-dd'),
      amount: histEntry?.amount ?? r.amount,
    });
  }

  return history.reverse();
}

/**
 * Days until next charge.
 */
export function daysUntilNextCharge(r: RecurringTransaction): number {
  const next = getNextCharge(r);
  return Math.max(0, differenceInDays(next, new Date()));
}
