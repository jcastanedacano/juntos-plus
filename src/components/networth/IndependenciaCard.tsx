import { Target } from 'lucide-react';
import { formatCurrency } from '../../utils/calculations';
import { localeActual } from '../../utils/fxTasas';
import { Independencia, TASAS_OFRECIDAS, MESES_MINIMOS } from '../../utils/independencia';

interface IndependenciaCardProps {
  resultado: Independencia;
  currency: string;
  onChangeTasa: (tasa: number) => void;
}

const card: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: 14,
  padding: '1.1rem',
};

const pct = (fraccion: number, decimales = 0) =>
  (fraccion * 100).toLocaleString(localeActual(), { maximumFractionDigits: decimales }) + '%';

export function IndependenciaCard({ resultado: r, currency, onChangeTasa }: IndependenciaCardProps) {
  const hayInmuebles = r.patrimonioInvertible !== r.patrimonioNeto;
  const faltan = MESES_MINIMOS - r.gasto.mesesConDatos;

  return (
    <div style={card} aria-labelledby="indep-titulo">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h3 id="indep-titulo" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Target size={16} aria-hidden="true" /> Independencia financiera
        </h3>
        <div role="group" aria-label="Tasa de retiro" style={{ display: 'flex', gap: '0.3rem' }}>
          {TASAS_OFRECIDAS.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => onChangeTasa(t)}
              aria-pressed={r.tasa === t}
              style={{
                minHeight: 32, padding: '0 0.65rem', borderRadius: 999, cursor: 'pointer',
                fontSize: '0.78rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                border: '1px solid var(--border-color)',
                background: r.tasa === t ? 'var(--accent-green)' : 'transparent',
                color: r.tasa === t ? '#0b1a14' : 'var(--text-muted)',
              }}
            >
              {pct(t, 1)}
            </button>
          ))}
        </div>
      </div>

      <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        Cuánto patrimonio hace falta para que lo que rinde cubra lo que gastas.
      </p>

      {r.numero === null ? (
        <div style={{ marginTop: '0.9rem' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
            Todavía faltan datos para calcularlo.
          </div>
          <div style={{ marginTop: '0.3rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Hacen falta al menos {MESES_MINIMOS} meses completos con gastos apuntados
            {r.gasto.mesesConDatos > 0
              ? `; hay ${r.gasto.mesesConDatos}, faltan ${faltan}.`
              : '; todavía no hay ninguno.'}
          </div>
          {r.sostieneNeto > 0 && (
            <div style={{ marginTop: '0.6rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Lo que tienes hoy sostendría{' '}
              <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(r.sostieneNeto, currency)}
              </strong>{' '}
              al mes.
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{ marginTop: '0.9rem' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Tu número</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(r.numero, currency)}
            </div>
            <div style={{ marginTop: '0.2rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {formatCurrency(r.gasto.promedio, currency)} al mes × 12 ÷ {pct(r.tasa, 1)}
              {' · '}promedio de {r.gasto.mesesConDatos} {r.gasto.mesesConDatos === 1 ? 'mes' : 'meses'}
            </div>
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <Barra
              etiqueta={hayInmuebles ? 'Con todo tu patrimonio' : 'Tu patrimonio'}
              monto={formatCurrency(r.patrimonioNeto, currency)}
              fraccion={r.progresoNeto ?? 0}
            />
            {hayInmuebles && (
              <Barra
                etiqueta="Sin inmuebles (lo que rinde de verdad)"
                monto={formatCurrency(r.patrimonioInvertible, currency)}
                fraccion={r.progresoInvertible ?? 0}
              />
            )}
          </div>

          <div style={{ marginTop: '0.9rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Hoy {hayInmuebles ? 'sin contar los inmuebles ' : ''}tu patrimonio sostiene{' '}
            <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(hayInmuebles ? r.sostieneInvertible : r.sostieneNeto, currency)}
            </strong>{' '}
            de los {formatCurrency(r.gasto.promedio, currency)} que gastas al mes.
          </div>
        </>
      )}

      <div style={{ marginTop: '0.9rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        Es una regla orientativa, no una recomendación de inversión.
      </div>
    </div>
  );
}

function Barra({ etiqueta, monto, fraccion }: { etiqueta: string; monto: string; fraccion: number }) {
  // La barra se topa en 100%, pero el numero no: pasarse de la meta es una
  // buena noticia y conviene verla, no que se recorte.
  const ancho = Math.min(1, Math.max(0, fraccion));
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', fontSize: '0.8rem' }}>
        <span style={{ color: 'var(--text-muted)' }}>{etiqueta}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
          {monto} · <strong>{pct(fraccion, 1)}</strong>
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={etiqueta}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(ancho * 100)}
        style={{ marginTop: '0.35rem', height: 8, borderRadius: 999, background: 'var(--border-color)', overflow: 'hidden' }}
      >
        <div
          style={{
            width: `${ancho * 100}%`, height: '100%', borderRadius: 999,
            background: 'var(--accent-green)', transition: 'width 0.4s ease',
          }}
        />
      </div>
    </div>
  );
}
