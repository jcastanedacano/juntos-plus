import { useMemo } from 'react';
import { RecurringTransaction } from '../../types';
import { calculateRecurringHealthScore, detectPossibleDuplicates } from '../../utils/recurringCalculations';
import { getCategoryInfo } from '../../data/categories';
import { Shield, AlertTriangle, CheckCircle, Info, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../utils/calculations';

interface RecurringHealthCardProps {
  recurring: RecurringTransaction[];
  onDeleteRecurring?: (id: string) => void;
  currency?: string;
}

export const RecurringHealthCard = ({ recurring, onDeleteRecurring, currency = 'PEN' }: RecurringHealthCardProps) => {
  const health = useMemo(() => calculateRecurringHealthScore(recurring), [recurring]);
  const duplicates = useMemo(() => detectPossibleDuplicates(recurring), [recurring]);

  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (health.score / 100) * circumference;

  return (
    <div className="rec-health">
      <div className="rec-health-header">
        <Shield size={18} />
        <h3 className="rec-health-title">Salud de recurrentes</h3>
      </div>

      <div className="rec-health-body">
        {/* Score circle */}
        <div className="rec-health-score">
          <svg viewBox="0 0 100 100" className="rec-health-ring">
            <circle cx="50" cy="50" r="40" fill="none" stroke="var(--rec-border)" strokeWidth="6" />
            <circle
              cx="50" cy="50" r="40"
              fill="none"
              stroke={health.color}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 50 50)"
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <div className="rec-health-score-text">
            <span className="rec-health-score-number" style={{ color: health.color }}>{health.score}</span>
            <span className="rec-health-score-label">{health.label}</span>
          </div>
        </div>

        {/* Alerts */}
        <div className="rec-health-alerts">
          {health.alerts.length === 0 ? (
            <div className="rec-health-alert rec-health-alert--success">
              <CheckCircle size={14} />
              <span>Todo en orden. Sin alertas.</span>
            </div>
          ) : (
            health.alerts.map((alert, i) => (
              <div key={i} className="rec-health-alert rec-health-alert--warning">
                <AlertTriangle size={14} />
                <span>{alert}</span>
              </div>
            ))
          )}
        </div>

        {/* Duplicates */}
        {duplicates.length > 0 && (
          <div className="rec-health-dupes">
            <h4 className="rec-health-dupes-title">
              <Info size={14} /> Posibles duplicados
            </h4>
            {duplicates.map(([a, b], i) => {
              const catA = getCategoryInfo(a.category);
              return (
                <div key={i} className="rec-health-dupe-row">
                  <div className="rec-health-dupe-info">
                    <span>{catA?.icon} {a.description} ({formatCurrency(a.amount, currency)})</span>
                    <span className="rec-health-dupe-vs">vs</span>
                    <span>{b.description} ({formatCurrency(b.amount, currency)})</span>
                  </div>
                  {onDeleteRecurring && (
                    <button
                      className="rec-health-dupe-delete"
                      title={`Eliminar "${b.description}"`}
                      onClick={() => {
                        if (window.confirm(`¿Eliminar "${b.description}" (posible duplicado)?`)) {
                          onDeleteRecurring(b.id);
                        }
                      }}
                    >
                      <Trash2 size={13} /> Eliminar
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
