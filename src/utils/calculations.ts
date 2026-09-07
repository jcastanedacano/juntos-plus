import { Transaction, Statistics, RecurringTransaction, Budget, SavingsGoal } from '../types';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, differenceInMonths, isWithinInterval, subMonths, addDays, subDays, startOfDay, getDaysInMonth } from 'date-fns';
import { parseDateOnly, toDateInputValue } from './stableDate';

export const calculateStatistics = (transactions: Transaction[], month?: Date): Statistics => {
  // Si se proporciona un mes, filtrar transacciones de ese mes
  let filteredTransactions = transactions;
  if (month) {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    filteredTransactions = transactions.filter(t => {
      const transactionDate = parseDateOnly(t.date);
      return isWithinInterval(transactionDate, { start: monthStart, end: monthEnd });
    });
  }

  const totalIncome = filteredTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = filteredTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const byCategory = filteredTransactions.reduce((acc, t) => {
    if (t.type === 'expense') {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
    }
    return acc;
  }, {} as { [key: string]: number });

  const trend = calculateTrend(filteredTransactions, month);

  return {
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
    byCategory,
    trend,
  };
};

export const calculatePreviousMonthStats = (transactions: Transaction[], currentMonth?: Date): Statistics => {
  const referenceMonth = currentMonth || new Date();
  const previousMonth = subMonths(referenceMonth, 1);

  return calculateStatistics(transactions, previousMonth);
};

const calculateTrend = (transactions: Transaction[], month?: Date) => {
  const referenceMonth = month || new Date();
  const start = startOfMonth(referenceMonth);
  const end = endOfMonth(referenceMonth);
  const days = eachDayOfInterval({ start, end });

  return days.map((day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayTransactions = transactions.filter((t) => t.date === dayStr);

    return {
      date: dayStr,
      income: dayTransactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0),
      expense: dayTransactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0),
    };
  });
};

// Locale-aware grouping (miles con coma) + siempre 2 decimales, en todas las
// monedas soportadas. Antes cada moneda tenía su propio camino (PEN/USD sin
// separador de miles, EUR vía Intl) — eso producía "S/2,220" al lado de
// "S/ 2075.65" en la misma pantalla. Un solo formateador para todo el app.
const GROUPED_NUMBER = new Intl.NumberFormat('es-PE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatCurrency = (amount: number, currency: string = 'EUR'): string => {
  if (currency === 'PEN') {
    return `S/ ${GROUPED_NUMBER.format(amount)}`;
  } else if (currency === 'USD') {
    return `$ ${GROUPED_NUMBER.format(amount)}`;
  } else {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  }
};

// Variante sin decimales, para totales resumidos (top de gastos, chips de
// suscripciones) donde mostrar centavos es ruido. Mismo símbolo + espacio +
// separador de miles que formatCurrency, para que el resto de la pantalla
// no cambie de "acento" al lado de un monto exacto.
const GROUPED_NUMBER_COMPACT = new Intl.NumberFormat('es-PE', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export const formatCurrencyCompact = (amount: number, currency: string = 'EUR'): string => {
  if (currency === 'PEN') {
    return `S/ ${GROUPED_NUMBER_COMPACT.format(amount)}`;
  } else if (currency === 'USD') {
    return `$ ${GROUPED_NUMBER_COMPACT.format(amount)}`;
  } else {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }
};

export interface MonthlyPlan {
  recurringIncome: number;
  recurringExpenses: number;
  recurringBalance: number;
  plannedBudgets: number;
  goalsContribution: number;
  estimatedFreeCash: number;
  // Datos reales del mes actual
  dailyExpensesThisMonth: number;
  extraIncomeThisMonth: number;
  actualFreeCash: number;
}

export const calculateMonthlyPlan = (
  recurring: RecurringTransaction[],
  budgets: Budget[],
  goals: SavingsGoal[],
  transactions: Transaction[],
  selectedMonth?: Date
): MonthlyPlan => {
  const referenceMonth = selectedMonth || new Date();
  // Calcular ingresos y gastos recurrentes mensuales
  const activeRecurring = recurring.filter(r => r.isActive);

  const recurringIncome = activeRecurring
    .filter(r => r.type === 'income')
    .reduce((sum, r) => {
      // Convertir a monto mensual según frecuencia
      let monthlyAmount = r.amount;
      if (r.frequency === 'weekly') monthlyAmount = r.amount * 4.33; // Promedio de semanas por mes
      if (r.frequency === 'yearly') monthlyAmount = r.amount / 12;
      if (r.frequency === 'daily') monthlyAmount = r.amount * 30;
      return sum + monthlyAmount;
    }, 0);

  const recurringExpenses = activeRecurring
    .filter(r => r.type === 'expense')
    .reduce((sum, r) => {
      // Convertir a monto mensual según frecuencia
      let monthlyAmount = r.amount;
      if (r.frequency === 'weekly') monthlyAmount = r.amount * 4.33;
      if (r.frequency === 'yearly') monthlyAmount = r.amount / 12;
      if (r.frequency === 'daily') monthlyAmount = r.amount * 30;
      return sum + monthlyAmount;
    }, 0);

  const recurringBalance = recurringIncome - recurringExpenses;

  // Calcular presupuestos mensuales
  const plannedBudgets = budgets.reduce((sum, b) => {
    let monthlyAmount = b.amount;
    if (b.period === 'weekly') monthlyAmount = b.amount * 4.33;
    if (b.period === 'yearly') monthlyAmount = b.amount / 12;
    return sum + monthlyAmount;
  }, 0);

  // Calcular aporte estimado a metas (solo metas activas)
  // Calculamos cuánto se necesita aportar mensualmente para llegar a las metas
  const goalsContribution = goals
    .filter(goal => goal.isActive) // Solo metas activas
    .reduce((sum, goal) => {
      const remaining = goal.targetAmount - goal.currentAmount;
      if (remaining <= 0) return sum;

      const deadline = new Date(goal.deadline);
      const now = new Date();
      const monthsRemaining = Math.max(1, differenceInMonths(deadline, now));

      const monthlyContribution = remaining / monthsRemaining;
      return sum + monthlyContribution;
    }, 0);

  // Saldo libre estimado
  const estimatedFreeCash = recurringBalance - plannedBudgets - goalsContribution;

  // Calcular datos reales del mes seleccionado
  const monthStart = startOfMonth(referenceMonth);
  const monthEnd = endOfMonth(referenceMonth);

  // Filtrar transacciones del mes actual que NO sean de recurrentes (sin sourceRecurringId)
  const thisMonthTransactions = transactions.filter(t => {
    const transactionDate = parseDateOnly(t.date);
    return isWithinInterval(transactionDate, { start: monthStart, end: monthEnd }) && !t.sourceRecurringId;
  });

  // Gastos diarios del mes (gastos no recurrentes)
  const dailyExpensesThisMonth = thisMonthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  // Ingresos extra del mes (ingresos no recurrentes)
  const extraIncomeThisMonth = thisMonthTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  // Saldo libre actual = Saldo estimado + ingresos extra - gastos diarios
  const actualFreeCash = estimatedFreeCash + extraIncomeThisMonth - dailyExpensesThisMonth;

  return {
    recurringIncome,
    recurringExpenses,
    recurringBalance,
    plannedBudgets,
    goalsContribution,
    estimatedFreeCash,
    dailyExpensesThisMonth,
    extraIncomeThisMonth,
    actualFreeCash,
  };
};

// ─── Disponible Real ────────────────────────────────────────────────────

export interface DisponibleRealBreakdown {
  ingresosEsperados: number;    // Ingresos recurrentes (mensualizado)
  ingresosExtra: number;        // Ingresos no recurrentes del mes
  totalIngresos: number;        // Total esperado del mes
  comprometido: number;         // Gastos fijos/recurrentes (mensualizado)
  variablePlaneado: number;     // Presupuestos asignados (mensualizado)
  ahorroMetas: number;          // Aporte mensual estimado a metas activas
  disponibleReal: number;       // totalIngresos − comprometido − variablePlaneado − ahorroMetas
  variableEjecutado: number;    // Gasto discrecional ya ejecutado este mes
  disponibleAjustado: number;   // disponibleReal − variableEjecutado
  diasElapsados: number;
  diasRestantes: number;
  disponiblePorDia: number;     // disponibleAjustado / diasRestantes (0 si no quedan días)
}

export const calculateDisponibleReal = (
  recurring: RecurringTransaction[],
  budgets: Budget[],
  goals: SavingsGoal[],
  transactions: Transaction[],
  selectedMonth?: Date
): DisponibleRealBreakdown => {
  const ref = selectedMonth || new Date();
  const monthStart = startOfMonth(ref);
  const monthEnd = endOfMonth(ref);
  const today = new Date();
  const isCurrentMonth = format(today, 'yyyy-MM') === format(ref, 'yyyy-MM');

  const totalDays = getDaysInMonth(ref);
  const dayOfMonth = isCurrentMonth ? Math.min(today.getDate(), totalDays) : totalDays;
  const diasElapsados = Math.max(1, dayOfMonth);
  const diasRestantes = Math.max(0, totalDays - dayOfMonth);

  const toMonthly = (r: RecurringTransaction) => {
    let m = r.amount;
    if (r.frequency === 'weekly') m = r.amount * 4.33;
    if (r.frequency === 'yearly') m = r.amount / 12;
    if (r.frequency === 'daily') m = r.amount * 30;
    return m;
  };

  const activeRecurring = recurring.filter(r => r.isActive);

  const ingresosEsperados = activeRecurring
    .filter(r => r.type === 'income')
    .reduce((sum, r) => sum + toMonthly(r), 0);

  const comprometido = activeRecurring
    .filter(r => r.type === 'expense')
    .reduce((sum, r) => sum + toMonthly(r), 0);

  const variablePlaneado = budgets.reduce((sum, b) => {
    let m = b.amount;
    if (b.period === 'weekly') m = b.amount * 4.33;
    if (b.period === 'yearly') m = b.amount / 12;
    return sum + m;
  }, 0);

  const ahorroMetas = goals
    .filter(g => g.isActive)
    .reduce((sum, g) => {
      const remaining = g.targetAmount - g.currentAmount;
      if (remaining <= 0) return sum;
      const monthsRemaining = Math.max(1, differenceInMonths(new Date(g.deadline), today));
      return sum + remaining / monthsRemaining;
    }, 0);

  const thisMonthTx = transactions.filter(t => {
    const d = parseDateOnly(t.date);
    return isWithinInterval(d, { start: monthStart, end: monthEnd });
  });

  const ingresosExtra = thisMonthTx
    .filter(t => t.type === 'income' && !t.sourceRecurringId)
    .reduce((sum, t) => sum + t.amount, 0);

  const variableEjecutado = thisMonthTx
    .filter(t => t.type === 'expense' && !t.sourceRecurringId)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalIngresos = ingresosEsperados + ingresosExtra;
  const disponibleReal = totalIngresos - comprometido - variablePlaneado - ahorroMetas;
  const disponibleAjustado = disponibleReal - variableEjecutado;
  const disponiblePorDia = diasRestantes > 0 ? disponibleAjustado / diasRestantes : 0;

  return {
    ingresosEsperados,
    ingresosExtra,
    totalIngresos,
    comprometido,
    variablePlaneado,
    ahorroMetas,
    disponibleReal,
    variableEjecutado,
    disponibleAjustado,
    diasElapsados,
    diasRestantes,
    disponiblePorDia,
  };
};

// ─── Regla 50/30/20 ─────────────────────────────────────────────────────

export interface Rule503020Segment {
  amount: number;
  percentage: number;  // actual % of income
  target: number;      // target % (50, 30 or 20)
  targetAmount: number;
  exceeds: boolean;    // true = over target (bad for comprometido/variable); for ahorro means below target
}

export interface Rule503020Result {
  totalIncome: number;
  comprometido: Rule503020Segment;  // fijos/recurrentes — meta ≤50%
  variable: Rule503020Segment;      // presupuestos discrecionales — meta ≤30%
  ahorro: Rule503020Segment;        // metas de ahorro — meta ≥20%
}

export const calculateRule503020 = (
  recurring: RecurringTransaction[],
  budgets: Budget[],
  goals: SavingsGoal[],
  transactions: Transaction[],
  selectedMonth?: Date
): Rule503020Result => {
  const ref = selectedMonth || new Date();
  const monthStart = startOfMonth(ref);
  const monthEnd = endOfMonth(ref);
  const today = new Date();

  const toMonthly = (amount: number, frequency: string) => {
    if (frequency === 'weekly') return amount * 4.33;
    if (frequency === 'yearly') return amount / 12;
    if (frequency === 'daily') return amount * 30;
    return amount;
  };

  const activeRecurring = recurring.filter(r => r.isActive);

  const recurringIncome = activeRecurring
    .filter(r => r.type === 'income')
    .reduce((s, r) => s + toMonthly(r.amount, r.frequency), 0);

  const thisMonthTx = transactions.filter(t => {
    const d = parseDateOnly(t.date);
    return isWithinInterval(d, { start: monthStart, end: monthEnd });
  });

  const extraIncome = thisMonthTx
    .filter(t => t.type === 'income' && !t.sourceRecurringId)
    .reduce((s, t) => s + t.amount, 0);

  const totalIncome = recurringIncome + extraIncome;

  if (totalIncome === 0) {
    const empty = (target: number): Rule503020Segment => ({
      amount: 0, percentage: 0, target, targetAmount: 0, exceeds: false,
    });
    return {
      totalIncome: 0,
      comprometido: empty(50),
      variable: empty(30),
      ahorro: { ...empty(20), exceeds: true },
    };
  }

  const comprometidoAmount = activeRecurring
    .filter(r => r.type === 'expense')
    .reduce((s, r) => s + toMonthly(r.amount, r.frequency), 0);

  const variableAmount = budgets.reduce((s, b) => s + toMonthly(b.amount, b.period), 0);

  const ahorroAmount = goals
    .filter(g => g.isActive)
    .reduce((sum, g) => {
      const remaining = g.targetAmount - g.currentAmount;
      if (remaining <= 0) return sum;
      const monthsRemaining = Math.max(1, differenceInMonths(new Date(g.deadline), today));
      return sum + remaining / monthsRemaining;
    }, 0);

  const pct = (v: number) => Math.round((v / totalIncome) * 100);

  return {
    totalIncome,
    comprometido: {
      amount: comprometidoAmount,
      percentage: pct(comprometidoAmount),
      target: 50,
      targetAmount: totalIncome * 0.5,
      exceeds: comprometidoAmount > totalIncome * 0.5,
    },
    variable: {
      amount: variableAmount,
      percentage: pct(variableAmount),
      target: 30,
      targetAmount: totalIncome * 0.3,
      exceeds: variableAmount > totalIncome * 0.3,
    },
    ahorro: {
      amount: ahorroAmount,
      percentage: pct(ahorroAmount),
      target: 20,
      targetAmount: totalIncome * 0.2,
      exceeds: ahorroAmount < totalIncome * 0.2, // "exceeds" = below target for savings
    },
  };
};

// ─── Forecast Fin de Mes ─────────────────────────────────────────────────

/** Middle value of a list; 0 when empty. Averages the two middles on even n. */
const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

export interface MonthEndForecast {
  incomeToDate: number;
  expensesToDate: number;
  balanceSoFar: number;
  daysElapsed: number;
  daysRemaining: number;
  dailyAvgExpense: number;
  pendingRecurringIncome: number;
  pendingRecurringExpenses: number;
  projectedVariableExpenses: number;
  projectedMonthEndBalance: number;
  isPositive: boolean;
  forecastMessage: string;
}

export const calculateMonthEndForecast = (
  transactions: Transaction[],
  recurring: RecurringTransaction[],
  currency: string,
  selectedMonth?: Date
): MonthEndForecast => {
  const ref = selectedMonth || new Date();
  const monthStart = startOfMonth(ref);
  const monthEnd = endOfMonth(ref);
  const today = new Date();
  const isCurrentMonth = format(today, 'yyyy-MM') === format(ref, 'yyyy-MM');

  const totalDays = getDaysInMonth(ref);
  const dayOfMonth = isCurrentMonth ? Math.min(today.getDate(), totalDays) : totalDays;
  const daysElapsed = Math.max(1, dayOfMonth);
  const daysRemaining = Math.max(0, totalDays - dayOfMonth);

  const thisMonthTx = transactions.filter(t => {
    const d = parseDateOnly(t.date);
    return isWithinInterval(d, { start: monthStart, end: monthEnd });
  });

  const incomeToDate = thisMonthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expensesToDate = thisMonthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balanceSoFar = incomeToDate - expensesToDate;

  // Daily rate of non-recurring (discretionary) spending.
  //
  // This used to be the plain mean: total discretionary spend / days elapsed.
  // One atypical charge early in the month then got extrapolated across every
  // remaining day. A single S/ 5,607 charge on the 1st turned into S/ 28,175 of
  // imaginary future spending and forecast a S/ 27,657 deficit for a month that
  // actually closes positive.
  //
  // The median of the elapsed days' totals is not dragged by one heavy day, so
  // a one-off stops masquerading as a daily habit. It still tracks real habits:
  // spend a similar amount most days and the median lands on that amount.
  const dailyTotals: number[] = [];
  for (let day = 1; day <= daysElapsed; day++) {
    const key = format(new Date(ref.getFullYear(), ref.getMonth(), day), 'yyyy-MM-dd');
    dailyTotals.push(
      thisMonthTx
        .filter(t => t.type === 'expense' && !t.sourceRecurringId && toDateInputValue(t.date) === key)
        .reduce((sum, t) => sum + t.amount, 0)
    );
  }
  const dailyAvgExpense = median(dailyTotals);

  // Pending recurring charges in remaining days of the month
  let pendingRecurringIncome = 0;
  let pendingRecurringExpenses = 0;

  if (isCurrentMonth && daysRemaining > 0) {
    // The window has to start at the START of tomorrow. addDays(today, 1) keeps
    // the current clock time, so a charge anchored earlier in the day fell
    // outside it: nextDate is stored at noon UTC (07:00 in Lima), so opening
    // the app any time after 07:00 silently dropped every charge dated
    // tomorrow. That is how Luz S/ 325.80 on the 6th vanished from the forecast.
    const tomorrowDate = startOfDay(addDays(today, 1));
    for (const r of recurring.filter(r => r.isActive)) {
      // Read the calendar day straight off the stored ISO prefix so the anchor
      // hour can never shift the charge into the previous day.
      const nextDate = parseDateOnly(toDateInputValue(r.nextDate));
      if (isWithinInterval(nextDate, { start: tomorrowDate, end: monthEnd })) {
        if (r.type === 'income') pendingRecurringIncome += r.amount;
        else pendingRecurringExpenses += r.amount;
      }
    }
  }

  const projectedVariableExpenses = dailyAvgExpense * daysRemaining;
  const projectedMonthEndBalance = balanceSoFar
    + pendingRecurringIncome
    - pendingRecurringExpenses
    - projectedVariableExpenses;

  const sym = currency === 'PEN' ? 'S/' : currency === 'USD' ? '$' : '€';
  const abs = Math.abs(projectedMonthEndBalance);
  const sign = projectedMonthEndBalance >= 0 ? '+' : '-';

  let forecastMessage: string;
  if (!isCurrentMonth) {
    forecastMessage = projectedMonthEndBalance >= 0
      ? `Cerraste en +${sym} ${abs.toFixed(0)}`
      : `Cerraste en -${sym} ${abs.toFixed(0)}`;
  } else if (daysRemaining === 0) {
    forecastMessage = projectedMonthEndBalance >= 0
      ? `Mes cerrado en +${sym} ${abs.toFixed(0)}`
      : `Mes cerrado en -${sym} ${abs.toFixed(0)}`;
  } else {
    forecastMessage = `Si sigues así, cierras en ${sign}${sym} ${abs.toFixed(0)}`;
  }

  return {
    incomeToDate,
    expensesToDate,
    balanceSoFar,
    daysElapsed,
    daysRemaining,
    dailyAvgExpense,
    pendingRecurringIncome,
    pendingRecurringExpenses,
    projectedVariableExpenses,
    projectedMonthEndBalance,
    isPositive: projectedMonthEndBalance >= 0,
    forecastMessage,
  };
};

// ─── Financial Health Score ─────────────────────────────────────────────

export interface HealthScoreBreakdown {
  total: number;
  savingsRateScore: number;      // 0–100 (weight 30%)
  budgetComplianceScore: number; // 0–100 (weight 30%)
  variabilityScore: number;      // 0–100 (weight 25%)
  goalCompletionScore: number;   // 0–100 (weight 15%)
  savingsRate: number;           // raw %
  budgetCompliance: number;      // raw % (0=all over budget, 100=all within budget)
  label: string;
  color: string;
}

export const calculateHealthScore = (
  transactions: Transaction[],
  goals: SavingsGoal[],
  currentMonth?: Date,
  budgets?: Budget[]
): HealthScoreBreakdown => {
  const ref = currentMonth || new Date();

  // ── 1. Savings rate (40%) ──────────────────────────────────────
  // Average over last 3 months for stability
  let totalIncome = 0;
  let totalExpenses = 0;
  for (let i = 0; i < 3; i++) {
    const m = subMonths(ref, i);
    const mStart = startOfMonth(m);
    const mEnd = endOfMonth(m);
    const monthTx = transactions.filter(t => {
      const d = parseDateOnly(t.date);
      return isWithinInterval(d, { start: mStart, end: mEnd });
    });
    totalIncome += monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    totalExpenses += monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  }
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
  // 30%+ savings → 100 pts, 0% → 0, negative caps at 0
  const savingsRateScore = Math.min(Math.max(savingsRate / 30, 0), 1) * 100;

  // ── 2. Expense variability (30%) ───────────────────────────────
  // CoV of monthly expenses over last 6 months; lower = better
  const monthlyExpenses: number[] = [];
  for (let i = 0; i < 6; i++) {
    const m = subMonths(ref, i);
    const mStart = startOfMonth(m);
    const mEnd = endOfMonth(m);
    const exp = transactions
      .filter(t => t.type === 'expense' && isWithinInterval(parseDateOnly(t.date), { start: mStart, end: mEnd }))
      .reduce((s, t) => s + t.amount, 0);
    monthlyExpenses.push(exp);
  }
  const nonZeroExpenses = monthlyExpenses.filter(e => e > 0);
  let variabilityScore = 100; // default if no data
  if (nonZeroExpenses.length >= 2) {
    const mean = nonZeroExpenses.reduce((s, v) => s + v, 0) / nonZeroExpenses.length;
    const variance = nonZeroExpenses.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / nonZeroExpenses.length;
    const cov = mean > 0 ? Math.sqrt(variance) / mean : 0;
    // CoV 0 → 100, CoV 0.5+ → 0
    variabilityScore = Math.min(Math.max((1 - cov * 2) * 100, 0), 100);
  }

  // ── 3. Goal completion (15%) ───────────────────────────────────
  const activeGoals = goals.filter(g => g.isActive);
  let goalCompletionScore = 100; // perfect if no goals
  if (activeGoals.length > 0) {
    const avgProgress = activeGoals.reduce((s, g) => {
      const progress = g.targetAmount > 0 ? g.currentAmount / g.targetAmount : 0;
      return s + Math.min(progress, 1);
    }, 0) / activeGoals.length;
    goalCompletionScore = avgProgress * 100;
  }

  // ── 4. Budget compliance (30%) ─────────────────────────────────
  let budgetComplianceScore = 100;
  let budgetCompliance = 100;
  if (budgets && budgets.length > 0) {
    const mStart = startOfMonth(ref);
    const mEnd = endOfMonth(ref);
    const monthTx = transactions.filter(t => {
      const d = parseDateOnly(t.date);
      return t.type === 'expense' && isWithinInterval(d, { start: mStart, end: mEnd });
    });
    const scores = budgets.map(b => {
      const spent = monthTx
        .filter(t => t.category === b.categoryId)
        .reduce((s, t) => s + t.amount, 0);
      const monthly = b.period === 'weekly' ? b.amount * 4.33
        : b.period === 'yearly' ? b.amount / 12
        : b.amount;
      if (monthly <= 0) return 100;
      // Penalize only for going over budget (spending within = 100, 2x over = 0)
      const overRatio = Math.max(0, (spent - monthly) / monthly);
      return Math.max(0, (1 - overRatio) * 100);
    });
    budgetCompliance = scores.reduce((s, v) => s + v, 0) / scores.length;
    budgetComplianceScore = budgetCompliance;
  }

  // ── Weighted total (30 / 30 / 25 / 15) ────────────────────────
  const total = Math.round(
    savingsRateScore    * 0.30 +
    budgetComplianceScore * 0.30 +
    variabilityScore    * 0.25 +
    goalCompletionScore * 0.15
  );

  let label: string;
  let color: string;
  if (total >= 80) { label = 'Excelente'; color = 'var(--success)'; }
  else if (total >= 60) { label = 'Buena'; color = 'var(--accent-blue)'; }
  else if (total >= 40) { label = 'Regular'; color = 'var(--warning)'; }
  else { label = 'En riesgo'; color = 'var(--danger)'; }

  return {
    total,
    savingsRateScore: Math.round(savingsRateScore),
    budgetComplianceScore: Math.round(budgetComplianceScore),
    variabilityScore: Math.round(variabilityScore),
    goalCompletionScore: Math.round(goalCompletionScore),
    savingsRate: Math.round(savingsRate * 10) / 10,
    budgetCompliance: Math.round(budgetCompliance * 10) / 10,
    label,
    color,
  };
};

// ─── Cashflow Forecast ──────────────────────────────────────────────────

export interface CashflowDataPoint {
  date: string;       // yyyy-MM-dd
  actual: number | null;
  forecast: number | null;
  cumulative: number;
  isForecast: boolean;
  /** Net income-minus-expense for this single day (0 on forecast days).
   *  Lets the chart pinpoint and annotate the day that caused a sharp
   *  drop, instead of leaving an unexplained cliff in the line. */
  dayNet: number;
}

export const calculateCashflowForecast = (
  transactions: Transaction[],
  recurring: RecurringTransaction[],
  currentMonth?: Date
): CashflowDataPoint[] => {
  const today = currentMonth || new Date();
  const historyStart = subDays(today, 30);
  const forecastEnd = addDays(today, 60);

  // ── Historical daily net (last 30 days) ────────────────────────
  const historyDays = eachDayOfInterval({ start: historyStart, end: today });
  const dailyNets: number[] = [];
  const result: CashflowDataPoint[] = [];

  // Calculate running balance from all transactions up to historyStart
  let runningBalance = transactions
    .filter(t => parseDateOnly(t.date) < historyStart)
    .reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);

  for (const day of historyDays) {
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayTx = transactions.filter(t => t.date === dayStr);
    const dayNet = dayTx.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);
    dailyNets.push(dayNet);
    runningBalance += dayNet;
    result.push({
      date: dayStr,
      actual: runningBalance,
      forecast: null,
      cumulative: runningBalance,
      isForecast: false,
      dayNet,
    });
  }

  // ── Moving average for forecast base ───────────────────────────
  const windowSize = Math.min(14, dailyNets.length);
  const recentNets = dailyNets.slice(-windowSize);
  const avgDailyNet = recentNets.length > 0
    ? recentNets.reduce((s, v) => s + v, 0) / recentNets.length
    : 0;

  // ── Add recurring transaction impacts ──────────────────────────
  const activeRecurring = recurring.filter(r => r.isActive);
  const recurringDailyNet = activeRecurring.reduce((sum, r) => {
    const sign = r.type === 'income' ? 1 : -1;
    let dailyAmount = r.amount;
    if (r.frequency === 'monthly') dailyAmount = r.amount / 30;
    else if (r.frequency === 'weekly') dailyAmount = r.amount / 7;
    else if (r.frequency === 'yearly') dailyAmount = r.amount / 365;
    return sum + (sign * dailyAmount);
  }, 0);

  // Blend: 60% moving average + 40% recurring-based
  const blendedDailyNet = avgDailyNet * 0.6 + recurringDailyNet * 0.4;

  // ── Project 60 days forward ────────────────────────────────────
  let forecastBalance = runningBalance;
  const forecastDays = eachDayOfInterval({ start: addDays(today, 1), end: forecastEnd });

  for (const day of forecastDays) {
    forecastBalance += blendedDailyNet;
    result.push({
      date: format(day, 'yyyy-MM-dd'),
      actual: null,
      forecast: Math.round(forecastBalance * 100) / 100,
      cumulative: Math.round(forecastBalance * 100) / 100,
      isForecast: true,
      dayNet: 0,
    });
  }

  return result;
};

// ─── Calendar Heatmap Data ──────────────────────────────────────────────

export interface HeatmapDay {
  date: string;
  count: number;     // number of transactions
  net: number;       // income - expenses
  intensity: number; // 0–4 level
}

export const calculateHeatmapData = (
  transactions: Transaction[],
  currentMonth?: Date
): HeatmapDay[] => {
  const ref = currentMonth || new Date();
  // Show 3 months of data
  const start = startOfMonth(subMonths(ref, 2));
  const end = endOfMonth(ref);
  const days = eachDayOfInterval({ start, end });

  // Aggregate by day
  const dayMap = new Map<string, { count: number; net: number }>();
  for (const t of transactions) {
    const d = t.date;
    const existing = dayMap.get(d) || { count: 0, net: 0 };
    existing.count += 1;
    existing.net += t.type === 'income' ? t.amount : -t.amount;
    dayMap.set(d, existing);
  }

  // Find max count for intensity scaling
  const maxCount = Math.max(1, ...Array.from(dayMap.values()).map(d => d.count));

  return days.map(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const data = dayMap.get(dateStr) || { count: 0, net: 0 };
    const intensity = data.count === 0 ? 0 : Math.min(4, Math.ceil((data.count / maxCount) * 4));
    return {
      date: dateStr,
      count: data.count,
      net: data.net,
      intensity,
    };
  });
};
