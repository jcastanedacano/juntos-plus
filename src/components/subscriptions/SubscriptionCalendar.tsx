import { useMemo } from 'react';
import { addDays, format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { DetectedSubscription } from '../../types';
import { getUpcomingChargesIn30Days, UpcomingCharge } from '../../utils/subscriptionDetector';
import { localeActual } from '../../utils/fxTasas';

interface SubscriptionCalendarProps {
  subscriptions: DetectedSubscription[];
  currency: string;
  onSelectSubscription?: (sub: DetectedSubscription) => void;
}

const sym = (c: string) => c === 'PEN' ? 'S/' : c === 'USD' ? '$' : '€';

export function SubscriptionCalendar({ subscriptions, currency, onSelectSubscription }: SubscriptionCalendarProps) {
  const s = sym(currency);

  const charges = useMemo(
    () => getUpcomingChargesIn30Days(subscriptions),
    [subscriptions]
  );

  // Build 30-day grid
  const today = new Date();
  const days = Array.from({ length: 30 }, (_, i) => addDays(today, i));

  // Group charges by date string
  const byDate = useMemo(() => {
    const map = new Map<string, UpcomingCharge[]>();
    for (const charge of charges) {
      if (!map.has(charge.date)) map.set(charge.date, []);
      map.get(charge.date)!.push(charge);
    }
    return map;
  }, [charges]);

  const totalIn30 = charges.reduce((s, c) => s + c.amount, 0);
  const daysWithCharges = new Set(charges.map(c => c.date)).size;

  if (charges.length === 0) {
    return (
      <div className="sub-cal-empty">
        <span style={{ fontSize: '2rem' }}>📅</span>
        <p>No hay cobros esperados en los próximos 30 días</p>
      </div>
    );
  }

  return (
    <div className="sub-cal-wrap">
      {/* Summary strip */}
      <div className="sub-cal-summary">
        <div className="sub-cal-stat">
          <span className="sub-cal-stat-value">{charges.length}</span>
          <span className="sub-cal-stat-label">cobros esperados</span>
        </div>
        <div className="sub-cal-stat">
          <span className="sub-cal-stat-value">{s}{totalIn30.toLocaleString(localeActual(), { maximumFractionDigits: 0 })}</span>
          <span className="sub-cal-stat-label">total próximos 30d</span>
        </div>
        <div className="sub-cal-stat">
          <span className="sub-cal-stat-value">{daysWithCharges}</span>
          <span className="sub-cal-stat-label">días con cobros</span>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="sub-cal-grid">
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayCharges = byDate.get(dateStr) || [];
          const isToday = isSameDay(day, today);
          const dayTotal = dayCharges.reduce((sum, c) => sum + c.amount, 0);

          return (
            <div
              key={dateStr}
              className={`sub-cal-day ${isToday ? 'today' : ''} ${dayCharges.length > 0 ? 'has-charges' : ''}`}
            >
              {/* Day number */}
              <div className={`sub-cal-day-num ${isToday ? 'today' : ''}`}>
                <span className="sub-cal-weekday">
                  {format(day, 'EEE', { locale: es }).slice(0, 2)}
                </span>
                <span className="sub-cal-date-n">{format(day, 'd')}</span>
              </div>

              {/* Charges */}
              {dayCharges.length > 0 && (
                <div className="sub-cal-charges">
                  {dayCharges.slice(0, 2).map((charge, i) => (
                    <button
                      key={`${charge.subscription.id}-${i}`}
                      className="sub-cal-chip"
                      title={`${charge.subscription.normalizedName}: ${s}${charge.amount.toFixed(2)}`}
                      onClick={() => onSelectSubscription?.(charge.subscription)}
                    >
                      <span className="sub-cal-chip-name">{charge.subscription.normalizedName.slice(0, 12)}</span>
                    </button>
                  ))}
                  {dayCharges.length > 2 && (
                    <span className="sub-cal-chip-more">+{dayCharges.length - 2}</span>
                  )}
                  <div className="sub-cal-day-total">
                    -{s}{dayTotal.toLocaleString(localeActual(), { maximumFractionDigits: 0 })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Upcoming list (compact) */}
      <div className="sub-cal-list">
        <h4 className="sub-cal-list-title">Orden cronológico</h4>
        {charges.map((charge, i) => {
          const date = new Date(charge.date);
          const daysUntil = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          return (
            <button
              key={`${charge.subscription.id}-${charge.date}-${i}`}
              className="sub-cal-list-row"
              onClick={() => onSelectSubscription?.(charge.subscription)}
            >
              <div className="sub-cal-list-date">
                <span className="sub-cal-list-day">{format(date, 'd')}</span>
                <span className="sub-cal-list-month">{format(date, 'MMM', { locale: es })}</span>
              </div>
              <div className="sub-cal-list-info">
                <span className="sub-cal-list-name">{charge.subscription.normalizedName}</span>
                <span className="sub-cal-list-when">
                  {daysUntil === 0 ? 'Hoy' : daysUntil === 1 ? 'Mañana' : `En ${daysUntil}d`}
                </span>
              </div>
              <span className="sub-cal-list-amount">-{s}{charge.amount.toLocaleString(localeActual(), { minimumFractionDigits: 2 })}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
