import { useState, useRef, useEffect } from 'react';
import { Trash2, Tag, XCircle } from 'lucide-react';
import { getCategoriesByType } from '../../utils/categoryHelpers';

interface BulkActionBarProps {
  count: number;
  onDelete: () => void;
  onDeselect: () => void;
  /** Apply a single category id to every selected transaction. */
  onCategorize?: (categoryId: string) => void;
}

const expenseCategories = getCategoriesByType('expense');
const incomeCategories = getCategoriesByType('income');

export function BulkActionBar({ count, onDelete, onDeselect, onCategorize }: BulkActionBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    window.addEventListener('mousedown', onDocClick);
    return () => window.removeEventListener('mousedown', onDocClick);
  }, [pickerOpen]);

  if (count === 0) return null;

  const handlePick = (categoryId: string) => {
    setPickerOpen(false);
    onCategorize?.(categoryId);
  };

  return (
    <div className="txn-bulk-bar">
      <span className="txn-bulk-count">{count} seleccionada{count !== 1 ? 's' : ''}</span>
      <div className="txn-bulk-actions">
        <div className="txn-bulk-categorize-wrap" ref={wrapRef}>
          <button
            className="txn-bulk-btn"
            onClick={() => setPickerOpen(o => !o)}
            disabled={!onCategorize}
            type="button"
          >
            <Tag size={16} /> Categorizar
          </button>
          {pickerOpen && (
            <div className="txn-bulk-categorize-menu" role="menu">
              <div className="txn-bulk-categorize-section">Gastos</div>
              {expenseCategories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  className="txn-bulk-categorize-item"
                  onClick={() => handlePick(cat.id)}
                >
                  <span className="txn-bulk-categorize-icon" aria-hidden>{cat.icon}</span>
                  {cat.name}
                </button>
              ))}
              <div className="txn-bulk-categorize-section">Ingresos</div>
              {incomeCategories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  className="txn-bulk-categorize-item"
                  onClick={() => handlePick(cat.id)}
                >
                  <span className="txn-bulk-categorize-icon" aria-hidden>{cat.icon}</span>
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="txn-bulk-btn txn-bulk-btn--danger" onClick={onDelete} type="button">
          <Trash2 size={16} /> Eliminar
        </button>
        <button className="txn-bulk-btn" onClick={onDeselect} type="button">
          <XCircle size={16} /> Deseleccionar
        </button>
      </div>
    </div>
  );
}
