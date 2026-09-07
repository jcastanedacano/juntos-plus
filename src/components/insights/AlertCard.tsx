import { AlertTriangle, TrendingUp, Calculator, Clock, Zap, Info } from 'lucide-react';
import { FinancialInsight } from '../../types';

interface AlertCardProps {
  insight: FinancialInsight;
}

const severityStyles: Record<string, { bg: string; border: string; color: string }> = {
  info: { bg: 'rgba(59, 130, 246, 0.06)', border: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue)' },
  warning: { bg: 'rgba(245, 158, 11, 0.06)', border: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)' },
  danger: { bg: 'rgba(239, 68, 68, 0.06)', border: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)' },
  success: { bg: 'rgba(34, 211, 166, 0.06)', border: 'rgba(34, 211, 166, 0.15)', color: 'var(--success)' },
};

const typeIcons: Record<string, React.ReactNode> = {
  phantom_spending: <Zap size={18} />,
  unusual_spending: <AlertTriangle size={18} />,
  month_forecast: <Calculator size={18} />,
  spending_pace: <TrendingUp size={18} />,
  daily_budget: <Clock size={18} />,
  trend_alert: <TrendingUp size={18} />,
};

export function AlertCard({ insight }: AlertCardProps) {
  const style = severityStyles[insight.severity];

  return (
    <div style={{
      background: style.bg,
      border: `1px solid ${style.border}`,
      borderRadius: '12px',
      padding: '1rem 1.25rem',
      display: 'flex',
      gap: '0.75rem',
      alignItems: 'flex-start',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '10px',
        background: `${style.color}15`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: style.color,
        flexShrink: 0,
      }}>
        {typeIcons[insight.type] || <Info size={18} />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 600, fontSize: '0.9rem',
          color: 'var(--text-primary)',
          marginBottom: '0.2rem',
        }}>
          {insight.title}
        </div>
        <div style={{
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
        }}>
          {insight.description}
        </div>
        {insight.action && (
          <div style={{
            marginTop: '0.5rem',
            fontSize: '0.75rem',
            fontWeight: 500,
            color: style.color,
            cursor: 'pointer',
          }}>
            {insight.action} →
          </div>
        )}
      </div>
    </div>
  );
}
