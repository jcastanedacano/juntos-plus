import { LayoutDashboard, Receipt, Settings } from 'lucide-react';
import type { ViewType } from '../Sidebar';

interface BottomTabsProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  /** La accion de registrar, inyectada para que viva dentro de la rejilla. */
  fab?: React.ReactNode;
}

/**
 * Barra inferior: tres destinos y una accion.
 *
 * Antes eran cinco mas una hoja «Mas» que escondia Credito, Presupuestos y
 * Recap: seis destinos donde ninguno quedaba claro. Ahora hay tres y el resto
 * se alcanza desde las secciones de Inicio y desde Ajustes.
 *
 * El boton de registrar vuelve a la barra. Floto en tres sitios distintos
 * --dentro de la barra, centrado sobre ella, abajo a la derecha-- y en los
 * tres tapaba filas: «Credito» y «Recap anual» en Resumen, «Suscripciones» y
 * «Centro de ahorro» en Ajustes. Como son tocables, ademas de taparlas les
 * robaba el toque. Un boton flotante sobre listas que llegan hasta el fondo
 * siempre va a tapar algo; se justifica cuando hay una accion dominante sobre
 * un lienzo grande, y aqui hay tres destinos y una accion, que entran en la
 * barra. De paso gana etiqueta: dejo de ser un circulo con un signo.
 */
const tabs: { id: ViewType; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
  { id: 'transactions', label: 'Movimientos', icon: Receipt },
  { id: 'settings', label: 'Ajustes', icon: Settings },
];

/** Vistas que se alcanzan desde Ajustes: la pestana queda marcada en todas. */
const SETTINGS_VIEWS: ViewType[] = [
  'settings', 'budgets', 'recurring', 'goals', 'credit',
  'recap', 'networth', 'subscriptions', 'savings',
];

export function BottomTabs({ currentView, onViewChange, fab }: BottomTabsProps) {
  const isActive = (id: ViewType) =>
    id === 'settings' ? SETTINGS_VIEWS.includes(currentView) : currentView === id;

  return (
    <nav className="cl-tabbar" aria-label="Navegación principal">
      {tabs.slice(0, 2).map(tab => (
        <TabButton key={tab.id} tab={tab} active={isActive(tab.id)} onClick={() => onViewChange(tab.id)} />
      ))}

      {/* La accion va entre el contenido y los ajustes, no al final: lo que
          se hace todos los dias queda mas cerca del pulgar que lo que se
          configura una vez. */}
      {fab}

      {tabs.slice(2).map(tab => (
        <TabButton key={tab.id} tab={tab} active={isActive(tab.id)} onClick={() => onViewChange(tab.id)} />
      ))}
    </nav>
  );
}

function TabButton({
  tab,
  active,
  onClick,
}: {
  tab: { id: ViewType; label: string; icon: typeof LayoutDashboard };
  active: boolean;
  onClick: () => void;
}) {
  const Icon = tab.icon;
  return (
    <button
      className={`cl-tab ${active ? 'active' : ''}`}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
    >
      <Icon size={20} strokeWidth={1.5} />
      <span className="cl-tab-label">{tab.label}</span>
    </button>
  );
}
