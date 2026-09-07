import { useRef, forwardRef, useImperativeHandle } from 'react';
import { RecurringFilter, RecurringQuickFilter } from '../../types';
import { Search, X, SlidersHorizontal } from 'lucide-react';

interface RecurringSearchBarProps {
  filter: RecurringFilter;
  dispatch: React.Dispatch<any>;
  activeFilterCount: number;
  quickFilterCounts: Record<RecurringQuickFilter, number>;
  onResetFilters: () => void;
}

const quickFilters: { key: RecurringQuickFilter; label: string }[] = [
  { key: 'active', label: 'Activos' },
  { key: 'paused', label: 'Pausados' },
  { key: 'next7days', label: 'Próx 7 días' },
  { key: 'annual', label: 'Anuales' },
  { key: 'monthly', label: 'Mensuales' },
  { key: 'withIncreases', label: 'Con subidas' },
];

export interface RecurringSearchBarRef {
  focusSearch: () => void;
}

export const RecurringSearchBar = forwardRef<RecurringSearchBarRef, RecurringSearchBarProps>(({
  filter,
  dispatch,
  activeFilterCount,
  quickFilterCounts,
  onResetFilters,
}, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focusSearch: () => inputRef.current?.focus(),
  }));

  return (
    <div className="rec-search-bar">
      {/* Search input */}
      <div className="rec-search-input-wrap">
        <Search size={16} className="rec-search-icon" />
        <input
          ref={inputRef}
          type="text"
          className="rec-search-input"
          placeholder="Buscar recurrente... (nombre, categoría, monto)"
          value={filter.searchTerm}
          onChange={e => dispatch({ type: 'SET_SEARCH', payload: e.target.value })}
        />
        {filter.searchTerm && (
          <button
            className="rec-search-clear"
            onClick={() => dispatch({ type: 'SET_SEARCH', payload: '' })}
          >
            <X size={14} />
          </button>
        )}
        {activeFilterCount > 0 && (
          <span className="rec-filter-count">{activeFilterCount}</span>
        )}
      </div>

      {/* Quick filter chips */}
      <div className="rec-quick-filters">
        {quickFilters.map(qf => (
          <button
            key={qf.key}
            className={`rec-quick-chip ${filter.quickFilter === qf.key ? 'rec-quick-chip--active' : ''}`}
            onClick={() => dispatch({ type: 'SET_QUICK_FILTER', payload: qf.key })}
          >
            {qf.label}
            <span className="rec-quick-chip-count">{quickFilterCounts[qf.key]}</span>
          </button>
        ))}
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="rec-active-filters">
          {filter.type !== 'all' && (
            <span className="rec-filter-chip">
              {filter.type === 'income' ? 'Ingresos' : 'Gastos'}
              <button onClick={() => dispatch({ type: 'SET_TYPE', payload: 'all' })} aria-label="Quitar filtro de tipo"><X size={12} /></button>
            </span>
          )}
          {filter.searchTerm && (
            <span className="rec-filter-chip">
              "{filter.searchTerm}"
              <button onClick={() => dispatch({ type: 'SET_SEARCH', payload: '' })} aria-label="Quitar búsqueda"><X size={12} /></button>
            </span>
          )}
          {filter.quickFilter && (
            <span className="rec-filter-chip">
              {quickFilters.find(q => q.key === filter.quickFilter)?.label}
              <button onClick={() => dispatch({ type: 'SET_QUICK_FILTER', payload: null })} aria-label="Quitar filtro rápido"><X size={12} /></button>
            </span>
          )}
          <button className="rec-filter-reset" onClick={onResetFilters}>
            Limpiar todo
          </button>
        </div>
      )}
    </div>
  );
});

RecurringSearchBar.displayName = 'RecurringSearchBar';
