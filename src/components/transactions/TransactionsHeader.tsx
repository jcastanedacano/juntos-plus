import { useRef, useState, useCallback } from 'react';
import { Search, Plus, Download, Upload } from 'lucide-react';
import { Transaction, TransactionFilter } from '../../types';
import { getCategoryById, getAllCategories } from '../../utils/categoryHelpers';
import { SegmentedControl } from './SegmentedControl';
import { FilterChip } from './FilterChip';
import { FilterDropdown } from './FilterDropdown';

interface TransactionsHeaderProps {
  transactions: Transaction[];
  filter: TransactionFilter;
  filteredCount: number;
  activeFilterCount: number;
  dispatch: React.Dispatch<any>;
  resetFilters: () => void;
  removeFilter: (key: keyof TransactionFilter) => void;
  onAddNew: () => void;
  onImport?: () => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

export function TransactionsHeader({
  transactions,
  filter,
  filteredCount,
  activeFilterCount,
  dispatch,
  resetFilters,
  removeFilter,
  onAddNew,
  onImport,
  searchInputRef,
}: TransactionsHeaderProps) {
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const categoryBtnRef = useRef<HTMLButtonElement>(null);

  const handleDateApply = useCallback(() => {
    if (dateStart && dateEnd) {
      dispatch({ type: 'SET_DATE_RANGE', payload: { start: dateStart, end: dateEnd } });
    }
    setDateDropdownOpen(false);
  }, [dateStart, dateEnd, dispatch]);

  const typeLabel = filter.type === 'income' ? 'Ingresos' : filter.type === 'expense' ? 'Gastos' : null;
  const catNames = filter.categories.map(
    (id) => getCategoryById(id)?.name || id
  );

  return (
    <div className="txn-header">
      <div className="txn-header-top">
        <div className="txn-header-title">
          <h2>Transacciones</h2>
          <span className="txn-header-count">{filteredCount}</span>
        </div>
        <div className="txn-header-actions">
          <button className="txn-btn txn-btn--primary" onClick={onAddNew}>
            <Plus size={16} /> Nueva
          </button>
          {onImport && (
            <button className="txn-btn txn-btn--outline" onClick={onImport}>
              <Upload size={16} /> Importar
            </button>
          )}
          <button className="txn-btn txn-btn--ghost" onClick={() => {/* export placeholder */}}>
            <Download size={16} /> Exportar
          </button>
        </div>
      </div>

      <SegmentedControl
        value={filter.type}
        onChange={(val) => dispatch({ type: 'SET_TYPE', payload: val })}
        transactions={transactions}
      />

      <div className="txn-header-filters">
        <div className="txn-search-wrapper">
          <Search size={16} className="txn-search-icon" />
          <input
            ref={searchInputRef as React.RefObject<HTMLInputElement>}
            type="text"
            className="txn-search-input"
            placeholder="Buscar transacciones...  (/)"
            value={filter.searchTerm}
            onChange={(e) => dispatch({ type: 'SET_SEARCH', payload: e.target.value })}
          />
        </div>

        <div className="txn-filter-group">
          <div style={{ position: 'relative' }}>
            <button
              ref={categoryBtnRef}
              className="txn-btn txn-btn--outline"
              onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
            >
              Categorías {filter.categories.length > 0 && `(${filter.categories.length})`}
            </button>
            <FilterDropdown open={categoryDropdownOpen} onClose={() => setCategoryDropdownOpen(false)}>
              <div className="txn-category-dropdown">
                <div className="txn-category-dropdown-title">Seleccionar categorías</div>
                {getAllCategories().map((cat) => (
                  <label key={cat.id} className="txn-category-option">
                    <input
                      type="checkbox"
                      checked={filter.categories.includes(cat.id)}
                      onChange={() => dispatch({ type: 'TOGGLE_CATEGORY', payload: cat.id })}
                    />
                    <span>{cat.icon} {cat.name}</span>
                  </label>
                ))}
              </div>
            </FilterDropdown>
          </div>

          <div style={{ position: 'relative' }}>
            <button
              className="txn-btn txn-btn--outline"
              onClick={() => setDateDropdownOpen(!dateDropdownOpen)}
            >
              Fecha {filter.dateRange && '✓'}
            </button>
            <FilterDropdown open={dateDropdownOpen} onClose={() => setDateDropdownOpen(false)}>
              <div className="txn-date-dropdown">
                <div className="txn-date-dropdown-title">Rango de fechas</div>
                <label className="txn-date-label">
                  Desde
                  <input
                    type="date"
                    className="txn-date-input"
                    value={dateStart}
                    onChange={(e) => setDateStart(e.target.value)}
                  />
                </label>
                <label className="txn-date-label">
                  Hasta
                  <input
                    type="date"
                    className="txn-date-input"
                    value={dateEnd}
                    onChange={(e) => setDateEnd(e.target.value)}
                  />
                </label>
                <button className="txn-btn txn-btn--primary txn-date-apply" onClick={handleDateApply}>
                  Aplicar
                </button>
              </div>
            </FilterDropdown>
          </div>
        </div>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="txn-header-chips">
          {typeLabel && (
            <FilterChip label={`Tipo: ${typeLabel}`} onRemove={() => removeFilter('type')} />
          )}
          {filter.dateRange && (
            <FilterChip
              label={`Fecha: ${filter.dateRange.start} → ${filter.dateRange.end}`}
              onRemove={() => removeFilter('dateRange')}
            />
          )}
          {catNames.length > 0 && (
            <FilterChip
              label={`Categorías: ${catNames.join(', ')}`}
              onRemove={() => removeFilter('categories')}
            />
          )}
          {filter.searchTerm && (
            <FilterChip label={`Buscar: "${filter.searchTerm}"`} onRemove={() => removeFilter('searchTerm')} />
          )}
          <button className="txn-chips-clear" onClick={resetFilters}>
            Limpiar todo
          </button>
        </div>
      )}
    </div>
  );
}
