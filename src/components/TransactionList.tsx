import { useState, useRef, useCallback, useMemo } from 'react';
import { Transaction, Owner } from '../types';
import { formatCurrency } from '../utils/calculations';
import { useFxRates, txBaseAmount } from '../utils/fx';
import { ownerOf } from '../utils/ownership';
import { useOwnerLabels } from '../utils/ownerLabels';
import { useTransactionFilters } from '../hooks/useTransactionFilters';
import { useVirtualList } from '../hooks/useVirtualList';
import { useTransactionKeyboard } from '../hooks/useTransactionKeyboard';
import { useToast } from './ui/Toast';
import { TransactionsHeader } from './transactions/TransactionsHeader';
import { TransactionsCalendar } from './transactions/TransactionsCalendar';
import { TransactionRow } from './transactions/TransactionRow';
import { BulkActionBar } from './transactions/BulkActionBar';
import { TransactionDrawer } from './transactions/TransactionDrawer';
import { TransactionEmptyState } from './transactions/TransactionEmptyState';
import { TrendingUp, TrendingDown, ArrowRightLeft } from 'lucide-react';

interface TransactionListProps {
  transactions: Transaction[];
  currency: string;
  onDelete: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  onAddNew?: () => void;
  onImport?: () => void;
  onBulkDelete?: (ids: string[]) => void;
  onInlineUpdate?: (transaction: Transaction) => void;
}

export const TransactionList = ({
  transactions,
  currency,
  onDelete,
  onEdit,
  onAddNew,
  onImport,
  onBulkDelete,
  onInlineUpdate,
}: TransactionListProps) => {
  const { addToast } = useToast();

  // Filter/search state
  const {
    filter,
    filteredTransactions: _baseFiltered,
    activeFilterCount,
    dispatch,
    resetFilters: _baseResetFilters,
    removeFilter,
  } = useTransactionFilters(transactions);

  // Ownership filter (couple-finance: shared / me / partner / all)
  const [ownerFilter, setOwnerFilter] = useState<'all' | Owner>('all');
  const ownerLabels = useOwnerLabels();

  // Day filter from the calendar (yyyy-MM-dd or null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Combined reset: clears the hook's filters PLUS the layers added later
  // (ownerFilter and selectedDay live as local state outside the reducer).
  // Without this wrapper, the empty-state "Restablecer filtros" button only
  // half-resets and the user wonders why nothing changed.
  const resetFilters = useCallback(() => {
    _baseResetFilters();
    setOwnerFilter('all');
    setSelectedDay(null);
  }, [_baseResetFilters]);

  const filteredTransactions = useMemo(() => {
    let out = _baseFiltered;
    if (ownerFilter !== 'all') {
      out = out.filter(t => ownerOf(t) === ownerFilter);
    }
    if (selectedDay) {
      out = out.filter(t => (t.date || '').slice(0, 10) === selectedDay);
    }
    return out;
  }, [_baseFiltered, ownerFilter, selectedDay]);

  // Total active filters (hook + new layers) — used by the header chip.
  const totalActiveFilters = activeFilterCount
    + (ownerFilter !== 'all' ? 1 : 0)
    + (selectedDay ? 1 : 0);

  // Selection
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const lastSelectedRef = useRef<number>(-1);

  // Summary banner — sums in base currency (PEN) using FX rates. Each tx
  // contributes its PEN-equivalent so $ and S/ collapse into one number.
  const fxRates = useFxRates();
  const summaryTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    let hasFx = false;
    for (const t of filteredTransactions) {
      const amt = txBaseAmount(t, fxRates);
      if (t.currency && t.currency !== 'PEN') hasFx = true;
      if (t.type === 'income') income += amt;
      else expense += amt;
    }
    return { income, expense, balance: income - expense, hasFx };
  }, [filteredTransactions, fxRates]);

  // Date group headers - compute which rows start a new date
  const dateGroupStarts = useMemo(() => {
    const starts = new Set<number>();
    let lastDate = '';
    filteredTransactions.forEach((tx, i) => {
      const d = tx.date?.slice(0, 10) || '';
      if (d !== lastDate) {
        starts.add(i);
        lastDate = d;
      }
    });
    return starts;
  }, [filteredTransactions]);

  // Drawer
  const [drawerTxnId, setDrawerTxnId] = useState<string | null>(null);
  const drawerTransaction = drawerTxnId
    ? filteredTransactions.find((t) => t.id === drawerTxnId) || null
    : null;

  // Inline edit
  const [inlineEdit, setInlineEdit] = useState<{ id: string; field: string } | null>(null);

  // Keyboard focused row
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Virtualization
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { virtualizer, virtualItems, totalSize } = useVirtualList({
    count: filteredTransactions.length,
    parentRef: scrollRef,
  });

  // Selection handlers
  const handleSelect = useCallback(
    (id: string, shiftKey: boolean) => {
      setSelection((prev) => {
        const next = new Set(prev);
        const currentIdx = filteredTransactions.findIndex((t) => t.id === id);

        if (shiftKey && lastSelectedRef.current >= 0) {
          const start = Math.min(lastSelectedRef.current, currentIdx);
          const end = Math.max(lastSelectedRef.current, currentIdx);
          for (let i = start; i <= end; i++) {
            next.add(filteredTransactions[i].id);
          }
        } else {
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
        }

        lastSelectedRef.current = currentIdx;
        return next;
      });
    },
    [filteredTransactions]
  );

  const handleDeselectAll = useCallback(() => setSelection(new Set()), []);

  // Delete with undo
  const handleDeleteWithUndo = useCallback(
    (id: string) => {
      const tx = transactions.find((t) => t.id === id);
      onDelete(id);
      if (tx) {
        addToast({
          type: 'success',
          message: 'Transacción eliminada',
          duration: 6000,
          action: {
            label: 'Deshacer',
            onClick: () => {
              // The parent will need to re-add; we pass via onInlineUpdate as a restore
              if (onInlineUpdate) {
                onInlineUpdate(tx);
              }
            },
          },
        });
      }
    },
    [transactions, onDelete, addToast, onInlineUpdate]
  );

  // Bulk categorize: applies a single category to every selected transaction.
  // Uses onInlineUpdate (already wired in App.tsx for in-place edits) so no
  // new backend handler is needed.
  const handleBulkCategorize = useCallback(
    (categoryId: string) => {
      const ids = Array.from(selection);
      if (ids.length === 0 || !onInlineUpdate) return;
      let n = 0;
      for (const id of ids) {
        const tx = transactions.find(t => t.id === id);
        if (tx) {
          onInlineUpdate({ ...tx, category: categoryId });
          n++;
        }
      }
      addToast({
        type: 'success',
        message: `${n} transacción(es) recategorizadas`,
        duration: 5000,
      });
      setSelection(new Set());
    },
    [selection, transactions, onInlineUpdate, addToast]
  );

  // Bulk delete
  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selection);
    if (ids.length === 0) return;
    if (onBulkDelete) {
      onBulkDelete(ids);
    } else {
      ids.forEach((id) => onDelete(id));
    }
    addToast({ type: 'success', message: `${ids.length} transacción(es) eliminada(s)` });
    setSelection(new Set());
  }, [selection, onBulkDelete, onDelete, addToast]);

  // Inline edit handlers
  const handleStartInlineEdit = useCallback((id: string, field: string) => {
    setInlineEdit({ id, field });
  }, []);

  const handleConfirmInlineEdit = useCallback(
    (id: string, field: string, value: string) => {
      const tx = transactions.find((t) => t.id === id);
      if (tx && onInlineUpdate) {
        onInlineUpdate({ ...tx, [field]: value });
      }
      setInlineEdit(null);
    },
    [transactions, onInlineUpdate]
  );

  const handleCancelInlineEdit = useCallback(() => setInlineEdit(null), []);

  // Keyboard shortcuts
  useTransactionKeyboard({
    rowCount: filteredTransactions.length,
    focusedIndex,
    onFocusChange: (idx) => {
      setFocusedIndex(idx);
      virtualizer.scrollToIndex(idx, { align: 'auto' });
    },
    onOpenDrawer: () => {
      const tx = filteredTransactions[focusedIndex];
      if (tx) setDrawerTxnId(tx.id);
    },
    onCloseDrawer: () => setDrawerTxnId(null),
    onNewTransaction: () => onAddNew?.(),
    onFocusSearch: () => searchInputRef.current?.focus(),
    onEditFocused: () => {
      const tx = filteredTransactions[focusedIndex];
      if (tx) onEdit(tx);
    },
    onDeleteFocused: () => {
      const tx = filteredTransactions[focusedIndex];
      if (tx) handleDeleteWithUndo(tx.id);
    },
    onToggleSelectFocused: () => {
      const tx = filteredTransactions[focusedIndex];
      if (tx) handleSelect(tx.id, false);
    },
    onTabChange: (tab) => dispatch({ type: 'SET_TYPE', payload: tab }),
    drawerOpen: !!drawerTxnId,
  });

  // Empty states
  if (transactions.length === 0) {
    return (
      <div className="txn-container">
        <TransactionsHeader
          transactions={transactions}
          filter={filter}
          filteredCount={0}
          activeFilterCount={totalActiveFilters}
          dispatch={dispatch}
          resetFilters={resetFilters}
          removeFilter={removeFilter}
          onAddNew={onAddNew || (() => {})}
          onImport={onImport}
          searchInputRef={searchInputRef}
        />
        <TransactionEmptyState variant="no-data" onAction={onAddNew || (() => {})} />
      </div>
    );
  }

  if (filteredTransactions.length === 0) {
    return (
      <div className="txn-container">
        <TransactionsHeader
          transactions={transactions}
          filter={filter}
          filteredCount={0}
          activeFilterCount={totalActiveFilters}
          dispatch={dispatch}
          resetFilters={resetFilters}
          removeFilter={removeFilter}
          onAddNew={onAddNew || (() => {})}
          onImport={onImport}
          searchInputRef={searchInputRef}
        />
        <TransactionEmptyState variant="no-results" onAction={resetFilters} />
      </div>
    );
  }

  return (
    <div className="txn-container">
      <TransactionsHeader
        transactions={transactions}
        filter={filter}
        filteredCount={filteredTransactions.length}
        activeFilterCount={totalActiveFilters}
        dispatch={dispatch}
        resetFilters={resetFilters}
        removeFilter={removeFilter}
        onAddNew={onAddNew || (() => {})}
        onImport={onImport}
        searchInputRef={searchInputRef}
      />

      {/* Calendar — click a day to filter the list to that day */}
      <TransactionsCalendar
        transactions={transactions}
        currency={currency}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
      />

      {/* Owner filter chips (compartido / yo / pareja) */}
      <div className="owner-filter-chips" role="tablist" aria-label="Filtrar por quién paga">
        <button
          type="button"
          role="tab"
          aria-selected={ownerFilter === 'all'}
          className={`owner-chip ${ownerFilter === 'all' ? 'active' : ''}`}
          onClick={() => setOwnerFilter('all')}
        >
          Todas
        </button>
        {(['shared', 'me', 'partner'] as Owner[]).map(o => (
          <button
            key={o}
            type="button"
            role="tab"
            aria-selected={ownerFilter === o}
            className={`owner-chip owner-${o} ${ownerFilter === o ? 'active' : ''}`}
            onClick={() => setOwnerFilter(o)}
          >
            {ownerLabels[o]}
          </button>
        ))}
      </div>

      {/* Summary banner — single total in PEN, USD/EUR converted at FX rate */}
      <div className="txn-summary-banner">
        <div className="txn-summary-item">
          <TrendingUp size={16} className="txn-summary-icon txn-summary-icon--green" />
          <div>
            <span className="txn-summary-label">Ingresos</span>
            <span className="txn-summary-value txn-summary-value--green">
              {formatCurrency(summaryTotals.income, 'PEN')}
            </span>
          </div>
        </div>
        <div className="txn-summary-item">
          <TrendingDown size={16} className="txn-summary-icon txn-summary-icon--red" />
          <div>
            <span className="txn-summary-label">Gastos</span>
            <span className="txn-summary-value txn-summary-value--red">
              {formatCurrency(summaryTotals.expense, 'PEN')}
            </span>
          </div>
        </div>
        <div className="txn-summary-item">
          <ArrowRightLeft size={16} className="txn-summary-icon txn-summary-icon--blue" />
          <div>
            <span className="txn-summary-label">Balance</span>
            <span className={`txn-summary-value ${summaryTotals.balance >= 0 ? 'txn-summary-value--green' : 'txn-summary-value--red'}`}>
              {summaryTotals.balance >= 0 ? '' : '−'}{formatCurrency(Math.abs(summaryTotals.balance), 'PEN')}
            </span>
          </div>
        </div>
        {summaryTotals.hasFx && (
          <div className="txn-summary-item" style={{ flex: '0 1 auto' }} title={`USD a S/${fxRates.USD.toFixed(2)} · EUR a S/${fxRates.EUR.toFixed(2)}`}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              USD a TC {fxRates.USD.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Grid header */}
      <div className="txn-grid-header">
        <div className="txn-row-check">
          <input
            type="checkbox"
            className="txn-checkbox"
            checked={selection.size === filteredTransactions.length && filteredTransactions.length > 0}
            onChange={() => {
              if (selection.size === filteredTransactions.length) {
                handleDeselectAll();
              } else {
                setSelection(new Set(filteredTransactions.map((t) => t.id)));
              }
            }}
            aria-label="Seleccionar todas"
          />
        </div>
        <div className="txn-col-header">Categoría</div>
        <div className="txn-col-header">Descripción</div>
        <div className="txn-col-header txn-col-account">Cuenta</div>
        <div className="txn-col-header txn-col-date">Fecha</div>
        <div className="txn-col-header txn-col-amount">Monto</div>
        <div className="txn-col-header txn-col-actions" />
      </div>

      {/* Virtualized rows */}
      <div ref={scrollRef} className="txn-scroll-container">
        <div style={{ height: totalSize, width: '100%', position: 'relative' }}>
          {virtualItems.map((vItem) => {
            const tx = filteredTransactions[vItem.index];
            const isDateStart = dateGroupStarts.has(vItem.index);
            return (
              <TransactionRow
                key={tx.id}
                transaction={tx}
                isSelected={selection.has(tx.id)}
                isFocused={focusedIndex === vItem.index}
                showDateHeader={isDateStart}
                onSelect={handleSelect}
                onOpenDrawer={(id) => setDrawerTxnId(id)}
                onEdit={onEdit}
                onDelete={handleDeleteWithUndo}
                inlineEdit={inlineEdit}
                onStartInlineEdit={handleStartInlineEdit}
                onConfirmInlineEdit={handleConfirmInlineEdit}
                onCancelInlineEdit={handleCancelInlineEdit}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${vItem.size}px`,
                  transform: `translateY(${vItem.start}px)`,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Bulk action bar */}
      <BulkActionBar
        count={selection.size}
        onDelete={handleBulkDelete}
        onDeselect={handleDeselectAll}
        onCategorize={handleBulkCategorize}
      />

      {/* Transaction detail drawer */}
      <TransactionDrawer
        transaction={drawerTransaction}
        open={!!drawerTxnId}
        onClose={() => setDrawerTxnId(null)}
        onEdit={onEdit}
        onDelete={handleDeleteWithUndo}
      />
    </div>
  );
};
