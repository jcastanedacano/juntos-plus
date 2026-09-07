import { useEffect, useMemo, useRef, useState } from 'react';
import { CreditCard, DollarSign, AlertTriangle, TrendingUp, List, Calendar, GanttChartSquare, Copy } from 'lucide-react';
import { Transaction, DetectedSubscription, RecurringTransaction } from '../../types';
import { collectSubscriptions, getSubscriptionStats } from '../../utils/subscriptionDetector';
import { parseDateOnly } from '../../utils/stableDate';
import { differenceInCalendarDays } from 'date-fns';
import { analyzeSavings } from '../../utils/savingsAnalyzer';
import { formatCurrency } from '../../utils/calculations';
import { SubscriptionCard } from './SubscriptionCard';
import { SubscriptionCalendar } from './SubscriptionCalendar';
import { SubscriptionTimeline } from './SubscriptionTimeline';

interface SubscriptionsViewProps {
  transactions: Transaction[];
  recurring: RecurringTransaction[];
  currency: string;
  dismissedIds: string[];
  onDismissedChange: (ids: string[]) => void;
  onCreateRecurring: (sub: DetectedSubscription) => void;
}

type FilterType = 'all' | 'high' | 'medium' | 'low' | 'alerts';
type ViewMode = 'list' | 'calendar' | 'timeline';

/* El orden manda: es el indice que desplaza la pildora del segmented. */
const MODOS: ViewMode[] = ['list', 'calendar', 'timeline'];

export function SubscriptionsView({ transactions, recurring, currency, dismissedIds, onDismissedChange, onCreateRecurring }: SubscriptionsViewProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [focusedSub, setFocusedSub] = useState<string | null>(null);

  // `recurring` estaba declarado en las props y no se usaba: la vista solo
  // miraba el historial de transacciones, que exige 2 cargos del mismo
  // comercio para inferir nada. Los recurrentes declarados quedaban fuera.
  const [subscriptions, setSubscriptions] = useState<DetectedSubscription[]>(() =>
    collectSubscriptions(transactions, recurring, dismissedIds)
  );

  // Alta, baja o edicion de un recurrente tiene que reflejarse aca sin
  // obligar a salir y volver a entrar a la vista.
  const signature = useMemo(
    () => [
      ...recurring.map(r => `${r.id}:${r.amount}:${r.isActive}:${r.nextDate}`),
      `dismissed:${dismissedIds.join(',')}`,
    ].join('|'),
    [recurring, dismissedIds]
  );
  const lastSignature = useRef(signature);
  useEffect(() => {
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;
    setSubscriptions(collectSubscriptions(transactions, recurring, dismissedIds));
  }, [signature, transactions, recurring, dismissedIds]);

  const stats = useMemo(() => getSubscriptionStats(subscriptions), [subscriptions]);

  const duplicates = useMemo(
    () => analyzeSavings(subscriptions).filter(s => s.reason === 'duplicate'),
    [subscriptions]
  );

  const filtered = useMemo(() => {
    const active = subscriptions.filter(s => !s.isDismissed);
    switch (filter) {
      case 'high':   return active.filter(s => s.confidence === 'high');
      case 'medium': return active.filter(s => s.confidence === 'medium');
      case 'low':    return active.filter(s => s.confidence === 'low');
      case 'alerts': return active.filter(s => s.alerts.length > 0);
      default:       return active;
    }
  }, [subscriptions, filter]);

  const handleConfirm = (id: string) => {
    setSubscriptions(prev => prev.map(s => s.id === id ? { ...s, isConfirmed: true } : s));
    const sub = subscriptions.find(s => s.id === id);
    if (sub) onCreateRecurring(sub);
  };

  // Antes esto solo tocaba el estado local del componente: al salir y volver,
  // collectSubscriptions rearmaba la lista desde cero y lo descartado
  // reaparecia. Ahora sube al padre, que lo persiste en el servidor.
  const dismiss = (id: string) => {
    setSubscriptions(prev => prev.map(s => s.id === id ? { ...s, isDismissed: true } : s));
    if (!dismissedIds.includes(id)) onDismissedChange([...dismissedIds, id]);
  };

  const handleDismiss = dismiss;
  const handlePause = dismiss;

  const handleSelectFromCalendar = (sub: DetectedSubscription) => {
    setViewMode('list');
    setFocusedSub(sub.id);
    setTimeout(() => {
      document.getElementById(`sub-card-${sub.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const redetect = () => {
    setSubscriptions(collectSubscriptions(transactions, recurring, dismissedIds));
    setFocusedSub(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* KPIs */}
      <div className="subsview-kpis">
        {/* Los recuentos van a dos columnas y los importes a fila completa.
            Una cifra de moneda a dos columnas no cabe en 320px por mucho que
            se le baje el cuerpo, y bajarselo hasta que quepa la deja igual de
            grande que su propia etiqueta. */}
        <KpiBox icon={<CreditCard size={20} />} label="Detectadas" value={String(stats.count)} iconColor="var(--accent-blue)" />
        <KpiBox
          icon={<AlertTriangle size={20} />}
          label="Con alertas"
          value={String(stats.withAlerts)}
          iconColor={stats.withAlerts > 0 ? 'var(--danger)' : 'var(--success)'}
        />
        <KpiBox ancho icon={<DollarSign size={20} />} label="Total mensual" value={formatCurrency(stats.monthlyTotal, currency)} iconColor="var(--danger)" />
        <KpiBox ancho icon={<TrendingUp size={20} />} label="Costo anual est." value={formatCurrency(stats.annualTotal, currency)} iconColor="var(--warning)" />
      </div>

      {/* Duplicates warning */}
      {duplicates.length > 0 && (
        <div style={{
          background: 'rgba(245,158,11,0.06)',
          border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Copy size={16} style={{ color: 'var(--warning)' }} />
            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
              Servicios duplicados detectados
            </span>
          </div>
          {duplicates.map(dup => (
            <div key={dup.id} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '1.5rem' }}>
              • {dup.reasonLabel} — {formatCurrency(dup.monthlyCost, currency)}/mes
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="subs-toolbar">
        <div className="subs-filters">
        {([
          { id: 'all' as FilterType, label: 'Todas' },
          { id: 'high' as FilterType, label: '🟢 Alta' },
          { id: 'medium' as FilterType, label: '🟡 Media' },
          { id: 'low' as FilterType, label: '⚪ Baja' },
          { id: 'alerts' as FilterType, label: '⚠️ Alertas' },
        ] as const).map(f => (
          <button
            key={f.id}
            className="cl-chip"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
        </div>

        <div className="subs-toolbar-right">
        <div
          className="subs-viewtoggle cl-segmented"
          style={{
            '--cl-seg-total': MODOS.length,
            '--cl-seg-activo': MODOS.indexOf(viewMode),
          } as React.CSSProperties}
        >
          <ViewToggleBtn icon={<List size={14} />} label="Lista" active={viewMode === 'list'} onClick={() => setViewMode('list')} />
          <ViewToggleBtn icon={<Calendar size={14} />} label="Calendario" active={viewMode === 'calendar'} onClick={() => setViewMode('calendar')} />
          <ViewToggleBtn icon={<GanttChartSquare size={14} />} label="Linea de tiempo" active={viewMode === 'timeline'} onClick={() => setViewMode('timeline')} />
        </div>

        <button
          className="subs-redetect"
          onClick={redetect}
          style={{
            padding: '0.4rem 0.85rem', borderRadius: '8px',
            border: '1px solid var(--border-color)',
            background: 'transparent', color: 'var(--text-secondary)',
            cursor: 'pointer', fontSize: '0.8rem',
          }}
        >
          Reanalizar
        </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'timeline' ? (
        <SubscriptionTimeline subscriptions={filtered} currency={currency} />
      ) : viewMode === 'calendar' ? (
        <SubscriptionCalendar
          subscriptions={subscriptions}
          currency={currency}
          onSelectSubscription={handleSelectFromCalendar}
        />
      ) : (
        <div className="subs-layout">
          {/* Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filtered.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '3rem',
                color: 'var(--text-muted)', fontSize: '0.9rem',
                background: 'var(--bg-card)', borderRadius: '12px',
                border: '1px solid var(--border-color)',
              }}>
                {subscriptions.length === 0
                  ? 'No se detectaron suscripciones. Importa más transacciones para mejorar la detección.'
                  : 'No hay suscripciones con este filtro.'}
              </div>
            ) : (
              filtered.map(sub => (
                <div
                  key={sub.id}
                  id={`sub-card-${sub.id}`}
                  style={{
                    transition: 'box-shadow 0.3s',
                    boxShadow: focusedSub === sub.id ? '0 0 0 2px var(--accent-blue)' : undefined,
                    borderRadius: '12px',
                  }}
                >
                  <SubscriptionCard
                    subscription={sub}
                    currency={currency}
                    transactions={transactions}
                    onConfirm={handleConfirm}
                    onDismiss={handleDismiss}
                    onPause={handlePause}
                  />
                </div>
              ))
            )}
          </div>

          {/* Timeline sidebar — show all 30-day charges */}
          <UpcomingList subscriptions={subscriptions} currency={currency} />
        </div>
      )}
    </div>
  );
}

// ─── Upcoming list (replaces SubscriptionTimeline in this view) ───────────

import { getUpcomingChargesIn30Days } from '../../utils/subscriptionDetector';

function UpcomingList({ subscriptions, currency }: { subscriptions: DetectedSubscription[]; currency: string }) {
  const s = currency === 'PEN' ? 'S/' : currency === 'USD' ? '$' : '€';
  const charges = useMemo(() => getUpcomingChargesIn30Days(subscriptions), [subscriptions]);

  if (charges.length === 0) {
    return (
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-color)',
        borderRadius: '12px', padding: '1.5rem',
        textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem',
      }}>
        No hay cobros próximos
      </div>
    );
  }

  const total30 = charges.reduce((acc, c) => acc + c.amount, 0);

  return (
    <div className="subs-upcoming-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Próximos 30 días
        </h3>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--danger)' }}>
          -{s}{total30.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
        </span>
      </div>

      <div className="subs-upcoming-list">
        {charges.map((charge, i) => {
          // new Date("2026-09-07") es medianoche UTC y en Lima cae el 6, asi
          // que el cobro del 7 se mostraba como "5 set" y encima con la
          // etiqueta "Hoy".
          const date = parseDateOnly(charge.date);
          const daysUntil = differenceInCalendarDays(date, new Date());
          const isPast = daysUntil < 0;

          return (
            <div key={`${charge.subscription.id}-${charge.date}-${i}`} style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem',
              padding: '0.5rem 0.6rem', borderRadius: '8px',
              background: isPast ? 'rgba(239,68,68,0.05)' : 'var(--bg-elevated)',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '8px', flexShrink: 0,
                background: isPast ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: isPast ? 'var(--danger)' : 'var(--accent-blue)', lineHeight: 1 }}>
                  {date.getDate()}
                </span>
                <span style={{ fontSize: 'var(--fs-micro)', textTransform: 'uppercase', color: isPast ? 'var(--danger)' : 'var(--text-muted)' }}>
                  {date.toLocaleDateString('es-PE', { month: 'short' })}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {charge.subscription.normalizedName}
                </div>
                <div style={{ fontSize: 'var(--fs-micro)', color: isPast ? 'var(--danger)' : 'var(--text-muted)' }}>
                  {isPast ? `Esperado hace ${Math.abs(daysUntil)}d` : daysUntil === 0 ? 'Hoy' : daysUntil === 1 ? 'Mañana' : `En ${daysUntil}d`}
                </div>
              </div>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--danger)', whiteSpace: 'nowrap' }}>
                -{s}{charge.amount.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KpiBox({ icon, label, value, iconColor, ancho }: {
  icon: React.ReactNode; label: string; value: string; iconColor: string;
  /** Ocupa la fila entera: para importes, que no caben a dos columnas. */
  ancho?: boolean;
}) {
  return (
    <div className={`subsview-kpi ${ancho ? 'subsview-kpi-ancho' : ''}`}>
      <div className="subsview-kpi-icon" style={{ background: `${iconColor}15`, color: iconColor }}>
        {icon}
      </div>
      <div className="subsview-kpi-text">
        <div className="subsview-kpi-label cl-kicker">{label}</div>
        <div className="subsview-kpi-value cl-amount is-m">{value}</div>
      </div>
    </div>
  );
}

function ViewToggleBtn({ icon, label, active, onClick }: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} aria-selected={active} className="subs-viewtoggle-btn">
      {icon} {label}
    </button>
  );
}
