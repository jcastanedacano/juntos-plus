import { Transaction, DetectedSubscription, SubscriptionAlert, RecurringTransaction } from '../types';
import { normalizeDescription } from './descriptionNormalizer';
import { toDateInputValue } from './stableDate';
import { addDays, addMonths, addQuarters, addYears, differenceInDays, format, isWithinInterval, startOfDay } from 'date-fns';
import { parseDateOnly } from './stableDate';

interface MerchantGroup {
  normalizedName: string;
  category: string;
  transactions: Transaction[];
}

function groupByMerchant(transactions: Transaction[]): MerchantGroup[] {
  const groups = new Map<string, MerchantGroup>();
  const expenses = transactions.filter(t => t.type === 'expense');

  for (const tx of expenses) {
    const normalized = normalizeDescription(tx.description);
    const key = normalized.normalizedName.toLowerCase();

    if (!groups.has(key)) {
      groups.set(key, {
        normalizedName: normalized.normalizedName,
        category: normalized.suggestedCategory || tx.category,
        transactions: [],
      });
    }
    groups.get(key)!.transactions.push(tx);
  }

  return Array.from(groups.values());
}

type DetectedFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

function detectFrequency(intervals: number[]): { frequency: DetectedFrequency; score: number } | null {
  if (intervals.length < 1) return null;

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

  // Weekly: 5–9 days (7 ± 2)
  const weeklyDev = intervals.map(i => Math.abs(i - 7));
  const avgWeeklyDev = weeklyDev.reduce((a, b) => a + b, 0) / weeklyDev.length;
  if (avgInterval >= 5 && avgInterval <= 9 && avgWeeklyDev < 2) {
    return { frequency: 'weekly', score: Math.max(0, 1 - avgWeeklyDev / 7) };
  }

  // Monthly: 26–33 days (30 ± 4) — covers Feb-Mar variation
  const monthlyDev = intervals.map(i => Math.abs(i - 30));
  const avgMonthlyDev = monthlyDev.reduce((a, b) => a + b, 0) / monthlyDev.length;
  if (avgInterval >= 26 && avgInterval <= 33 && avgMonthlyDev < 5) {
    return { frequency: 'monthly', score: Math.max(0, 1 - avgMonthlyDev / 30) };
  }

  // Quarterly: 85–97 days (91 ± 6)
  const quarterlyDev = intervals.map(i => Math.abs(i - 91));
  const avgQuarterlyDev = quarterlyDev.reduce((a, b) => a + b, 0) / quarterlyDev.length;
  if (avgInterval >= 85 && avgInterval <= 97 && avgQuarterlyDev < 8) {
    return { frequency: 'quarterly', score: Math.max(0, 1 - avgQuarterlyDev / 91) };
  }

  // Yearly: 355–375 days (365 ± 10)
  const yearlyDev = intervals.map(i => Math.abs(i - 365));
  const avgYearlyDev = yearlyDev.reduce((a, b) => a + b, 0) / yearlyDev.length;
  if (avgInterval >= 355 && avgInterval <= 375 && avgYearlyDev < 12) {
    return { frequency: 'yearly', score: Math.max(0, 1 - avgYearlyDev / 365) };
  }

  return null;
}

function checkAmountConsistency(amounts: number[]): { consistent: boolean; score: number } {
  if (amounts.length < 2) return { consistent: true, score: 0.5 };

  const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const maxDeviation = Math.max(...amounts.map(a => Math.abs(a - avg) / avg));

  // Tolerance: ±15% (requested range 10–15%)
  return {
    consistent: maxDeviation <= 0.15,
    score: Math.max(0, 1 - maxDeviation / 0.15),
  };
}

function detectAlerts(group: MerchantGroup): SubscriptionAlert[] {
  const alerts: SubscriptionAlert[] = [];
  const sorted = [...group.transactions].sort(
    (a, b) => parseDateOnly(a.date).getTime() - parseDateOnly(b.date).getTime()
  );

  if (sorted.length < 2) return alerts;

  // ── Price increase (last two charges differ >5%) ──────────────
  const lastTwo = sorted.slice(-2);
  if (lastTwo[1].amount > lastTwo[0].amount * 1.05) {
    const increase = ((lastTwo[1].amount - lastTwo[0].amount) / lastTwo[0].amount * 100).toFixed(0);
    alerts.push({
      type: 'price_increase',
      message: `Subió ${increase}% (de ${lastTwo[0].amount.toFixed(2)} a ${lastTwo[1].amount.toFixed(2)})`,
      severity: 'warning',
      date: lastTwo[1].date,
    });
  }

  // ── Double charge (same month, same amount) ───────────────────
  const byMonth = new Map<string, Transaction[]>();
  for (const tx of sorted) {
    const month = tx.date.slice(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month)!.push(tx);
  }
  for (const [month, txs] of byMonth) {
    if (txs.length > 1) {
      const sameAmount = txs.filter(t => Math.abs(t.amount - txs[0].amount) < 0.01);
      if (sameAmount.length > 1) {
        alerts.push({
          type: 'double_charge',
          message: `Posible cobro doble en ${month}`,
          severity: 'danger',
          date: txs[txs.length - 1].date,
        });
      }
    }
  }

  return alerts;
}

function detectMissingChargeAlert(
  lastChargeDate: string,
  nextExpectedDate: string,
  frequency: DetectedFrequency
): SubscriptionAlert | null {
  const today = new Date();
  const nextDate = new Date(nextExpectedDate);
  const graceDays = frequency === 'yearly' ? 14 : frequency === 'quarterly' ? 10 : 6;

  const daysPastDue = differenceInDays(today, nextDate);
  if (daysPastDue > graceDays) {
    return {
      type: 'missing_charge',
      message: `Cobro esperado hace ${daysPastDue} días (${new Date(nextExpectedDate).toLocaleDateString('es-PE')}), no detectado`,
      severity: 'warning',
      date: nextExpectedDate,
    };
  }
  return null;
}

export function getNextExpectedDate(
  lastDate: string,
  frequency: DetectedFrequency
): string {
  // parseDateOnly y no new Date(): "2026-09-07" como UTC cae el 6 en Lima, y
  // format() vuelve a escribirlo en local, asi que cada vuelta del bucle
  // restaba un dia mas.
  const date = parseDateOnly(lastDate);
  let next: Date;
  switch (frequency) {
    case 'weekly':    next = addDays(date, 7);      break;
    case 'monthly':   next = addMonths(date, 1);    break;
    case 'quarterly': next = addQuarters(date, 1);  break;
    case 'yearly':    next = addYears(date, 1);     break;
  }
  return format(next, 'yyyy-MM-dd');
}

// ─── Calendar helper ─────────────────────────────────────────────────────

export interface UpcomingCharge {
  date: string;              // yyyy-MM-dd
  subscription: DetectedSubscription;
  amount: number;
}

export function getUpcomingChargesIn30Days(subscriptions: DetectedSubscription[]): UpcomingCharge[] {
  // Comparar contra el inicio del dia y no contra la hora actual: un cobro
  // de hoy no debe quedar fuera solo porque ya pasaron las 11 de la maniana.
  const today = startOfDay(new Date());
  const end = addDays(today, 30);
  const charges: UpcomingCharge[] = [];

  for (const sub of subscriptions.filter(s => !s.isDismissed)) {
    // Walk forward from the next expected date, generating occurrences within [today, end]
    let current = parseDateOnly(sub.nextExpectedDate);

    // If the first occurrence is already past, advance to a future one
    while (current < today) {
      current = parseDateOnly(getNextExpectedDate(format(current, 'yyyy-MM-dd'), sub.frequency));
    }

    // Collect all occurrences within 30 days
    while (current <= end) {
      charges.push({
        date: format(current, 'yyyy-MM-dd'),
        subscription: sub,
        amount: sub.estimatedAmount,
      });
      current = parseDateOnly(getNextExpectedDate(format(current, 'yyyy-MM-dd'), sub.frequency));
    }
  }

  return charges.sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Main detector ───────────────────────────────────────────────────────

export function detectSubscriptions(transactions: Transaction[]): DetectedSubscription[] {
  const groups = groupByMerchant(transactions);
  const subscriptions: DetectedSubscription[] = [];

  for (const group of groups) {
    if (group.transactions.length < 2) continue;

    const sorted = [...group.transactions].sort(
      (a, b) => parseDateOnly(a.date).getTime() - parseDateOnly(b.date).getTime()
    );

    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(differenceInDays(parseDateOnly(sorted[i].date), parseDateOnly(sorted[i - 1].date)));
    }

    const frequencyResult = detectFrequency(intervals);
    if (!frequencyResult) continue;

    const amounts = sorted.map(t => t.amount);
    const amountCheck = checkAmountConsistency(amounts);

    // Skip if amount is wildly inconsistent (even with ±15% tolerance)
    if (!amountCheck.consistent && amountCheck.score < 0.2) continue;

    // Confidence scoring
    let confidenceScore = 0;
    confidenceScore += frequencyResult.score * 40;   // 40%: frequency regularity
    confidenceScore += amountCheck.score * 30;        // 30%: amount consistency
    const occurrenceScore = Math.min(sorted.length / 6, 1);
    confidenceScore += occurrenceScore * 30;          // 30%: number of occurrences

    confidenceScore = Math.round(confidenceScore);
    if (confidenceScore < 25) continue;

    const confidence: 'high' | 'medium' | 'low' =
      confidenceScore >= 70 ? 'high' :
      confidenceScore >= 40 ? 'medium' : 'low';

    const lastTx = sorted[sorted.length - 1];
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
    const totalLast12 = sorted
      .filter(t => parseDateOnly(t.date) >= twelveMonthsAgo)
      .reduce((s, t) => s + t.amount, 0);

    const nextExpectedDate = getNextExpectedDate(lastTx.date, frequencyResult.frequency);
    const alerts = detectAlerts(group);

    // Missing charge alert
    const missingAlert = detectMissingChargeAlert(lastTx.date, nextExpectedDate, frequencyResult.frequency);
    if (missingAlert) alerts.push(missingAlert);

    subscriptions.push({
      id: `sub_${group.normalizedName.toLowerCase().replace(/\s+/g, '_')}_${sorted[0].date}`,
      merchantName: group.transactions[0].description,
      normalizedName: group.normalizedName,
      category: group.category,
      estimatedAmount: Math.round(avgAmount * 100) / 100,
      frequency: frequencyResult.frequency,
      confidence,
      confidenceScore,
      lastChargeDate: lastTx.date,
      nextExpectedDate,
      totalLast12Months: Math.round(totalLast12 * 100) / 100,
      chargeCount: sorted.length,
      transactionIds: sorted.map(t => t.id),
      alerts,
      isConfirmed: false,
      isDismissed: false,
    });
  }

  return subscriptions.sort((a, b) => b.confidenceScore - a.confidenceScore);
}

// --- Recurrentes declarados como suscripciones ---------------------------
//
// detectSubscriptions() solo mina el historial de transacciones y exige al
// menos 2 cargos del mismo comercio. Netflix, Spotify y compania viven en la
// coleccion `recurring`, declarados a mano: no habia forma de que aparecieran
// en Suscripciones ni en el Centro de Ahorro, por muchos que hubiera.
// Un recurrente declarado es mejor evidencia que un patron inferido.

const MONTHS_PER_YEAR = 12;

function recurringFrequency(f: RecurringTransaction['frequency']): {
  frequency: DetectedFrequency;
  multiplier: number;
} {
  // DetectedSubscription no contempla 'daily'. Se expresa como semanal por 7
  // para conservar el equivalente mensual (7 x 4.33 ~ 30).
  if (f === 'daily') return { frequency: 'weekly', multiplier: 7 };
  if (f === 'weekly') return { frequency: 'weekly', multiplier: 1 };
  if (f === 'yearly') return { frequency: 'yearly', multiplier: 1 };
  return { frequency: 'monthly', multiplier: 1 };
}

function monthlyEquivalent(amount: number, f: DetectedFrequency): number {
  switch (f) {
    case 'weekly': return amount * 4.33;
    case 'quarterly': return amount / 3;
    case 'yearly': return amount / MONTHS_PER_YEAR;
    default: return amount;
  }
}

/** Da el ultimo cobro retrocediendo un periodo desde el proximo. */
function previousChargeDate(nextDay: string, frequency: DetectedFrequency): string {
  const d = new Date(nextDay + 'T12:00:00.000Z');
  switch (frequency) {
    case 'weekly': d.setUTCDate(d.getUTCDate() - 7); break;
    case 'monthly': d.setUTCMonth(d.getUTCMonth() - 1); break;
    case 'quarterly': d.setUTCMonth(d.getUTCMonth() - 3); break;
    case 'yearly': d.setUTCFullYear(d.getUTCFullYear() - 1); break;
  }
  return d.toISOString().slice(0, 10);
}

export function recurringToSubscription(r: RecurringTransaction): DetectedSubscription {
  const { frequency, multiplier } = recurringFrequency(r.frequency);
  const estimatedAmount = r.amount * multiplier;
  const nextDay = toDateInputValue(r.nextDate) || String(r.nextDate).slice(0, 10);

  const alerts: SubscriptionAlert[] = [];
  const prev = r.previousAmounts;
  if (prev && prev.length > 0) {
    const last = prev[prev.length - 1];
    if (r.amount > last.amount) {
      const pct = last.amount > 0 ? ((r.amount - last.amount) / last.amount) * 100 : 0;
      alerts.push({
        type: 'price_increase',
        message: `Subio de ${last.amount.toFixed(2)} a ${r.amount.toFixed(2)} (${pct.toFixed(0)}%)`,
        severity: pct >= 20 ? 'danger' : 'warning',
        date: nextDay,
      });
    }
  }

  return {
    // Prefijo para no chocar con los ids que genera el detector.
    id: `rec_${r.id}`,
    merchantName: r.description,
    normalizedName: r.description,
    category: r.category,
    estimatedAmount,
    frequency,
    // Lo declaro el usuario: no es una inferencia, es un hecho.
    confidence: 'high',
    confidenceScore: 100,
    lastChargeDate: previousChargeDate(nextDay, frequency),
    nextExpectedDate: nextDay,
    totalLast12Months: Math.round(monthlyEquivalent(estimatedAmount, frequency) * MONTHS_PER_YEAR * 100) / 100,
    chargeCount: (prev?.length || 0) + 1,
    transactionIds: [],
    alerts,
    isConfirmed: true,
    // Un recurrente pausado no es un costo vigente: se marca descartado para
    // que no sume en el Centro de Ahorro, pero sigue existiendo en la lista.
    isDismissed: !r.isActive,
  };
}

/**
 * Suscripciones declaradas (recurrentes de gasto) mas las inferidas del
 * historial. Ante el mismo nombre gana la declarada.
 */
export function collectSubscriptions(
  transactions: Transaction[],
  recurring: RecurringTransaction[],
  dismissedIds: string[] = []
): DetectedSubscription[] {
  const declared = recurring
    .filter(r => r.type === 'expense')
    .map(recurringToSubscription);

  const taken = new Set(declared.map(d => d.normalizedName.toLowerCase().trim()));
  const inferred = detectSubscriptions(transactions)
    .filter(d => !taken.has(d.normalizedName.toLowerCase().trim()));

  // Lo que se marco como "no es suscripcion" se recalcula igual en cada
  // arranque --sale de los recurrentes y del historial-- asi que el descarte
  // tiene que reaplicarse aca o reaparece en cada visita.
  const dismissed = new Set(dismissedIds);
  return [...declared, ...inferred].map(s =>
    dismissed.has(s.id) ? { ...s, isDismissed: true } : s
  );
}

export function getSubscriptionStats(subs: DetectedSubscription[]) {
  const active = subs.filter(s => !s.isDismissed);
  const monthlyTotal = active.reduce((sum, s) => {
    switch (s.frequency) {
      case 'weekly':    return sum + s.estimatedAmount * 4.33;
      case 'monthly':   return sum + s.estimatedAmount;
      case 'quarterly': return sum + s.estimatedAmount / 3;
      case 'yearly':    return sum + s.estimatedAmount / 12;
    }
  }, 0);

  return {
    count: active.length,
    monthlyTotal: Math.round(monthlyTotal * 100) / 100,
    annualTotal: Math.round(monthlyTotal * 12 * 100) / 100,
    highConfidence: active.filter(s => s.confidence === 'high').length,
    withAlerts: active.filter(s => s.alerts.length > 0).length,
  };
}
