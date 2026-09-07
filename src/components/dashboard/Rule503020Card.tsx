import { useState } from 'react';
import { Info, X } from 'lucide-react';
import { Rule503020Result, formatCurrency } from '../../utils/calculations';

interface Rule503020CardProps {
  result: Rule503020Result;
  currency: string;
}

interface AllocRowProps {
  name: string;
  amount: number;
  target: number;
  targetAmount: number;
  totalIncome: number;
  exceeds: boolean;
  isAhorro?: boolean;
  color: string;
  currency: string;
}

function AllocRow({ name, amount, target, targetAmount, totalIncome, exceeds, isAhorro, color, currency }: AllocRowProps) {
  // Bar fills relative to total income; target marker sits at the recommended %.
  const fillPct = totalIncome > 0 ? Math.min((amount / totalIncome) * 100, 100) : 0;
  const targetPct = target;

  // Red if over (or below for savings)
  const barColor = exceeds ? 'var(--accent-red)' : color;

  return (
    <div className="alloc-row">
      <span className="alloc-name">{name}</span>
      <span className="alloc-amt">
        {formatCurrency(amount, currency)}
        {' '}<span className="target">/ {formatCurrency(targetAmount, currency)}</span>
      </span>
      <div className="alloc-bar" title={`${isAhorro ? 'meta' : 'tope'}: ${target}%`}>
        <span className="alloc-fill" style={{ width: `${fillPct}%`, background: barColor }} />
        <span className="alloc-target" style={{ left: `${targetPct}%` }} />
      </div>
    </div>
  );
}

export function Rule503020Card({ result, currency }: Rule503020CardProps) {
  const [showFormula, setShowFormula] = useState(false);
  const fmt = (n: number) => formatCurrency(n, currency);
  const anyAlert = result.comprometido.exceeds || result.variable.exceeds || result.ahorro.exceeds;

  if (result.totalIncome === 0) {
    return (
      <div className="dr-card">
        <div className="dr-card-head">
          <div>
            <div className="dr-card-title">Asignación 50/30/20</div>
            <div className="dr-card-sub">Necesidades · Deseos · Ahorro</div>
          </div>
        </div>
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
          Sin ingresos registrados para analizar
        </div>
      </div>
    );
  }

  return (
    <div className="dr-card">
      <div className="dr-card-head">
        <div>
          <div className="dr-card-title">Asignación 50/30/20</div>
          <div className="dr-card-sub">Necesidades · Deseos · Ahorro · Ingresos {fmt(result.totalIncome)}</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {anyAlert ? (
            <span className="delta-pill down">Revisar</span>
          ) : (
            <span className="delta-pill up">En camino</span>
          )}
          <button className="dr-card-action" onClick={() => setShowFormula(v => !v)} aria-label="Ver fórmula">
            <Info size={14} />
          </button>
        </div>
      </div>

      {showFormula && (
        <div style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '14px 16px',
          marginBottom: '14px',
          position: 'relative',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
        }}>
          <button
            onClick={() => setShowFormula(false)}
            aria-label="Cerrar fórmula"
            style={{
              position: 'absolute', top: 8, right: 8, background: 'transparent',
              border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4,
            }}
          >
            <X size={12} />
          </button>
          <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Cómo funciona</strong>
          50% Necesidades (fijos) · 30% Deseos (discrecional) · 20% Ahorro (metas)
          <br />Basado en ingresos totales del mes.
        </div>
      )}

      <div className="alloc-list">
        <AllocRow
          name="Necesidades"
          amount={result.comprometido.amount}
          target={result.comprometido.target}
          targetAmount={result.comprometido.targetAmount}
          totalIncome={result.totalIncome}
          exceeds={result.comprometido.exceeds}
          color="var(--accent-blue)"
          currency={currency}
        />
        <AllocRow
          name="Deseos"
          amount={result.variable.amount}
          target={result.variable.target}
          targetAmount={result.variable.targetAmount}
          totalIncome={result.totalIncome}
          exceeds={result.variable.exceeds}
          color="var(--accent-amber)"
          currency={currency}
        />
        <AllocRow
          name="Ahorro & metas"
          amount={result.ahorro.amount}
          target={result.ahorro.target}
          targetAmount={result.ahorro.targetAmount}
          totalIncome={result.totalIncome}
          exceeds={result.ahorro.exceeds}
          isAhorro
          color="var(--accent-green)"
          currency={currency}
        />
      </div>
    </div>
  );
}
