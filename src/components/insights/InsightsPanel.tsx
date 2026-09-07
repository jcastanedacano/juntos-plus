import { useState, useMemo } from 'react';
import { Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { Transaction, RecurringTransaction, Budget, FinancialInsight } from '../../types';
import { generateInsights } from '../../utils/insights';
import { AlertCard } from './AlertCard';

interface InsightsPanelProps {
  transactions: Transaction[];
  recurring: RecurringTransaction[];
  budgets: Budget[];
  selectedMonth?: Date;
}

export function InsightsPanel({ transactions, recurring, budgets, selectedMonth }: InsightsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const insights = useMemo(
    () => generateInsights(transactions, recurring, budgets, selectedMonth),
    [transactions, recurring, budgets, selectedMonth]
  );

  if (insights.length === 0) return null;

  const dangerCount = insights.filter(i => i.severity === 'danger').length;
  const warningCount = insights.filter(i => i.severity === 'warning').length;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: '16px',
      overflow: 'hidden',
    }}>
      {/* Header - clickable to toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          background: 'none', border: 'none',
          cursor: 'pointer', color: 'var(--text-primary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 36, height: 36, borderRadius: '10px',
            background: 'rgba(245, 158, 11, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Lightbulb size={20} style={{ color: 'var(--warning)' }} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
              Insights Financieros
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {insights.length} insight{insights.length !== 1 ? 's' : ''} disponible{insights.length !== 1 ? 's' : ''}
              {dangerCount > 0 && (
                <span style={{ color: 'var(--danger)', marginLeft: '0.5rem' }}>
                  {dangerCount} urgente{dangerCount !== 1 ? 's' : ''}
                </span>
              )}
              {warningCount > 0 && (
                <span style={{ color: 'var(--warning)', marginLeft: '0.5rem' }}>
                  {warningCount} aviso{warningCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {/* Insights list */}
      {isExpanded && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '0.75rem',
          padding: '0 1.25rem 1.25rem',
        }}>
          {/* Priority sort: danger > warning > info > success */}
          {[...insights]
            .sort((a, b) => {
              const order = { danger: 0, warning: 1, info: 2, success: 3 };
              return order[a.severity] - order[b.severity];
            })
            .map(insight => (
              <AlertCard key={insight.id} insight={insight} />
            ))
          }
        </div>
      )}
    </div>
  );
}
