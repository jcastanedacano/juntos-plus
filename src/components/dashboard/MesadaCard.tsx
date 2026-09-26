import { useMemo, useState } from 'react';
import { Wallet, Pencil } from 'lucide-react';
import { Transaction, HogarConfig } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { useOwnerLabels } from '../../utils/ownerLabels';
import { calcularMesadas, normalizarMesada, Mesada, Persona } from '../../utils/mesada';

type Guardable = Pick<HogarConfig, 'mesadaMe' | 'mesadaPartner'>;

interface MesadaCardProps {
  /** Movimientos ya llevados a la moneda del hogar. */
  transacciones: Transaction[];
  config: HogarConfig;
  moneda: string;
  mes?: Date;
  /** La pantalla movil pinta las tarjetas con su propia clase. */
  variante?: 'escritorio' | 'movil';
  /** Para respetar el modo «ocultar montos» de la pantalla movil. */
  formato?: (n: number) => string;
  onGuardar: (parcial: Guardable) => void;
}

const COLOR: Record<Mesada['estado'], string> = {
  sin_mesada: 'var(--border-color)',
  dentro: 'var(--accent-green)',
  cerca: 'var(--accent-amber, #f59e0b)',
  excedida: 'var(--rec-danger, #ef4444)',
};

/**
 * La mesada de cada persona: lo que puede gastar sin rendir cuentas, lo que
 * lleva y lo que le queda. Solo cuenta lo que se apunta como SUYO; lo
 * compartido sale de la casa y no la toca.
 */
export function MesadaCard({ transacciones, config, moneda, mes, variante = 'escritorio', formato, onGuardar }: MesadaCardProps) {
  const etiquetas = useOwnerLabels();
  const [editando, setEditando] = useState<Persona | null>(null);
  const [borrador, setBorrador] = useState('');

  // Sin `mes`, la fecha nueva cambiaria de identidad en cada pintado: lo que
  // importa es el anio y el mes, y eso es lo que se vigila.
  const ref = mes || new Date();
  const anio = ref.getFullYear();
  const mesNum = ref.getMonth();
  const mesadas = useMemo(
    () => calcularMesadas(transacciones, { mesadaMe: config.mesadaMe, mesadaPartner: config.mesadaPartner }, new Date(anio, mesNum, 1)),
    [transacciones, config.mesadaMe, config.mesadaPartner, anio, mesNum]
  );

  const empezar = (p: Persona) => {
    const actual = mesadas[p].asignada;
    setBorrador(actual > 0 ? String(actual) : '');
    setEditando(p);
  };

  const guardar = (p: Persona) => {
    const monto = normalizarMesada(borrador);
    onGuardar(p === 'me' ? { mesadaMe: monto } : { mesadaPartner: monto });
    setEditando(null);
  };

  const fmt = formato || ((n: number) => formatCurrency(n, moneda));
  const personas: Persona[] = ['me', 'partner'];

  return (
    <div
      className={variante === 'movil' ? 'cl-card' : 'dr-card'}
      aria-labelledby="mesada-titulo"
      // En la pantalla movil las tarjetas vecinas no traen separacion propia.
      style={variante === 'movil' ? { marginTop: 16 } : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Wallet size={16} aria-hidden="true" />
        <div>
          <div id="mesada-titulo" className={variante === 'movil' ? undefined : 'dr-card-title'} style={{ fontWeight: 600 }}>
            Mesada
          </div>
          <div className={variante === 'movil' ? undefined : 'dr-card-sub'} style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Lo que cada uno gasta sin rendir cuentas
          </div>
        </div>
      </div>

      <div style={{ marginTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {personas.map(p => {
          const m = mesadas[p];
          const nombre = etiquetas[p];
          const ancho = m.avance === null ? 0 : Math.min(1, Math.max(0, m.avance));
          return (
            <div key={p}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{nombre}</span>
                {editando === p ? null : (
                  <button
                    type="button"
                    onClick={() => empezar(p)}
                    aria-label={m.asignada > 0 ? `Editar la mesada de ${nombre}` : `Fijar la mesada de ${nombre}`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.3rem', minHeight: 32,
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', fontSize: '0.78rem',
                    }}
                  >
                    <Pencil size={13} aria-hidden="true" /> {m.asignada > 0 ? 'Editar' : 'Fijar'}
                  </button>
                )}
              </div>

              {editando === p ? (
                <form
                  onSubmit={e => { e.preventDefault(); guardar(p); }}
                  style={{ marginTop: '0.4rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}
                >
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    autoFocus
                    aria-label={`Mesada mensual de ${nombre}`}
                    placeholder="0.00"
                    value={borrador}
                    onChange={e => setBorrador(e.target.value)}
                    className="form-input"
                    style={{ width: 130, minHeight: 36 }}
                  />
                  <button type="submit" className="gl-add-btn">Guardar</button>
                  <button type="button" onClick={() => setEditando(null)} className="cancel-btn" style={{ minHeight: 36 }}>
                    Cancelar
                  </button>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Vacío para quitarla</span>
                </form>
              ) : m.estado === 'sin_mesada' ? (
                <div style={{ marginTop: '0.3rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Sin mesada fijada.{m.gastado > 0 ? ` Lleva ${fmt(m.gastado)} de gasto personal este mes.` : ''}
                </div>
              ) : (
                <>
                  <div
                    role="progressbar"
                    aria-label={`Mesada gastada de ${nombre}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(ancho * 100)}
                    style={{ marginTop: '0.4rem', height: 8, borderRadius: 999, background: 'var(--border-color)', overflow: 'hidden' }}
                  >
                    <div style={{ width: `${ancho * 100}%`, height: '100%', borderRadius: 999, background: COLOR[m.estado], transition: 'width 0.4s ease' }} />
                  </div>
                  <div style={{ marginTop: '0.35rem', display: 'flex', justifyContent: 'space-between', gap: '0.75rem', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(m.gastado)} de {fmt(m.asignada)}
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: m.estado === 'excedida' ? COLOR.excedida : 'var(--text-primary)' }}>
                      {m.estado === 'excedida' ? `Te pasaste por ${fmt(-m.restante)}` : `Quedan ${fmt(m.restante)}`}
                    </span>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: '0.9rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        Cuenta lo que apuntas como tuyo. Lo compartido no resta.
      </div>
    </div>
  );
}
