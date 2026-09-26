import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { formatCurrency } from '../../utils/calculations';
import { MESES_OFRECIDOS, MESES_POR_DEFECTO, metaFondo } from '../../utils/fondoEmergencia';

interface FondoEmergenciaBannerProps {
  /** Lo que cuestan al mes los gastos recurrentes activos, en la moneda del hogar. */
  gastoMensual: number;
  currency: string;
  onCrear: (meses: number) => void;
}

const caja: React.CSSProperties = {
  background: 'var(--goal-card-bg, var(--bg-card))',
  border: '1px dashed var(--goal-border, var(--border-color))',
  borderRadius: 14,
  padding: '1rem 1.1rem',
  display: 'flex',
  gap: '0.85rem',
  alignItems: 'flex-start',
};

/**
 * Propone crear el fondo de emergencia. Solo se pinta mientras no exista uno:
 * hay uno por hogar, porque dos objetivos distintos de «cuanto aguantamos sin
 * sueldo» no significan nada.
 */
export function FondoEmergenciaBanner({ gastoMensual, currency, onCrear }: FondoEmergenciaBannerProps) {
  const [meses, setMeses] = useState<number>(MESES_POR_DEFECTO);

  if (!(gastoMensual > 0)) {
    return (
      <div style={caja} aria-labelledby="fe-titulo">
        <ShieldCheck size={22} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div id="fe-titulo" style={{ fontWeight: 600, fontSize: '0.92rem' }}>Fondo de emergencia</div>
          <div style={{ marginTop: '0.25rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Registra tus gastos recurrentes (alquiler, servicios, suscripciones) y aquí verás cuánto
            necesitas guardar para aguantar unos meses sin ingresos.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={caja} aria-labelledby="fe-titulo">
      <ShieldCheck size={22} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div id="fe-titulo" style={{ fontWeight: 600, fontSize: '0.92rem' }}>Fondo de emergencia</div>
        <div style={{ marginTop: '0.25rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Tus gastos recurrentes suman{' '}
          <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(gastoMensual, currency)}
          </strong>{' '}
          al mes. Para cubrir {meses} meses necesitas{' '}
          <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(metaFondo(gastoMensual, meses), currency)}
          </strong>
          , y se ajusta solo si esos gastos cambian.
        </div>
        <div style={{ marginTop: '0.7rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div role="group" aria-label="Meses de cobertura" style={{ display: 'flex', gap: '0.3rem' }}>
            {MESES_OFRECIDOS.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMeses(m)}
                aria-pressed={meses === m}
                style={{
                  minHeight: 32, padding: '0 0.75rem', borderRadius: 999, cursor: 'pointer',
                  fontSize: '0.78rem', fontWeight: 600,
                  border: '1px solid var(--border-color)',
                  background: meses === m ? 'var(--accent-green)' : 'transparent',
                  color: meses === m ? '#0b1a14' : 'var(--text-muted)',
                }}
              >
                {m} meses
              </button>
            ))}
          </div>
          <button type="button" className="gl-add-btn" onClick={() => onCrear(meses)}>
            Crear fondo
          </button>
        </div>
      </div>
    </div>
  );
}
