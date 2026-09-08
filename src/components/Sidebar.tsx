import {
  LayoutDashboard,
  ArrowLeftRight,
  Target,
  Wallet,
  RefreshCw,
  CreditCard,
  Download,
  Settings,
  Sparkles,
  Landmark,
  Bell,
  Repeat,
  PiggyBank,
  Users,
  ChevronLeft,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';

export type ViewType = 'dashboard' | 'transactions' | 'goals' | 'budgets' | 'recurring' | 'subscriptions' | 'savings' | 'networth' | 'recap' | 'credit' | 'settings';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  onOpenImport?: () => void;
  onOpenSettings?: () => void;
  onOpenNotifications?: () => void;
  onOpenOwnerLabels?: () => void;
  onImportBcpPdf?: () => void;
}

const navItems: { id: ViewType; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transacciones', icon: ArrowLeftRight },
  { id: 'recurring', label: 'Recurrentes', icon: RefreshCw },
  { id: 'subscriptions', label: 'Suscripciones', icon: Repeat },
  { id: 'savings', label: 'Ahorro', icon: PiggyBank },
  { id: 'credit', label: 'Crédito', icon: CreditCard },
  { id: 'budgets', label: 'Presupuestos', icon: Wallet },
  { id: 'goals', label: 'Metas', icon: Target },
  { id: 'networth', label: 'Patrimonio', icon: Landmark },
  { id: 'recap', label: 'Recap anual', icon: Sparkles },
];

export function Sidebar({
  currentView,
  onViewChange,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onMobileClose,
  onOpenImport,
  onOpenSettings,
  onOpenNotifications,
  onOpenOwnerLabels,
  onImportBcpPdf,
}: SidebarProps) {
  const handleNavClick = (view: ViewType) => {
    onViewChange(view);
    if (onMobileClose) {
      onMobileClose();
    }
  };

  const handleAction = (action?: () => void) => {
    if (action) action();
    if (onMobileClose) onMobileClose();
  };

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={`sidebar-overlay ${isMobileOpen ? 'visible' : ''}`}
        onClick={onMobileClose}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : 'expanded'} ${isMobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span className="sidebar-brand-mark" aria-hidden="true">J</span>
            <span className="sidebar-logo-text">
              Juntos<span className="sidebar-logo-plus">+1</span>
            </span>
          </div>

          <button
            className="sidebar-toggle desktop-only"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
            aria-label={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>

          {isMobileOpen && (
            <button
              className="sidebar-toggle mobile-only"
              onClick={onMobileClose}
              aria-label="Cerrar menú"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleNavClick(item.id)}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className="sidebar-nav-icon" size={18} />
                <span className="sidebar-nav-text">{item.label}</span>
                {isActive && <span className="sidebar-nav-dot" aria-hidden="true" />}
              </button>
            );
          })}

          {(onOpenImport || onOpenSettings || onOpenOwnerLabels || onOpenNotifications) && (
            <>
              <div className="sidebar-section-label">Datos</div>
              {onImportBcpPdf && (
                <button
                  className="sidebar-nav-item"
                  onClick={() => handleAction(onImportBcpPdf)}
                  title={isCollapsed ? 'Importar' : undefined}
                >
                  <Download className="sidebar-nav-icon" size={18} />
                  <span className="sidebar-nav-text">Importar</span>
                </button>
              )}
              {onOpenOwnerLabels && (
                <button
                  className="sidebar-nav-item"
                  onClick={() => handleAction(onOpenOwnerLabels)}
                  title={isCollapsed ? 'Pareja' : undefined}
                >
                  <Users className="sidebar-nav-icon" size={18} />
                  <span className="sidebar-nav-text">Pareja</span>
                </button>
              )}
              {onOpenNotifications && (
                <button
                  className="sidebar-nav-item"
                  onClick={() => handleAction(onOpenNotifications)}
                  title={isCollapsed ? 'Notificaciones' : undefined}
                >
                  <Bell size={18} />
                  {!isCollapsed && <span>Notificaciones</span>}
                </button>
              )}
              {onOpenSettings && (
                <button
                  className="sidebar-nav-item"
                  onClick={() => handleAction(onOpenSettings)}
                  title={isCollapsed ? 'Ajustes' : undefined}
                >
                  <Settings className="sidebar-nav-icon" size={18} />
                  <span className="sidebar-nav-text">Ajustes</span>
                </button>
              )}
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          {!isCollapsed && (
            <div className="sidebar-version">
              Juntos<span className="sidebar-version-plus">+1</span>
              <span className="sidebar-version-sep">·</span>
              v3.1
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

// Mobile menu button component
export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="mobile-menu-btn" onClick={onClick}>
      <Menu size={20} />
    </button>
  );
}
