import { MonthlyPlan as MonthlyPlanType, formatCurrency } from '../utils/calculations';

interface MonthlyPlanProps {
  plan: MonthlyPlanType;
  currency: string;
}

export const MonthlyPlan = ({ plan, currency }: MonthlyPlanProps) => {
  // Calcular diferencia vs plan
  const differenceVsPlan = plan.actualFreeCash - plan.estimatedFreeCash;
  const executionPercentage = plan.estimatedFreeCash !== 0
    ? Math.abs((plan.actualFreeCash / plan.estimatedFreeCash) * 100)
    : 0;
  const executionDisplay = executionPercentage.toFixed(1);
  const isOver = parseFloat(executionDisplay) > 100;

  // Saldo libre progress: ratio of actual vs estimated
  const saldoLibreRatio = plan.estimatedFreeCash !== 0
    ? Math.min(Math.abs(plan.actualFreeCash / plan.estimatedFreeCash) * 100, 100)
    : 0;

  return (
    <div className="monthly-plan-container">
      <div className="section-header-inline">
        <h2 className="section-title-inline">Plan del Mes</h2>
      </div>

      {/* Row: Plan del Mes (2/3) + Saldo Libre Estimado (1/3) */}
      <div className="plan-cards-row">
        {/* Plan del Mes card - contains Balance Recurrente + Compromisos */}
        <div className="plan-mini-card">
          <div className="plan-mini-header">
            <span className="plan-mini-icon">💰</span>
            <span className="plan-mini-title">Balance Recurrente & Compromisos</span>
          </div>
          <div className="plan-mini-amount positive">
            {formatCurrency(plan.recurringBalance, currency)}
          </div>
          <div className="plan-mini-detail">
            <span className="detail-label">Ingresos:</span>
            <span className="detail-value income">+{formatCurrency(plan.recurringIncome, currency)}</span>
          </div>
          <div className="plan-mini-detail">
            <span className="detail-label">Gastos:</span>
            <span className="detail-value expense">-{formatCurrency(plan.recurringExpenses, currency)}</span>
          </div>
          <div className="plan-mini-detail">
            <span className="detail-label">Presupuestos:</span>
            <span className="detail-value expense">-{formatCurrency(plan.plannedBudgets, currency)}</span>
          </div>
          <div className="plan-mini-detail">
            <span className="detail-label">Metas:</span>
            <span className="detail-value expense">-{formatCurrency(plan.goalsContribution, currency)}</span>
          </div>
        </div>

        {/* Saldo Libre Estimado (1/3) */}
        <div className={`plan-mini-card highlighted ${plan.estimatedFreeCash >= 0 ? 'positive-border' : 'negative-border'}`}>
          <div className="plan-mini-header">
            <span className="plan-mini-icon">💎</span>
            <span className="plan-mini-title">Saldo Libre Estimado</span>
          </div>
          <div className={`plan-mini-amount-large ${plan.estimatedFreeCash >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(plan.estimatedFreeCash, currency)}
          </div>
          {plan.estimatedFreeCash >= 0 ? (
            <div className="plan-status-badge success">Plan positivo</div>
          ) : plan.estimatedFreeCash > -1000 ? (
            <div className="plan-status-badge warning">Plan ajustado</div>
          ) : (
            <div className="plan-status-badge danger">Plan en déficit</div>
          )}
        </div>
      </div>

      {/* Sección de datos reales - Full width (row 4) */}
      <div className="plan-real-section">
        <div className="plan-real-header">
          <span className="plan-real-icon">📊</span>
          <span className="plan-real-title">Datos Reales del Mes</span>
          <span className={`difference-badge ${differenceVsPlan >= 0 ? 'positive' : 'negative'}`}>
            {differenceVsPlan >= 0 ? '+' : ''}{formatCurrency(Math.abs(differenceVsPlan), currency)} vs Plan
          </span>
        </div>

        <div className="plan-real-grid">
          <div className="plan-real-item">
            <div className="plan-real-label">Gastos diarios del mes</div>
            <div className="plan-real-value expense">-{formatCurrency(plan.dailyExpensesThisMonth, currency)}</div>
          </div>

          <div className="plan-real-item">
            <div className="plan-real-label">Ingresos extra del mes</div>
            <div className="plan-real-value income">+{formatCurrency(plan.extraIncomeThisMonth, currency)}</div>
          </div>

          <div className={`plan-real-item-final ${plan.actualFreeCash < 0 ? 'deficit' : ''}`}>
            <div className="plan-real-label-final">
              {plan.actualFreeCash < 0 && <span className="warning-icon">⚠️</span>}
              Saldo libre actual
            </div>
            <div className={`plan-real-value-final ${plan.actualFreeCash >= 0 ? 'positive' : 'negative'}`}>
              {formatCurrency(plan.actualFreeCash, currency)}
            </div>
          </div>
        </div>

        {/* Saldo libre progress bar */}
        <div className="saldo-libre-bar-container">
          <div className="saldo-libre-bar-header">
            <span>Saldo libre actual</span>
            <span style={{ fontFeatureSettings: "'tnum' on, 'lnum' on" }}>
              {formatCurrency(plan.actualFreeCash, currency)}
            </span>
          </div>
          <div className="saldo-libre-bar">
            <div
              className={`saldo-libre-bar-fill ${plan.actualFreeCash >= 0 ? 'positive' : 'negative'}`}
              style={{ width: `${saldoLibreRatio}%` }}
            />
          </div>
        </div>

        {/* Barra de ejecución del gasto con markers */}
        <div className="execution-bar-container">
          <div className="execution-bar-header">
            <span>
              Ejecución del gasto
              {isOver && (
                <span className="execution-over-badge">Over</span>
              )}
            </span>
            <span className="execution-percentage" style={isOver ? { color: '#FF6B81' } : undefined}>
              {executionDisplay}%
            </span>
          </div>
          <div className="execution-bar">
            <div
              className={`execution-bar-fill ${isOver ? 'over' : 'normal'}`}
              style={{ width: `${Math.min(parseFloat(executionDisplay), 100)}%` }}
            />
            {/* Markers at 80%, 100% */}
            <div className="execution-markers">
              <div className="execution-marker at-80" />
              <div className="execution-marker at-100" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
