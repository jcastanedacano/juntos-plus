import { Plus, Download, Menu, LogOut } from 'lucide-react';
import { useMsal } from '@azure/msal-react';
import { clearLoginHint } from '../auth/msalConfig';
import { MonthSelector } from './MonthSelector';

export type PeriodFilter = 'month' | '3months' | 'year' | 'custom';

interface HeaderProps {
  title: string;
  periodFilter: PeriodFilter;
  onPeriodChange: (period: PeriodFilter) => void;
  onNewTransaction: () => void;
  onExport?: () => void;
  showPeriodFilter?: boolean;
  showMonthSelector?: boolean;
  selectedMonth?: Date;
  onMonthChange?: (month: Date) => void;
  isCurrentMonth?: boolean;
  onResetToCurrentMonth?: () => void;
  onMobileMenuOpen?: () => void;
}

const periodLabels: Record<PeriodFilter, string> = {
  month: 'Mes',
  '3months': '3M',
  year: 'Año',
  custom: 'Otro'
};

export function Header({
  title,
  periodFilter,
  onPeriodChange,
  onNewTransaction,
  onExport,
  showPeriodFilter = true,
  showMonthSelector = false,
  selectedMonth,
  onMonthChange,
  isCurrentMonth,
  onResetToCurrentMonth,
  onMobileMenuOpen
}: HeaderProps) {
  const { instance, accounts } = useMsal();
  const account = accounts[0];

  const initials = account?.name
    ? account.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const handleLogout = () => {
    clearLoginHint();
    instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin });
  };

  return (
    <header className="app-header">
      <div className="header-left">
        {onMobileMenuOpen && (
          <button className="mobile-menu-btn header-mobile-menu" onClick={onMobileMenuOpen} aria-label="Abrir menú">
            <Menu size={20} />
          </button>
        )}

        <h1 className="header-title">{title}</h1>

        {showMonthSelector && selectedMonth && onMonthChange && (
          <MonthSelector
            selectedMonth={selectedMonth}
            onMonthChange={onMonthChange}
            isCurrentMonth={isCurrentMonth || false}
            onResetToCurrentMonth={onResetToCurrentMonth || (() => {})}
          />
        )}

        {showPeriodFilter && (
          <div className="header-period-filter">
            {(Object.keys(periodLabels) as PeriodFilter[]).map((period) => (
              <button
                key={period}
                className={`period-btn ${periodFilter === period ? 'active' : ''}`}
                onClick={() => onPeriodChange(period)}
              >
                {periodLabels[period]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="header-right">
        {account && (
          <div className="header-user-info">
            <div className="header-avatar">{initials}</div>
            <span className="header-user-name">{account.name}</span>
            <button className="header-logout-btn" onClick={handleLogout} title="Cerrar sesión">
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
