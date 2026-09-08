import { Transaction } from '../types';
import { CreditSnapshot, teaToMonthly } from './creditCardAnalytics';
import { parseDateOnly } from './stableDate';
import { localeActual } from './fxTasas';

// ─── Types ────────────────────────────────────────────────────────────

export type AdviceSeverity = 'info' | 'success' | 'warning' | 'danger';

export interface CreditAdvice {
  id: string;
  /** Where this advice belongs in the UI — F2 / F3 / F4. */
  group: 'utilization' | 'installments' | 'forecast';
  severity: AdviceSeverity;
  title: string;
  body: string;
  /** Optional "do this" CTA — for now we just render it as a label. */
  action?: string;
  /** Headline number we want to highlight (eg "S/ 1,200"). */
  highlight?: string;
}

export interface InstallmentAdvice {
  installmentId: string;
  description: string;
  remainingInstallments: number;
  remainingPrincipal: number;
  remainingInterest: number;
  tea: number;
  /** Annual cost of carry of THIS plan in soles (or USD). */
  annualCostOfCarry: number;
  /** If you cancel anticipadamente, you save this much interest. */
  estimatedSavings: number;
  /** 1 = cancel first, 2 = cancel next, … */
  priority: number;
  reason: string;
}

// ─── F2 · Utilization advice ──────────────────────────────────────────
//
// Goal: keep credit-card utilization < 30% (the threshold credit
// bureaus reward). Tells the user how much to pay before the
// statement closes to land below that line.

const UTIL_TARGET = 0.30;
const UTIL_HIGH = 0.70;

function daysUntilDay(targetDay: number): number {
  const now = new Date();
  const cur = now.getDate();
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  // Clamp the day to month length.
  const tgt = Math.min(targetDay, dim);
  if (tgt >= cur) return tgt - cur;
  // Already past — wrap to next month.
  const next = new Date(now.getFullYear(), now.getMonth() + 1, targetDay);
  return Math.round((next.getTime() - now.getTime()) / 86_400_000);
}

function utilizationAdvice(snapshot: CreditSnapshot): CreditAdvice[] {
  const out: CreditAdvice[] = [];
  const { saldoPEN, creditLimit, utilization, account, daysUntilDue } = snapshot;
  if (creditLimit <= 0 || saldoPEN <= 0) return out;

  // Amount to bring utilization down to target.
  const targetBalance = creditLimit * UTIL_TARGET;
  const payToTarget = Math.max(saldoPEN - targetBalance, 0);

  const closeDay = account.statementCloseDay;
  const daysToClose = closeDay !== undefined ? daysUntilDay(closeDay) : undefined;

  if (utilization > UTIL_HIGH) {
    out.push({
      id: 'util-critical',
      group: 'utilization',
      severity: 'danger',
      title: 'Utilización crítica',
      body: `Estás usando ${Math.round(utilization * 100)}% de tu línea. Por encima de 70% el banco te ve como cliente riesgoso y baja tu score crediticio.`,
      highlight: `${Math.round(utilization * 100)}%`,
      action: `Pagá al menos S/ ${Math.round(payToTarget).toLocaleString(localeActual())} para volver a < 30%${daysToClose !== undefined ? ` (antes del cierre en ${daysToClose}d)` : ''}.`,
    });
  } else if (utilization > UTIL_TARGET) {
    out.push({
      id: 'util-warning',
      group: 'utilization',
      severity: 'warning',
      title: `Llegá a 30% antes del cierre${daysToClose !== undefined ? ` (en ${daysToClose}d)` : ''}`,
      body: `Tu utilización reporta al banco el día del cierre. Pagando S/ ${Math.round(payToTarget).toLocaleString(localeActual())} bajás a 30% y mejorás tu perfil crediticio.`,
      highlight: `S/ ${Math.round(payToTarget).toLocaleString(localeActual())}`,
      action: closeDay !== undefined
        ? `Día de cierre: ${closeDay} de cada mes.`
        : undefined,
    });
  } else {
    out.push({
      id: 'util-good',
      group: 'utilization',
      severity: 'success',
      title: 'Utilización saludable',
      body: `${Math.round(utilization * 100)}%, estás dentro del rango que el banco premia (< 30%). Mantenelo así pagando antes del cierre.`,
      highlight: `${Math.round(utilization * 100)}%`,
    });
  }

  // Due-date urgency — separate piece of advice.
  if (daysUntilDue !== undefined) {
    if (daysUntilDue < 0) {
      out.push({
        id: 'due-overdue',
        group: 'utilization',
        severity: 'danger',
        title: 'Pago vencido',
        body: `Tu pago venció hace ${Math.abs(daysUntilDue)}d. El banco ya aplicó mora + intereses moratorios sobre el saldo. Pagá al menos el mínimo hoy.`,
        action: `Mínimo: S/ ${Math.round(snapshot.pagoMinimoPEN).toLocaleString(localeActual())}`,
      });
    } else if (daysUntilDue <= 3) {
      out.push({
        id: 'due-soon',
        group: 'utilization',
        severity: 'warning',
        title: `Vence en ${daysUntilDue}d`,
        body: `Pagá al menos el mínimo para evitar mora. Si pagás el total, no te cobran intereses sobre las compras no-cuotas de este ciclo.`,
        action: `Total: S/ ${Math.round(snapshot.pagoTotalPEN).toLocaleString(localeActual())}`,
      });
    }
  }

  return out;
}

// ─── F3 · Installment strategy ────────────────────────────────────────
//
// Rank PASE-CUOTAS plans by their cost-of-carry. The one with the
// highest TEA AND the most remaining months wastes the most money.

export function rankInstallments(snapshot: CreditSnapshot): InstallmentAdvice[] {
  const stmt = snapshot.account.latestStatement;
  if (!stmt?.installments?.length) return [];

  // Estimate remaining principal as monthlyCapital × remainingInstallments.
  // (BCP's amortization is approximately constant-cuota so this is close
  // enough for a strategy view — exact payoff requires the bank's quote.)
  const ranked = stmt.installments.map((inst) => {
    const remainingInstallments = Math.max(
      inst.totalInstallments - inst.paidInstallments,
      0
    );
    const remainingPrincipal = inst.monthlyCapital * remainingInstallments;
    const remainingInterest = inst.monthlyInterest * remainingInstallments;
    const annualCostOfCarry = remainingPrincipal * inst.tea;

    return {
      installmentId: inst.id,
      description: inst.description,
      remainingInstallments,
      remainingPrincipal,
      remainingInterest,
      tea: inst.tea,
      annualCostOfCarry,
      // Cancelar anticipado evita el interés de las cuotas restantes.
      // Es una estimación conservadora — el banco descuenta interés
      // no-devengado pero cobra una comisión de prepago.
      estimatedSavings: remainingInterest * 0.85,
      priority: 0,
      reason: '',
    } as InstallmentAdvice;
  });

  // Sort by remainingInterest desc (biggest waste first), tie-break by TEA.
  ranked.sort(
    (a, b) =>
      b.remainingInterest - a.remainingInterest || b.tea - a.tea
  );
  ranked.forEach((r, i) => {
    r.priority = i + 1;
    if (r.tea > 0.9 && r.remainingInstallments > 6) {
      r.reason = 'TEA muy alta + muchas cuotas pendientes';
    } else if (r.tea > 0.9) {
      r.reason = 'TEA muy alta (cancelar libera línea de crédito)';
    } else if (r.remainingInstallments > 12) {
      r.reason = 'Plazo largo: interés acumulado considerable';
    } else {
      r.reason = 'Costo moderado: cancelá solo si tenés liquidez';
    }
  });

  return ranked;
}

function installmentAdvice(snapshot: CreditSnapshot): CreditAdvice[] {
  const ranked = rankInstallments(snapshot);
  if (ranked.length === 0) return [];

  const top = ranked[0];
  const totalCarry = ranked.reduce((s, r) => s + r.remainingInterest, 0);

  const out: CreditAdvice[] = [];
  out.push({
    id: 'inst-summary',
    group: 'installments',
    severity: totalCarry > 1000 ? 'warning' : 'info',
    title: `${ranked.length} plan${ranked.length === 1 ? '' : 'es'} en cuotas`,
    body: `Vas a pagar aprox. S/ ${Math.round(totalCarry).toLocaleString(localeActual())} en intereses si dejás correr todas las cuotas hasta el final.`,
    highlight: `S/ ${Math.round(totalCarry).toLocaleString(localeActual())}`,
  });

  if (top.tea > 0.9 && top.remainingInstallments >= 3) {
    out.push({
      id: 'inst-top',
      group: 'installments',
      severity: 'warning',
      title: 'Candidato a cancelar anticipado',
      body: `${top.description} (TEA ${(top.tea * 100).toFixed(1)}%, ${top.remainingInstallments} cuotas restantes). Cancelar libera ~S/ ${Math.round(top.estimatedSavings).toLocaleString(localeActual())} de intereses.`,
      highlight: `S/ ${Math.round(top.estimatedSavings).toLocaleString(localeActual())}`,
      action: 'Pedí el saldo de prepago a tu banco antes de pagar.',
    });
  }

  return out;
}

// ─── F4 · Forecast end-of-cycle balance ───────────────────────────────
//
// Looks at the user's transactions inside the current statement window
// (or last 30 days as a fallback) and projects the closing balance if
// they keep that daily spend rate.

function inCycle(t: Transaction, cycleStart: Date, cycleEnd: Date): boolean {
  const d = parseDateOnly(t.date);
  return d >= cycleStart && d <= cycleEnd;
}

function forecastAdvice(
  snapshot: CreditSnapshot,
  transactions: Transaction[]
): CreditAdvice[] {
  const stmt = snapshot.account.latestStatement;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Pick the cycle: prefer PDF cycle, fall back to current calendar month
  // bounded by paymentDueDate if known.
  let cycleStart: Date;
  let cycleEnd: Date;
  if (stmt?.cycleStart && stmt?.cycleEnd) {
    cycleStart = new Date(stmt.cycleStart);
    cycleEnd = new Date(stmt.cycleEnd);
  } else if (snapshot.account.statementCloseDay) {
    // Cycle ends on next statementCloseDay.
    const close = snapshot.account.statementCloseDay;
    const cur = today.getDate();
    cycleStart = new Date(today.getFullYear(), today.getMonth() - (cur > close ? 0 : 1), close + 1);
    cycleEnd = new Date(today.getFullYear(), today.getMonth() + (cur > close ? 1 : 0), close);
  } else {
    // Last 30 days as a heuristic.
    cycleStart = new Date(today);
    cycleStart.setDate(cycleStart.getDate() - 30);
    cycleEnd = new Date(today);
    cycleEnd.setDate(cycleEnd.getDate() + 30);
  }

  // Sum expenses on this card during the cycle so far.
  const accountTx = transactions.filter(
    (t) => t.accountId === snapshot.account.id && t.type === 'expense'
  );
  const cycleTx = accountTx.filter((t) => inCycle(t, cycleStart, today));
  const spentSoFar = cycleTx.reduce((s, t) => s + t.amount, 0);

  const daysIn = Math.max(
    Math.round((today.getTime() - cycleStart.getTime()) / 86_400_000),
    1
  );
  const daysLeft = Math.max(
    Math.round((cycleEnd.getTime() - today.getTime()) / 86_400_000),
    0
  );
  if (daysIn < 3 || daysLeft <= 0) return [];

  const dailyPace = spentSoFar / daysIn;
  const projectedExtra = dailyPace * daysLeft;
  const projectedBalance = snapshot.saldoPEN + projectedExtra;
  const projectedUtil = snapshot.creditLimit > 0
    ? projectedBalance / snapshot.creditLimit
    : 0;

  const out: CreditAdvice[] = [];
  out.push({
    id: 'forecast-pace',
    group: 'forecast',
    severity: 'info',
    title: 'Ritmo del ciclo actual',
    body: `Llevás S/ ${Math.round(spentSoFar).toLocaleString(localeActual())} en ${daysIn}d (S/ ${Math.round(dailyPace).toLocaleString(localeActual())}/día). Si seguís el ritmo, cerrás el ciclo con S/ ${Math.round(projectedBalance).toLocaleString(localeActual())} de saldo.`,
    highlight: `S/ ${Math.round(projectedBalance).toLocaleString(localeActual())}`,
  });

  if (projectedUtil > UTIL_HIGH) {
    out.push({
      id: 'forecast-util',
      group: 'forecast',
      severity: 'danger',
      title: 'Vas camino a superar 70% de utilización',
      body: `Proyección: ${Math.round(projectedUtil * 100)}% al cierre del ciclo. Eso impacta tu score y limita futuras aprobaciones.`,
      highlight: `${Math.round(projectedUtil * 100)}%`,
      action: `Bajá el ritmo o pagá S/ ${Math.round((projectedBalance - snapshot.creditLimit * UTIL_TARGET)).toLocaleString(localeActual())} antes del cierre.`,
    });
  } else if (projectedUtil > UTIL_TARGET) {
    out.push({
      id: 'forecast-util',
      group: 'forecast',
      severity: 'warning',
      title: 'Cerrarías por encima de 30%',
      body: `Proyección de utilización al cierre: ${Math.round(projectedUtil * 100)}%. Para reportar < 30% al banco, pagá S/ ${Math.round((projectedBalance - snapshot.creditLimit * UTIL_TARGET)).toLocaleString(localeActual())} antes del corte.`,
      highlight: `${Math.round(projectedUtil * 100)}%`,
    });
  }

  // Interest if revolving — how much next month's interest line will be.
  const interestNextCycle = projectedBalance * teaToMonthly(snapshot.teaPEN);
  if (interestNextCycle > 50) {
    out.push({
      id: 'forecast-interest',
      group: 'forecast',
      severity: 'info',
      title: 'Interés del próximo ciclo (si revolvés)',
      body: `Con saldo proyectado S/ ${Math.round(projectedBalance).toLocaleString(localeActual())}, si solo pagás el mínimo te cobrarían ~S/ ${Math.round(interestNextCycle).toLocaleString(localeActual())} de interés el próximo ciclo.`,
      highlight: `S/ ${Math.round(interestNextCycle).toLocaleString(localeActual())}`,
    });
  }

  return out;
}

// ─── Entry point ──────────────────────────────────────────────────────

export function buildCreditAdvice(
  snapshot: CreditSnapshot,
  transactions: Transaction[]
): CreditAdvice[] {
  return [
    ...utilizationAdvice(snapshot),
    ...installmentAdvice(snapshot),
    ...forecastAdvice(snapshot, transactions),
  ];
}
