import { FormEvent, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Investment } from '../../types';
import { INVESTMENT_TYPE_LABEL } from '../../utils/netWorth';
import { toDateInputValue, toStableDateISO } from '../../utils/stableDate';

interface InvestmentModalProps {
  editing: Investment | null;
  onClose: () => void;
  onSave: (inv: Investment) => void;
}

const TYPES: Investment['type'][] = ['stocks', 'crypto', 'bonds', 'realestate', 'other'];

export function InvestmentModal({ editing, onClose, onSave }: InvestmentModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<Investment['type']>('stocks');
  const [initialAmount, setInitialAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setType(editing.type);
      setInitialAmount(String(editing.initialAmount));
      setCurrentAmount(String(editing.currentAmount));
      setPurchaseDate(toDateInputValue(editing.purchaseDate));
      setNotes(editing.notes || '');
    } else {
      setPurchaseDate(new Date().toISOString().slice(0, 10));
    }
  }, [editing]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cost = parseFloat(initialAmount);
    const value = parseFloat(currentAmount);
    if (!name.trim() || isNaN(cost) || isNaN(value)) return;

    onSave({
      id: editing?.id || Date.now().toString(),
      name: name.trim(),
      type,
      initialAmount: cost,
      currentAmount: value,
      // Se ancla al mediodia UTC como el resto de fechas de la app, para que
      // no se guarde un dia antes en husos negativos.
      purchaseDate: toStableDateISO(purchaseDate),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h2 className="modal-title">{editing ? 'Editar inversion' : 'Nueva inversion'}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '0 1.25rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <div>
            <label className="form-label" htmlFor="inv-name">Nombre</label>
            <input
              id="inv-name"
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="ETF S&P 500"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="form-label" htmlFor="inv-type">Tipo</label>
            <select id="inv-type" className="form-input" value={type} onChange={e => setType(e.target.value as Investment['type'])}>
              {TYPES.map(t => (
                <option key={t} value={t}>{INVESTMENT_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="form-label" htmlFor="inv-cost">Monto invertido</label>
              <input
                id="inv-cost"
                className="form-input"
                type="number"
                step="0.01"
                value={initialAmount}
                onChange={e => setInitialAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="form-label" htmlFor="inv-value">Valor actual</label>
              <input
                id="inv-value"
                className="form-input"
                type="number"
                step="0.01"
                value={currentAmount}
                onChange={e => setCurrentAmount(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="form-label" htmlFor="inv-date">Fecha de compra</label>
            <input
              id="inv-date"
              className="form-input"
              type="date"
              value={purchaseDate}
              onChange={e => setPurchaseDate(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label" htmlFor="inv-notes">Notas (opcional)</label>
            <input
              id="inv-notes"
              className="form-input"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary">{editing ? 'Guardar' : 'Agregar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
