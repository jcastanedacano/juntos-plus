import { MonthlyPlan as MonthlyPlanType, formatCurrency } from '../utils/calculations';

interface MonthlyPlanProps {
  plan: MonthlyPlanType;
  currency: string;
}

export const MonthlyPlan = ({ plan, currency }: MonthlyPlanProps) => {
  return (
    <div className="monthly-plan-container">
      <h2 className="section-title">📋 Plan del Mes</h2>

      <div className="monthly-plan-card">
        <div className="plan-section">
          <div className="plan-header">
            <span className="plan-icon">💰</span>
            <span className="plan-label">Balance Recurrente</span>
          </div>
          <div className="plan-breakdown">
            <div className="plan-item">
              <span className="plan-item-label">Ingresos recurrentes:</span>
              <span className="plan-item-value income">
                +{formatCurrency(plan.recurringIncome, currency)}
              </span>
            </div>
            <div className="plan-item">
              <span className="plan-item-label">Gastos recurrentes:</span>
              <span className="plan-item-value expense">
                -{formatCurrency(plan.recurringExpenses, currency)}
              </span>
            </div>
          </div>
          <div className="plan-total">
            <span className="plan-total-label">Balance:</span>
            <span className={`plan-total-value ${plan.recurringBalance >= 0 ? 'positive' : 'negative'}`}>
              {formatCurrency(plan.recurringBalance, currency)}
            </span>
          </div>
        </div>

        <div className="plan-divider">−</div>

        <div className="plan-section">
          <div className="plan-header">
            <span className="plan-icon">🎯</span>
            <span className="plan-label">Presupuestos Planificados</span>
          </div>
          <div className="plan-total">
            <span className={`plan-total-value expense`}>
              {formatCurrency(plan.plannedBudgets, currency)}
            </span>
          </div>
        </div>

        <div className="plan-divider">−</div>

        <div className="plan-section">
          <div className="plan-header">
            <span className="plan-icon">🎯</span>
            <span className="plan-label">Aporte a Metas</span>
          </div>
          <div className="plan-total">
            <span className={`plan-total-value expense`}>
              {formatCurrency(plan.goalsContribution, currency)}
            </span>
          </div>
        </div>

        <div className="plan-divider-thick">=</div>

        <div className="plan-section plan-result">
          <div className="plan-header">
            <span className="plan-icon">💎</span>
            <span className="plan-label">Saldo Libre Estimado</span>
          </div>
          <div className="plan-final-total">
            <span className={`plan-final-value ${plan.estimatedFreeCash >= 0 ? 'positive' : 'negative'}`}>
              {formatCurrency(plan.estimatedFreeCash, currency)}
            </span>
          </div>
          {plan.estimatedFreeCash >= 0 ? (
            <div className="plan-message success">
              ✓ Buen plan financiero para el mes
            </div>
          ) : (
            <div className="plan-message warning">
              ⚠️ Considera ajustar tus presupuestos o metas
            </div>
          )}
        </div>

        <div className="plan-divider-thin"></div>

        <div className="plan-section plan-actual">
          <div className="plan-header">
            <span className="plan-icon">📊</span>
            <span className="plan-label">Datos Reales del Mes</span>
          </div>

          <div className="plan-actual-items">
            <div className="plan-actual-item">
              <span className="plan-actual-label">Gastos diarios del mes:</span>
              <span className="plan-actual-value expense">
                -{formatCurrency(plan.dailyExpensesThisMonth, currency)}
              </span>
            </div>

            <div className="plan-actual-item">
              <span className="plan-actual-label">Ingresos extra del mes:</span>
              <span className="plan-actual-value income">
                +{formatCurrency(plan.extraIncomeThisMonth, currency)}
              </span>
            </div>

            <div className="plan-actual-item-final">
              <span className="plan-actual-label-final">Saldo libre actual:</span>
              <span className={`plan-actual-value-final ${plan.actualFreeCash >= 0 ? 'positive' : 'negative'}`}>
                {formatCurrency(plan.actualFreeCash, currency)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
