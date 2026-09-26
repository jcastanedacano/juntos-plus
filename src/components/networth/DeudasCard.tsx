import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Landmark } from 'lucide-react';
import { addMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Debt } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { localeActual } from '../../utils/fxTasas';
import {
  Estrategia, ESTRATEGIAS, compararEstrategias, simularPago,
  cuotasRestantesDe, normalizarExtra,
} from '../../utils/deudas';

interface DeudasCardProps {
  /** Las deudas como se guardaron: cada una con su moneda, para listarlas y editarlas. */
  deudas: Debt[];
  /** Las mismas, ya en la moneda del hogar: con estas se hace el plan. */
  deudasBase: Debt[];
  currency: string;
  estrategia: Estrategia;
  extra: number;
  onCambiarEstrategia: (e: Estrategia) => void;
  onCambiarExtra: (n: number) => void;
  onAgregar: () => void;
  onEditar: (d: Debt) => void;
  onEliminar: (id: string) => void;
}

const card: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: 14,
  padding: '1.1rem',
};

const muted: React.CSSProperties = { color: 'var(--text-muted)' };

const pct = (fraccion: number) =>
  (fraccion * 100).toLocaleString(localeActual(), { maximumFractionDigits: 2 }) + '%';

const cuando = (meses: number) => format(addMonths(new Date(), meses), 'MMM yyyy', { locale: es });

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function DeudasCard({
  deudas, deudasBase, currency, estrategia, extra,
  onCambiarEstrategia, onCambiarExtra, onAgregar, onEditar, onEliminar,
}: DeudasCardProps) {
  const [borrador, setBorrador] = useState(extra > 0 ? String(extra) : '');
  useEffect(() => { setBorrador(extra > 0 ? String(extra) : ''); }, [extra]);

  const fmt = (n: number) => formatCurrency(n, currency);
  const hayVivas = deudasBase.some(d => d.isActive !== false && d.balance > 0);

  const comparacion = useMemo(() => compararEstrategias(deudasBase, extra), [deudasBase, extra]);
  const plan = estrategia === 'avalancha' ? comparacion.avalancha : comparacion.bolaDeNieve;
  const sinExtra = useMemo(
    () => (extra > 0 ? simularPago(deudasBase, 0, estrategia) : null),
    [deudasBase, extra, estrategia]
  );
  const nombreDe = (id: string) => deudasBase.find(d => d.id === id)?.name || '';

  const confirmarExtra = () => {
    const n = normalizarExtra(borrador);
    if (n !== extra) onCambiarExtra(n);
  };

  return (
    <div style={card} aria-labelledby="deudas-titulo">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
        <h3 id="deudas-titulo" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Landmark size={16} aria-hidden="true" /> Deudas
        </h3>
        <button className="btn-primary" onClick={onAgregar} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Plus size={15} /> Agregar
        </button>
      </div>
      <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', ...muted }}>
        Préstamos, vehículo, un familiar. Las cuotas de tu tarjeta ya cuentan en «Deuda de tarjetas».
      </p>

      {deudas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '1.5rem 1rem 0.5rem', fontSize: '0.88rem', ...muted }}>
          Sin deudas registradas. Si tienes alguna, agrégala y verás en qué orden conviene pagarla.
        </div>
      ) : (
        <div style={{ marginTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {deudas.map(d => {
            const restantes = cuotasRestantesDe(d);
            const cur = d.currency || currency;
            return (
              <div
                key={d.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.7rem 0.85rem', borderRadius: 10,
                  background: 'var(--bg-hover, rgba(255,255,255,0.02))',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{d.name}</div>
                  <div style={{ fontSize: '0.75rem', ...muted }}>
                    {d.tea > 0 ? `TEA ${pct(d.tea)}` : 'Sin interés'} · {formatCurrency(d.monthlyPayment, cur)}/mes ·{' '}
                    {Number.isFinite(restantes) ? plural(restantes, 'cuota', 'cuotas') : 'no se salda'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.92rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(d.balance, cur)}
                </div>
                <button className="icon-btn" onClick={() => onEditar(d)} aria-label={`Editar ${d.name}`} style={{ minWidth: 32, minHeight: 32 }}>
                  <Pencil size={15} />
                </button>
                <button className="icon-btn" onClick={() => { if (window.confirm(`¿Eliminar "${d.name}"?`)) onEliminar(d.id); }} aria-label={`Eliminar ${d.name}`} style={{ minWidth: 32, minHeight: 32 }}>
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {hayVivas && (
        <div style={{ marginTop: '1.1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Plan de pago</div>

          <div role="group" aria-label="Estrategia de pago" style={{ marginTop: '0.6rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {ESTRATEGIAS.map(e => (
              <button
                key={e.id}
                type="button"
                onClick={() => onCambiarEstrategia(e.id)}
                aria-pressed={estrategia === e.id}
                style={{
                  minHeight: 34, padding: '0 0.85rem', borderRadius: 999, cursor: 'pointer',
                  fontSize: '0.8rem', fontWeight: 600,
                  border: '1px solid var(--border-color)',
                  background: estrategia === e.id ? 'var(--accent-green)' : 'transparent',
                  color: estrategia === e.id ? '#0b1a14' : 'var(--text-muted)',
                }}
              >
                {e.nombre}
              </button>
            ))}
          </div>
          <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', ...muted }}>
            {ESTRATEGIAS.find(e => e.id === estrategia)?.explicacion}
          </div>

          <form
            onSubmit={ev => { ev.preventDefault(); confirmarExtra(); }}
            style={{ marginTop: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}
          >
            <label htmlFor="deuda-extra" style={{ fontSize: '0.8rem', ...muted }}>Pagar de más cada mes</label>
            <input
              id="deuda-extra"
              className="form-input"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={borrador}
              onChange={e => setBorrador(e.target.value)}
              onBlur={confirmarExtra}
              style={{ width: 130, minHeight: 36 }}
            />
          </form>

          {plan.meses === null ? (
            <div
              role="status"
              style={{ marginTop: '0.9rem', fontSize: '0.85rem', color: 'var(--rec-danger, #ef4444)' }}
            >
              Con estos pagos {plan.sinFin.map(nombreDe).filter(Boolean).join(', ')}{' '}
              {plan.sinFin.length === 1 ? 'no se salda' : 'no se saldan'}: la cuota no cubre el interés. Sube la cuota o paga algo de más.
            </div>
          ) : (
            <>
              <div style={{ marginTop: '0.9rem' }}>
                <div style={{ fontSize: '0.78rem', ...muted }}>Libre de deudas en</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.15 }}>
                  {plural(plan.meses, 'mes', 'meses')}
                  <span style={{ fontSize: '0.85rem', fontWeight: 500, marginLeft: '0.5rem', ...muted }}>
                    ({cuando(plan.meses)})
                  </span>
                </div>
                <div style={{ marginTop: '0.2rem', fontSize: '0.8rem', ...muted }}>
                  Pagando {fmt(plan.presupuestoMensual)} al mes en total, {fmt(plan.interesTotal)} de intereses.
                </div>
              </div>

              <ol style={{ margin: '0.8rem 0 0', paddingLeft: '1.2rem', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {plan.saldadas.map(s => (
                  <li key={s.id}>
                    <strong>{s.nombre}</strong>
                    <span style={muted}> · saldada en {plural(s.mes, 'mes', 'meses')} ({cuando(s.mes)})</span>
                  </li>
                ))}
              </ol>

              {sinExtra && sinExtra.meses !== null && sinExtra.meses > plan.meses && (
                <div style={{ marginTop: '0.8rem', fontSize: '0.8rem', ...muted }}>
                  Sin ese extra: {plural(sinExtra.meses, 'mes', 'meses')} y {fmt(sinExtra.interesTotal)} de intereses.
                  {' '}Con él ahorras <strong style={{ color: 'var(--text-primary)' }}>{fmt(Math.max(0, sinExtra.interesTotal - plan.interesTotal))}</strong>
                  {' '}y {plural(sinExtra.meses - plan.meses, 'mes', 'meses')}.
                </div>
              )}

              {comparacion.masBarata !== 'igual' && deudasBase.length > 1 && (
                <div style={{ marginTop: '0.6rem', fontSize: '0.8rem', ...muted }}>
                  {comparacion.masBarata === 'avalancha' ? 'La avalancha' : 'La bola de nieve'} paga{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>{fmt(comparacion.interesAhorrado)}</strong> menos en intereses
                  {comparacion.masBarata !== estrategia ? ' que la que tienes elegida' : ' que la otra'}.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
