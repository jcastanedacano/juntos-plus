import { useState, FormEvent, useEffect } from 'react';
import { Budget, CurrencyType } from '../types';
import { getCategoriesByType } from '../utils/categoryHelpers';
import { getMonedaBase } from '../utils/fx';
import { limpiarNota, LIMITE_NOTA } from '../utils/budgetNotes';

interface BudgetModalProps {
  onClose: () => void;
  onSave: (budget: Omit<Budget, 'id' | 'spent'>) => void;
  editingBudget?: Budget | null;
  existingBudgets: Budget[];
}

export const BudgetModal = ({ onClose, onSave, editingBudget, existingBudgets }: BudgetModalProps) => {
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<'monthly' | 'weekly' | 'yearly'>('monthly');
  const [currency, setCurrency] = useState<CurrencyType>('PEN');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (editingBudget) {
      setCategoryId(editingBudget.categoryId);
      setAmount(editingBudget.amount.toString());
      setPeriod(editingBudget.period);
      setCurrency(editingBudget.currency || getMonedaBase());
      setNotes(editingBudget.notes || '');
    }
  }, [editingBudget]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    // Check if budget already exists for this category and period
    const existingBudget = existingBudgets.find(
      (b) =>
        b.categoryId === categoryId &&
        b.period === period &&
        b.id !== editingBudget?.id
    );

    if (existingBudget) {
      alert(`Ya existe un presupuesto ${period === 'monthly' ? 'mensual' : period === 'weekly' ? 'semanal' : 'anual'} para esta categoría`);
      return;
    }

    // Una nota vacia no se guarda: editar un presupuesto y borrar su nota
    // tiene que dejarlo sin ella, no con un texto en blanco.
    const nota = limpiarNota(notes);
    const budget: Omit<Budget, 'id' | 'spent'> = {
      categoryId,
      amount: parseFloat(amount),
      period,
      currency,
      ...(nota ? { notes: nota } : {}),
    };

    onSave(budget);
    onClose();
  };

  const expenseCategories = getCategoriesByType('expense');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {editingBudget ? '✏️ Editar Presupuesto' : '💰 Nuevo Presupuesto'}
          </h2>
          <button className="close-btn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Categoría</label>
            <select
              className="form-input"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            >
              <option value="">Selecciona una categoría</option>
              {expenseCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Monto del presupuesto</label>
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
            <label className="form-label">Periodo</label>
            <select
              className="form-input"
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
              required
            >
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensual</option>
              <option value="yearly">Anual</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="budget-notes">Notas (opcional)</label>
            <textarea
              id="budget-notes"
              className="form-input"
              placeholder="Ej: terapias, compra de medicamentos"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, LIMITE_NOTA))}
              maxLength={LIMITE_NOTA}
              rows={3}
              style={{ resize: 'vertical' }}
            />
            <div style={{ marginTop: '0.25rem', fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right' }}>
              {notes.length}/{LIMITE_NOTA}
            </div>
          </div>

          <div className="budget-info">
            <p>
              💡 <strong>Consejo:</strong> Define presupuestos realistas para cada categoría de gasto.
              Te alertaremos cuando superes el 80% del presupuesto.
            </p>
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="submit-btn">
              {editingBudget ? 'Actualizar' : 'Crear Presupuesto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
