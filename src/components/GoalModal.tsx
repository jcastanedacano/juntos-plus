import { useState, FormEvent, useEffect } from 'react';
import { SavingsGoal, CurrencyType, Owner } from '../types';
import { OWNER_OPTIONS } from '../utils/ownership';
import { useOwnerLabels } from '../utils/ownerLabels';

interface GoalModalProps {
  onClose: () => void;
  onSave: (goal: Omit<SavingsGoal, 'id'>) => void;
  editingGoal?: SavingsGoal | null;
}

const goalIcons = ['🎯', '🏖️', '🏠', '🚗', '💍', '🎓', '🎮', '✈️', '💻', '📱', '⌚', '🎸'];
const goalColors = [
  '#E8519E',
  '#02B08D',
  '#1F4278',
  '#FF6B6B',
  '#4ECDC4',
  '#95E1D3',
  '#F38181',
  '#AA96DA',
  '#FCBAD3',
  '#FFFFD2',
  '#A8E6CF',
  '#FFD3B6',
];

export const GoalModal = ({ onClose, onSave, editingGoal }: GoalModalProps) => {
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('0');
  const [deadline, setDeadline] = useState('');
  const [startDate, setStartDate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🎯');
  const [color, setColor] = useState('#E8519E');
  const [currency, setCurrency] = useState<CurrencyType>('PEN');
  const [owner, setOwner] = useState<Owner>('shared');
  const ownerLabels = useOwnerLabels();

  useEffect(() => {
    if (editingGoal) {
      setName(editingGoal.name);
      setTargetAmount(editingGoal.targetAmount.toString());
      setCurrentAmount(editingGoal.currentAmount.toString());
      setDeadline(editingGoal.deadline.split('T')[0]);
      setStartDate(editingGoal.startDate.split('T')[0]);
      setIsActive(editingGoal.isActive);
      setDescription(editingGoal.description || '');
      setIcon(editingGoal.icon);
      setColor(editingGoal.color);
      setCurrency(editingGoal.currency || 'PEN');
      setOwner(editingGoal.owner || 'shared');
    } else {
      // Para nueva meta, establecer fecha de inicio como hoy
      setStartDate(new Date().toISOString().split('T')[0]);
    }
  }, [editingGoal]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const goal: Omit<SavingsGoal, 'id'> = {
      name: name.trim(),
      targetAmount: parseFloat(targetAmount),
      currentAmount: parseFloat(currentAmount),
      deadline: new Date(deadline).toISOString(),
      startDate: new Date(startDate).toISOString(),
      isActive,
      icon,
      color,
      description: description.trim() || undefined,
      currency,
      owner,
    };

    onSave(goal);
    onClose();
  };

  // Calculate minimum date (today)
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {editingGoal ? '✏️ Editar Meta' : '🎯 Nueva Meta de Ahorro'}
          </h2>
          <button className="close-btn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nombre de la meta</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej: Vacaciones en la playa"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Descripción (opcional)</label>
            <textarea
              className="form-input"
              placeholder="Detalles sobre tu meta..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Monto objetivo</label>
              <input
                type="number"
                className="form-input"
                placeholder="0.00"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                step="0.01"
                min="0.01"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Monto actual</label>
              <input
                type="number"
                className="form-input"
                placeholder="0.00"
                value={currentAmount}
                onChange={(e) => setCurrentAmount(e.target.value)}
                step="0.01"
                min="0"
                required
              />
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
            <label className="form-label">Para quién</label>
            <div className="owner-segmented" role="radiogroup" aria-label="Para quién">
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

          <div className="form-group">
            <label className="form-label">Fecha límite</label>
            <input
              type="date"
              className="form-input"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              min={today}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Estado de la meta</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">Icono</label>
            <div className="icon-selector">
              {goalIcons.map((i) => (
                <button
                  key={i}
                  type="button"
                  className={`icon-option ${icon === i ? 'selected' : ''}`}
                  onClick={() => setIcon(i)}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Color</label>
            <div className="color-selector">
              {goalColors.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-option ${color === c ? 'selected' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  title={c}
                />
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="submit-btn">
              {editingGoal ? 'Actualizar' : 'Crear Meta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
