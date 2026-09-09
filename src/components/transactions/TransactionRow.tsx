import { memo, useMemo } from 'react';
import { Transaction } from '../../types';
import { getCategoryById } from '../../utils/categoryHelpers';
import { formatCurrency } from '../../utils/calculations';
import { getMonedaBase } from '../../utils/fx';
import { normalizeDescription } from '../../utils/descriptionNormalizer';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { InlineEditCell } from './InlineEditCell';
import { parseDateOnly } from '../../utils/stableDate';

interface TransactionRowProps {
  transaction: Transaction;
  isSelected: boolean;
  isFocused: boolean;
  showDateHeader?: boolean;
  onSelect: (id: string, shiftKey: boolean) => void;
  onOpenDrawer: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  inlineEdit: { id: string; field: string } | null;
  onStartInlineEdit: (id: string, field: string) => void;
  onConfirmInlineEdit: (id: string, field: string, value: string) => void;
  onCancelInlineEdit: () => void;
  style: React.CSSProperties;
}

export const TransactionRow = memo(function TransactionRow({
  transaction,
  isSelected,
  isFocused,
  showDateHeader,
  onSelect,
  onOpenDrawer,
  onEdit,
  onDelete,
  inlineEdit,
  onStartInlineEdit,
  onConfirmInlineEdit,
  onCancelInlineEdit,
  style,
}: TransactionRowProps) {
  const cat = getCategoryById(transaction.category);
  const isRecurring = !!transaction.sourceRecurringId;
  const normalized = useMemo(() => normalizeDescription(transaction.description || ''), [transaction.description]);
  const displayName = normalized.wasNormalized ? normalized.normalizedName : transaction.description;

  const formatDate = (dateStr: string) => {
    try {
      return format(parseDateOnly(dateStr), "d MMM", { locale: es });
    } catch {
      return dateStr;
    }
  };

  const cls = [
    'txn-row',
    isSelected && 'txn-row--selected',
    isFocused && 'txn-row--focused',
    showDateHeader && 'txn-row--date-start',
  ]
    .filter(Boolean)
    .join(' ');

  const formatFullDate = (dateStr: string) => {
    try {
      return format(parseDateOnly(dateStr), "EEEE d 'de' MMMM", { locale: es });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className={cls} style={style} data-txn-id={transaction.id}>
      {showDateHeader && (
        <div className="txn-date-divider">
          <span>{formatFullDate(transaction.date)}</span>
        </div>
      )}
      {/* Checkbox */}
      <div className="txn-row-check">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect(transaction.id, e.nativeEvent instanceof MouseEvent ? (e.nativeEvent as MouseEvent).shiftKey : false);
          }}
          className="txn-checkbox"
          aria-label={`Seleccionar transacción ${cat?.name}`}
        />
      </div>

      {/* Category */}
      <div className="txn-row-category" onClick={() => onOpenDrawer(transaction.id)}>
        <span
          className="txn-row-category-icon"
          style={{ backgroundColor: (cat?.color || '#666') + '20', color: cat?.color }}
        >
          {cat?.icon || '💱'}
        </span>
        <span className="txn-row-category-label">{cat?.name || transaction.category}</span>
        {isRecurring && <span className="txn-badge-recurring" title="Recurrente">↻</span>}
        {transaction.receiptImageUrl && <span className="txn-badge-receipt" title="Recibo adjunto">🧾</span>}
      </div>

      {/* Description (inline editable) */}
      <div className="txn-row-description">
        <InlineEditCell
          value={transaction.description || '—'}
          displayValue={displayName || '—'}
          isEditing={inlineEdit?.id === transaction.id && inlineEdit?.field === 'description'}
          onStartEdit={() => onStartInlineEdit(transaction.id, 'description')}
          onConfirm={(val) => onConfirmInlineEdit(transaction.id, 'description', val)}
          onCancel={onCancelInlineEdit}
        />
      </div>

      {/* Account */}
      <div className="txn-row-account">
        {transaction.accountId && transaction.accountId !== 'default' ? transaction.accountId : '—'}
      </div>

      {/* Date */}
      <div className="txn-row-date">{formatDate(transaction.date)}</div>

      {/* Amount */}
      <div className={`txn-row-amount ${transaction.type === 'income' ? 'txn-amount-positive' : 'txn-amount-negative'}`}>
        <span className="txn-amount-sign">{transaction.type === 'income' ? '+' : '-'}</span>
        {formatCurrency(transaction.amount, transaction.currency || getMonedaBase())}
      </div>

      {/* Actions */}
      <div className="txn-row-actions">
        <button className="txn-action-btn" onClick={() => onEdit(transaction)} title="Editar" aria-label="Editar transacción">
          <Pencil size={14} />
        </button>
        <button className="txn-action-btn txn-action-btn--danger" onClick={() => onDelete(transaction.id)} title="Eliminar" aria-label="Eliminar transacción">
          <Trash2 size={14} />
        </button>
        <button className="txn-action-btn" onClick={() => onOpenDrawer(transaction.id)} title="Detalles" aria-label="Ver detalles">
          <MoreHorizontal size={14} />
        </button>
      </div>
    </div>
  );
});
