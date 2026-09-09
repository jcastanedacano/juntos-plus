import { useState, FormEvent, useEffect } from 'react';
import { RecurringTransaction, TransactionType, CurrencyType, Owner } from '../types';
import { getCategoriesByType } from '../utils/categoryHelpers';
import { OWNER_OPTIONS } from '../utils/ownership';
import { useOwnerLabels } from '../utils/ownerLabels';
import { getMyOwnerRole } from '../utils/userIdentity';
import { getMonedaBase } from '../utils/fx';
import { toStableDateISO, toDateInputValue } from '../utils/stableDate';

interface RecurringModalProps {
  onClose: () => void;
  onSave: (recurring: Omit<RecurringTransaction, 'id'>) => void;
  editingRecurring?: RecurringTransaction | null;
}

export const RecurringModal = ({ onClose, onSave, editingRecurring }: RecurringModalProps) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [nextDate, setNextDate] = useState('');
  const [currency, setCurrency] = useState<CurrencyType>('PEN');
  const [owner, setOwner] = useState<Owner>(getMyOwnerRole());
  const ownerLabels = useOwnerLabels();

  useEffect(() => {
    if (editingRecurring) {
      setType(editingRecurring.type);
      setAmount(editingRecurring.amount.toString());
      setCategory(editingRecurring.category);
      setDescription(editingRecurring.description);
      setFrequency(editingRecurring.frequency);
      setNextDate(toDateInputValue(editingRecurring.nextDate));
      setCurrency(editingRecurring.currency || getMonedaBase());
      setOwner(editingRecurring.owner || getMyOwnerRole());
    } else {
      // Set default next date to today
      const today = new Date().toISOString().split('T')[0];
      setNextDate(today);
    }
  }, [editingRecurring]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const recurring: Omit<RecurringTransaction, 'id'> = {
      type,
      amount: parseFloat(amount),
      category,
      description: description.trim(),
      frequency,
      // El valor del <input type="date"> se ancla a mediodía UTC. Pasarlo
      // por `new Date(...)` lo leía como medianoche UTC y en husos negativos
      // el cobro quedaba guardado un día antes del elegido.
      nextDate: toStableDateISO(nextDate),
      isActive: true,
      currency,
      owner,
    };

    onSave(recurring);
    onClose();
  };

  const categories = getCategoriesByType(type);
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {editingRecurring ? '✏️ Editar Gasto Recurrente' : '🔄 Nuevo Gasto Recurrente'}
          </h2>
          <button className="close-btn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Tipo</label>
            <div className="type-toggle">
              <button
                type="button"
                className={`type-btn ${type === 'expense' ? 'active expense' : ''}`}
                onClick={() => {
                  setType('expense');
                  setCategory('');
                }}
              >
                📤 Gasto
              </button>
              <button
                type="button"
                className={`type-btn ${type === 'income' ? 'active income' : ''}`}
                onClick={() => {
                  setType('income');
                  setCategory('');
                }}
              >
                📥 Ingreso
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Descripción</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej: Netflix, Gym, Salario"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Monto</label>
              <input
                type="number"
                className="form-input"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.01"
                min="0.01"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select
                className="form-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              >
                <option value="">Seleccionar</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Moneda</label>
            <select
              className="form-input"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyType)}
            >
              <option value="PEN">S/ Soles</option>
              <option value="USD">$ Dólares</option>
              <option value="EUR">€ Euros</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Pagado por</label>
            <div className="owner-segmented" role="radiogroup" aria-label="Pagado por">
              {OWNER_OPTIONS.map((o) => (
                <button
                  key={o}
                  type="button"
                  role="radio"
                  aria-checked={owner === o}
                  className={`owner-segmented-btn owner-${o} ${owner === o ? 'active' : ''}`}
                  onClick={() => setOwner(o)}
                >
                  {ownerLabels[o]}
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Frecuencia</label>
              <select
                className="form-input"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as any)}
                required
              >
                <option value="daily">Diario</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensual</option>
                <option value="yearly">Anual</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Próxima fecha</label>
              <input
                type="date"
                className="form-input"
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
                min={today}
                required
              />
            </div>
          </div>

          <div className="budget-info">
            <p>
              💡 <strong>Consejo:</strong> Las transacciones recurrentes te ayudan a controlar
              suscripciones y gastos fijos. Puedes pausarlas temporalmente sin eliminarlas.
            </p>
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="submit-btn">
              {editingRecurring ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
