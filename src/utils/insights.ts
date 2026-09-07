import { Transaction, RecurringTransaction, Budget, FinancialInsight } from '../types';
import { startOfMonth, endOfMonth, isWithinInterval, subMonths, differenceInDays, format, getDaysInMonth } from 'date-fns';
import { toMonthlyAmount } from './recurringCalculations';
import { parseDateOnly } from './stableDate';

function getMonthTransactions(transactions: Transaction[], month: Date): Transaction[] {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  return transactions.filter(t => isWithinInterval(parseDateOnly(t.date), { start, end }));
}

function getCategoryAverage(transactions: Transaction[], category: string, currentMonth: Date, months: number = 3): number {
  let total = 0;
  for (let i = 1; i <= months; i++) {
    const m = subMonths(currentMonth, i);
    const monthTx = getMonthTransactions(transactions, m);
    total += monthTx
      .filter(t => t.type === 'expense' && t.category === category)
      .reduce((s, t) => s + t.amount, 0);
  }
  return total / months;
}

export function generateInsights(
  transactions: Transaction[],
  recurring: RecurringTransaction[],
  budgets: Budget[],
  currentMonth?: Date
): FinancialInsight[] {
  const ref = currentMonth || new Date();
  const insights: FinancialInsight[] = [];
  const currentTx = getMonthTransactions(transactions, ref);
  const today = new Date();
  let id = 0;

  // 1. Phantom spending: small recurring charges that add up
  const smallRecurring = recurring.filter(r =>
    r.isActive && r.type === 'expense' && toMonthlyAmount(r) < 20
  );
  const totalPhantom = smallRecurring.reduce((s, r) => s + toMonthlyAmount(r), 0);
  if (totalPhantom > 100 && smallRecurring.length >= 3) {
    insights.push({
      id: `insight_${++id}`,
      type: 'phantom_spending',
      title: 'Gasto fantasma detectado',
      description: `${smallRecurring.length} pagos pequeños suman S/ ${totalPhantom.toFixed(0)}/mes (S/ ${(totalPhantom * 12).toFixed(0)}/año). Revisa si todos son necesarios.`,
      severity: 'warning',
      value: totalPhantom,
      action: 'Ver suscripciones',
    });
  }

  // 2. Unusual spending by category
  const currentExpenses = currentTx.filter(t => t.type === 'expense');
  const categorySpending = new Map<string, number>();
  for (const tx of currentExpenses) {
    categorySpending.set(tx.category, (categorySpending.get(tx.category) || 0) + tx.amount);
  }

  for (const [category, amount] of categorySpending) {
    const avg = getCategoryAverage(transactions, category, ref);
    if (avg > 0 && amount > avg * 1.3) {
      const percent = Math.round(((amount - avg) / avg) * 100);
      insights.push({
        id: `insight_${++id}`,
        type: 'unusual_spending',
        title: `Gasto inusual en ${category}`,
        description: `Llevas S/ ${amount.toFixed(0)} este mes, un ${percent}% más que tu promedio de S/ ${avg.toFixed(0)}.`,
        severity: percent > 50 ? 'danger' : 'warning',
        value: amount - avg,
        category,
      });
    }
  }

  // 3. Month forecast
  const totalExpenses = currentExpenses.reduce((s, t) => s + t.amount, 0);
  const totalIncome = currentTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const dayOfMonth = today.getDate();
  const daysInMonth = getDaysInMonth(ref);
  const daysRemaining = Math.max(0, daysInMonth - dayOfMonth);

  // Add pending recurring expenses
  const pendingRecurring = recurring
    .filter(r => r.isActive && r.type === 'expense')
    .reduce((s, r) => {
      const nextDate = new Date(r.nextDate);
      if (nextDate > today && nextDate <= endOfMonth(ref)) {
        return s + r.amount;
      }
      return s;
    }, 0);

  const expectedIncome = recurring
    .filter(r => r.isActive && r.type === 'income')
    .reduce((s, r) => s + toMonthlyAmount(r), 0);

  const projectedExpenses = totalExpenses + pendingRecurring + (totalExpenses / Math.max(dayOfMonth, 1)) * daysRemaining * 0.5;
  const projectedBalance = (totalIncome || expectedIncome) - projectedExpenses;

  if (dayOfMonth >= 5) {
    insights.push({
      id: `insight_${++id}`,
      type: 'month_forecast',
      title: 'Proyección de cierre de mes',
      description: projectedBalance >= 0
        ? `Estimamos que cerrarás el mes con +S/ ${projectedBalance.toFixed(0)} de balance.`
        : `A este ritmo, podrías cerrar el mes con -S/ ${Math.abs(projectedBalance).toFixed(0)}.`,
      severity: projectedBalance >= 0 ? 'success' : 'danger',
      value: projectedBalance,
    });
  }

  // 4. Spending pace
  if (dayOfMonth >= 3) {
    const dailyRate = totalExpenses / dayOfMonth;
    const projectedTotal = dailyRate * daysInMonth;
    const monthlyBudget = budgets.reduce((s, b) => {
      if (b.period === 'monthly') return s + b.amount;
      if (b.period === 'weekly') return s + b.amount * 4.33;
      if (b.period === 'yearly') return s + b.amount / 12;
      return s;
    }, 0);

    if (monthlyBudget > 0) {
      const overBudget = projectedTotal > monthlyBudget;
      insights.push({
        id: `insight_${++id}`,
        type: 'spending_pace',
        title: overBudget ? 'Ritmo de gasto elevado' : 'Buen ritmo de gasto',
        description: overBudget
          ? `A S/ ${dailyRate.toFixed(0)}/día, proyectas gastar S/ ${projectedTotal.toFixed(0)} (presupuesto: S/ ${monthlyBudget.toFixed(0)}).`
          : `Vas bien: S/ ${dailyRate.toFixed(0)}/día, proyección S/ ${projectedTotal.toFixed(0)} de S/ ${monthlyBudget.toFixed(0)} presupuestados.`,
        severity: overBudget ? 'warning' : 'success',
        value: dailyRate,
      });
    }
  }

  // 5. Daily budget remaining
  if (daysRemaining > 0) {
    const incomeThisMonth = totalIncome > 0 ? totalIncome : expectedIncome;
    const remaining = incomeThisMonth - totalExpenses - pendingRecurring;
    const dailyBudget = remaining / daysRemaining;

    if (incomeThisMonth > 0) {
      insights.push({
        id: `insight_${++id}`,
        type: 'daily_budget',
        title: 'Presupuesto diario disponible',
        description: dailyBudget > 0
          ? `Te quedan S/ ${remaining.toFixed(0)} para ${daysRemaining} días → S/ ${dailyBudget.toFixed(0)} por día.`
          : `Ya superaste tus ingresos del mes por S/ ${Math.abs(remaining).toFixed(0)}.`,
        severity: dailyBudget > 50 ? 'info' : dailyBudget > 0 ? 'warning' : 'danger',
        value: dailyBudget,
      });
    }
  }

  // 6. Trend alerts (categories growing month over month)
  const prevMonth = subMonths(ref, 1);
  const prev2Month = subMonths(ref, 2);
  const prevTx = getMonthTransactions(transactions, prevMonth);
  const prev2Tx = getMonthTransactions(transactions, prev2Month);

  const prevCategorySpending = new Map<string, number>();
  const prev2CategorySpending = new Map<string, number>();
  for (const tx of prevTx.filter(t => t.type === 'expense')) {
    prevCategorySpending.set(tx.category, (prevCategorySpending.get(tx.category) || 0) + tx.amount);
  }
  for (const tx of prev2Tx.filter(t => t.type === 'expense')) {
    prev2CategorySpending.set(tx.category, (prev2CategorySpending.get(tx.category) || 0) + tx.amount);
  }

  for (const [category, currentAmount] of categorySpending) {
    const prevAmount = prevCategorySpending.get(category) || 0;
    const prev2Amount = prev2CategorySpending.get(category) || 0;

    // Growing 3 months in a row
    if (currentAmount > prevAmount && prevAmount > prev2Amount && prev2Amount > 0) {
      const growthRate = Math.round(((currentAmount - prev2Amount) / prev2Amount) * 100);
      if (growthRate > 20) {
        insights.push({
          id: `insight_${++id}`,
          type: 'trend_alert',
          title: `Tendencia creciente: ${category}`,
          description: `Esta categoría ha crecido ${growthRate}% en los últimos 3 meses.`,
          severity: 'warning',
          value: growthRate,
          category,
        });
      }
    }
  }

  return insights;
}
