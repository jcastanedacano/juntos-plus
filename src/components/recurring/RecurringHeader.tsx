import { useMemo } from 'react';
import { RecurringTransaction, RecurringPeriod } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { toMonthlyAmount, savingsIfPaused, daysUntilNextCharge } from '../../utils/recurringCalculations';
import { TrendingUp, TrendingDown, Minus, Calendar, Zap } from 'lucide-react';
import { format } from 'date-fns';

interface RecurringHeaderProps {
  recurring: RecurringTransaction[];
  period: RecurringPeriod;
  onPeriodChange: (p: RecurringPeriod) => void;
  periodTotals: { income: number; expense: number; balance: number };
  currency: string;
}

const periodLabels: Record<RecurringPeriod, string> = {
  current: 'Este mes',
  next: 'Próximo',
  last3: 'Últimos 3',
};

const kpiSubLabels: Record<RecurringPeriod, string> = {
  current: 'este mes',
  next: 'próximo mes',
  last3: 'en 3 meses',
};

export const RecurringHeader = ({
  recurring,
  period,
  onPeriodChange,
  periodTotals,
  currency,
}: RecurringHeaderProps) => {
  const active = recurring.filter(r => r.isActive);
  const savings = savingsIfPaused(recurring);

  // Find next upcoming charge
  const nextCharge = useMemo(() => {
    if (active.length === 0) return null;
    let closest: RecurringTransaction | null = null;
    let minDays = Infinity;
    for (const r of active) {
      const d = daysUntilNextCharge(r);
      if (d < minDays) {
        minDays = d;
        closest = r;
      }
    }
    return closest ? { item: closest, days: minDays } : null;
  }, [active]);

  // Previous period comparison (simple: compare income vs expense trend)
  const balancePositive = periodTotals.balance >= 0;

  return (
    <div className="rec-header">
      {/* Period Selector */}
      <div className="rec-header-top">
        <div className="rec-period-selector">
          {(Object.keys(periodLabels) as RecurringPeriod[]).map(p => (
            <button
              key={p}
              className={`rec-period-btn ${period === p ? 'rec-period-btn--active' : ''}`}
              onClick={() => onPeriodChange(p)}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
        {balancePositive ? (
          <span className="rec-header-badge rec-header-badge--positive">
            <TrendingUp size={14} /> Plan positivo
          </span>
        ) : (
          <span className="rec-header-badge rec-header-badge--negative">
            <TrendingDown size={14} /> Revisar: gastos superan ingresos
          </span>
        )}
      </div>

      {/* KPI Cards */}
      <div className="rec-kpi-strip">
        <div className="rec-kpi-card">
          <div className="rec-kpi-label">Ingresos recurrentes</div>
          <div className="rec-kpi-value rec-kpi-value--income">
            <TrendingUp size={16} />
            {formatCurrency(periodTotals.income, currency)}
          </div>
          <div className="rec-kpi-sub">{active.filter(r => r.type === 'income').length} activos · {kpiSubLabels[period]}</div>
        </div>

        <div className="rec-kpi-card">
          <div className="rec-kpi-label">Gastos recurrentes</div>
          <div className="rec-kpi-value rec-kpi-value--expense">
            <TrendingDown size={16} />
            {formatCurrency(periodTotals.expense, currency)}
          </div>
          <div className="rec-kpi-sub">{active.filter(r => r.type === 'expense').length} activos · {kpiSubLabels[period]}</div>
        </div>

        <div className="rec-kpi-card">
          <div className="rec-kpi-label">Balance {period === 'last3' ? '3 meses' : 'mensual'}</div>
          <div className={`rec-kpi-value ${balancePositive ? 'rec-kpi-value--income' : 'rec-kpi-value--expense'}`}>
            {balancePositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            {formatCurrency(Math.abs(periodTotals.balance), currency)}
          </div>
          <div className="rec-kpi-sub">
            {balancePositive ? 'Superávit' : 'Déficit'} {kpiSubLabels[period]}
          </div>
        </div>
      </div>

      {/* Bottom info bar */}
      <div className="rec-header-info">
        {nextCharge && (
          <div className="rec-header-next">
            <Calendar size={14} />
            <span>
              Próximo cobro: <strong>{nextCharge.item.description}</strong>
              {' '}en {nextCharge.days === 0 ? 'hoy' : `${nextCharge.days}d`}
              {' '}({formatCurrency(nextCharge.item.amount, nextCharge.item.currency || currency)})
            </span>
          </div>
        )}
        {savings > 0 && (
          <div className="rec-header-savings">
            <Zap size={14} />
            <span>
              Ahorras <strong>{formatCurrency(savings, currency)}/mes</strong> con suscripciones pausadas
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
