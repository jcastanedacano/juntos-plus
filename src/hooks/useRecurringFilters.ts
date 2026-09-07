import { useReducer, useMemo, useCallback, useState } from 'react';
import { RecurringTransaction, RecurringFilter, RecurringQuickFilter, RecurringPeriod, RecurringSortBy, RecurringSortDir } from '../types';
import { getCategoryById } from '../utils/categoryHelpers';
import { toMonthlyAmount, daysUntilNextCharge, getPriceChangePercentage } from '../utils/recurringCalculations';
import { addMonths, isWithinInterval, startOfMonth, endOfMonth, addDays, subMonths } from 'date-fns';

type FilterAction =
  | { type: 'SET_TYPE'; payload: RecurringFilter['type'] }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_STATUSES'; payload: RecurringFilter['statuses'] }
  | { type: 'TOGGLE_FREQUENCY'; payload: RecurringTransaction['frequency'] }
  | { type: 'TOGGLE_CATEGORY'; payload: string }
  | { type: 'SET_CATEGORIES'; payload: string[] }
  | { type: 'SET_QUICK_FILTER'; payload: RecurringQuickFilter | null }
  | { type: 'RESET' };

const initialFilter: RecurringFilter = {
  type: 'all',
  searchTerm: '',
  statuses: [],
  frequencies: [],
  categories: [],
  quickFilter: null,
};

function filterReducer(state: RecurringFilter, action: FilterAction): RecurringFilter {
  switch (action.type) {
    case 'SET_TYPE':
      return { ...state, type: action.payload };
    case 'SET_SEARCH':
      return { ...state, searchTerm: action.payload };
    case 'SET_STATUSES':
      return { ...state, statuses: action.payload };
    case 'TOGGLE_FREQUENCY': {
      const freq = action.payload;
      const frequencies = state.frequencies.includes(freq)
        ? state.frequencies.filter(f => f !== freq)
        : [...state.frequencies, freq];
      return { ...state, frequencies };
    }
    case 'TOGGLE_CATEGORY': {
      const cat = action.payload;
      const categories = state.categories.includes(cat)
        ? state.categories.filter(c => c !== cat)
        : [...state.categories, cat];
      return { ...state, categories };
    }
    case 'SET_CATEGORIES':
      return { ...state, categories: action.payload };
    case 'SET_QUICK_FILTER':
      return { ...state, quickFilter: state.quickFilter === action.payload ? null : action.payload };
    case 'RESET':
      return initialFilter;
    default:
      return state;
  }
}

function matchesQuickFilter(r: RecurringTransaction, qf: RecurringQuickFilter | null): boolean {
  if (!qf) return true;
  switch (qf) {
    case 'active': return r.isActive;
    case 'paused': return !r.isActive;
    case 'next7days': return r.isActive && daysUntilNextCharge(r) <= 7;
    case 'annual': return r.frequency === 'yearly';
    case 'monthly': return r.frequency === 'monthly';
    case 'withIncreases': {
      const pct = getPriceChangePercentage(r);
      return pct !== null && pct > 0;
    }
  }
}

export function useRecurringFilters(recurring: RecurringTransaction[]) {
  const [filter, dispatch] = useReducer(filterReducer, initialFilter);
  const [period, setPeriod] = useState<RecurringPeriod>('current');
  const [sortBy, setSortBy] = useState<RecurringSortBy>('nextDate');
  const [sortDir, setSortDir] = useState<RecurringSortDir>('asc');

  const filteredRecurring = useMemo(() => {
    return recurring
      .filter(r => {
        // Type filter
        if (filter.type !== 'all' && r.type !== filter.type) return false;

        // Status filter
        if (filter.statuses.length > 0) {
          const status = r.isActive ? 'active' : 'paused';
          if (!filter.statuses.includes(status)) return false;
        }

        // Frequency filter
        if (filter.frequencies.length > 0 && !filter.frequencies.includes(r.frequency)) return false;

        // Category filter
        if (filter.categories.length > 0 && !filter.categories.includes(r.category)) return false;

        // Quick filter
        if (!matchesQuickFilter(r, filter.quickFilter)) return false;

        // Search
        if (filter.searchTerm) {
          const term = filter.searchTerm.toLowerCase();
          const cat = getCategoryById(r.category);
          const match =
            r.description.toLowerCase().includes(term) ||
            cat?.name.toLowerCase().includes(term) ||
            r.amount.toString().includes(term) ||
            r.tags?.some(t => t.toLowerCase().includes(term));
          if (!match) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        switch (sortBy) {
          case 'nextDate':
            cmp = new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime();
            break;
          case 'amount':
            cmp = toMonthlyAmount(a) - toMonthlyAmount(b);
            break;
          case 'name':
            cmp = a.description.localeCompare(b.description);
            break;
          case 'category':
            cmp = a.category.localeCompare(b.category);
            break;
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [recurring, filter, sortBy, sortDir]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filter.type !== 'all') count++;
    if (filter.statuses.length > 0) count++;
    if (filter.frequencies.length > 0) count++;
    if (filter.categories.length > 0) count++;
    if (filter.searchTerm) count++;
    if (filter.quickFilter) count++;
    return count;
  }, [filter]);

  const quickFilterCounts = useMemo(() => {
    const all: RecurringQuickFilter[] = ['active', 'paused', 'next7days', 'annual', 'monthly', 'withIncreases'];
    const counts: Record<RecurringQuickFilter, number> = {} as any;
    for (const qf of all) {
      counts[qf] = recurring.filter(r => matchesQuickFilter(r, qf)).length;
    }
    return counts;
  }, [recurring]);

  // Period-based totals
  const periodTotals = useMemo(() => {
    const active = recurring.filter(r => r.isActive);
    let income = 0;
    let expense = 0;

    for (const r of active) {
      const monthly = toMonthlyAmount(r);
      if (r.type === 'income') income += monthly;
      else expense += monthly;
    }

    // "last3" shows accumulated 3-month total, others show 1 month
    const multiplier = period === 'last3' ? 3 : 1;
    return {
      income: income * multiplier,
      expense: expense * multiplier,
      balance: (income - expense) * multiplier,
    };
  }, [recurring, period]);

  const resetFilters = useCallback(() => dispatch({ type: 'RESET' }), []);

  const removeFilter = useCallback((key: keyof RecurringFilter) => {
    switch (key) {
      case 'type': dispatch({ type: 'SET_TYPE', payload: 'all' }); break;
      case 'searchTerm': dispatch({ type: 'SET_SEARCH', payload: '' }); break;
      case 'statuses': dispatch({ type: 'SET_STATUSES', payload: [] }); break;
      case 'frequencies': dispatch({ type: 'SET_STATUSES', payload: [] }); break;
      case 'categories': dispatch({ type: 'SET_CATEGORIES', payload: [] }); break;
      case 'quickFilter': dispatch({ type: 'SET_QUICK_FILTER', payload: null }); break;
    }
  }, []);

  return {
    filter,
    filteredRecurring,
    activeFilterCount,
    quickFilterCounts,
    dispatch,
    resetFilters,
    removeFilter,
    period,
    setPeriod,
    sortBy,
    setSortBy,
    sortDir,
    setSortDir,
    periodTotals,
  };
}
