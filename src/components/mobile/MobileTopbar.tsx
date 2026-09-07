import { MonthSelector } from '../MonthSelector';

interface MobileTopbarProps {
  title: string;
  showMonthSelector?: boolean;
  selectedMonth?: Date;
  onMonthChange?: (month: Date) => void;
  isCurrentMonth?: boolean;
  onResetToCurrentMonth?: () => void;
  rightActions?: React.ReactNode;
}

export function MobileTopbar({
  title,
  showMonthSelector,
  selectedMonth,
  onMonthChange,
  isCurrentMonth,
  onResetToCurrentMonth,
  rightActions
}: MobileTopbarProps) {
  return (
    <div className="mobile-topbar-wrapper">
      <header className="mobile-topbar">
        <div className="mobile-topbar-left">
          <span className="mobile-topbar-logo">💰</span>
        </div>
        <h1 className="mobile-topbar-title">{title}</h1>
        <div className="mobile-topbar-right">
          {rightActions}
        </div>
      </header>

      {showMonthSelector && selectedMonth && onMonthChange && (
        <div className="mobile-month-bar">
          <MonthSelector
            selectedMonth={selectedMonth}
            onMonthChange={onMonthChange}
            isCurrentMonth={isCurrentMonth || false}
            onResetToCurrentMonth={onResetToCurrentMonth || (() => {})}
          />
        </div>
      )}
    </div>
  );
}
