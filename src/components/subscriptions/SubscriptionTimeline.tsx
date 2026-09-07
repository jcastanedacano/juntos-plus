import { DetectedSubscription } from '../../types';
import { formatCurrency } from '../../utils/calculations';

interface SubscriptionTimelineProps {
  subscriptions: DetectedSubscription[];
  currency: string;
}

export function SubscriptionTimeline({ subscriptions, currency }: SubscriptionTimelineProps) {
  // Get upcoming charges sorted by date
  const upcoming = [...subscriptions]
    .filter(s => !s.isDismissed)
    .sort((a, b) => new Date(a.nextExpectedDate).getTime() - new Date(b.nextExpectedDate).getTime())
    .slice(0, 10);

  if (upcoming.length === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: '2rem',
        color: 'var(--text-muted)', fontSize: '0.85rem',
      }}>
        No hay cobros próximos detectados
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: '12px',
      padding: '1.25rem',
    }}>
      <h3 style={{
        margin: '0 0 1rem', fontSize: '0.95rem',
        color: 'var(--text-primary)', fontWeight: 600,
      }}>
        Próximos cobros esperados
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {upcoming.map(sub => {
          const date = new Date(sub.nextExpectedDate);
          const daysUntil = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          const isPast = daysUntil < 0;

          return (
            <div key={sub.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.6rem 0.75rem',
              borderRadius: '8px',
              background: isPast ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-elevated)',
            }}>
              {/* Date circle */}
              <div style={{
                width: 44, height: 44, borderRadius: '10px',
                background: isPast ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{
                  fontSize: '0.95rem', fontWeight: 700,
                  color: isPast ? 'var(--danger)' : 'var(--accent-blue)',
                  lineHeight: 1,
                }}>
                  {date.getDate()}
                </span>
                <span style={{
                  fontSize: 'var(--fs-micro)', textTransform: 'uppercase',
                  color: isPast ? 'var(--danger)' : 'var(--text-muted)',
                }}>
                  {date.toLocaleDateString('es-PE', { month: 'short' })}
                </span>
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '0.85rem', fontWeight: 500,
                  color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {sub.normalizedName}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {isPast
                    ? `Esperado hace ${Math.abs(daysUntil)} días`
                    : daysUntil === 0 ? 'Hoy'
                    : daysUntil === 1 ? 'Mañana'
                    : `En ${daysUntil} días`}
                </div>
              </div>

              {/* Amount */}
              <div style={{
                fontSize: '0.9rem', fontWeight: 600,
                color: 'var(--danger)',
                whiteSpace: 'nowrap',
              }}>
                -{formatCurrency(sub.estimatedAmount, currency)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
