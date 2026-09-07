import { useState } from 'react';
import { Info, X } from 'lucide-react';
import { HealthScoreBreakdown } from '../utils/calculations';

interface FinancialHealthScoreProps {
  score: HealthScoreBreakdown;
}

export function FinancialHealthScore({ score }: FinancialHealthScoreProps) {
  const [showFormula, setShowFormula] = useState(false);

  // SVG gauge parameters
  const size = 160;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75; // 270 degrees
  const offset = arcLength - (arcLength * score.total) / 100;
  const rotation = 135;

  const breakdownItems = [
    {
      label: 'Tasa de ahorro',
      value: score.savingsRateScore,
      weight: '30%',
      detail: `${score.savingsRate}% de ahorro`,
      formula: 'Promedio últimos 3 meses. 30%+ ahorro → 100 pts.',
    },
    {
      label: 'Cumplimiento presupuestos',
      value: score.budgetComplianceScore,
      weight: '30%',
      detail: `${score.budgetCompliance.toFixed(0)}% cumplimiento`,
      formula: 'Por cada presupuesto: penaliza solo si gastas más de lo asignado.',
    },
    {
      label: 'Estabilidad de gasto',
      value: score.variabilityScore,
      weight: '25%',
      detail: null,
      formula: 'Coeficiente de variación de gastos mensuales (6 meses). Menor variación = mejor score.',
    },
    {
      label: 'Progreso en metas',
      value: score.goalCompletionScore,
      weight: '15%',
      detail: null,
      formula: 'Promedio de progreso de todas las metas activas.',
    },
  ];

  return (
    <div className="health-score-card">
      <div className="health-score-header">
        <h3 className="health-score-title">Salud Financiera</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="health-score-badge" style={{ color: score.color, borderColor: score.color }}>
            {score.label}
          </span>
          <button
            className="formula-btn"
            onClick={() => setShowFormula(v => !v)}
            title="Ver cómo se calcula el score"
            aria-label="Ver cómo se calcula el score"
            aria-expanded={showFormula}
          >
            <Info size={14} />
          </button>
        </div>
      </div>

      {showFormula && (
        <div className="formula-panel" style={{ marginBottom: '0.75rem' }}>
          <button className="formula-close" onClick={() => setShowFormula(false)} aria-label="Cerrar fórmula">
            <X size={14} />
          </button>
          <p className="formula-title">Cómo se calcula el Score</p>
          <code className="formula-text">
            Score = 30% × Ahorro<br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ 30% × Presupuestos<br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ 25% × Estabilidad<br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ 15% × Metas<br />
            <br />
            Escala: ≥80 Excelente · ≥60 Buena<br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;≥40 Regular · &lt;40 En riesgo
          </code>
        </div>
      )}

      <div className="health-score-body">
        {/* Gauge */}
        <div className="health-score-gauge">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="var(--border)"
              strokeWidth={strokeWidth}
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeLinecap="round"
              transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={score.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
              style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.3s ease' }}
            />
          </svg>
          <div className="health-score-value">
            <span className="health-score-number" style={{ color: score.color }}>
              {score.total}
            </span>
            <span className="health-score-max">/100</span>
          </div>
        </div>

        {/* Breakdown bars */}
        <div className="health-score-breakdown">
          {breakdownItems.map((item) => (
            <div key={item.label} className="health-breakdown-item" title={item.formula}>
              <div className="health-breakdown-header">
                <span className="health-breakdown-label">{item.label}</span>
                <span className="health-breakdown-weight">peso {item.weight}</span>
              </div>
              <div className="health-breakdown-bar-bg">
                <div
                  className="health-breakdown-bar-fill"
                  style={{
                    width: `${item.value}%`,
                    background: item.value >= 70
                      ? 'var(--success)'
                      : item.value >= 40
                        ? 'var(--warning)'
                        : 'var(--danger)',
                  }}
                />
              </div>
              <div className="health-breakdown-value">
                Puntaje: <strong>{item.value}</strong>/100
                {item.detail && <span className="health-breakdown-detail"> ({item.detail})</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
