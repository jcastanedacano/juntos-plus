import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Transaction } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import {
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  format,
  getDay,
  isSameDay,
  parseISO,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { parseDateOnly } from '../../utils/stableDate';

interface TransactionsCalendarProps {
  transactions: Transaction[];
  currency: string;
  /** ISO yyyy-MM-dd; null = no day selected */
  selectedDay: string | null;
  onSelectDay: (dateStr: string | null) => void;
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

export function TransactionsCalendar({
  transactions,
  currency,
  selectedDay,
  onSelectDay,
}: TransactionsCalendarProps) {
  // Initialize calendar to the month of the first transaction (most recent),
  // or today if there's no data — so a 2025-only dataset shows up immediately.
  const initialMonth = useMemo(() => {
    if (transactions.length === 0) return new Date();
    const sorted = [...transactions].sort(
      (a, b) => parseDateOnly(b.date).getTime() - parseDateOnly(a.date).getTime()
    );
    const d = parseDateOnly(sorted[0].date);
    return isNaN(d.getTime()) ? new Date() : startOfMonth(d);
  }, [transactions]);

  const [viewMonth, setViewMonth] = useState<Date>(initialMonth);
  // useState only reads its initializer on mount, so a calendar mounted while
  // the fetch was still in flight would stay stuck on today's month once the
  // data landed. Follow initialMonth until the user picks a month themselves.
  const userPickedMonth = useRef(false);
  useEffect(() => {
    if (!userPickedMonth.current) setViewMonth(initialMonth);
  }, [initialMonth]);

  const goToMonth = (next: Date) => {
    userPickedMonth.current = true;
    setViewMonth(next);
  };

  const cells: DayCell[] = useMemo(() => {
    const start = startOfMonth(viewMonth);
    const end = endOfMonth(viewMonth);
    const daysInMonth = end.getDate();
    const today = new Date();

    // Aggregate transactions by yyyy-MM-dd for this month
    const buckets = new Map<string, { income: number; expense: number; count: number }>();
    for (const tx of transactions) {
      const d = parseDateOnly(tx.date);
      if (isNaN(d.getTime())) continue;
      if (d < start || d > end) continue;
      const key = format(d, 'yyyy-MM-dd');
      const cur = buckets.get(key) || { income: 0, expense: 0, count: 0 };
      if (tx.type === 'income') cur.income += tx.amount;
      else cur.expense += tx.amount;
      cur.count += 1;
      buckets.set(key, cur);
    }

    const out: DayCell[] = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i);
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
  }, [viewMonth, transactions]);

  // Maximum expense across the visible month — used to scale cell intensity.
  const maxExpense = useMemo(
    () => Math.max(...cells.map(c => c.expense), 1),
    [cells]
  );

  // Pad leading blanks so day-1 lands under its real weekday column
  // (Monday = column 0).
  const firstDay = startOfMonth(viewMonth);
  const firstDow = (getDay(firstDay) + 6) % 7; // 0=Mon..6=Sun

  const monthLabel = format(viewMonth, "MMMM yyyy", { locale: es });
  const totalExpenseMonth = cells.reduce((s, c) => s + c.expense, 0);
  const totalIncomeMonth = cells.reduce((s, c) => s + c.income, 0);

  const handleClick = (cell: DayCell) => {
    if (selectedDay === cell.dateStr) {
      onSelectDay(null);
    } else {
      onSelectDay(cell.dateStr);
    }
  };

  return (
    <div className="txn-cal">
      <div className="txn-cal-head">
        <div className="txn-cal-head-left">
          <button
            type="button"
            className="txn-cal-nav"
            onClick={() => goToMonth(subMonths(viewMonth, 1))}
            aria-label="Mes anterior"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="txn-cal-month">{monthLabel}</span>
          <button
            type="button"
            className="txn-cal-nav"
            onClick={() => goToMonth(addMonths(viewMonth, 1))}
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
          {selectedDay && (
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

      <p className="txn-cal-hint">
        El color del día indica si el neto fue ingreso o gasto; el número en la esquina es la cantidad de transacciones ese día.
      </p>

      <div className="txn-cal-grid">
        {WEEK_LABELS.map((d) => (
          <div key={d} className="txn-cal-weeklabel">{d}</div>
        ))}
        {Array.from({ length: firstDow }).map((_, i) => (
          <div key={`pad-${i}`} className="txn-cal-pad" aria-hidden="true" />
        ))}
        {cells.map(c => {
          const intensity = c.expense / maxExpense; // 0..1
          const hasIncome = c.income > 0;
          const isSelected = selectedDay === c.dateStr;
          // Color bias: net positive → green, net negative → red, scaled
          const net = c.income - c.expense;
          // El alpha del tinte escalaba hasta 0.65, y como crece con el
          // gasto, los días de más movimiento quedaban con el peor
          // contraste: texto sobre ámbar a 0.65 medía 1.50:1 (WCAG AA
          // pide 4.5:1). Capado a 0.30, el peor caso sube a 7.5:1 y el
          // heatmap sigue leyéndose. No subir este techo sin volver a
          // medir el contraste del texto encima.
          const tintAlpha = (ratio: number) => 0.08 + 0.22 * Math.min(Math.max(ratio, 0), 1);
          const cellStyle: React.CSSProperties = c.count === 0
            ? {}
            : net >= 0
              ? { background: `rgba(0, 209, 178, ${tintAlpha(c.income / Math.max(maxExpense, 1))})` }
              : { background: `rgba(245, 158, 11, ${tintAlpha(intensity)})` };
          return (
            <button
              key={c.dateStr}
              type="button"
              className={`txn-cal-cell ${isSelected ? 'selected' : ''} ${c.isToday ? 'today' : ''} ${c.count === 0 ? 'empty' : ''}`}
              onClick={() => handleClick(c)}
              style={cellStyle}
              title={c.count > 0
                ? `${c.count} transaccion${c.count === 1 ? '' : 'es'} · +${formatCurrency(c.income, currency)} · −${formatCurrency(c.expense, currency)}`
                : 'Sin transacciones'}
            >
              <span className="txn-cal-day">{c.day}</span>
              {c.count > 0 && (
                <>
                  {c.expense > 0 && (
                    <span className="txn-cal-amt expense">
                      −{formatCurrency(c.expense, currency).replace(/\.\d{2}$/, '')}
                    </span>
                  )}
                  {hasIncome && c.expense === 0 && (
                    <span className="txn-cal-amt income">
                      +{formatCurrency(c.income, currency).replace(/\.\d{2}$/, '')}
                    </span>
                  )}
                  <span className="txn-cal-count" aria-label={`${c.count} transacciones`}>{c.count}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
