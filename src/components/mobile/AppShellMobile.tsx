import type { ViewType } from '../Sidebar';
import { BottomTabs } from './BottomTabs';
import { MobileFab } from './MobileFab';

interface AppShellMobileProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  children: React.ReactNode;

  // Topbar props
  title: string;
  showMonthSelector?: boolean;
  selectedMonth?: Date;
  onMonthChange?: (month: Date) => void;
  isCurrentMonth?: boolean;
  onResetToCurrentMonth?: () => void;

  // FAB actions
  onNewTransaction: () => void;
  onScanReceipt: () => void;
  onNewGoal: () => void;
  onNewBudget: () => void;

  // More menu actions
  onExport?: () => void;
  onOpenSettings?: () => void;
  onOpenNotifications?: () => void;
  onOpenOwnerLabels?: () => void;
  onImportBcpPdf?: () => void;
}

/** Vistas que traen su propia cabecera al estilo del design system. */
/* Recap trae la suya porque su titulo lleva el anio --«Recap 2026»-- y el
   anio es estado de la vista, no del contenedor. Ocultandolo y dejando la
   cabecera generica el titulo se quedaba en «Recap» a secas. */
const VISTAS_CON_CABECERA_PROPIA: ViewType[] = ['dashboard', 'transactions', 'recap'];

const viewTitles: Record<ViewType, string> = {
  dashboard: 'Inicio',
  transactions: 'Movimientos',
  goals: 'Metas',
  budgets: 'Presupuestos',
  recurring: 'Recurrentes',
  subscriptions: 'Suscripciones',
  savings: 'Ahorro',
  networth: 'Patrimonio',
  settings: 'Ajustes',
  recap: 'Recap',
  credit: 'Crédito',
};

export function AppShellMobile({
  currentView,
  onViewChange,
  children,
  showMonthSelector,
  selectedMonth,
  onMonthChange,
  isCurrentMonth,
  onResetToCurrentMonth,
  onNewTransaction,
  onScanReceipt,
  onNewGoal,
  onNewBudget,
  onExport,
  onOpenSettings,
  onOpenNotifications,
  onOpenOwnerLabels,
  onImportBcpPdf,
}: AppShellMobileProps) {
  return (
    <div className="mobile-shell">
      {/* El topbar oscuro con avatar se retira: repetia en una barra el mismo
          titulo que el cuerpo ya muestra como H1, y su fondo estaba escrito a
          mano fuera del sistema. Las vistas que no traen cabecera propia
          reciben aqui una del design system; la sesion vive en Ajustes. */}
      {!VISTAS_CON_CABECERA_PROPIA.includes(currentView) && (
        <header className="cl-page-header">
          <h1 className="cl-title">{viewTitles[currentView]}</h1>
        </header>
      )}

      <main className="mobile-content">
        {children}
      </main>

      <BottomTabs
        currentView={currentView}
        onViewChange={onViewChange}
        fab={
          <MobileFab
            onNewTransaction={onNewTransaction}
            onScanReceipt={onScanReceipt}
            onNewGoal={onNewGoal}
            onNewBudget={onNewBudget}
            onImport={onImportBcpPdf}
          />
        }
      />
    </div>
  );
}
