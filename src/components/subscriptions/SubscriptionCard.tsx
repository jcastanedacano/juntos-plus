import { useState } from 'react';
import { CreditCard, TrendingUp, AlertTriangle, Check, X, Calendar, List, EyeOff, Plus } from 'lucide-react';
import { DetectedSubscription, Transaction } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { parseDateOnly } from '../../utils/stableDate';

interface SubscriptionCardProps {
  subscription: DetectedSubscription;
  currency: string;
  transactions?: Transaction[];
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
  onPause?: (id: string) => void;
}

const frequencyLabels: Record<string, string> = {
  weekly: 'Semanal',
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  yearly: 'Anual',
};

const confidenceColors: Record<string, string> = {
  high: 'var(--success)',
  medium: 'var(--warning)',
  low: 'var(--text-muted)',
};

const confidenceLabels: Record<string, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

function monthlyEquivalent(sub: DetectedSubscription): number {
  switch (sub.frequency) {
    case 'weekly':    return sub.estimatedAmount * 4.33;
    case 'monthly':   return sub.estimatedAmount;
    case 'quarterly': return sub.estimatedAmount / 3;
    case 'yearly':    return sub.estimatedAmount / 12;
  }
}

export function SubscriptionCard({
  subscription,
  currency,
  transactions = [],
  onConfirm,
  onDismiss,
  onPause,
}: SubscriptionCardProps) {
  const [showTx, setShowTx] = useState(false);
  const monthly = monthlyEquivalent(subscription);

  const subTransactions = transactions
    .filter(t => subscription.transactionIds.includes(t.id))
    .sort((a, b) => parseDateOnly(b.date).getTime() - parseDateOnly(a.date).getTime());

  const nextDate = new Date(subscription.nextExpectedDate);
  const daysUntilNext = Math.ceil((nextDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: '12px',
      padding: '1rem 1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '10px',
            background: 'var(--bg-elevated)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CreditCard size={20} style={{ color: 'var(--accent-blue)' }} />
          </div>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
              {subscription.normalizedName}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {frequencyLabels[subscription.frequency]} · {subscription.chargeCount} cobros detectados
            </div>
          </div>
        </div>

        {/* Confidence badge */}
        <span style={{
          fontSize: '0.7rem', fontWeight: 600,
          padding: '0.2rem 0.5rem', borderRadius: '999px',
          background: `${confidenceColors[subscription.confidence]}18`,
          color: confidenceColors[subscription.confidence],
        }}>
          {confidenceLabels[subscription.confidence]} · {subscription.confidenceScore}%
        </span>
      </div>

      {/* Stats grid */}
      <div className="sub-stats">
        <StatBox label="Mensual" value={formatCurrency(monthly, currency)} />
        <StatBox label="Últimos 12m" value={formatCurrency(subscription.totalLast12Months, currency)} />
        <StatBox
          label="Próximo cobro"
          value={nextDate.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}
          sub={daysUntilNext <= 0 ? 'Vencido' : daysUntilNext === 0 ? 'Hoy' : daysUntilNext === 1 ? 'Mañana' : `En ${daysUntilNext}d`}
          icon={<Calendar size={12} />}
          warn={daysUntilNext <= 0}
        />
      </div>

      {/* Alerts */}
      {subscription.alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {subscription.alerts.map((alert, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.4rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem',
              background: alert.severity === 'danger' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
              color: alert.severity === 'danger' ? 'var(--danger)' : 'var(--warning)',
            }}>
              {alert.type === 'price_increase' ? <TrendingUp size={12} /> : <AlertTriangle size={12} />}
              {alert.message}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {!subscription.isConfirmed && !subscription.isDismissed && (
          <ActionBtn
            icon={<Plus size={12} />}
            label="Crear recurrente"
            color="var(--success)"
            bg="rgba(34,211,166,0.1)"
            onClick={() => onConfirm(subscription.id)}
          />
        )}
        {!subscription.isDismissed && (
          <>
            <ActionBtn
              icon={<X size={12} />}
              label="No es suscripción"
              color="var(--text-muted)"
              bg="transparent"
              border="var(--border-color)"
              onClick={() => onDismiss(subscription.id)}
            />
            {onPause && (
              <ActionBtn
                icon={<EyeOff size={12} />}
                label="Pausar / ocultar"
                color="var(--text-muted)"
                bg="transparent"
                border="var(--border-color)"
                onClick={() => onPause(subscription.id)}
              />
            )}
          </>
        )}
        {subTransactions.length > 0 && (
          <ActionBtn
            icon={<List size={12} />}
            label={showTx ? 'Ocultar transacciones' : 'Ver transacciones'}
            color="var(--accent-blue)"
            bg="rgba(59,130,246,0.08)"
            onClick={() => setShowTx(v => !v)}
          />
        )}
      </div>

      {/* Status row */}
      {subscription.isConfirmed && (
        <div style={{
          fontSize: '0.75rem', color: 'var(--success)', textAlign: 'center',
          padding: '0.4rem', background: 'rgba(34,211,166,0.08)', borderRadius: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
        }}>
          <Check size={12} /> Confirmada · recurrente creado
        </div>
      )}

      {/* Transaction list */}
      {showTx && (
        <div style={{
          borderTop: '1px solid var(--border-color)',
          paddingTop: '0.5rem',
          display: 'flex', flexDirection: 'column', gap: '0.25rem',
        }}>
          {subTransactions.slice(0, 12).map(tx => (
            <div key={tx.id} style={{
              display: 'flex', gap: '0.75rem', alignItems: 'center',
              padding: '0.3rem 0', fontSize: '0.75rem',
              borderBottom: '1px solid var(--border-color)',
            }}>
              <span style={{ color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>
                {parseDateOnly(tx.date).toLocaleDateString('es-PE')}
              </span>
              <span style={{ flex: 1, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tx.description}
              </span>
              <span style={{ fontWeight: 600, color: 'var(--danger)', flexShrink: 0 }}>
                {formatCurrency(tx.amount, currency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, sub, icon, warn }: {
  label: string; value: string; sub?: string; icon?: React.ReactNode; warn?: boolean;
}) {
  return (
    <div className="sub-stat">
      <div className="cl-kicker sub-stat-label">{label}</div>
      <div className={`cl-num sub-stat-value ${warn ? 'warn' : ''}`}>
        {icon}{value}
      </div>
      {sub && <div className={`sub-stat-sub ${warn ? 'warn' : ''}`}>{sub}</div>}
    </div>
  );
}

function ActionBtn({ icon, label, color, bg, border, onClick }: {
  icon: React.ReactNode; label: string; color: string; bg: string; border?: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="sub-action">
      {icon} {label}
    </button>
  );
}
