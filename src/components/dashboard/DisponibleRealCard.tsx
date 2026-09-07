import { useState } from 'react';
import { Info, X } from 'lucide-react';
import { DisponibleRealBreakdown, MonthEndForecast, formatCurrency } from '../../utils/calculations';

interface DisponibleRealCardProps {
  breakdown: DisponibleRealBreakdown;
  forecast: MonthEndForecast;
  currency: string;
}

export function DisponibleRealCard({ breakdown, forecast, currency }: DisponibleRealCardProps) {
  const [showFormula, setShowFormula] = useState(false);

  const fmt = (n: number) => formatCurrency(n, currency);
  const isPositive = breakdown.disponibleAjustado >= 0;

  const rows: { label: string; value: number; sign: '+' | '-'; color: string }[] = [
    { label: 'Ingresos esperados', value: breakdown.totalIngresos, sign: '+', color: 'var(--success)' },
    { label: 'Comprometido (fijos)', value: breakdown.comprometido, sign: '-', color: 'var(--danger)' },
    { label: 'Variable planeado', value: breakdown.variablePlaneado, sign: '-', color: 'var(--warning)' },
    { label: 'Ahorro / Metas', value: breakdown.ahorroMetas, sign: '-', color: 'var(--accent-blue)' },
  ];

  return (
    <div className="disponible-card">
      {/* Header */}
      <div className="disponible-header">
        <div>
          <h3 className="disponible-title">¿Cuánto puedo gastar?</h3>
          <p className="disponible-subtitle">Disponible real este mes</p>
        </div>
        <button
          className="formula-btn"
          onClick={() => setShowFormula(v => !v)}
          title="Ver fórmula"
        >
          <Info size={15} />
          <span>Ver fórmula</span>
        </button>
      </div>

      {/* Formula tooltip */}
      {showFormula && (
        <div className="formula-panel">
          <button className="formula-close" onClick={() => setShowFormula(false)} aria-label="Cerrar fórmula">
            <X size={14} />
          </button>
          <p className="formula-title">Cómo se calcula</p>
          <code className="formula-text">
            Disponible Real =<br />
            &nbsp;&nbsp;Ingresos esperados<br />
            &nbsp;&nbsp;− Comprometido (fijos + recurrentes)<br />
            &nbsp;&nbsp;− Variable planeado (presupuestos)<br />
            &nbsp;&nbsp;− Ahorro / Metas<br />
            <br />
            Disponible ajustado =<br />
            &nbsp;&nbsp;Disponible Real − Gasto variable ejecutado
          </code>
        </div>
      )}

      {/* Main KPI */}
      <div className="disponible-main">
        <span
          className="disponible-amount"
          style={{ color: isPositive ? 'var(--success)' : 'var(--danger)' }}
        >
          {isPositive ? '' : '−'}{fmt(Math.abs(breakdown.disponibleAjustado))}
        </span>
        {breakdown.diasRestantes > 0 && (
          <span className="disponible-per-day">
            {fmt(Math.abs(breakdown.disponiblePorDia))}/día · {breakdown.diasRestantes} días restantes
          </span>
        )}
      </div>

      {/* Breakdown waterfall */}
      <div className="disponible-breakdown">
        {rows.map(row => (
          <div key={row.label} className="disponible-row">
            <span className="disponible-row-label">{row.label}</span>
            <span className="disponible-row-value" style={{ color: row.color }}>
              {row.sign}{fmt(row.value)}
            </span>
          </div>
        ))}
        <div className="disponible-divider" />
        <div className="disponible-row bold">
          <span className="disponible-row-label">= Disponible real</span>
          <span className="disponible-row-value" style={{ color: breakdown.disponibleReal >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {fmt(breakdown.disponibleReal)}
          </span>
        </div>
        {breakdown.variableEjecutado > 0 && (
          <>
            <div className="disponible-row">
              <span className="disponible-row-label">Ya gastado (variable)</span>
              <span className="disponible-row-value" style={{ color: 'var(--danger)' }}>
                −{fmt(breakdown.variableEjecutado)}
              </span>
            </div>
            <div className="disponible-row bold">
              <span className="disponible-row-label">= Disponible ajustado</span>
              <span className="disponible-row-value" style={{ color: isPositive ? 'var(--success)' : 'var(--danger)' }}>
                {fmt(breakdown.disponibleAjustado)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Forecast badge */}
      <div className={`disponible-forecast ${forecast.isPositive ? 'positive' : 'negative'}`}>
        <span className="forecast-icon">{forecast.isPositive ? '📈' : '📉'}</span>
        <span className="forecast-msg">{forecast.forecastMessage}</span>
      </div>
    </div>
  );
}
