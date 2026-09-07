import { useMemo, useState } from 'react';
import { Delete } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { PaidBy, Transaction } from '../../types';
import { toStableDateISO } from '../../utils/stableDate';
import { useOwnerLabels } from '../../utils/ownerLabels';

interface MobileNewExpenseSheetProps {
  onClose: () => void;
  onSave: (t: Omit<Transaction, 'id'>) => void;
  /** Abre el formulario completo para lo que esta hoja no cubre. */
  onMoreOptions: () => void;
}

const CATEGORIAS = [
  { id: 'food', label: 'Alimentación' },
  { id: 'transport', label: 'Transporte' },
  { id: 'home', label: 'Hogar' },
  { id: 'other-expense', label: 'Otros' },
];

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '←'];

/** Tope de caracteres del monto: mas que eso no es un gasto, es un error. */
const MAX_CHARS = 8;

/**
 * Alta rapida de gasto.
 *
 * Teclado propio en vez de un <input type="number">: el teclado del sistema
 * tapa media pantalla y trae teclas que aqui no sirven. Con este se ve el
 * monto, la categoria y quien pago a la vez.
 */
export function MobileNewExpenseSheet({ onClose, onSave, onMoreOptions }: MobileNewExpenseSheetProps) {
  const labels = useOwnerLabels();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('food');
  const [paidBy, setPaidBy] = useState<PaidBy>('me');
  const hoy = useMemo(() => new Date(), []);

  const pulsar = (tecla: string) => {
    setAmount(prev => {
      if (tecla === '←') return prev.slice(0, -1);
      // Un solo punto decimal, y no mas de dos decimales.
      if (tecla === '.' && prev.includes('.')) return prev;
      if (prev.length >= MAX_CHARS) return prev;
      const siguiente = prev + tecla;
      const [, dec] = siguiente.split('.');
      if (dec && dec.length > 2) return prev;
      return siguiente;
    });
  };

  const valor = parseFloat(amount);
  const valido = Number.isFinite(valor) && valor > 0;

  const personas: { id: PaidBy; label: string }[] = [
    { id: 'me', label: labels.me },
    { id: 'partner', label: labels.partner },
    { id: 'both', label: 'Ambos' },
  ];

  const resumenPago =
    paidBy === 'both'
      ? `Se divide 50/50 entre ${labels.me} y ${labels.partner}`
      : `Lo pagó ${paidBy === 'me' ? labels.me : labels.partner}`;

  const guardar = () => {
    if (!valido) return;
    onSave({
      type: 'expense',
      amount: valor,
      category,
      description: CATEGORIAS.find(c => c.id === category)?.label || 'Gasto',
      date: toStableDateISO(format(hoy, 'yyyy-MM-dd')),
      accountId: 'default',
      paidBy,
    } as Omit<Transaction, 'id'>);
  };

  return (
    <div className="cl-sheet-backdrop" onClick={onClose}>
      <div
        className="cl-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Nuevo gasto"
        onClick={e => e.stopPropagation()}
      >
        <div className="cl-sheet-grab" />

        <div className="cl-sheet-head">
          <h2 className="cl-title" style={{ margin: 0 }}>Nuevo gasto</h2>
          <span className="cl-num cl-sheet-date">
            hoy · {format(hoy, 'd MMM', { locale: es })}
          </span>
        </div>

        <div className={`cl-amount is-l ${amount ? 'filled' : ''}`}>
          {amount ? `S/ ${amount}` : 'S/ 0.00'}
        </div>

        <div className="cl-chips">
          {CATEGORIAS.map(c => (
            <button
              key={c.id}
              className="cl-chip"
              aria-pressed={category === c.id}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
          <button className="cl-chip cl-chip-dashed" onClick={onMoreOptions}>+ otra</button>
        </div>

        <div>
          <div className="cl-kicker" style={{ display: 'block', marginBottom: 8 }}>
            Quién pagó
          </div>
          <div
            className="cl-segmented"
            style={{
              '--cl-seg-total': personas.length,
              '--cl-seg-activo': personas.findIndex(p => p.id === paidBy),
            } as React.CSSProperties}
          >
            {personas.map(p => (
              <button
                key={p.id}
                aria-selected={paidBy === p.id}
                onClick={() => setPaidBy(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="cl-meta" style={{ marginTop: 8 }}>{resumenPago}</div>
        </div>

        {/* El fondo de la rejilla se ve por los huecos de 1px y dibuja las
            lineas del teclado: una sola propiedad en vez de bordes por tecla. */}
        <div className="cl-keypad">
          {TECLAS.map(t => (
            <button key={t} className="cl-key" onClick={() => pulsar(t)} aria-label={t === '←' ? 'Borrar' : t}>
              {t === '←' ? <Delete size={18} strokeWidth={1.5} /> : t}
            </button>
          ))}
        </div>

        <button className="cl-btn" disabled={!valido} onClick={guardar}>
          Guardar gasto
        </button>
      </div>
    </div>
  );
}
