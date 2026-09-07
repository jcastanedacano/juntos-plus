import { Statistics } from '../types';
import { formatCurrency } from '../utils/calculations';

interface StatsCardsProps {
  stats: Statistics;
  previousStats: Statistics;
  currency: string;
}

export const StatsCards = ({ stats, previousStats, currency }: StatsCardsProps) => {
  const expenseRatio = stats.totalIncome > 0
    ? (stats.totalExpenses / stats.totalIncome * 100).toFixed(1)
    : '0';

  // Calcular deltas vs mes anterior
  const incomeDelta = stats.totalIncome - previousStats.totalIncome;
  const expenseDelta = stats.totalExpenses - previousStats.totalExpenses;
  const balanceDelta = stats.balance - previousStats.balance;

  const prevExpenseRatio = previousStats.totalIncome > 0
    ? (previousStats.totalExpenses / previousStats.totalIncome * 100)
    : 0;
  const currentExpenseRatio = parseFloat(expenseRatio);
  const ratioDelta = currentExpenseRatio - prevExpenseRatio;

  // Función para calcular porcentaje de cambio
  const calculatePercentageChange = (current: number, previous: number): string => {
    if (previous === 0) {
      return current > 0 ? '+100%' : '0%';
    }
    const change = ((current - previous) / Math.abs(previous)) * 100;
    return change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
  };

  // Función para renderizar delta
  const renderDelta = (delta: number, isInverted: boolean = false) => {
    if (delta === 0) {
      return <div className="stat-delta neutral">→ Sin cambio vs mes anterior</div>;
    }

    const isPositive = isInverted ? delta < 0 : delta > 0;
    const arrow = delta > 0 ? '↑' : '↓';

    return (
      <div className={`stat-delta ${isPositive ? 'positive' : 'negative'}`}>
        {arrow} {formatCurrency(Math.abs(delta), currency)} vs mes anterior
      </div>
    );
  };

  return (
    <div className="stats-grid">
      {/* Ingresos */}
      <div className="stat-card-v2">
        <div className="stat-card-header">
          <div className="stat-icon-text">
            <span className="stat-icon-v2">💰</span>
            <div className="stat-text-group">
              <div className="stat-title-v2">Ingresos</div>
              <div className="stat-subtitle-v2">Este mes</div>
            </div>
          </div>
        </div>
        <div className="stat-amount income-color">+ {formatCurrency(stats.totalIncome, currency)}</div>
        {renderDelta(incomeDelta)}
      </div>

      {/* Gastos */}
      <div className="stat-card-v2">
        <div className="stat-card-header">
          <div className="stat-icon-text">
            <span className="stat-icon-v2">💸</span>
            <div className="stat-text-group">
              <div className="stat-title-v2">Gastos</div>
              <div className="stat-subtitle-v2">Este mes</div>
            </div>
          </div>
        </div>
        <div className="stat-amount expense-color">- {formatCurrency(stats.totalExpenses, currency)}</div>
        {renderDelta(expenseDelta, true)}
      </div>

      {/* Balance */}
      <div className={`stat-card-v2 ${stats.balance < 0 ? 'has-badge' : ''}`}>
        {stats.balance < 0 && (
          <div className="stat-badge-absolute danger">⚠ Déficit</div>
        )}
        <div className="stat-card-header">
          <div className="stat-icon-text">
            <span className="stat-icon-v2">💳</span>
            <div className="stat-text-group">
              <div className="stat-title-v2">Balance neto</div>
              <div className="stat-subtitle-v2">Este mes</div>
            </div>
          </div>
        </div>
        <div className={`stat-amount ${stats.balance >= 0 ? 'income-color' : 'expense-color'}`}>
          {stats.balance >= 0 ? '+ ' : '- '}{formatCurrency(Math.abs(stats.balance), currency)}
        </div>
        {renderDelta(balanceDelta)}
      </div>

      {/* Gasto/Ingreso */}
      <div className={`stat-card-v2 ${parseFloat(expenseRatio) > 100 ? 'has-badge' : ''}`}>
        {parseFloat(expenseRatio) > 100 && (
          <div className="stat-badge-absolute warning">⚠ Exceso</div>
        )}
        <div className="stat-card-header">
          <div className="stat-icon-text">
            <span className="stat-icon-v2">📊</span>
            <div className="stat-text-group">
              <div className="stat-title-v2">Gasto/Ingreso</div>
              <div className="stat-subtitle-v2">Este mes</div>
            </div>
          </div>
        </div>
        <div className={`stat-amount ${parseFloat(expenseRatio) <= 100 ? 'neutral-color' : 'expense-color'}`}>
          {expenseRatio}%
        </div>
        <div className="stat-explanation">
          {stats.totalIncome > 0 ? (
            parseFloat(expenseRatio) >= 100 ? (
              `Por cada ${currency === 'PEN' ? 'S/' : currency === 'USD' ? '$' : '€'} 1 que entra, salen ${currency === 'PEN' ? 'S/' : currency === 'USD' ? '$' : '€'} ${(parseFloat(expenseRatio) / 100).toFixed(2)}`
            ) : (
              `Gastas el ${expenseRatio}% de tus ingresos`
            )
          ) : 'Sin ingresos registrados'}
        </div>
        {ratioDelta !== 0 && (
          <div className={`stat-delta ${ratioDelta < 0 ? 'positive' : 'negative'}`}>
            {ratioDelta < 0 ? '↓' : '↑'} Gastas {ratioDelta < 0 ? 'menos' : 'más'} por cada {currency === 'PEN' ? 'sol' : currency === 'USD' ? 'dólar' : 'euro'} que entra
          </div>
        )}
        {ratioDelta === 0 && <div className="stat-delta neutral">→ Sin cambio vs mes anterior</div>}
      </div>
    </div>
  );
};
