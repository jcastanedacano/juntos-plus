import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format, addMonths, subMonths, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';

interface MonthSelectorProps {
  selectedMonth: Date;
  onMonthChange: (month: Date) => void;
  isCurrentMonth: boolean;
  onResetToCurrentMonth: () => void;
}

export const MonthSelector = ({
  selectedMonth,
  onMonthChange,
  isCurrentMonth,
  onResetToCurrentMonth,
}: MonthSelectorProps) => {
  const handlePreviousMonth = () => {
    onMonthChange(subMonths(selectedMonth, 1));
  };

  const handleNextMonth = () => {
    onMonthChange(addMonths(selectedMonth, 1));
  };

  const formattedMonth = format(selectedMonth, 'MMMM yyyy', { locale: es });
  const capitalizedMonth = formattedMonth.charAt(0).toUpperCase() + formattedMonth.slice(1);

  const now = new Date();
  const canGoNext = !isSameMonth(selectedMonth, now);

  return (
    <div className="month-selector-container">
      <div className="month-selector">
        <button
          className="month-nav-btn"
          onClick={handlePreviousMonth}
          title="Mes anterior"
          aria-label="Mes anterior"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="month-display">
          <Calendar size={16} />
          <span>{capitalizedMonth}</span>
        </div>

        <button
          className="month-nav-btn"
          onClick={handleNextMonth}
          disabled={!canGoNext}
          title="Mes siguiente"
          aria-label="Mes siguiente"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {!isCurrentMonth && (
        <button className="current-month-chip" onClick={onResetToCurrentMonth}>
          Viendo: {capitalizedMonth} · <span className="chip-action">Volver a mes actual</span>
        </button>
      )}
    </div>
  );
};
