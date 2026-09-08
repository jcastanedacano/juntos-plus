import { localeActual } from '../../utils/fxTasas';
interface BudgetBarProps {
  category: string;
  categoryIcon: string;
  limit: number;
  used: number;
  currency?: string;
}

const currencySymbols: Record<string, string> = {
  PEN: 'S/',
  USD: '$',
  EUR: '€'
};

export function BudgetBar({
  category,
  categoryIcon,
  limit,
  used,
  currency = 'PEN'
}: BudgetBarProps) {
  const symbol = currencySymbols[currency] || 'S/';
  const percentage = limit > 0 ? (used / limit) * 100 : 0;
  const remaining = limit - used;

  const formatAmount = (value: number) => {
    return `${symbol} ${Math.abs(value).toLocaleString(localeActual(), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })}`;
  };

  const getBarColor = () => {
    if (percentage >= 100) return 'red';
    if (percentage >= 80) return 'amber';
    return 'green';
  };

  const getStatusText = () => {
    if (percentage >= 110) return `Excedido por ${formatAmount(used - limit)}`;
    if (percentage >= 100) return 'Límite alcanzado';
    if (percentage >= 80) return `Quedan ${formatAmount(remaining)}`;
    return `Quedan ${formatAmount(remaining)}`;
  };

  return (
    <div className="budget-bar-container">
      <div className="budget-bar-header">
        <div className="budget-bar-category">
          <span className="budget-bar-icon">{categoryIcon}</span>
          <span className="budget-bar-name">{category}</span>
        </div>
        <div className="budget-bar-amounts">
          <span>{formatAmount(used)}</span> / {formatAmount(limit)}
        </div>
      </div>

      <div className="budget-bar-track">
        <div
          className={`budget-bar-fill ${getBarColor()}`}
          style={{ width: `${Math.min(percentage, 110)}%` }}
        />
        <div className="budget-bar-markers">
          <div className="budget-bar-marker at-80" />
          <div className="budget-bar-marker at-100" />
        </div>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '0.375rem',
        fontSize: '0.75rem'
      }}>
        <span style={{ color: 'var(--text-muted)' }}>{percentage.toFixed(0)}% usado</span>
        <span style={{
          color: percentage >= 100 ? 'var(--danger)' : percentage >= 80 ? 'var(--warning)' : 'var(--text-secondary)'
        }}>
          {getStatusText()}
        </span>
      </div>
    </div>
  );
}
