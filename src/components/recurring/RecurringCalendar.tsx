import { useState, useMemo } from 'react';
import { RecurringTransaction } from '../../types';
import { getChargesInMonth, getMonthlyTotals } from '../../utils/recurringCalculations';
import { formatCurrency } from '../../utils/calculations';
import {
  format,
  startOfMonth,
  endOfMonth,
  getDay,
  addMonths,
  subMonths,
  isSameDay,
  parseISO,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface RecurringCalendarProps {
  recurring: RecurringTransaction[];
  currency: string;
  /** ISO yyyy-MM-dd of the day filtered in the parent list, null = no filter */
  selectedDay?: string | null;
  /** Callback when the user clicks a day cell. Parent decides what to do. */
  onSelectDay?: (dateStr: string | null) => void;
}

interface DayCell {
  dateStr: string;
  day: number;
  income: number;
  expense: number;
  count: number;
  isToday: boolean;
}

const WEEK_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export const RecurringCalendar = ({
  recurring,
  currency,
  selectedDay = null,
  onSelectDay,
}: RecurringCalendarProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [calMonth, setCalMonth] = useState<Date>(startOfMonth(new Date()));
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  const active = recurring.filter(r => r.isActive);

  // Per-day buckets for the visible month
  const cells: DayCell[] = useMemo(() => {
    const start = startOfMonth(calMonth);
    const end = endOfMonth(calMonth);
    const today = new Date();
    const buckets = new Map<string, { income: number; expense: number; count: number }>();

    for (const r of active) {
      const charges = getChargesInMonth(r, calMonth);
      for (const date of charges) {
        const key = format(date, 'yyyy-MM-dd');
        const cur = buckets.get(key) || { income: 0, expense: 0, count: 0 };
        if (r.type === 'income') cur.income += r.amount;
        else cur.expense += r.amount;
        cur.count += 1;
        buckets.set(key, cur);
      }
    }

    const out: DayCell[] = [];
    const daysInMonth = end.getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), i);
      const key = format(d, 'yyyy-MM-dd');
      const b = buckets.get(key) || { income: 0, expense: 0, count: 0 };
      out.push({
        dateStr: key,
        day: i,
        income: b.income,
        expense: b.expense,
        count: b.count,
        isToday: isSameDay(d, today),
      });
    }
    return out;
  }, [active, calMonth]);

  const maxExpense = useMemo(
    () => Math.max(...cells.map(c => c.expense), 1),
    [cells]
  );
  const maxIncome = useMemo(
    () => Math.max(...cells.map(c => c.income), 1),
    [cells]
  );

  const totalIncomeMonth = cells.reduce((s, c) => s + c.income, 0);
  const totalExpenseMonth = cells.reduce((s, c) => s + c.expense, 0);

  // Pad leading blanks (Mon = col 0)
  const firstDow = (getDay(startOfMonth(calMonth)) + 6) % 7;

  // 12-month projection (kept from original)
  const projection = useMemo(() => getMonthlyTotals(recurring, 12, new Date()), [recurring]);
  const maxProjection = useMemo(
    () => Math.max(1, ...projection.map(p => Math.max(p.income, p.expense))),
    [projection]
  );

  const monthLabel = format(calMonth, 'MMMM yyyy', { locale: es });

  const handleClick = (cell: DayCell) => {
    if (!onSelectDay) return;
    onSelectDay(selectedDay === cell.dateStr ? null : cell.dateStr);
  };

  return (
    <div className="rec-calendar">
      <div className="rec-calendar-header" onClick={() => setCollapsed(!collapsed)}>
        <h3 className="rec-calendar-title">Calendario de cobros</h3>
        {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </div>

      {!collapsed && (
        <div className="rec-calendar-body">
          {/* Rich monthly grid (mirrors Transacciones calendar) */}
          <div className="txn-cal" style={{ margin: 0, marginBottom: 16 }}>
            <div className="txn-cal-head">
              <div className="txn-cal-head-left">
                <button
                  type="button"
                  className="txn-cal-nav"
                  onClick={(e) => { e.stopPropagation(); setCalMonth(subMonths(calMonth, 1)); }}
                  aria-label="Mes anterior"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="txn-cal-month">{monthLabel}</span>
                <button
                  type="button"
                  className="txn-cal-nav"
                  onClick={(e) => { e.stopPropagation(); setCalMonth(addMonths(calMonth, 1)); }}
                  aria-label="Mes siguiente"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="txn-cal-head-right">
                <span className="txn-cal-mtotal">
                  <span className="dot income" /> +{formatCurrency(totalIncomeMonth, currency)}
                  <span className="dot expense" style={{ marginLeft: 12 }} /> −{formatCurrency(totalExpenseMonth, currency)}
                </span>
                {selectedDay && onSelectDay && (
                  <button
                    type="button"
                    className="txn-cal-clear"
                    onClick={() => onSelectDay(null)}
                    title="Quitar filtro de día"
                  >
                    <X size={12} /> {format(parseISO(selectedDay), "d 'de' MMM", { locale: es })}
                  </button>
                )}
              </div>
            </div>

            <div className="txn-cal-grid">
              {WEEK_LABELS.map((d) => (
                <div key={d} className="txn-cal-weeklabel">{d}</div>
              ))}
              {Array.from({ length: firstDow }).map((_, i) => (
                <div key={`pad-${i}`} className="txn-cal-pad" aria-hidden="true" />
              ))}
              {cells.map(c => {
                const isSelected = selectedDay === c.dateStr;
                const expIntensity = c.expense / maxExpense;
                const incIntensity = c.income / maxIncome;
                const cellStyle: React.CSSProperties = c.count === 0
                  ? {}
                  : c.income > c.expense
                    ? { background: `rgba(0, 209, 178, ${0.10 + 0.55 * incIntensity})` }
                    : { background: `rgba(245, 158, 11, ${0.10 + 0.55 * expIntensity})` };
                return (
                  <button
                    key={c.dateStr}
                    type="button"
                    className={`txn-cal-cell ${isSelected ? 'selected' : ''} ${c.isToday ? 'today' : ''} ${c.count === 0 ? 'empty' : ''}`}
                    onClick={() => handleClick(c)}
                    style={cellStyle}
                    title={c.count > 0
                      ? `${c.count} cobro${c.count === 1 ? '' : 's'} · +${formatCurrency(c.income, currency)} · −${formatCurrency(c.expense, currency)}`
                      : 'Sin cobros'}
                  >
                    <span className="txn-cal-day">{c.day}</span>
                    {c.count > 0 && (
                      <>
                        {c.expense > 0 && (
                          <span className="txn-cal-amt expense">
                            −{formatCurrency(c.expense, currency).replace(/\.\d{2}$/, '')}
                          </span>
                        )}
                        {c.income > 0 && c.expense === 0 && (
                          <span className="txn-cal-amt income">
                            +{formatCurrency(c.income, currency).replace(/\.\d{2}$/, '')}
                          </span>
                        )}
                        <span className="txn-cal-count">{c.count}</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 12-month projection (preserved from original) */}
          <div className="rec-calendar-projection">
            <h4 className="rec-calendar-projection-title">Proyección 12 meses</h4>
            <div className="rec-calendar-bars">
              {projection.map((p, i) => {
                const balance = p.income - p.expense;
                return (
                  <div
                    key={i}
                    className="rec-calendar-bar-col"
                    onMouseEnter={() => setHoveredBar(i)}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    <div className="rec-calendar-bar-wrap">
                      <div
                        className="rec-calendar-bar rec-calendar-bar--income"
                        style={{ height: `${(p.income / maxProjection) * 100}%` }}
                      />
                      <div
                        className="rec-calendar-bar rec-calendar-bar--expense"
                        style={{ height: `${(p.expense / maxProjection) * 100}%` }}
                      />
                    </div>
                    <span className="rec-calendar-bar-label">{p.month.substring(0, 3)}</span>
                    {hoveredBar === i && (
                      <div className="rec-bar-tooltip">
                        <div className="rec-bar-tooltip-row">
                          <span className="rec-bar-tooltip-dot rec-bar-tooltip-dot--income" />{' '}
                          {formatCurrency(p.income, currency)}
                        </div>
                        <div className="rec-bar-tooltip-row">
                          <span className="rec-bar-tooltip-dot rec-bar-tooltip-dot--expense" />{' '}
                          {formatCurrency(p.expense, currency)}
                        </div>
                        <div
                          className="rec-bar-tooltip-balance"
                          style={{ color: balance >= 0 ? 'var(--success)' : 'var(--danger)' }}
                        >
                          {balance >= 0 ? '+' : ''}
                          {formatCurrency(balance, currency)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
