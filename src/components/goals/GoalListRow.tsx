import { memo } from 'react';
import { SavingsGoal } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { getGoalProgress, getDaysRemaining, getGoalStatusLabel, isGoalCompleted, getRemainingAmount, getRequiredContribution } from '../../utils/goalCalculations';
import { Pause, Play } from 'lucide-react';

interface GoalListRowProps {
  goal: SavingsGoal;
  currency: string;
  onContribute: (goalId: string) => void;
  onToggleActive: (id: string) => void;
  onViewDetail: (id: string) => void;
  style?: React.CSSProperties;
}

export const GoalListRow = memo(({
  goal,
  currency,
  onContribute,
  onToggleActive,
  onViewDetail,
  style,
}: GoalListRowProps) => {
  const progress = getGoalProgress(goal);
  const days = getDaysRemaining(goal);
  const status = getGoalStatusLabel(goal);
  const completed = isGoalCompleted(goal);
  const remaining = getRemainingAmount(goal);
  const req = getRequiredContribution(goal);
  const cur = goal.currency || currency;

  return (
    <div
      className={`gl-list-row ${!goal.isActive ? 'gl-list-row--paused' : ''} ${completed ? 'gl-list-row--completed' : ''}`}
      style={style}
      onClick={() => onViewDetail(goal.id)}
      role="row"
      tabIndex={0}
    >
      <span className="gl-list-icon">{goal.icon}</span>

      <div className="gl-list-info">
        <span className="gl-list-name">{goal.name}</span>
        <span className="gl-list-status" style={{ color: status.color }}>{status.text}</span>
      </div>

      <div className="gl-list-progress-col">
        <div
          className="gl-list-progress-bar"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          title={`Faltan ${formatCurrency(remaining, cur)} · ${days > 0 ? `${days}d` : 'Vencida'}`}
        >
          <div
            className="gl-list-progress-fill"
            style={{
              width: `${progress}%`,
              background: completed ? 'var(--goal-success)' : goal.color,
            }}
          />
        </div>
        <span className="gl-list-pct">{progress.toFixed(0)}%</span>
      </div>

      <div className="gl-list-amounts">
        <span className="gl-list-current">{formatCurrency(goal.currentAmount, cur)}</span>
        <span className="gl-list-target">/ {formatCurrency(goal.targetAmount, cur)}</span>
      </div>

      <div className="gl-list-deadline">
        {days > 0 ? `${days}d` : completed ? '✓' : 'Vencida'}
      </div>

      <div className="gl-list-req">
        {!completed && goal.isActive && req.monthly > 0 ? formatCurrency(req.monthly, cur) + '/mes' : '—'}
      </div>

      <div className="gl-list-actions" onClick={e => e.stopPropagation()}>
        {!completed && (
          <>
            <button
              className="gl-list-toggle-btn"
              onClick={() => onToggleActive(goal.id)}
              title={goal.isActive ? 'Pausar' : 'Reanudar'}
              aria-label={goal.isActive ? 'Pausar' : 'Reanudar'}
            >
              {goal.isActive ? <Pause size={13} /> : <Play size={13} />}
            </button>
            {goal.isActive && (
              <button className="gl-list-cta" onClick={() => onContribute(goal.id)}>
                Aportar
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
});

GoalListRow.displayName = 'GoalListRow';
