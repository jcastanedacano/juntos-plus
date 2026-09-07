import { memo, useCallback } from 'react';
import { RecurringTransaction } from '../../types';
import { getCategoryInfo } from '../../data/categories';
import { formatCurrency } from '../../utils/calculations';
import { toMonthlyAmount, daysUntilNextCharge, getPriceChangePercentage } from '../../utils/recurringCalculations';
import { format } from 'date-fns';
import { Edit2, Copy, Trash2 } from 'lucide-react';

interface RecurringRowProps {
  item: RecurringTransaction;
  isSelected: boolean;
  isFocused: boolean;
  onSelect: (id: string) => void;
  onClick: (id: string) => void;
  onToggleActive: (id: string) => void;
  onEdit: (item: RecurringTransaction) => void;
  onDuplicate?: (item: RecurringTransaction) => void;
  onDelete: (id: string) => void;
  currency: string;
  style?: React.CSSProperties;
}

const frequencyLabels: Record<string, string> = {
  daily: 'Diario',
  weekly: 'Semanal',
  monthly: 'Mensual',
  yearly: 'Anual',
};

const frequencyShort: Record<string, string> = {
  daily: 'D',
  weekly: 'S',
  monthly: 'M',
  yearly: 'A',
};

export const RecurringRow = memo(({
  item,
  isSelected,
  isFocused,
  onSelect,
  onClick,
  onToggleActive,
  onEdit,
  onDuplicate,
  onDelete,
  currency,
  style,
}: RecurringRowProps) => {
  const category = getCategoryInfo(item.category);
  const monthlyAmt = toMonthlyAmount(item);
  const days = daysUntilNextCharge(item);
  const priceChange = getPriceChangePercentage(item);
  const nextDate = new Date(item.nextDate);

  const handleCheckbox = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(item.id);
  }, [item.id, onSelect]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleActive(item.id);
  }, [item.id, onToggleActive]);

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(item);
  }, [item, onEdit]);

  const handleDuplicate = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDuplicate?.(item);
  }, [item, onDuplicate]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(item.id);
  }, [item.id, onDelete]);

  return (
    <div
      className={`rec-row ${!item.isActive ? 'rec-row--paused' : ''} ${isSelected ? 'rec-row--selected' : ''} ${isFocused ? 'rec-row--focused' : ''}`}
      style={style}
      onClick={() => onClick(item.id)}
      role="row"
      tabIndex={0}
    >
      {/* Checkbox */}
      <div className="rec-row-check" onClick={handleCheckbox}>
        <div className={`rec-checkbox ${isSelected ? 'rec-checkbox--checked' : ''}`}>
          {isSelected && <span>✓</span>}
        </div>
      </div>

      {/* Icon */}
      <div className="rec-row-icon">
        <span>{category?.icon || '📊'}</span>
      </div>

      {/* Name + Category */}
      <div className="rec-row-info">
        <span className="rec-row-name">{item.description}</span>
        <span className="rec-row-category">{category?.name || item.category}</span>
      </div>

      {/* Badges */}
      <div className="rec-row-badges">
        {priceChange !== null && priceChange > 0 && (
          <span className="rec-badge rec-badge--increase" title={`Subió ${priceChange.toFixed(1)}%`}>
            ↑ {priceChange.toFixed(0)}%
          </span>
        )}
        {days <= 3 && item.isActive && (
          <span className="rec-badge rec-badge--soon" title={`Cobra en ${days} día${days !== 1 ? 's' : ''}`}>
            {days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : `${days}d`}
          </span>
        )}
      </div>

      {/* Frequency */}
      <div className="rec-row-freq">
        <span className="rec-freq-badge" title={frequencyLabels[item.frequency]}>
          {frequencyShort[item.frequency]}
        </span>
      </div>

      {/* Next Date */}
      <div className="rec-row-date">
        <span>{format(nextDate, 'dd MMM')}</span>
      </div>

      {/* Amount */}
      <div className={`rec-row-amount ${item.type === 'income' ? 'rec-row-amount--income' : 'rec-row-amount--expense'}`}>
        <span className="rec-row-amount-main">
          {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount, item.currency || currency)}
        </span>
        {item.frequency !== 'monthly' && (
          <span className="rec-row-amount-monthly">
            {formatCurrency(monthlyAmt, item.currency || currency)}/mes
          </span>
        )}
      </div>

      {/* Toggle */}
      <div className="rec-row-toggle" onClick={handleToggle}>
        <div className={`rec-toggle ${item.isActive ? 'rec-toggle--active' : ''}`}>
          <div className="rec-toggle-knob" />
        </div>
      </div>

      {/* Hover actions */}
      <div className="rec-row-actions">
        <button className="rec-action-btn" onClick={handleEdit} title="Editar" aria-label="Editar recurrente">
          <Edit2 size={14} />
        </button>
        {onDuplicate && (
          <button className="rec-action-btn" onClick={handleDuplicate} title="Duplicar" aria-label="Duplicar recurrente">
            <Copy size={14} />
          </button>
        )}
        <button className="rec-action-btn rec-action-btn--danger" onClick={handleDelete} title="Eliminar" aria-label="Eliminar recurrente">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
});

RecurringRow.displayName = 'RecurringRow';
