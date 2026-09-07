import { useState, useRef, useEffect, useCallback } from 'react';
import { SavingsGoal } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { getGoalProgress, getRemainingAmount, getRequiredContribution } from '../../utils/goalCalculations';
import { X } from 'lucide-react';

interface GoalContributeModalProps {
  goal: SavingsGoal | null;
  isOpen: boolean;
  onClose: () => void;
  onContribute: (goalId: string, amount: number, note?: string) => void;
  currency: string;
}

export const GoalContributeModal = ({
  goal,
  isOpen,
  onClose,
  onContribute,
  currency,
}: GoalContributeModalProps) => {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setAmount('');
      setNote('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (!goal) return;
    const num = parseFloat(amount);
    if (num > 0) {
      onContribute(goal.id, num, note || undefined);
      onClose();
    }
  }, [goal, amount, note, onContribute, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  if (!isOpen || !goal) return null;

  const cur = goal.currency || currency;
  const progress = getGoalProgress(goal);
  const remaining = getRemainingAmount(goal);
  const req = getRequiredContribution(goal);

  return (
    <div className="gl-contribute-backdrop" onClick={onClose}>
      <div className="gl-contribute-modal" onClick={e => e.stopPropagation()}>
        <button className="gl-contribute-close" onClick={onClose} aria-label="Cerrar">
          <X size={18} />
        </button>

        <div className="gl-contribute-header">
          <span className="gl-contribute-icon">{goal.icon}</span>
          <div>
            <h3 className="gl-contribute-title">Aportar a {goal.name}</h3>
            <span className="gl-contribute-sub">
              {formatCurrency(goal.currentAmount, cur)} de {formatCurrency(goal.targetAmount, cur)} ({progress.toFixed(0)}%)
            </span>
          </div>
        </div>

        <div className="gl-contribute-remaining">
          Faltan <strong>{formatCurrency(remaining, cur)}</strong>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="gl-contribute-field">
            <label className="gl-contribute-label">Monto</label>
            <input
              ref={inputRef}
              type="number"
              className="gl-contribute-input"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              onKeyDown={handleKeyDown}
              step="0.01"
              min="0.01"
              required
            />
          </div>

          <div className="gl-contribute-suggestions">
            {[req.weekly, req.monthly, remaining].filter(v => v > 0).map((v, i) => (
              <button
                key={i}
                type="button"
                className="gl-contribute-sug-btn"
                onClick={() => setAmount(v.toFixed(2))}
              >
                {i === 0 ? 'Semanal' : i === 1 ? 'Mensual' : 'Total'}: {formatCurrency(v, cur)}
              </button>
            ))}
          </div>

          <div className="gl-contribute-field">
            <label className="gl-contribute-label">Nota (opcional)</label>
            <input
              type="text"
              className="gl-contribute-input"
              placeholder="Ej: Bono del mes"
              value={note}
              onChange={e => setNote(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={100}
            />
          </div>

          <div className="gl-contribute-actions">
            <button type="button" className="gl-contribute-cancel" onClick={onClose}>Cancelar</button>
            <button
              type="submit"
              className="gl-contribute-confirm"
              disabled={!amount || parseFloat(amount) <= 0}
            >
              Confirmar aporte
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
