import { useState, useRef, useEffect, useCallback } from 'react';
import { RecurringTransaction } from '../../types';
import { getCategoryInfo } from '../../data/categories';
import { formatCurrency } from '../../utils/calculations';
import { toMonthlyAmount, getPriceChangePercentage, generateChargeHistory, daysUntilNextCharge } from '../../utils/recurringCalculations';
import { format } from 'date-fns';
import { X, Edit2, Trash2, Copy, Tag, Calendar, TrendingUp, TrendingDown, Clock } from 'lucide-react';

interface RecurringDrawerProps {
  item: RecurringTransaction | null;
  isOpen: boolean;
  onClose: () => void;
  onToggleActive: (id: string) => void;
  onEdit: (item: RecurringTransaction) => void;
  onDelete: (id: string) => void;
  onDuplicate?: (item: RecurringTransaction) => void;
  onUpdateTags?: (id: string, tags: string[]) => void;
  onUpdateNotes?: (id: string, notes: string) => void;
  currency: string;
}

const frequencyLabels: Record<string, string> = {
  daily: 'Diario',
  weekly: 'Semanal',
  monthly: 'Mensual',
  yearly: 'Anual',
};

export const RecurringDrawer = ({
  item,
  isOpen,
  onClose,
  onToggleActive,
  onEdit,
  onDelete,
  onDuplicate,
  onUpdateTags,
  onUpdateNotes,
  currency,
}: RecurringDrawerProps) => {
  const [tagInput, setTagInput] = useState('');
  const [notes, setNotes] = useState('');
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (item) {
      setNotes(item.notes || '');
    }
  }, [item]);

  const handleAddTag = useCallback(() => {
    if (!item || !tagInput.trim() || !onUpdateTags) return;
    const newTags = [...(item.tags || []), tagInput.trim()];
    onUpdateTags(item.id, newTags);
    setTagInput('');
  }, [item, tagInput, onUpdateTags]);

  const handleRemoveTag = useCallback((tag: string) => {
    if (!item || !onUpdateTags) return;
    const newTags = (item.tags || []).filter(t => t !== tag);
    onUpdateTags(item.id, newTags);
  }, [item, onUpdateTags]);

  const handleNotesBlur = useCallback(() => {
    if (!item || !onUpdateNotes) return;
    if (notes !== (item.notes || '')) {
      onUpdateNotes(item.id, notes);
    }
  }, [item, notes, onUpdateNotes]);

  if (!item) return null;

  const category = getCategoryInfo(item.category);
  const monthlyAmt = toMonthlyAmount(item);
  const priceChange = getPriceChangePercentage(item);
  const days = daysUntilNextCharge(item);
  const chargeHistory = generateChargeHistory(item, 12);

  return (
    <>
      {isOpen && <div className="rec-drawer-backdrop" onClick={onClose} />}
      <div
        ref={drawerRef}
        className={`rec-drawer ${isOpen ? 'rec-drawer--open' : ''}`}
        role="dialog"
        aria-label="Detalle de recurrente"
      >
        {/* Header */}
        <div className="rec-drawer-header">
          <button className="rec-drawer-close" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
          <div className="rec-drawer-title-row">
            <span className="rec-drawer-icon">{category?.icon || '📊'}</span>
            <div>
              <h3 className="rec-drawer-title">{item.description}</h3>
              <span className="rec-drawer-subtitle">{category?.name || item.category}</span>
            </div>
          </div>
        </div>

        {/* Amount hero */}
        <div className="rec-drawer-hero">
          <div className={`rec-drawer-amount ${item.type === 'income' ? 'rec-drawer-amount--income' : 'rec-drawer-amount--expense'}`}>
            {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount, item.currency || currency)}
          </div>
          {item.frequency !== 'monthly' && (
            <div className="rec-drawer-monthly">
              {formatCurrency(monthlyAmt, item.currency || currency)}/mes
            </div>
          )}
          {priceChange !== null && priceChange !== 0 && (
            <div className={`rec-drawer-price-change ${priceChange > 0 ? 'rec-drawer-price-change--up' : 'rec-drawer-price-change--down'}`}>
              {priceChange > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {priceChange > 0 ? '+' : ''}{priceChange.toFixed(1)}% vs anterior
            </div>
          )}
        </div>

        {/* Status toggle */}
        <div className="rec-drawer-field">
          <span className="rec-drawer-field-label">Estado</span>
          <div className="rec-drawer-status-row">
            <span className={`rec-status-dot ${item.isActive ? 'rec-status-dot--active' : 'rec-status-dot--paused'}`} />
            <span>{item.isActive ? 'Activo' : 'Pausado'}</span>
            <div
              className={`rec-toggle ${item.isActive ? 'rec-toggle--active' : ''}`}
              onClick={() => onToggleActive(item.id)}
            >
              <div className="rec-toggle-knob" />
            </div>
          </div>
        </div>

        {/* Detail fields */}
        <div className="rec-drawer-details">
          <div className="rec-drawer-field">
            <span className="rec-drawer-field-label">Frecuencia</span>
            <span className="rec-drawer-field-value">{frequencyLabels[item.frequency]}</span>
          </div>
          <div className="rec-drawer-field">
            <span className="rec-drawer-field-label">Próximo cobro</span>
            <span className="rec-drawer-field-value">
              <Calendar size={14} />
              {format(new Date(item.nextDate), 'dd MMM yyyy')}
              <span className="rec-drawer-days-badge">
                {days === 0 ? 'Hoy' : `en ${days}d`}
              </span>
            </span>
          </div>
          <div className="rec-drawer-field">
            <span className="rec-drawer-field-label">Tipo</span>
            <span className="rec-drawer-field-value">
              {item.type === 'income' ? 'Ingreso' : 'Gasto'}
            </span>
          </div>
        </div>

        {/* Price change timeline */}
        {item.previousAmounts && item.previousAmounts.length > 0 && (
          <div className="rec-drawer-section">
            <h4 className="rec-drawer-section-title">
              <TrendingUp size={14} /> Historial de precios
            </h4>
            <div className="rec-drawer-timeline">
              {item.previousAmounts.map((entry, i) => (
                <div key={i} className="rec-drawer-timeline-item">
                  <span className="rec-drawer-timeline-date">{format(new Date(entry.date), 'MMM yyyy')}</span>
                  <span className="rec-drawer-timeline-amount">{formatCurrency(entry.amount, item.currency || currency)}</span>
                </div>
              ))}
              <div className="rec-drawer-timeline-item rec-drawer-timeline-item--current">
                <span className="rec-drawer-timeline-date">Actual</span>
                <span className="rec-drawer-timeline-amount">{formatCurrency(item.amount, item.currency || currency)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Tags */}
        <div className="rec-drawer-section">
          <h4 className="rec-drawer-section-title">
            <Tag size={14} /> Etiquetas
          </h4>
          <div className="rec-drawer-tags">
            {(item.tags || []).map(tag => (
              <span key={tag} className="rec-drawer-tag">
                {tag}
                {onUpdateTags && (
                  <button onClick={() => handleRemoveTag(tag)} aria-label={`Quitar etiqueta ${tag}`}><X size={10} /></button>
                )}
              </span>
            ))}
            {onUpdateTags && (
              <div className="rec-drawer-tag-input">
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                  placeholder="+ Agregar"
                  maxLength={20}
                />
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="rec-drawer-section">
          <h4 className="rec-drawer-section-title">Notas</h4>
          <textarea
            className="rec-drawer-notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="Agregar una nota..."
            rows={3}
          />
        </div>

        {/* Simulated charge history */}
        <div className="rec-drawer-section">
          <h4 className="rec-drawer-section-title">
            <Clock size={14} /> Historial de cobros estimado
          </h4>
          <div className="rec-drawer-charges">
            {chargeHistory.map((ch, i) => (
              <div key={i} className="rec-drawer-charge-row">
                <span className="rec-drawer-charge-date">{format(new Date(ch.date), 'dd MMM yyyy')}</span>
                <span className={`rec-drawer-charge-amount ${item.type === 'income' ? 'rec-text-income' : 'rec-text-expense'}`}>
                  {item.type === 'income' ? '+' : '-'}{formatCurrency(ch.amount, item.currency || currency)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer actions */}
        <div className="rec-drawer-footer">
          <button className="rec-drawer-btn" onClick={() => onEdit(item)}>
            <Edit2 size={14} /> Editar
          </button>
          {onDuplicate && (
            <button className="rec-drawer-btn" onClick={() => onDuplicate(item)}>
              <Copy size={14} /> Duplicar
            </button>
          )}
          <button className="rec-drawer-btn rec-drawer-btn--danger" onClick={() => onDelete(item.id)}>
            <Trash2 size={14} /> Eliminar
          </button>
        </div>
      </div>
    </>
  );
};
