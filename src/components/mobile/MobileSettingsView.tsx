import { ChevronRight } from 'lucide-react';
import { useMsal } from '@azure/msal-react';
import type { ViewType } from '../Sidebar';

interface MobileSettingsViewProps {
  onViewChange: (view: ViewType) => void;
  onExport?: () => void;
  onOpenSettings?: () => void;
  onOpenNotifications?: () => void;
  onOpenOwnerLabels?: (foco?: 'pareja' | 'cambio') => void;
}

/**
 * Ajustes, con un indice de secciones al final.
 *
 * Sin iconos de fila a proposito. Era la unica pantalla de la app que los
 * usaba --Inicio y Movimientos no tienen ninguno-- asi que no formaban un
 * sistema sino una excepcion, y Lucide es vocabulario de producto SaaS dentro
 * de una identidad editorial. Con etiquetas tan explicitas como «Exportar
 * datos» o «Centro de ahorro» el icono no anadia nada, y el ocre repetido en
 * catorce filas armaba una franja que tiraba del ojo hacia abajo en vez de
 * dejar leer. El ocre queda para estado; la jerarquia la llevan el kicker y
 * el espacio.
 *
 * El contenido sigue viviendo donde tiene sentido --Suscripciones bajo Fijos,
 * Metas bajo Resumen-- y el indice esta para quien no recuerde donde.
 */
const INDICE: { label: string; donde: string; view: ViewType }[] = [
  { label: 'Presupuestos', donde: 'Resumen', view: 'budgets' },
  { label: 'Metas', donde: 'Resumen', view: 'goals' },
  { label: 'Crédito', donde: 'Resumen', view: 'credit' },
  { label: 'Recap anual', donde: 'Resumen', view: 'recap' },
  { label: 'Recurrentes', donde: 'Fijos', view: 'recurring' },
  { label: 'Suscripciones', donde: 'Fijos', view: 'subscriptions' },
  { label: 'Centro de ahorro', donde: 'Fijos', view: 'savings' },
  { label: 'Patrimonio', donde: 'Nosotros', view: 'networth' },
];

export function MobileSettingsView({
  onViewChange,
  onExport,
  onOpenSettings,
  onOpenNotifications,
  onOpenOwnerLabels,
}: MobileSettingsViewProps) {
  const { instance, accounts } = useMsal();
  const account = accounts[0];

  const secciones: { titulo: string; items: { label: string; run: () => void }[] }[] = [
    {
      titulo: 'Datos',
      items: [
        ...(onExport ? [{ label: 'Exportar datos', run: onExport }] : []),
      ],
    },
    {
      titulo: 'Preferencias',
      items: [
        ...(onOpenNotifications ? [{ label: 'Notificaciones', run: onOpenNotifications }] : []),
        // «Pareja y tipo de cambio» era una fila con dos ajustes sin relacion
        // entre si. Ningun nombre --ni icono-- podia describir las dos a la
        // vez, asi que se separan y cada una abre el modal en su seccion.
        ...(onOpenOwnerLabels ? [
          { label: 'Nombres de la pareja', run: () => onOpenOwnerLabels('pareja') },
          { label: 'Tipo de cambio', run: () => onOpenOwnerLabels('cambio') },
        ] : []),
        ...(onOpenSettings ? [{ label: 'Categorías', run: onOpenSettings }] : []),
      ],
    },
  ];

  return (
    <div className="cl-screen">
      {secciones
        .filter(s => s.items.length > 0)
        .map(seccion => (
          <section key={seccion.titulo} className="cl-settings-group">
            <div className="cl-kicker">{seccion.titulo}</div>
            {seccion.items.map(item => (
              <button key={item.label} className="cl-settings-row" onClick={item.run}>
                <span className="cl-settings-label">{item.label}</span>
                <ChevronRight size={16} strokeWidth={1.5} className="cl-settings-chevron" />
              </button>
            ))}
          </section>
        ))}

      <section className="cl-settings-group">
        <div className="cl-kicker">Todas las secciones</div>
        {INDICE.map(item => (
          <button key={item.view} className="cl-settings-row" onClick={() => onViewChange(item.view)}>
            <span className="cl-settings-label">{item.label}</span>
            <span className="cl-settings-where">en {item.donde}</span>
            <ChevronRight size={16} strokeWidth={1.5} className="cl-settings-chevron" />
          </button>
        ))}
      </section>

      <section className="cl-settings-group">
        <div className="cl-kicker">Sesión</div>
        <div className="cl-settings-account">
          <span className="cl-settings-account-label">Sesión iniciada como</span>
          <span>{account?.username || account?.name}</span>
        </div>
        <button
          className="cl-settings-row"
          onClick={() => {
            import('../../auth/msalConfig').then(m => m.clearLoginHint());
            instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin });
          }}
        >
          <span className="cl-settings-label">Cerrar sesión</span>
        </button>
      </section>
    </div>
  );
}
