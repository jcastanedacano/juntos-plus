import { SavingsGoal } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { differenceInMonths } from 'date-fns';

interface GoalsStripProps {
  goals: SavingsGoal[];
  currency: string;
  onManageGoals?: () => void;
  onSelectGoal?: (goal: SavingsGoal) => void;
}

const monthsLeft = (deadline: string): number => {
  try {
    return Math.max(differenceInMonths(new Date(deadline), new Date()), 0);
  } catch {
    return 0;
  }
};

const barColor = (pct: number): string => {
  if (pct >= 80) return 'var(--accent-amber)';
  if (pct >= 50) return 'var(--accent-green)';
  return 'var(--accent-blue)';
};

export function GoalsStrip({ goals, currency, onManageGoals, onSelectGoal }: GoalsStripProps) {
  const active = goals.filter(g => g.isActive).slice(0, 3);

  return (
    <>
      <div className="dr-section-head">
        <h2>Metas activas</h2>
        {onManageGoals && (
          <button className="dr-section-more" onClick={onManageGoals}>
            Gestionar metas →
          </button>
        )}
      </div>
      {active.length === 0 ? (
        <div className="insights-empty">No hay metas activas</div>
      ) : (
        <div className="goals-strip">
          {active.map(goal => {
            const pct = goal.targetAmount > 0
              ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
              : 0;
            const months = monthsLeft(goal.deadline);
            return (
              <div
                key={goal.id}
                className="goal-card"
                onClick={() => onSelectGoal?.(goal)}
                role={onSelectGoal ? 'button' : undefined}
              >
                <div className="goal-head">
                  <span className="goal-emoji">{goal.icon}</span>
                  <span className="goal-name">{goal.name}</span>
                  <span className="goal-pct">{pct.toFixed(0)}%</span>
                </div>
                <div className="alloc-bar">
                  <span
                    className="alloc-fill"
                    style={{ width: `${pct}%`, background: goal.color || barColor(pct) }}
                  />
                </div>
                <div className="goal-amounts">
                  <strong>{formatCurrency(goal.currentAmount, currency)}</strong>
                  {' '}de {formatCurrency(goal.targetAmount, currency)}
                  {months > 0 && ` · faltan ${months} ${months === 1 ? 'mes' : 'meses'}`}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
