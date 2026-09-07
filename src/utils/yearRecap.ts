import { Transaction, SavingsGoal, Owner } from '../types';
import { getCategoryById } from './categoryHelpers';
import { ownerOf } from './ownership';

export interface MonthAgg {
  month: number;        // 0-11
  label: string;        // 'Ene', 'Feb', ...
  income: number;
  expense: number;
  net: number;
}

export interface CategoryAgg {
  id: string;
  name: string;
  icon: string;
  color: string;
  total: number;
  count: number;
  pct: number;          // % of total expenses
}

export interface MerchantAgg {
  description: string;
  total: number;
  count: number;
}

export interface BigExpense {
  id: string;
  date: string;
  description: string;
  category: string;
  categoryName: string;
  categoryIcon: string;
  amount: number;
}

export interface GoalRecap {
  id: string;
  name: string;
  icon: string;
  target: number;
  current: number;
  pct: number;
  completed: boolean;
}

export interface OwnerYearAgg {
  expense: number;
  income: number;
  count: number;
  pct: number; // % of total expenses
}

export interface OwnerCategoryAgg {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  total: number;
  byOwner: Record<Owner, number>;
}

export interface YearRecap {
  year: number;
  totalIncome: number;
  totalExpense: number;
  net: number;
  savingsRate: number;
  txCount: number;

  byMonth: MonthAgg[];
  bestMonth: MonthAgg | null;     // highest net
  worstMonth: MonthAgg | null;    // lowest net

  topCategories: CategoryAgg[];   // top 5 by total
  topMerchants: MerchantAgg[];    // top 10 by total
  bigExpenses: BigExpense[];      // top 5 single transactions

  goals: {
    total: number;
    completed: number;
    avgPct: number;
    items: GoalRecap[];
  };

  // Ownership: who paid for what across the year
  ownership: {
    byOwner: Record<Owner, OwnerYearAgg>;
    byCategory: OwnerCategoryAgg[]; // top 8 categories with per-owner split
  };

  // Comparison vs previous year (when there is data)
  prev?: {
    year: number;
    totalIncome: number;
    totalExpense: number;
    net: number;
    savingsRate: number;
  };
}

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const yearOf = (iso: string): number => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? -1 : d.getFullYear();
};

const monthOf = (iso: string): number => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? 0 : d.getMonth();
};

export function calculateYearRecap(
  transactions: Transaction[],
  goals: SavingsGoal[],
  year: number
): YearRecap {
  const yearTx = transactions.filter(t => yearOf(t.date) === year);
  const prevYearTx = transactions.filter(t => yearOf(t.date) === year - 1);

  let totalIncome = 0;
  let totalExpense = 0;
  const byMonth: MonthAgg[] = MONTH_LABELS.map((label, i) => ({
    month: i, label, income: 0, expense: 0, net: 0,
  }));

  for (const tx of yearTx) {
    const m = monthOf(tx.date);
    if (tx.type === 'income') {
      totalIncome += tx.amount;
      byMonth[m].income += tx.amount;
    } else {
      totalExpense += tx.amount;
      byMonth[m].expense += tx.amount;
    }
  }
  for (const m of byMonth) m.net = m.income - m.expense;

  // Only consider months that had any activity for best/worst
  const monthsWithActivity = byMonth.filter(m => m.income + m.expense > 0);
  let bestMonth: MonthAgg | null = null;
  let worstMonth: MonthAgg | null = null;
  if (monthsWithActivity.length > 0) {
    bestMonth = monthsWithActivity.reduce((a, b) => (b.net > a.net ? b : a));
    worstMonth = monthsWithActivity.reduce((a, b) => (b.net < a.net ? b : a));
  }

  // Top categories (expenses only)
  const catMap = new Map<string, { total: number; count: number }>();
  for (const tx of yearTx) {
    if (tx.type !== 'expense') continue;
    const cur = catMap.get(tx.category) || { total: 0, count: 0 };
    cur.total += tx.amount;
    cur.count += 1;
    catMap.set(tx.category, cur);
  }
  const topCategories: CategoryAgg[] = Array.from(catMap.entries())
    .map(([id, v]) => {
      const cat = getCategoryById(id);
      return {
        id,
        name: cat?.name || id,
        icon: cat?.icon || '📦',
        color: cat?.color || '#6B7280',
        total: v.total,
        count: v.count,
        pct: totalExpense > 0 ? (v.total / totalExpense) * 100 : 0,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Top merchants (description-based, expenses only, normalised)
  const normalize = (s: string) =>
    s.replace(/\s+/g, ' ').trim().replace(/^[-_*]+/, '').toUpperCase();
  const merchMap = new Map<string, MerchantAgg>();
  for (const tx of yearTx) {
    if (tx.type !== 'expense') continue;
    const key = normalize(tx.description || '(sin descripción)').slice(0, 60);
    if (!key) continue;
    const cur = merchMap.get(key) || { description: tx.description || '(sin descripción)', total: 0, count: 0 };
    cur.total += tx.amount;
    cur.count += 1;
    merchMap.set(key, cur);
  }
  const topMerchants = Array.from(merchMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // Big single expenses (top 5)
  const bigExpenses: BigExpense[] = yearTx
    .filter(t => t.type === 'expense')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map(tx => {
      const cat = getCategoryById(tx.category);
      return {
        id: tx.id,
        date: tx.date,
        description: tx.description || '(sin descripción)',
        category: tx.category,
        categoryName: cat?.name || tx.category,
        categoryIcon: cat?.icon || '📦',
        amount: tx.amount,
      };
    });

  // Goals — track all goals (active + completed) for the year
  const goalItems: GoalRecap[] = goals.map(g => {
    const pct = g.targetAmount > 0
      ? Math.min((g.currentAmount / g.targetAmount) * 100, 100)
      : 0;
    return {
      id: g.id,
      name: g.name,
      icon: g.icon,
      target: g.targetAmount,
      current: g.currentAmount,
      pct,
      completed: pct >= 100,
    };
  });
  const completed = goalItems.filter(g => g.completed).length;
  const avgPct = goalItems.length > 0
    ? goalItems.reduce((s, g) => s + g.pct, 0) / goalItems.length
    : 0;

  // Ownership: aggregate by owner across the year
  const byOwner: Record<Owner, OwnerYearAgg> = {
    shared:  { expense: 0, income: 0, count: 0, pct: 0 },
    me:      { expense: 0, income: 0, count: 0, pct: 0 },
    partner: { expense: 0, income: 0, count: 0, pct: 0 },
  };
  const ownerCategoryMap = new Map<string, { total: number; byOwner: Record<Owner, number> }>();
  for (const tx of yearTx) {
    const o = ownerOf(tx);
    byOwner[o].count += 1;
    if (tx.type === 'income') {
      byOwner[o].income += tx.amount;
    } else {
      byOwner[o].expense += tx.amount;
      // per-category split
      const cur = ownerCategoryMap.get(tx.category) || {
        total: 0,
        byOwner: { shared: 0, me: 0, partner: 0 },
      };
      cur.total += tx.amount;
      cur.byOwner[o] += tx.amount;
      ownerCategoryMap.set(tx.category, cur);
    }
  }
  for (const o of Object.keys(byOwner) as Owner[]) {
    byOwner[o].pct = totalExpense > 0 ? (byOwner[o].expense / totalExpense) * 100 : 0;
  }
  const byCategory: OwnerCategoryAgg[] = Array.from(ownerCategoryMap.entries())
    .map(([categoryId, v]) => {
      const cat = getCategoryById(categoryId);
      return {
        categoryId,
        categoryName: cat?.name || categoryId,
        categoryIcon: cat?.icon || '📦',
        total: v.total,
        byOwner: v.byOwner,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  // Previous year comparison
  let prev: YearRecap['prev'] | undefined;
  if (prevYearTx.length > 0) {
    let pi = 0;
    let pe = 0;
    for (const tx of prevYearTx) {
      if (tx.type === 'income') pi += tx.amount;
      else pe += tx.amount;
    }
    prev = {
      year: year - 1,
      totalIncome: pi,
      totalExpense: pe,
      net: pi - pe,
      savingsRate: pi > 0 ? ((pi - pe) / pi) * 100 : 0,
    };
  }

  return {
    year,
    totalIncome,
    totalExpense,
    net: totalIncome - totalExpense,
    savingsRate: totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0,
    txCount: yearTx.length,
    byMonth,
    bestMonth,
    worstMonth,
    topCategories,
    topMerchants,
    bigExpenses,
    goals: {
      total: goalItems.length,
      completed,
      avgPct,
      items: goalItems,
    },
    ownership: {
      byOwner,
      byCategory,
    },
    prev,
  };
}

// Returns the years that have any transactions (for the year selector).
export function getAvailableYears(transactions: Transaction[]): number[] {
  const set = new Set<number>();
  for (const t of transactions) {
    const y = yearOf(t.date);
    if (y > 0) set.add(y);
  }
  // Always include current year, even if no data yet.
  set.add(new Date().getFullYear());
  return Array.from(set).sort((a, b) => b - a);
}
