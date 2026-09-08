import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MobileHomeView, type HomeSection } from '../src/components/mobile/MobileHomeView';
import { MobileTransactionsView } from '../src/components/mobile/MobileTransactionsView';
import { BottomTabs } from '../src/components/mobile/BottomTabs';
import { transacciones, recurrentes } from './datos';
import '../src/App.css';

// Los nombres de la pareja se leen de localStorage; aqui se fijan para que las
// capturas no dependan de lo que tenga guardado el navegador.
localStorage.setItem(
  'juntos:ownerLabels',
  JSON.stringify({ shared: 'Compartido', me: 'Carlos', partner: 'Sandra' })
);

/** La pantalla se elige por ?vista= para capturarlas una a una. */
const params = new URLSearchParams(location.search);
const vista = params.get('vista') || 'inicio';
const seccionInicial = (params.get('seccion') || 'resumen') as HomeSection;

function Escaparate() {
  const [section, setSection] = useState<HomeSection>(seccionInicial);
  const nada = () => {};
  return (
    <div className="app-layout is-mobile">
      <div className="mobile-shell">
        <main className="mobile-content">
          {vista === 'movimientos' ? (
            <MobileTransactionsView
              transactions={transacciones}
              recurring={recurrentes}
              currency="PEN"
              onEdit={nada}
              onDelete={nada}
              onImport={nada}
            />
          ) : (
            <MobileHomeView
              transactions={transacciones}
              recurring={recurrentes}
              currency="PEN"
              section={section}
              onSectionChange={setSection}
              onGoSubscriptions={nada}
              onAssignAuthors={nada}
              onNavigate={nada}
              onImport={nada}
            />
          )}
        </main>
        {/* El boton de registrar se dibuja aqui en vez de traer MobileFab: ese
            componente abre hojas y menus que en una captura estatica no
            aportan, y arrastraria sus dependencias al harness. */}
        <BottomTabs
          currentView={vista === 'movimientos' ? 'transactions' : 'dashboard'}
          onViewChange={nada}
          fab={
            <button className="cl-tab cl-tab-accion" aria-label="Registrar un gasto">
              <span className="cl-tab-accion-icono">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth={1.5}>
                  <path d="M5 12h14M12 5v14" />
                </svg>
              </span>
              <span className="cl-tab-label">Registrar</span>
            </button>
          }
        />
      </div>
    </div>
  );
}

// La capa Classical vive colgada de .is-mobile en la raiz.
document.documentElement.classList.add('is-mobile');
createRoot(document.getElementById('root')!).render(<Escaparate />);
