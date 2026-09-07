import { useMemo } from 'react';
import { Transaction, RecurringTransaction, Budget, FinancialInsight, SavingsGoal, Owner } from '../../types';
import { generateInsights } from '../../utils/insights';
import { ownerOf } from '../../utils/ownership';
import { useOwnerLabels } from '../../utils/ownerLabels';
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { parseDateOnly } from '../../utils/stableDate';

interface InsightsRowProps {
  transactions: Transaction[];
  recurring: RecurringTransaction[];
  budgets: Budget[];
  goals?: SavingsGoal[];
  selectedMonth?: Date;
  onAction?: (insight: FinancialInsight, options?: { compatibleGoals?: SavingsGoal[] }) => void;
  onCreateGoal?: () => void;
}

const SEVERITY_TONE: Record<FinancialInsight['severity'], 'amber' | 'blue' | 'green' | 'red'> = {
  warning: 'amber',
  info: 'blue',
  success: 'green',
  danger: 'red',
};

const TYPE_TAG: Record<FinancialInsight['type'], string> = {
  phantom_spending: 'Gasto fantasma',
  unusual_spending: 'Gasto inusual',
  month_forecast: 'Pronóstico',
  spending_pace: 'Ritmo',
  daily_budget: 'Día gastable',
  trend_alert: 'Tendencia',
};

// Returns the owner that contributed the most expense in this category for
// the given month — used to scope the "Mover a meta" CTA to a matching goal.
function dominantOwnerForCategory(
  transactions: Transaction[],
  category: string | undefined,
  ref: Date
): Owner {
  if (!category) return 'shared';
  const start = startOfMonth(ref);
  const end = endOfMonth(ref);
  const totals: Record<Owner, number> = { shared: 0, me: 0, partner: 0 };
  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    if (tx.category !== category) continue;
    const d = parseDateOnly(tx.date);
    if (isNaN(d.getTime()) || !isWithinInterval(d, { start, end })) continue;
    totals[ownerOf(tx)] += tx.amount;
  }
  let best: Owner = 'shared';
  let bestVal = totals.shared;
  for (const o of ['me', 'partner'] as Owner[]) {
    if (totals[o] > bestVal) { best = o; bestVal = totals[o]; }
  }
  return best;
}

const MOVE_TO_GOAL_RE = /meta|ahorro/i;

export function InsightsRow({
  transactions,
  recurring,
  budgets,
  goals = [],
  selectedMonth,
  onAction,
  onCreateGoal,
}: InsightsRowProps) {
  const ownerLabels = useOwnerLabels();
  const insights = useMemo(
    () => generateInsights(transactions, recurring, budgets, selectedMonth).slice(0, 3),
    [transactions, recurring, budgets, selectedMonth]
  );
  const ref = selectedMonth || new Date();

  return (
    <>
      <div className="dr-section-head">
        <h2>Sugerencias para esta semana</h2>
      </div>
      {insights.length === 0 ? (
        <div className="insights-empty">
          Sin sugerencias por ahora — todo va en orden ✨
        </div>
      ) : (
        <div className="insights-row">
          {insights.map(ins => {
            const isMoveToGoal = !!ins.action && MOVE_TO_GOAL_RE.test(ins.action);
            const dominant = isMoveToGoal
              ? dominantOwnerForCategory(transactions, ins.category, ref)
              : 'shared';
            const compatible = isMoveToGoal
              ? goals.filter(g => g.isActive && (g.owner || 'shared') === dominant)
              : [];
            const lockMoveToGoal = isMoveToGoal && compatible.length === 0;
            const lockReason = lockMoveToGoal
              ? `No tienes metas activas de "${ownerLabels[dominant]}". Crea una meta primero.`
              : undefined;

            return (
              <div key={ins.id} className={`insight-card ${SEVERITY_TONE[ins.severity]}`}>
                <span className="ins-tag">{TYPE_TAG[ins.type]}</span>
                <div className="ins-title">{ins.title}</div>
                <div className="ins-detail">{ins.description}</div>
                {ins.action && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                    <button
                      className="ins-cta"
                      onClick={() => {
                        if (lockMoveToGoal) {
                          onCreateGoal?.();
                        } else {
                          onAction?.(ins, { compatibleGoals: compatible });
                        }
                      }}
                      type="button"
                      disabled={lockMoveToGoal && !onCreateGoal}
                      title={lockReason}
                      aria-disabled={lockMoveToGoal && !onCreateGoal}
                      style={lockMoveToGoal && !onCreateGoal
                        ? { opacity: 0.55, cursor: 'not-allowed' }
                        : undefined
                      }
                    >
                      {lockMoveToGoal && onCreateGoal
                        ? `Crear meta · ${ownerLabels[dominant]}`
                        : `${ins.action} →`}
                    </button>
                    {lockMoveToGoal && (
                      <small style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        🔒 {lockReason}
                      </small>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
