import { useState, useRef, useCallback, useMemo } from 'react';
import { RecurringTransaction } from '../types';
import { useRecurringFilters } from '../hooks/useRecurringFilters';
import { getChargesInMonth } from '../utils/recurringCalculations';
import { useRecurringKeyboard } from '../hooks/useRecurringKeyboard';
import { useVirtualList } from '../hooks/useVirtualList';
import { RecurringHeader } from './recurring/RecurringHeader';
import { RecurringSearchBar, RecurringSearchBarRef } from './recurring/RecurringSearchBar';
import { RecurringRow } from './recurring/RecurringRow';
import { RecurringDrawer } from './recurring/RecurringDrawer';
import { RecurringBulkBar } from './recurring/RecurringBulkBar';
import { RecurringCalendar } from './recurring/RecurringCalendar';
import { RecurringHealthCard } from './recurring/RecurringHealthCard';
import { RecurringEmptyState } from './recurring/RecurringEmptyState';
import { RecurringSkeleton } from './recurring/RecurringSkeleton';
import { exportRecurringToCSV } from './recurring/RecurringExportUtil';
import { Plus } from 'lucide-react';

interface RecurringTransactionsProps {
  recurring: RecurringTransaction[];
  onAddRecurring: () => void;
  onEditRecurring: (recurring: RecurringTransaction) => void;
  onDeleteRecurring: (id: string) => void;
  onToggleActive: (id: string) => void;
  currency: string;
  onDuplicateRecurring?: (recurring: RecurringTransaction) => void;
  onBulkToggleRecurring?: (ids: string[]) => void;
  onBulkDeleteRecurring?: (ids: string[]) => void;
  onBulkUpdateCategoryRecurring?: (ids: string[], category: string) => void;
  onUpdateTags?: (id: string, tags: string[]) => void;
  onUpdateNotes?: (id: string, notes: string) => void;
}

const REC_ROW_HEIGHT = 56;

export const RecurringTransactions = ({
  recurring,
  onAddRecurring,
  onEditRecurring,
  onDeleteRecurring,
  onToggleActive,
  currency,
  onDuplicateRecurring,
  onBulkToggleRecurring,
  onBulkDeleteRecurring,
  onBulkUpdateCategoryRecurring,
  onUpdateTags,
  onUpdateNotes,
}: RecurringTransactionsProps) => {
  // Filter/sort state
  const {
    filter,
    filteredRecurring: _baseFilteredRecurring,
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
  } = useRecurringFilters(recurring);

  // Calendar day filter (yyyy-MM-dd or null)
  const [selectedCalDay, setSelectedCalDay] = useState<string | null>(null);
  const filteredRecurring = useMemo(() => {
    if (!selectedCalDay) return _baseFilteredRecurring;
    const target = new Date(selectedCalDay);
    return _baseFilteredRecurring.filter(r => {
      try {
        const charges = getChargesInMonth(r, target);
        return charges.some(d => d.toISOString().slice(0, 10) === selectedCalDay);
      } catch {
        return false;
      }
    });
  }, [_baseFilteredRecurring, selectedCalDay]);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);

  // Refs
  const searchBarRef = useRef<RecurringSearchBarRef>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Virtual list
  const { virtualizer, virtualItems, totalSize } = useVirtualList({
    count: filteredRecurring.length,
    parentRef: listRef as React.RefObject<HTMLDivElement>,
    compact: false,
    overscan: 10,
  });

  // Drawer item
  const drawerItem = useMemo(
    () => recurring.find(r => r.id === drawerId) || null,
    [recurring, drawerId]
  );

  // Selection helpers
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const deselectAll = useCallback(() => setSelectedIds(new Set()), []);

  // Row click -> open drawer
  const handleRowClick = useCallback((id: string) => {
    setDrawerId(id);
  }, []);

  // Delete with confirmation
  const handleDelete = useCallback((id: string) => {
    const item = recurring.find(r => r.id === id);
    if (item && window.confirm(`¿Eliminar "${item.description}"?`)) {
      onDeleteRecurring(id);
      if (drawerId === id) setDrawerId(null);
    }
  }, [recurring, onDeleteRecurring, drawerId]);

  // Bulk actions
  const handleBulkToggle = useCallback((ids: string[]) => {
    if (onBulkToggleRecurring) {
      onBulkToggleRecurring(ids);
    } else {
      ids.forEach(id => onToggleActive(id));
    }
    deselectAll();
  }, [onBulkToggleRecurring, onToggleActive, deselectAll]);

  const handleBulkDelete = useCallback((ids: string[]) => {
    if (window.confirm(`¿Eliminar ${ids.length} recurrente${ids.length !== 1 ? 's' : ''}?`)) {
      if (onBulkDeleteRecurring) {
        onBulkDeleteRecurring(ids);
      } else {
        ids.forEach(id => onDeleteRecurring(id));
      }
      deselectAll();
      if (drawerId && ids.includes(drawerId)) setDrawerId(null);
    }
  }, [onBulkDeleteRecurring, onDeleteRecurring, deselectAll, drawerId]);

  const handleExport = useCallback((ids: string[]) => {
    const items = recurring.filter(r => ids.includes(r.id));
    exportRecurringToCSV(items, currency);
    deselectAll();
  }, [recurring, currency, deselectAll]);

  // Keyboard
  useRecurringKeyboard({
    rowCount: filteredRecurring.length,
    focusedIndex,
    onFocusChange: setFocusedIndex,
    onOpenDrawer: () => {
      if (focusedIndex >= 0 && focusedIndex < filteredRecurring.length) {
        setDrawerId(filteredRecurring[focusedIndex].id);
      }
    },
    onCloseDrawer: () => setDrawerId(null),
    onNewRecurring: onAddRecurring,
    onFocusSearch: () => searchBarRef.current?.focusSearch(),
    onEditFocused: () => {
      if (focusedIndex >= 0 && focusedIndex < filteredRecurring.length) {
        onEditRecurring(filteredRecurring[focusedIndex]);
      }
    },
    onDeleteFocused: () => {
      if (focusedIndex >= 0 && focusedIndex < filteredRecurring.length) {
        handleDelete(filteredRecurring[focusedIndex].id);
      }
    },
    onToggleSelectFocused: () => {
      if (focusedIndex >= 0 && focusedIndex < filteredRecurring.length) {
        toggleSelect(filteredRecurring[focusedIndex].id);
      }
    },
    onPauseFocused: () => {
      if (focusedIndex >= 0 && focusedIndex < filteredRecurring.length) {
        onToggleActive(filteredRecurring[focusedIndex].id);
      }
    },
    drawerOpen: drawerId !== null,
  });

  // Empty state for no data at all
  if (recurring.length === 0) {
    return (
      <div className="rec-container">
        <RecurringEmptyState variant="no-data" onAddRecurring={onAddRecurring} />
      </div>
    );
  }

  return (
    <div className="rec-container">
      {/* Header with KPIs */}
      <div className="rec-top-bar">
        <h2 className="rec-title">Recurrentes</h2>
        <button className="rec-add-btn" onClick={onAddRecurring}>
          <Plus size={16} />
          Nuevo
        </button>
      </div>

      <RecurringHeader
        recurring={recurring}
        period={period}
        onPeriodChange={setPeriod}
        periodTotals={periodTotals}
        currency={currency}
      />

      {/* Calendar (moved above search per UX feedback — quick visual scan
          of upcoming charges before diving into search/filtering) */}
      <RecurringCalendar
        recurring={recurring}
        currency={currency}
        selectedDay={selectedCalDay}
        onSelectDay={setSelectedCalDay}
      />

      {/* Search + Filters */}
      <RecurringSearchBar
        ref={searchBarRef}
        filter={filter}
        dispatch={dispatch}
        activeFilterCount={activeFilterCount}
        quickFilterCounts={quickFilterCounts}
        onResetFilters={resetFilters}
      />

      {/* Sort controls */}
      <div className="rec-sort-bar">
        <span className="rec-sort-label">{filteredRecurring.length} recurrente{filteredRecurring.length !== 1 ? 's' : ''}</span>
        <div className="rec-sort-controls">
          <select
            className="rec-sort-select"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
          >
            <option value="nextDate">Próximo cobro</option>
            <option value="amount">Monto</option>
            <option value="name">Nombre</option>
            <option value="category">Categoría</option>
          </select>
          <button
            className="rec-sort-dir"
            onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
            title={sortDir === 'asc' ? 'Ascendente' : 'Descendente'}
          >
            {sortDir === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Main content area with list + drawer */}
      <div className={`rec-main ${drawerId ? 'rec-main--drawer-open' : ''}`}>
        <div className="rec-list-area">
          {isLoading ? (
            <RecurringSkeleton />
          ) : filteredRecurring.length === 0 ? (
            <RecurringEmptyState
              variant="no-results"
              onAddRecurring={onAddRecurring}
              onResetFilters={resetFilters}
            />
          ) : (
            <div
              ref={listRef}
              className="rec-list-scroll"
              style={{ height: Math.min(filteredRecurring.length * REC_ROW_HEIGHT, 600), overflow: 'auto' }}
            >
              <div style={{ height: totalSize, width: '100%', position: 'relative' }}>
                {virtualItems.map(vRow => {
                  const item = filteredRecurring[vRow.index];
                  if (!item) return null;
                  return (
                    <RecurringRow
                      key={item.id}
                      item={item}
                      isSelected={selectedIds.has(item.id)}
                      isFocused={focusedIndex === vRow.index}
                      onSelect={toggleSelect}
                      onClick={handleRowClick}
                      onToggleActive={onToggleActive}
                      onEdit={onEditRecurring}
                      onDuplicate={onDuplicateRecurring}
                      onDelete={handleDelete}
                      currency={currency}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${vRow.size}px`,
                        transform: `translateY(${vRow.start}px)`,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Drawer */}
        <RecurringDrawer
          item={drawerItem}
          isOpen={drawerId !== null}
          onClose={() => setDrawerId(null)}
          onToggleActive={onToggleActive}
          onEdit={onEditRecurring}
          onDelete={handleDelete}
          onDuplicate={onDuplicateRecurring}
          onUpdateTags={onUpdateTags}
          onUpdateNotes={onUpdateNotes}
          currency={currency}
        />
      </div>

      {/* Health Card */}
      <RecurringHealthCard recurring={recurring} onDeleteRecurring={onDeleteRecurring} currency={currency} />

      {/* Bulk action bar */}
      <RecurringBulkBar
        selectedIds={selectedIds}
        recurring={recurring}
        onBulkToggle={handleBulkToggle}
        onBulkDelete={handleBulkDelete}
        onBulkUpdateCategory={onBulkUpdateCategoryRecurring}
        onExport={handleExport}
        onDeselectAll={deselectAll}
        currency={currency}
      />
    </div>
  );
};
