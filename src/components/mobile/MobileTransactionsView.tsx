import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { RecurringTransaction, Transaction } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { parseDateOnly } from '../../utils/stableDate';
import { clasificar, nombreCategoria, diaLargo, type ClaseMovimiento } from '../../utils/homeMobile';
import { SwipeableListItem } from './SwipeableListItem';
import { CategoryGlyph } from './CategoryGlyph';

type MovFilter = 'todos' | ClaseMovimiento;

interface MobileTransactionsViewProps {
  transactions: Transaction[];
  recurring: RecurringTransaction[];
  currency: string;
  onEdit: (t: Transaction) => void;
  onDelete: (id: string) => void;
  onImport?: () => void;
}

const FILTROS: { id: MovFilter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'var', label: 'Variables' },
  { id: 'fijo', label: 'Fijos' },
  { id: 'sub', label: 'Suscripciones' },
];

export function MobileTransactionsView({
  transactions, recurring, currency, onEdit, onDelete, onImport,
}: MobileTransactionsViewProps) {
  const [filtro, setFiltro] = useState<MovFilter>('todos');
  const [buscando, setBuscando] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  // La clase de cada movimiento se calcula una vez: recorrer los recurrentes
  // por cada fila y por cada filtro se nota en listas largas.
  const clasificados = useMemo(
    () => transactions.map(t => ({ t, clase: clasificar(t, recurring) })),
    [transactions, recurring]
  );

  const conteos = useMemo(() => {
    const c: Record<MovFilter, number> = { todos: clasificados.length, var: 0, fijo: 0, sub: 0 };
    for (const { clase } of clasificados) c[clase]++;
    return c;
  }, [clasificados]);

  const filtrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    return clasificados
      .filter(({ clase }) => filtro === 'todos' || clase === filtro)
      .filter(({ t }) => !term || t.description.toLowerCase().includes(term) || t.category.toLowerCase().includes(term))
      .map(({ t }) => t)
      .sort((a, b) => parseDateOnly(b.date).getTime() - parseDateOnly(a.date).getTime());
  }, [clasificados, filtro, busqueda]);

  const total = filtrados.reduce((s, t) => s + (t.type === 'expense' ? t.amount : 0), 0);

  return (
    <div className="cl-screen">
      <header className="cl-home-header">
        <h1 className="cl-title" style={{ margin: 0 }}>Movimientos</h1>
        <button
          className="cl-icon-btn"
          aria-pressed={buscando}
          aria-label={buscando ? 'Cerrar búsqueda' : 'Buscar'}
          onClick={() => { setBuscando(v => !v); if (buscando) setBusqueda(''); }}
        >
          {buscando ? <X size={15} strokeWidth={1.5} /> : <Search size={15} strokeWidth={1.5} />}
        </button>
      </header>

      {/* El subtitulo refleja el filtro activo, no el total general: si dice
          otra cosa que la lista de abajo, deja de ser util. */}
      <div className="cl-num cl-mov-subtitle">
        {filtrados.length} {filtrados.length === 1 ? 'movimiento' : 'movimientos'} · {formatCurrency(total, currency)}
      </div>

      {buscando && (
        <input
          className="cl-search"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o categoría"
          autoFocus
        />
      )}

      <div className="cl-chips cl-mov-chips" data-fade="true">
        {/* Un filtro vacio ocupa sitio y no lleva a ningun lado; solo se
            mantiene visible si es el activo, para poder salir de el. */}
        {FILTROS.filter(f => conteos[f.id] > 0 || filtro === f.id).map(f => (
          <button
            key={f.id}
            className="cl-chip"
            aria-pressed={filtro === f.id}
            onClick={() => setFiltro(f.id)}
          >
            {f.label} · {conteos[f.id]}
          </button>
        ))}
      </div>

      {filtrados.length === 0 ? (
        /* Una lista vacia dejaba 600px en blanco sin decir que hacer. */
        <div className="cl-empty" style={{ marginTop: 20 }}>
          <h2 className="cl-title cl-empty-title">
            {busqueda ? 'Nada coincide' : 'Todavía no hay movimientos'}
          </h2>
          <p className="cl-empty-body">
            {busqueda
              ? 'Probá con otra palabra, o quitá el filtro activo.'
              : 'Importá el estado de tu banco y quedan cargados de una vez, o registrá uno con el botón +.'}
          </p>
          {!busqueda && onImport && (
            <button className="cl-btn" onClick={onImport}>Importar estado BCP</button>
          )}
        </div>
      ) : (
        <div className="cl-mov-list">
          {filtrados.map((t, i) => {
            const fecha = parseDateOnly(t.date);
            const anterior = i > 0 ? parseDateOnly(filtrados[i - 1].date) : null;
            const primeroDelDia = !anterior || !isSameDay(fecha, anterior);
            return (
              <div key={t.id}>
                {/* El dia va como encabezado del grupo. Antes era una columna
                    de 40px que solo se rellenaba en la primera fila, asi que
                    las demas arrastraban ese hueco y el borde quedaba dentado. */}
                {primeroDelDia && (
                  <div className="cl-mov-day">{diaLargo(fecha)}</div>
                )}
                <SwipeableListItem onEdit={() => onEdit(t)} onDelete={() => onDelete(t.id)}>
                  <div className="cl-mov-row">
                    <CategoryGlyph categoryId={t.category} />
                    <div className="cl-row-main">
                      <div className="cl-row-name">{t.description}</div>
                      <div className="cl-meta">{nombreCategoria(t.category)}</div>
                    </div>
                    <div
                      className="cl-amount"
                      style={t.type === 'income' ? { color: 'var(--color-accent-700)' } : undefined}
                    >
                      {t.type === 'income' ? '+' : ''}{formatCurrency(t.amount, currency)}
                    </div>
                  </div>
                </SwipeableListItem>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
