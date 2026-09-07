import { SavingsGoal } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import {
  getGoalProgress, getDaysRemaining, getRemainingAmount,
  getRequiredContribution, getGoalStatusLabel, isGoalCompleted, projectCompletion,
} from '../../utils/goalCalculations';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { X, Edit2, Trash2, Pause, Play, TrendingUp, Calendar, Target } from 'lucide-react';
import { parseDateOnly } from '../../utils/stableDate';

interface GoalDrawerProps {
  goal: SavingsGoal | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (goal: SavingsGoal) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string) => void;
  onContribute: (goalId: string) => void;
  currency: string;
}

export const GoalDrawer = ({
  goal,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onToggleActive,
  onContribute,
  currency,
}: GoalDrawerProps) => {
  if (!goal) return null;

  const cur = goal.currency || currency;
  const progress = getGoalProgress(goal);
  const days = getDaysRemaining(goal);
  const remaining = getRemainingAmount(goal);
  const req = getRequiredContribution(goal);
  const status = getGoalStatusLabel(goal);
  const completed = isGoalCompleted(goal);
  const contributions = goal.contributions || [];
  const projected = projectCompletion(goal, req.monthly);

  return (
    <>
      {isOpen && <div className="gl-drawer-backdrop" onClick={onClose} />}
      <div
        className={`gl-drawer ${isOpen ? 'gl-drawer--open' : ''}`}
        role="dialog"
        aria-label="Detalle de meta"
      >
        {/* Header */}
        <div className="gl-drawer-header">
          <button className="gl-drawer-close" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
          <div className="gl-drawer-title-row">
            <span className="gl-drawer-icon">{goal.icon}</span>
            <div>
              <h3 className="gl-drawer-title">{goal.name}</h3>
              <span className="gl-drawer-status" style={{ color: status.color }}>{status.text}</span>
            </div>
          </div>
        </div>

        {/* Progress hero */}
        <div className="gl-drawer-hero">
          <div className="gl-drawer-progress-ring-wrap">
            <svg viewBox="0 0 100 100" className="gl-drawer-ring">
              <circle cx="50" cy="50" r="40" fill="none" stroke="var(--goal-border)" strokeWidth="7" />
              <circle
                cx="50" cy="50" r="40"
                fill="none"
                stroke={completed ? 'var(--goal-success)' : goal.color}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 40}
                strokeDashoffset={2 * Math.PI * 40 * (1 - progress / 100)}
                transform="rotate(-90 50 50)"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
            </svg>
            <div className="gl-drawer-ring-text">
              <span className="gl-drawer-ring-pct">{progress.toFixed(0)}%</span>
            </div>
          </div>
          <div className="gl-drawer-hero-amounts">
            <span className="gl-drawer-hero-current">{formatCurrency(goal.currentAmount, cur)}</span>
            <span className="gl-drawer-hero-of">de {formatCurrency(goal.targetAmount, cur)}</span>
          </div>
          {remaining > 0 && (
            <div className="gl-drawer-hero-remaining">Faltan {formatCurrency(remaining, cur)}</div>
          )}
        </div>

        {/* Details */}
        <div className="gl-drawer-details">
          <div className="gl-drawer-field">
            <span className="gl-drawer-field-label"><Calendar size={13} /> Fecha objetivo</span>
            <span className="gl-drawer-field-value">
              {format(new Date(goal.deadline), "d 'de' MMMM yyyy", { locale: es })}
              {days > 0 && <span className="gl-drawer-days-badge">{days}d</span>}
            </span>
          </div>
          <div className="gl-drawer-field">
            <span className="gl-drawer-field-label"><Calendar size={13} /> Inicio</span>
            <span className="gl-drawer-field-value">
              {format(new Date(goal.startDate), "d 'de' MMMM yyyy", { locale: es })}
            </span>
          </div>
          {goal.description && (
            <div className="gl-drawer-field">
              <span className="gl-drawer-field-label">Descripción</span>
              <span className="gl-drawer-field-value">{goal.description}</span>
            </div>
          )}
        </div>

        {/* Contribution suggestions */}
        {!completed && goal.isActive && (
          <div className="gl-drawer-section">
            <h4 className="gl-drawer-section-title"><Target size={14} /> Aportes sugeridos</h4>
            <div className="gl-drawer-suggestions">
              <div className="gl-drawer-sug-item">
                <span className="gl-drawer-sug-label">Diario</span>
                <span className="gl-drawer-sug-value">{formatCurrency(req.daily, cur)}</span>
              </div>
              <div className="gl-drawer-sug-item">
                <span className="gl-drawer-sug-label">Semanal</span>
                <span className="gl-drawer-sug-value">{formatCurrency(req.weekly, cur)}</span>
              </div>
              <div className="gl-drawer-sug-item">
                <span className="gl-drawer-sug-label">Mensual</span>
                <span className="gl-drawer-sug-value">{formatCurrency(req.monthly, cur)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Projection */}
        {!completed && goal.isActive && projected && (
          <div className="gl-drawer-section">
            <h4 className="gl-drawer-section-title"><TrendingUp size={14} /> Proyección</h4>
            <p className="gl-drawer-projection-text">
              Si mantienes un aporte de {formatCurrency(req.monthly, cur)}/mes, completarás esta meta
              aproximadamente el <strong>{format(projected, "d 'de' MMMM yyyy", { locale: es })}</strong>.
            </p>
          </div>
        )}

        {/* Contribution history */}
        <div className="gl-drawer-section">
          <h4 className="gl-drawer-section-title">Historial de aportes</h4>
          {contributions.length === 0 ? (
            <p className="gl-drawer-no-data">Sin aportes registrados</p>
          ) : (
            <div className="gl-drawer-contributions">
              {contributions.slice().reverse().map((c, i) => (
                <div key={i} className="gl-drawer-contrib-row">
                  <span className="gl-drawer-contrib-date">{format(parseDateOnly(c.date), 'dd MMM yyyy')}</span>
                  <span className="gl-drawer-contrib-amount">+{formatCurrency(c.amount, cur)}</span>
                  {c.note && <span className="gl-drawer-contrib-note">{c.note}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="gl-drawer-footer">
          {!completed && goal.isActive && (
            <button className="gl-drawer-btn gl-drawer-btn--primary" onClick={() => onContribute(goal.id)}>
              Aportar
            </button>
          )}
          <button className="gl-drawer-btn" onClick={() => onToggleActive(goal.id)}>
            {goal.isActive ? <><Pause size={14} /> Pausar</> : <><Play size={14} /> Reanudar</>}
          </button>
          <button className="gl-drawer-btn" onClick={() => onEdit(goal)}>
            <Edit2 size={14} /> Editar
          </button>
          <button className="gl-drawer-btn gl-drawer-btn--danger" onClick={() => {
            if (window.confirm(`¿Eliminar "${goal.name}"?`)) onDelete(goal.id);
          }}>
            <Trash2 size={14} /> Eliminar
          </button>
        </div>
      </div>
    </>
  );
};
