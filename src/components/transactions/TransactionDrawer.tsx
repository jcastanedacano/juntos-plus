import { Transaction } from '../../types';
import { getCategoryById } from '../../utils/categoryHelpers';
import { formatCurrency } from '../../utils/calculations';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { X, Copy, RefreshCw, Trash2, Receipt } from 'lucide-react';
import { useState } from 'react';
import { parseDateOnly } from '../../utils/stableDate';

interface TransactionDrawerProps {
  transaction: Transaction | null;
  open: boolean;
  onClose: () => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
}

function ReceiptPreview({ imageUrl }: { imageUrl: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="txn-drawer-field">
      <span className="txn-drawer-label">
        <Receipt size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
        Recibo adjunto
      </span>
      <img
        src={imageUrl}
        alt="Recibo"
        className="txn-drawer-receipt-thumb"
        onClick={() => setExpanded(true)}
      />
      {expanded && (
        <div className="txn-drawer-receipt-overlay" onClick={() => setExpanded(false)}>
          <img src={imageUrl} alt="Recibo ampliado" className="txn-drawer-receipt-full" />
        </div>
      )}
    </div>
  );
}

export function TransactionDrawer({ transaction, open, onClose, onEdit, onDelete }: TransactionDrawerProps) {
  if (!transaction) return null;

  const cat = getCategoryById(transaction.category);
  const isRecurring = !!transaction.sourceRecurringId;

  const formatDate = (dateStr: string) => {
    try {
      return format(parseDateOnly(dateStr), "EEEE d 'de' MMMM, yyyy", { locale: es });
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      {open && <div className="txn-drawer-backdrop" onClick={onClose} />}
      <div className={`txn-drawer ${open ? 'txn-drawer--open' : ''}`}>
        <div className="txn-drawer-header">
          <h3 className="txn-drawer-title">Detalle de transacción</h3>
          <button className="txn-drawer-close" onClick={onClose} aria-label="Cerrar panel">
            <X size={20} />
          </button>
        </div>

        <div className="txn-drawer-body">
          {/* Amount hero */}
          <div className={`txn-drawer-amount ${transaction.type === 'income' ? 'txn-amount-positive' : 'txn-amount-negative'}`}>
            {transaction.type === 'income' ? '+' : '-'}
            {formatCurrency(transaction.amount, transaction.currency || 'PEN')}
          </div>

          {/* Category */}
          <div className="txn-drawer-field">
            <span className="txn-drawer-label">Categoría</span>
            <span className="txn-drawer-value">
              <span
                className="txn-row-category-icon"
                style={{ backgroundColor: (cat?.color || '#666') + '20', color: cat?.color }}
              >
                {cat?.icon || '💱'}
              </span>
              {cat?.name || transaction.category}
              {isRecurring && <span className="txn-badge-recurring">↻ Recurrente</span>}
            </span>
          </div>

          {/* Description */}
          <div className="txn-drawer-field">
            <span className="txn-drawer-label">Descripción</span>
            <span className="txn-drawer-value">{transaction.description || '—'}</span>
          </div>

          {/* Date */}
          <div className="txn-drawer-field">
            <span className="txn-drawer-label">Fecha</span>
            <span className="txn-drawer-value">{formatDate(transaction.date)}</span>
          </div>

          {/* Account */}
          <div className="txn-drawer-field">
            <span className="txn-drawer-label">Cuenta</span>
            <span className="txn-drawer-value">{transaction.accountId && transaction.accountId !== 'default' ? transaction.accountId : '—'}</span>
          </div>

          {/* Type */}
          <div className="txn-drawer-field">
            <span className="txn-drawer-label">Tipo</span>
            <span className={`txn-drawer-type-badge ${transaction.type}`}>
              {transaction.type === 'income' ? 'Ingreso' : 'Gasto'}
            </span>
          </div>

          {/* Receipt */}
          {transaction.receiptImageUrl && (
            <ReceiptPreview imageUrl={transaction.receiptImageUrl} />
          )}
        </div>

        <div className="txn-drawer-footer">
          <button className="txn-btn txn-btn--outline" onClick={() => onEdit(transaction)}>
            <Copy size={16} /> Duplicar
          </button>
          <button className="txn-btn txn-btn--outline">
            <RefreshCw size={16} /> Convertir a recurrente
          </button>
          <button
            className="txn-btn txn-btn--danger"
            onClick={() => {
              onDelete(transaction.id);
              onClose();
            }}
          >
            <Trash2 size={16} /> Eliminar
          </button>
        </div>
      </div>
    </>
  );
}
