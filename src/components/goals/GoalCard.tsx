import { memo, useState, useRef, useCallback } from 'react';
import { SavingsGoal } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import {
  getGoalProgress, getDaysRemaining, getRemainingAmount,
  getRequiredContribution, getGoalStatusLabel, isGoalCompleted, isGoalExpired,
} from '../../utils/goalCalculations';
import { Edit2, Trash2, MoreVertical, Pause, Play, Eye } from 'lucide-react';

interface GoalCardProps {
  goal: SavingsGoal;
  currency: string;
  onEdit: (goal: SavingsGoal) => void;
  onDelete: (id: string) => void;
  onContribute: (goalId: string) => void;
  onToggleActive: (id: string) => void;
  onViewDetail: (id: string) => void;
}

export const GoalCard = memo(({
  goal,
  currency,
  onEdit,
  onDelete,
  onContribute,
  onToggleActive,
  onViewDetail,
}: GoalCardProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const progress = getGoalProgress(goal);
  const days = getDaysRemaining(goal);
  const remaining = getRemainingAmount(goal);
  const req = getRequiredContribution(goal);
  const status = getGoalStatusLabel(goal);
  const completed = isGoalCompleted(goal);
  const expired = isGoalExpired(goal);
  const cur = goal.currency || currency;

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <div
      className={`gl-card ${!goal.isActive ? 'gl-card--paused' : ''} ${completed ? 'gl-card--completed' : ''} ${expired ? 'gl-card--expired' : ''}`}
      style={{ '--goal-accent': goal.color } as React.CSSProperties}
    >
      {/* Header */}
      <div className="gl-card-header">
        <span className="gl-card-icon">{goal.icon}</span>
        <div className="gl-card-title-area">
          <h3 className="gl-card-name">{goal.name}</h3>
          <span className="gl-card-status" style={{ color: status.color }}>{status.text}</span>
        </div>
        <div className="gl-card-kebab" ref={menuRef}>
          <button
            className="gl-kebab-btn"
            onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            aria-label="Menú"
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <>
              <div className="gl-kebab-backdrop" onClick={closeMenu} />
              <div className="gl-kebab-menu">
                <button onClick={() => { onEdit(goal); closeMenu(); }}>
                  <Edit2 size={13} /> Editar
                </button>
                <button onClick={() => { onToggleActive(goal.id); closeMenu(); }}>
                  {goal.isActive ? <><Pause size={13} /> Pausar</> : <><Play size={13} /> Reanudar</>}
                </button>
                <button onClick={() => { onViewDetail(goal.id); closeMenu(); }}>
                  <Eye size={13} /> Ver detalle
                </button>
                <button className="gl-kebab-danger" onClick={() => {
                  if (window.confirm(`¿Eliminar "${goal.name}"?`)) onDelete(goal.id);
                  closeMenu();
                }}>
                  <Trash2 size={13} /> Eliminar
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Progress ring + amounts */}
      <div className="gl-card-progress-area">
        <div className="gl-card-ring">
          <svg viewBox="0 0 80 80" width="72" height="72">
            <circle cx="40" cy="40" r="34" fill="none" stroke="var(--goal-border)" strokeWidth="5" />
            <circle
              cx="40" cy="40" r="34"
              fill="none"
              stroke={completed ? 'var(--goal-success)' : goal.color}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 34}
              strokeDashoffset={2 * Math.PI * 34 * (1 - progress / 100)}
              transform="rotate(-90 40 40)"
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <span className="gl-card-ring-pct">{progress.toFixed(0)}%</span>
        </div>
        <div className="gl-card-amounts-col">
          <span className="gl-card-current">{formatCurrency(goal.currentAmount, cur)}</span>
          <span className="gl-card-of">de {formatCurrency(goal.targetAmount, cur)}</span>
          {remaining > 0 && goal.isActive && (
            <span className="gl-card-remaining">Faltan {formatCurrency(remaining, cur)}</span>
          )}
        </div>
      </div>

      {/* Footer info */}
      <div className="gl-card-footer">
        {!completed && goal.isActive && !expired && (
          <div className="gl-card-info-row">
            <span className="gl-card-deadline">
              {days > 0 ? `${days} día${days !== 1 ? 's' : ''} restantes` : 'Hoy'}
            </span>
            <div className="gl-card-req-chips">
              <span className="gl-req-chip" title="Aporte sugerido por semana">{formatCurrency(req.weekly, cur)}/sem</span>
              <span className="gl-req-chip" title="Aporte sugerido por mes">{formatCurrency(req.monthly, cur)}/mes</span>
            </div>
          </div>
        )}

        {completed && (
          <div className="gl-card-status-msg gl-card-status-msg--achieved">
            ✓ ¡Meta alcanzada!
          </div>
        )}

        {expired && !completed && (
          <div className="gl-card-status-msg gl-card-status-msg--expired">
            Plazo vencido
          </div>
        )}

        {/* Action buttons */}
        <div className="gl-card-actions">
          {!completed && (
            <>
              {goal.isActive ? (
                <button className="gl-card-cta" onClick={() => onContribute(goal.id)}>
                  Aportar
                </button>
              ) : (
                <button className="gl-card-cta gl-card-cta--resume" onClick={() => onToggleActive(goal.id)}>
                  Reanudar
                </button>
              )}
            </>
          )}
          <button className="gl-card-detail-btn" onClick={() => onViewDetail(goal.id)}>
            Ver detalle
          </button>
        </div>
      </div>
    </div>
  );
});

GoalCard.displayName = 'GoalCard';
