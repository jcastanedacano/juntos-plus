import { useEffect, useRef, useState } from 'react';
import { Plus, Camera, Target, Wallet, FileDown, X } from 'lucide-react';

interface MobileFabProps {
  onNewTransaction: () => void;
  onScanReceipt: () => void;
  onNewGoal: () => void;
  onNewBudget: () => void;
  /** Importar el estado del banco. Ver el comentario de `secundarias`. */
  onImport?: () => void;
}

/** Milisegundos de pulsacion sostenida antes de abrir el menu secundario. */
const LONG_PRESS_MS = 400;

/**
 * La accion de registrar, como cuarto elemento de la barra inferior.
 *
 * Un toque hace lo principal --registrar un gasto, que es lo que se hace
 * todos los dias-- y las otras tres acciones viven detras de una pulsacion
 * sostenida. Antes un toque abria el menu de las cuatro, asi que lo diario
 * costaba dos toques y una decision.
 *
 * Deja de ser un circulo flotante: ver el comentario de BottomTabs. Se dibuja
 * como una pestania mas, con etiqueta, y se distingue por el ocre y el
 * recuadro del icono en vez de por flotar por encima de todo.
 */
export function MobileFab({
  onNewTransaction,
  onScanReceipt,
  onNewGoal,
  onNewBudget,
  onImport,
}: MobileFabProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const timerRef = useRef<number | null>(null);
  // Distingue "solte despues de una pulsacion larga" de "fue un toque":
  // sin esto, al soltar se dispararia ademas la accion principal.
  const longPressFired = useRef(false);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => clearTimer, []);

  const startPress = () => {
    longPressFired.current = false;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      longPressFired.current = true;
      setMenuOpen(true);
      // Vibracion breve: confirma que la pulsacion larga se registro, que de
      // otro modo es invisible hasta que aparece el menu.
      navigator.vibrate?.(10);
    }, LONG_PRESS_MS);
  };

  const endPress = () => {
    clearTimer();
    if (!longPressFired.current) onNewTransaction();
  };

  const cancelPress = () => {
    clearTimer();
    longPressFired.current = true; // cancelado: no dispares nada al salir
  };

  // Importar vivia en Ajustes y salio de ahi con la limpieza de iconos. Se
  // quedo solo en el estado vacio de Movimientos, o sea que en cuanto habia
  // un movimiento no habia forma de importar nada. Vuelve aqui, que es donde
  // ya viven las demas acciones secundarias, y no como fila de configuracion.
  const secondary = [
    ...(onImport ? [{ id: 'import', label: 'Importar estado del banco', icon: FileDown, run: onImport }] : []),
    { id: 'receipt', label: 'Escanear recibo', icon: Camera, run: onScanReceipt },
    { id: 'goal', label: 'Nueva meta', icon: Target, run: onNewGoal },
    { id: 'budget', label: 'Nuevo presupuesto', icon: Wallet, run: onNewBudget },
  ];

  return (
    <>
      <button
        className="cl-tab cl-tab-accion"
        aria-label="Registrar un gasto"
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={cancelPress}
        onPointerCancel={cancelPress}
        // El boton solo escuchaba eventos de puntero, asi que con teclado no
        // hacia nada: ni Enter ni Espacio lo activaban. Tampoco respondia a un
        // click programatico, que es como se detecto.
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onNewTransaction();
          }
        }}
        onContextMenu={e => e.preventDefault()}
      >
        <span className="cl-tab-accion-icono">
          <Plus size={20} strokeWidth={1.5} />
        </span>
        <span className="cl-tab-label">Registrar</span>
      </button>

      {menuOpen && (
        <div className="cl-fab-menu-backdrop" onClick={() => setMenuOpen(false)}>
          <div
            className="cl-fab-menu"
            role="menu"
            onClick={e => e.stopPropagation()}
          >
            <div className="cl-kicker" style={{ marginBottom: 10 }}>Otras acciones</div>
            {secondary.map(a => {
              const Icon = a.icon;
              return (
                <button
                  key={a.id}
                  role="menuitem"
                  className="cl-fab-menu-item"
                  onClick={() => { setMenuOpen(false); a.run(); }}
                >
                  <Icon size={16} strokeWidth={1.5} />
                  <span>{a.label}</span>
                </button>
              );
            })}
            <button
              className="cl-fab-menu-close"
              onClick={() => setMenuOpen(false)}
              aria-label="Cerrar"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
