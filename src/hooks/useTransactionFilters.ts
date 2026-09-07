import { useReducer, useMemo, useCallback } from 'react';
import { Transaction, TransactionFilter, TransactionFilterPreset } from '../types';
import { getCategoryById } from '../utils/categoryHelpers';
import { parseDateOnly } from '../utils/stableDate';

type FilterAction =
  | { type: 'SET_TYPE'; payload: TransactionFilter['type'] }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_DATE_RANGE'; payload: TransactionFilter['dateRange'] }
  | { type: 'TOGGLE_CATEGORY'; payload: string }
  | { type: 'SET_CATEGORIES'; payload: string[] }
  | { type: 'RESET' }
  | { type: 'LOAD_PRESET'; payload: TransactionFilter };

const initialFilter: TransactionFilter = {
  type: 'all',
  dateRange: null,
  categories: [],
  searchTerm: '',
};

function filterReducer(state: TransactionFilter, action: FilterAction): TransactionFilter {
  switch (action.type) {
    case 'SET_TYPE':
      return { ...state, type: action.payload };
    case 'SET_SEARCH':
      return { ...state, searchTerm: action.payload };
    case 'SET_DATE_RANGE':
      return { ...state, dateRange: action.payload };
    case 'TOGGLE_CATEGORY': {
      const cat = action.payload;
      const categories = state.categories.includes(cat)
        ? state.categories.filter((c) => c !== cat)
        : [...state.categories, cat];
      return { ...state, categories };
    }
    case 'SET_CATEGORIES':
      return { ...state, categories: action.payload };
    case 'RESET':
      return initialFilter;
    case 'LOAD_PRESET':
      return action.payload;
    default:
      return state;
  }
}

const PRESETS_KEY = 'txn-filter-presets';

function loadPresets(): TransactionFilterPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePresetsToStorage(presets: TransactionFilterPreset[]) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

export function useTransactionFilters(transactions: Transaction[]) {
  const [filter, dispatch] = useReducer(filterReducer, initialFilter);

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((t) => {
        if (filter.type !== 'all' && t.type !== filter.type) return false;

        if (filter.dateRange) {
          const d = parseDateOnly(t.date).getTime();
          // Both bounds must be parsed the same way as `d` above. Mixing a
          // local-parsed date with UTC-parsed bounds dropped the last day of
          // every range in negative offsets.
          const start = parseDateOnly(filter.dateRange.start).getTime();
          const end = parseDateOnly(filter.dateRange.end).getTime();
          if (d < start || d > end) return false;
        }

        if (filter.categories.length > 0 && !filter.categories.includes(t.category)) {
          return false;
        }

        if (filter.searchTerm) {
          const term = filter.searchTerm.toLowerCase();
          const cat = getCategoryById(t.category);
          const match =
            cat?.name.toLowerCase().includes(term) ||
            t.description.toLowerCase().includes(term) ||
            t.amount.toString().includes(term);
          if (!match) return false;
        }

        return true;
      })
      .sort((a, b) => parseDateOnly(b.date).getTime() - parseDateOnly(a.date).getTime());
  }, [transactions, filter]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filter.type !== 'all') count++;
    if (filter.dateRange) count++;
    if (filter.categories.length > 0) count++;
    if (filter.searchTerm) count++;
    return count;
  }, [filter]);

  const resetFilters = useCallback(() => dispatch({ type: 'RESET' }), []);

  const removeFilter = useCallback((key: keyof TransactionFilter) => {
    switch (key) {
      case 'type':
        dispatch({ type: 'SET_TYPE', payload: 'all' });
        break;
      case 'dateRange':
        dispatch({ type: 'SET_DATE_RANGE', payload: null });
        break;
      case 'categories':
        dispatch({ type: 'SET_CATEGORIES', payload: [] });
        break;
      case 'searchTerm':
        dispatch({ type: 'SET_SEARCH', payload: '' });
        break;
    }
  }, []);

  const savePreset = useCallback(
    (name: string) => {
      const presets = loadPresets();
      const preset: TransactionFilterPreset = {
        id: Date.now().toString(),
        name,
        filter: { ...filter },
      };
      presets.push(preset);
      savePresetsToStorage(presets);
      return preset;
    },
    [filter]
  );

  const loadPreset = useCallback(
    (preset: TransactionFilterPreset) => {
      dispatch({ type: 'LOAD_PRESET', payload: preset.filter });
    },
    []
  );

  const deletePreset = useCallback((id: string) => {
    const presets = loadPresets().filter((p) => p.id !== id);
    savePresetsToStorage(presets);
  }, []);

  const getPresets = useCallback(() => loadPresets(), []);

  return {
    filter,
    filteredTransactions,
    activeFilterCount,
    dispatch,
    resetFilters,
    removeFilter,
    savePreset,
    loadPreset,
    deletePreset,
    getPresets,
  };
}
