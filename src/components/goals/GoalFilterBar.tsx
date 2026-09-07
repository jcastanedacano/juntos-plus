import { useRef, forwardRef, useImperativeHandle } from 'react';
import { GoalStatusFilter, GoalPeriodFilter, GoalSortBy, GoalViewMode } from '../../types';
import { Search, X, LayoutGrid, List } from 'lucide-react';

interface GoalFilterBarProps {
  statusFilter: GoalStatusFilter;
  onStatusChange: (s: GoalStatusFilter) => void;
  periodFilter: GoalPeriodFilter;
  onPeriodChange: (p: GoalPeriodFilter) => void;
  searchTerm: string;
  onSearchChange: (s: string) => void;
  sortBy: GoalSortBy;
  onSortChange: (s: GoalSortBy) => void;
  viewMode: GoalViewMode;
  onViewModeChange: (v: GoalViewMode) => void;
  filterCounts: Record<GoalStatusFilter, number>;
  activeFilterCount: number;
  onResetFilters: () => void;
}

const statusOptions: { key: GoalStatusFilter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'active', label: 'Activas' },
  { key: 'paused', label: 'Pausadas' },
  { key: 'completed', label: 'Completadas' },
];

const periodOptions: { key: GoalPeriodFilter; label: string }[] = [
  { key: 'month', label: 'Mes' },
  { key: 'quarter', label: 'Trimestre' },
  { key: 'year', label: 'Año' },
];

export interface GoalFilterBarRef {
  focusSearch: () => void;
}

export const GoalFilterBar = forwardRef<GoalFilterBarRef, GoalFilterBarProps>(({
  statusFilter,
  onStatusChange,
  periodFilter,
  onPeriodChange,
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  filterCounts,
  activeFilterCount,
  onResetFilters,
}, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focusSearch: () => inputRef.current?.focus(),
  }));

  return (
    <div className="gl-filter-bar">
      {/* Status chips */}
      <div className="gl-filter-row">
        <div className="gl-status-chips">
          {statusOptions.map(opt => (
            <button
              key={opt.key}
              className={`gl-chip ${statusFilter === opt.key ? 'gl-chip--active' : ''}`}
              onClick={() => onStatusChange(opt.key)}
            >
              {opt.label}
              <span className="gl-chip-count">{filterCounts[opt.key]}</span>
            </button>
          ))}
        </div>

        {/* Period chips */}
        <div className="gl-period-chips">
          {periodOptions.map(opt => (
            <button
              key={opt.key}
              className={`gl-period-btn ${periodFilter === opt.key ? 'gl-period-btn--active' : ''}`}
              onClick={() => onPeriodChange(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search + Sort + View Toggle */}
      <div className="gl-toolbar">
        <div className="gl-search-wrap">
          <Search size={15} className="gl-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="gl-search-input"
            placeholder="Buscar meta..."
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
          />
          {searchTerm && (
            <button className="gl-search-clear" onClick={() => onSearchChange('')}>
              <X size={14} />
            </button>
          )}
        </div>

        <select
          className="gl-sort-select"
          value={sortBy}
          onChange={e => onSortChange(e.target.value as GoalSortBy)}
        >
          <option value="progress">Progreso</option>
          <option value="amount">Monto</option>
          <option value="deadline">Fecha fin</option>
          <option value="name">Nombre</option>
        </select>

        <div className="gl-view-toggle">
          <button
            className={`gl-view-btn ${viewMode === 'cards' ? 'gl-view-btn--active' : ''}`}
            onClick={() => onViewModeChange('cards')}
            title="Vista tarjetas"
            aria-label="Vista tarjetas"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            className={`gl-view-btn ${viewMode === 'list' ? 'gl-view-btn--active' : ''}`}
            onClick={() => onViewModeChange('list')}
            title="Vista lista"
            aria-label="Vista lista"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Active filters */}
      {activeFilterCount > 0 && (
        <div className="gl-active-filters">
          {statusFilter !== 'all' && (
            <span className="gl-filter-tag">
              {statusOptions.find(o => o.key === statusFilter)?.label}
              <button onClick={() => onStatusChange('all')} aria-label="Quitar filtro de estado"><X size={11} /></button>
            </span>
          )}
          {periodFilter !== 'year' && (
            <span className="gl-filter-tag">
              {periodOptions.find(o => o.key === periodFilter)?.label}
              <button onClick={() => onPeriodChange('year')} aria-label="Quitar filtro de periodo"><X size={11} /></button>
            </span>
          )}
          {searchTerm && (
            <span className="gl-filter-tag">
              "{searchTerm}"
              <button onClick={() => onSearchChange('')} aria-label="Quitar búsqueda"><X size={11} /></button>
            </span>
          )}
          <button className="gl-filter-reset" onClick={onResetFilters}>Limpiar</button>
        </div>
      )}
    </div>
  );
});

GoalFilterBar.displayName = 'GoalFilterBar';
