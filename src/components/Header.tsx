import { Plus, Download, Menu, LogOut } from 'lucide-react';
import { useMsal } from '@azure/msal-react';
import { cerrarSesion } from '../auth/salir';
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
  /** Correo de la sesion del servidor, cuando se entro por Google. */
  correoSesion?: string | null;
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
  onMobileMenuOpen,
  correoSesion
}: HeaderProps) {
  const { instance, accounts } = useMsal();
  const account = accounts[0];

  const handleLogout = () => { cerrarSesion(instance); };

  // Quien entra con Google no tiene cuenta en MSAL. Antes el bloque entero
  // dependia de `account`, asi que a esos usuarios no se les dibujaba ni el
  // boton de salir: estaban dentro sin forma de irse.
  const nombre = account?.name || correoSesion || '';
  const iniciales = account?.name
    ? account.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : (correoSesion ? correoSesion.slice(0, 2).toUpperCase() : '?');

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
        {(account || correoSesion) && (
          <div className="header-user-info">
            <div className="header-avatar">{iniciales}</div>
            <span className="header-user-name">{nombre}</span>
            <button className="header-logout-btn" onClick={handleLogout} title="Cerrar sesión">
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
