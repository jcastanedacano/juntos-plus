import { useMemo } from 'react';
import { RecurringTransaction } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { toMonthlyAmount } from '../../utils/recurringCalculations';
import { Pause, Play, FolderEdit, Download, Trash2, XCircle } from 'lucide-react';

interface RecurringBulkBarProps {
  selectedIds: Set<string>;
  recurring: RecurringTransaction[];
  onBulkToggle: (ids: string[]) => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkUpdateCategory?: (ids: string[], category: string) => void;
  onExport: (ids: string[]) => void;
  onDeselectAll: () => void;
  currency: string;
}

export const RecurringBulkBar = ({
  selectedIds,
  recurring,
  onBulkToggle,
  onBulkDelete,
  onExport,
  onDeselectAll,
  currency,
}: RecurringBulkBarProps) => {
  const ids = Array.from(selectedIds);
  const selectedItems = recurring.filter(r => selectedIds.has(r.id));

  const monthlySavings = useMemo(() => {
    return selectedItems
      .filter(r => r.isActive && r.type === 'expense')
      .reduce((sum, r) => sum + toMonthlyAmount(r), 0);
  }, [selectedItems]);

  const hasActive = selectedItems.some(r => r.isActive);
  const hasPaused = selectedItems.some(r => !r.isActive);

  if (selectedIds.size === 0) return null;

  return (
    <div className="rec-bulk-bar">
      <div className="rec-bulk-left">
        <span className="rec-bulk-count">{selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}</span>
        {monthlySavings > 0 && (
          <span className="rec-bulk-savings">
            Ahorro si pausas: {formatCurrency(monthlySavings, currency)}/mes
          </span>
        )}
      </div>
      <div className="rec-bulk-actions">
        {hasActive && (
          <button className="rec-bulk-btn" onClick={() => onBulkToggle(ids)} title="Pausar seleccionados">
            <Pause size={14} /> Pausar
          </button>
        )}
        {hasPaused && (
          <button className="rec-bulk-btn" onClick={() => onBulkToggle(ids)} title="Reanudar seleccionados">
            <Play size={14} /> Reanudar
          </button>
        )}
        <button className="rec-bulk-btn" onClick={() => onExport(ids)} title="Exportar seleccionados">
          <Download size={14} /> Exportar
        </button>
        <button className="rec-bulk-btn rec-bulk-btn--danger" onClick={() => onBulkDelete(ids)} title="Eliminar seleccionados">
          <Trash2 size={14} /> Eliminar
        </button>
        <button className="rec-bulk-btn rec-bulk-btn--muted" onClick={onDeselectAll} title="Deseleccionar todo">
          <XCircle size={14} /> Deseleccionar
        </button>
      </div>
    </div>
  );
};
