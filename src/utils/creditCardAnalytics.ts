import { Account, RecurringTransaction, Transaction } from '../types';
import { parseDateOnly } from './stableDate';

// Default rates BCP charges on the Visa as of mid-2026. Used when the
// imported PDF didn't expose the rate (e.g. user hasn't run PDF import yet).
const DEFAULT_TEA_PEN = 0.9589;   // 95.89% annual
const DEFAULT_TEA_USD = 0.7690;   // 76.90% annual

export const teaToMonthly = (tea: number): number => Math.pow(1 + tea, 1 / 12) - 1;

export interface CreditSnapshot {
  account: Account;
  /** Outstanding balance in soles (sum of unpaid PEN expenses on this card). */
  saldoPEN: number;
  saldoUSD: number;
  creditLimit: number;
  utilization: number;        // 0..1
  paymentDueDate?: string;
  daysUntilDue?: number;
  pagoMinimoPEN: number;
  pagoTotalPEN: number;
  pagoMinimoUSD: number;
  pagoTotalUSD: number;
  teaPEN: number;             // e.g. 0.9589
  teaUSD: number;
  monthlyRatePEN: number;     // derived from tea
  monthlyRateUSD: number;
  /** Interest you'd pay over a single cycle if you only paid the minimum. */
  interestIfMinimumPEN: number;
  interestIfMinimumUSD: number;
  /** Income hint for the simulator — picked from the active "Sueldo" recurring. */
  monthlySalary?: number;
}

const isSalary = (r: RecurringTransaction): boolean => {
  if (r.type !== 'income' || !r.isActive) return false;
  const d = (r.description || '').toLowerCase();
  return /sueldo|salario|haberes|n[oó]mina/.test(d);
};

const getMonthlySalary = (recurring: RecurringTransaction[]): number | undefined => {
  const sueldo = recurring.find(isSalary);
  if (!sueldo) return undefined;
  switch (sueldo.frequency) {
    case 'monthly': return sueldo.amount;
    case 'weekly':  return sueldo.amount * 4.33;
    case 'daily':   return sueldo.amount * 30;
    case 'yearly':  return sueldo.amount / 12;
    default: return sueldo.amount;
  }
};

const daysUntil = (iso?: string): number | undefined => {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return undefined;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86_400_000);
};

export function computeCreditSnapshot(
  account: Account,
  transactions: Transaction[],
  recurring: RecurringTransaction[]
): CreditSnapshot {
  const stmt = account.latestStatement;

  // Saldo: prefer PDF-imported "Saldo Total" (or a manual edit the user
  // typed in from their BCP app); fall back to summing only the
  // current-cycle transactions so historical purchases from already-paid
  // cycles don't inflate the number.
  let saldoPEN: number;
  let saldoUSD: number;
  if (stmt?.saldoTotalPEN !== undefined || stmt?.saldoTotalUSD !== undefined) {
    saldoPEN = stmt.saldoTotalPEN || 0;
    saldoUSD = stmt.saldoTotalUSD || 0;
  } else {
    // Determine the current cycle window. Prefer the account's
    // statementCloseDay; if unknown, default to the last 30 days.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let cycleStart: Date;
    if (account.statementCloseDay) {
      const closeDay = account.statementCloseDay;
      const curDay = today.getDate();
      // Cycle started the day AFTER last statement close. If today is
      // past the close day this month, start = closeDay+1 of this month;
      // otherwise start = closeDay+1 of previous month.
      cycleStart = curDay > closeDay
        ? new Date(today.getFullYear(), today.getMonth(), closeDay + 1)
        : new Date(today.getFullYear(), today.getMonth() - 1, closeDay + 1);
    } else {
      cycleStart = new Date(today);
      cycleStart.setDate(cycleStart.getDate() - 30);
    }

    const inCycle = (t: Transaction): boolean => {
      const d = parseDateOnly(t.date);
      return d >= cycleStart;
    };
    const accountTx = transactions.filter(t => t.accountId === account.id && inCycle(t));
    const pen = accountTx.filter(t => (t.currency || 'PEN') === 'PEN');
    const usd = accountTx.filter(t => t.currency === 'USD');
    const sum = (arr: Transaction[]) =>
      arr.reduce((s, t) => s + (t.type === 'expense' ? t.amount : -t.amount), 0);
    saldoPEN = Math.max(sum(pen), 0);
    saldoUSD = Math.max(sum(usd), 0);
  }

  const creditLimit = account.creditLimit || 0;
  const utilization = creditLimit > 0 ? saldoPEN / creditLimit : 0;

  const pagoMinimoPEN = stmt?.pagoMinimoPEN ?? Math.round(saldoPEN * 0.10 * 100) / 100;
  const pagoTotalPEN = stmt?.pagoTotalPEN ?? saldoPEN;
  const pagoMinimoUSD = stmt?.pagoMinimoUSD ?? Math.round(saldoUSD * 0.10 * 100) / 100;
  const pagoTotalUSD = stmt?.pagoTotalUSD ?? saldoUSD;

  const teaPEN = stmt?.teaPEN ?? DEFAULT_TEA_PEN;
  const teaUSD = stmt?.teaUSD ?? DEFAULT_TEA_USD;
  const monthlyRatePEN = teaToMonthly(teaPEN);
  const monthlyRateUSD = teaToMonthly(teaUSD);

  // Interest if you only pay the minimum: charged on (saldo − pagoMinimo)
  // — the part that revolves into next cycle.
  const interestIfMinimumPEN = Math.max(saldoPEN - pagoMinimoPEN, 0) * monthlyRatePEN;
  const interestIfMinimumUSD = Math.max(saldoUSD - pagoMinimoUSD, 0) * monthlyRateUSD;

  return {
    account,
    saldoPEN,
    saldoUSD,
    creditLimit,
    utilization,
    paymentDueDate: stmt?.paymentDueDate,
    daysUntilDue: daysUntil(stmt?.paymentDueDate),
    pagoMinimoPEN,
    pagoTotalPEN,
    pagoMinimoUSD,
    pagoTotalUSD,
    teaPEN,
    teaUSD,
    monthlyRatePEN,
    monthlyRateUSD,
    interestIfMinimumPEN,
    interestIfMinimumUSD,
    monthlySalary: getMonthlySalary(recurring),
  };
}

// ─── Simulator ─────────────────────────────────────────────────────

export interface SimulationResult {
  paymentAmount: number;        // input
  remainingAfterPayment: number;
  /** Number of months to fully pay off the current balance keeping this
   *  monthly payment constant. Capped at 120 for sanity. */
  monthsToPayoff: number;
  /** Total interest paid across the payoff path. */
  totalInterest: number;
  /** Compared to "pay the minimum each month forever" baseline. */
  interestSavedVsMinimum: number;
  monthsSavedVsMinimum: number;
}

function projectPayoff(
  initialBalance: number,
  monthlyPayment: number,
  monthlyRate: number,
  maxMonths = 120
): { months: number; totalInterest: number } {
  if (initialBalance <= 0 || monthlyPayment <= 0) {
    return { months: 0, totalInterest: 0 };
  }
  let balance = initialBalance;
  let interestAcc = 0;
  let m = 0;
  while (balance > 0.01 && m < maxMonths) {
    const interest = balance * monthlyRate;
    interestAcc += interest;
    balance = balance + interest - monthlyPayment;
    m++;
    // If the payment doesn't cover the interest, we never pay off.
    if (balance >= initialBalance && m > 2) {
      return { months: maxMonths, totalInterest: interestAcc };
    }
  }
  return { months: m, totalInterest: interestAcc };
}

export function simulatePayment(
  snapshot: CreditSnapshot,
  paymentAmount: number
): SimulationResult {
  const balance = snapshot.saldoPEN;
  const remaining = Math.max(balance - paymentAmount, 0);
  const proposed = projectPayoff(balance, paymentAmount, snapshot.monthlyRatePEN);
  const baseline = projectPayoff(balance, snapshot.pagoMinimoPEN, snapshot.monthlyRatePEN);

  return {
    paymentAmount,
    remainingAfterPayment: remaining,
    monthsToPayoff: proposed.months,
    totalInterest: proposed.totalInterest,
    interestSavedVsMinimum: Math.max(baseline.totalInterest - proposed.totalInterest, 0),
    monthsSavedVsMinimum: Math.max(baseline.months - proposed.months, 0),
  };
}
