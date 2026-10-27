import { useCallback, useEffect, useState } from 'react';
import { Scale, Plus, X } from 'lucide-react';
import { useOwnerLabels } from '../../utils/ownerLabels';
import { useMyOwnerRole } from '../../utils/userIdentity';
import { getMonedaBase } from '../../utils/fxTasas';
import { formatCurrency } from '../../utils/calculations';
import {
  consultarDecisiones, crearDecision, votarDecision, resolverDecision, explicarDecision,
  VistaDecisiones, VistaDecision,
} from '../../utils/decisiones';

const card: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: 14,
  padding: '1.1rem',
};
const muted: React.CSSProperties = { color: 'var(--text-muted)' };

const COLOR_YO = 'var(--accent-blue, #3b82f6)';
const COLOR_PAREJA = 'var(--accent-pink, #ec4899)';

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'error'; codigo: string }
  | { tipo: 'listo'; vista: VistaDecisiones };

const textoOpcion = (d: VistaDecision, id?: string) => d.opciones.find(o => o.id === id)?.texto ?? '';

/**
 * Decidir juntos: cada persona vota en privado y, cuando las dos votaron, se
 * ve si coinciden. Si no, queda en «Hablarlo» hasta que alguna la resuelve.
 *
 * El voto de la otra persona NO llega a esta pantalla hasta entonces: lo
 * decide el servidor, no esta vista.
 */
export function DecisionsView() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  const [creando, setCreando] = useState(false);

  const etiquetas = useOwnerLabels();
  const miRol = useMyOwnerRole();
  const nombrePareja = etiquetas[miRol === 'me' ? 'partner' : 'me'];

  const cargar = useCallback(async () => {
    setEstado({ tipo: 'cargando' });
    const r = await consultarDecisiones();
    setEstado(r.ok ? { tipo: 'listo', vista: r.vista } : { tipo: 'error', codigo: r.codigo });
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  if (estado.tipo === 'cargando') {
    return <div style={{ ...card, ...muted }} role="status">Cargando las decisiones...</div>;
  }

  if (estado.tipo === 'error') {
    return (
      <div style={card} role="alert">
        <div style={{ fontWeight: 600 }}>No pudimos cargar las decisiones</div>
        <div style={{ marginTop: '0.3rem', fontSize: '0.85rem', ...muted }}>{explicarDecision(estado.codigo)}</div>
        <button className="btn-primary" onClick={() => void cargar()} style={{ marginTop: '0.8rem' }}>Reintentar</button>
      </div>
    );
  }

  const v = estado.vista;
  const abiertas = v.decisiones.filter(d => d.estado === 'votando' || d.estado === 'hablarlo');
  const historial = v.decisiones.filter(d => d.estado === 'resuelta' || d.estado === 'coinciden');
  const alActualizar = (vista: VistaDecisiones) => setEstado({ tipo: 'listo', vista });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={card}>
        <h2 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Scale size={18} aria-hidden="true" /> Decidir juntos
        </h2>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', ...muted }}>
          Planteen una decisión de dinero y voten cada uno en privado. Nadie ve el voto del otro hasta que los
          dos votan: así lo que uno elige no depende de lo que eligió el otro.
        </p>
        {v.miembros < 2 && (
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', ...muted }}>
            Para ver los resultados falta tu pareja: invítala desde «Pareja» y que vote.
          </p>
        )}
        {!creando && (
          <button type="button" className="btn-primary" onClick={() => setCreando(true)} style={{ marginTop: '0.9rem' }}>
            <Plus size={15} aria-hidden="true" /> Nueva decisión
          </button>
        )}
      </div>

      {creando && (
        <Nueva
          limites={v.limites}
          onCancelar={() => setCreando(false)}
          onCreada={vista => { setCreando(false); alActualizar(vista); }}
        />
      )}

      {abiertas.length === 0 && !creando && (
        <div style={{ ...card, ...muted, fontSize: '0.85rem' }}>
          No hay decisiones pendientes. Empiecen con algo como «¿Compramos esto?» o «¿Cuánto ponemos al ahorro este mes?».
        </div>
      )}

      {abiertas.map(d => (
        <Tarjeta key={d.id} d={d} limites={v.limites} nombrePareja={nombrePareja} onActualizar={alActualizar} />
      ))}

      {historial.length > 0 && (
        <div>
          <h3 style={{ margin: '0 0 0.6rem', fontSize: '0.95rem' }}>Historial</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {historial.map(d => (
              <Tarjeta key={d.id} d={d} limites={v.limites} nombrePareja={nombrePareja} onActualizar={alActualizar} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Nueva decision ──────────────────────────────────────────────────

function Nueva({
  limites, onCancelar, onCreada,
}: { limites: VistaDecisiones['limites']; onCancelar: () => void; onCreada: (v: VistaDecisiones) => void }) {
  const [pregunta, setPregunta] = useState('');
  const [opciones, setOpciones] = useState<string[]>(['Sí', 'No']);
  const [monto, setMonto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const limpias = opciones.map(o => o.trim());
  const valido = pregunta.trim() !== '' && limpias.every(o => o !== '') && limpias.length >= limites.minOpciones;

  const guardar = async () => {
    setGuardando(true);
    setFallo(null);
    const m = monto.trim() === '' ? null : Number(monto);
    const r = await crearDecision(pregunta.trim(), limpias, m);
    setGuardando(false);
    if (!r.ok) {
      setFallo(explicarDecision(r.codigo));
      return;
    }
    onCreada(r.vista);
  };

  const cambiar = (i: number, t: string) => setOpciones(opciones.map((o, j) => (j === i ? t : o)));

  return (
    <div style={card}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>
          Pregunta
          <input
            className="form-input"
            value={pregunta}
            maxLength={limites.maxPregunta}
            placeholder="¿Compramos esto?"
            onChange={e => setPregunta(e.target.value)}
            style={{ minHeight: 40 }}
          />
        </label>

        <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <legend style={{ fontSize: '0.85rem', fontWeight: 600, padding: 0, marginBottom: '0.4rem' }}>
            Opciones ({limites.minOpciones} a {limites.maxOpciones})
          </legend>
          {opciones.map((o, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <input
                className="form-input"
                aria-label={`Opción ${i + 1}`}
                value={o}
                maxLength={limites.maxOpcion}
                onChange={e => cambiar(i, e.target.value)}
                style={{ flex: 1, minHeight: 40 }}
              />
              {opciones.length > limites.minOpciones && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Quitar la opción ${i + 1}`}
                  onClick={() => setOpciones(opciones.filter((_, j) => j !== i))}
                  style={{ minWidth: 36, minHeight: 36 }}
                >
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
          {opciones.length < limites.maxOpciones && (
            <button type="button" className="btn-secondary" onClick={() => setOpciones([...opciones, ''])} style={{ alignSelf: 'flex-start' }}>
              Agregar opción
            </button>
          )}
        </fieldset>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>
          Monto (opcional)
          <input
            className="form-input"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={monto}
            onChange={e => setMonto(e.target.value)}
            style={{ minHeight: 40, maxWidth: 200 }}
          />
        </label>
      </div>

      {fallo && <div role="alert" style={{ marginTop: '0.8rem', fontSize: '0.83rem', color: 'var(--rec-danger, #ef4444)' }}>{fallo}</div>}

      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn-primary" disabled={!valido || guardando} onClick={() => void guardar()}>
          {guardando ? 'Guardando...' : 'Plantear decisión'}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  );
}

// ─── Una decision ────────────────────────────────────────────────────

function Tarjeta({
  d, limites, nombrePareja, onActualizar,
}: {
  d: VistaDecision;
  limites: VistaDecisiones['limites'];
  nombrePareja: string;
  onActualizar: (v: VistaDecisiones) => void;
}) {
  const [elegida, setElegida] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [resolviendo, setResolviendo] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const ejecutar = async (accion: () => ReturnType<typeof votarDecision>) => {
    setTrabajando(true);
    setFallo(null);
    const r = await accion();
    setTrabajando(false);
    if (!r.ok) {
      setFallo(explicarDecision(r.codigo));
      return;
    }
    setResolviendo(false);
    setElegida(null);
    onActualizar(r.vista);
  };

  const fmtMonto = d.monto !== null ? formatCurrency(d.monto, getMonedaBase()) : null;
  const miVoto = d.yo ? d.yo.opcion : null;
  const votando = d.estado === 'votando';

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
        <div style={{ fontWeight: 600, fontSize: '0.98rem' }}>{d.pregunta}</div>
        {fmtMonto && <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtMonto}</div>}
      </div>

      {votando && (
        <>
          <div style={{ marginTop: '0.25rem', fontSize: '0.78rem', ...muted }}>
            {d.yo
              ? `Ya votaste. Cuando ${nombrePareja} vote, verán el resultado juntos.`
              : (d.pareja.voto ? `${nombrePareja} ya votó. Vota tú para ver el resultado.` : 'Vota en privado: el otro no ve tu voto.')}
          </div>
          <div role="radiogroup" aria-label={d.pregunta} style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {d.opciones.map(o => {
              const marcada = (elegida ?? miVoto) === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={marcada}
                  className={marcada ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setElegida(o.id)}
                  style={{ justifyContent: 'flex-start', textAlign: 'left', minHeight: 40 }}
                >
                  {o.texto}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: '0.8rem' }}>
            <button
              type="button"
              className="btn-primary"
              disabled={trabajando || elegida === null || elegida === miVoto}
              onClick={() => elegida && void ejecutar(() => votarDecision(d.id, elegida))}
            >
              {trabajando ? 'Guardando...' : d.yo ? 'Cambiar mi voto' : 'Guardar mi voto'}
            </button>
            {d.yo && (
              <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', ...muted }}>
                Puedes cambiarlo hasta que {nombrePareja} vote.
              </div>
            )}
          </div>
        </>
      )}

      {!votando && d.yo && d.pareja.opcion !== undefined && (
        <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem' }}>
          <div><span aria-hidden="true" style={{ color: COLOR_YO }}>●</span> Tú: <strong>{textoOpcion(d, d.yo.opcion)}</strong></div>
          <div><span aria-hidden="true" style={{ color: COLOR_PAREJA }}>●</span> {nombrePareja}: <strong>{textoOpcion(d, d.pareja.opcion)}</strong></div>
        </div>
      )}

      {d.estado === 'hablarlo' && !resolviendo && (
        <div style={{ marginTop: '0.9rem' }}>
          <div style={{ fontSize: '0.85rem' }}>Eligieron distinto. Es un buen momento para hablarlo.</div>
          <button type="button" className="btn-secondary" onClick={() => { setResolviendo(true); setElegida(null); }} style={{ marginTop: '0.6rem' }}>
            Marcar como resuelta
          </button>
        </div>
      )}

      {d.estado === 'hablarlo' && resolviendo && (
        <div style={{ marginTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>¿Qué decidieron al final?</div>
          <div role="radiogroup" aria-label="Decisión final" style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {d.opciones.map(o => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={elegida === o.id}
                className={elegida === o.id ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setElegida(o.id)}
                style={{ justifyContent: 'flex-start', textAlign: 'left', minHeight: 40 }}
              >
                {o.texto}
              </button>
            ))}
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.8rem', ...muted }}>
            Nota (opcional)
            <textarea
              className="form-input"
              rows={2}
              maxLength={limites.maxNota}
              value={nota}
              onChange={e => setNota(e.target.value)}
            />
          </label>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-primary"
              disabled={trabajando || elegida === null}
              onClick={() => elegida && void ejecutar(() => resolverDecision(d.id, elegida, nota))}
            >
              {trabajando ? 'Guardando...' : 'Guardar decisión final'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setResolviendo(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {d.estado === 'resuelta' && d.resolucion && (
        <div style={{ marginTop: '0.9rem', fontSize: '0.85rem' }}>
          <strong style={{ color: 'var(--accent-green)' }}>Resuelta:</strong> {textoOpcion(d, d.resolucion.opcion)}
          {d.resolucion.nota && <div style={{ marginTop: '0.25rem', ...muted }}>{d.resolucion.nota}</div>}
        </div>
      )}

      {d.estado === 'coinciden' && (
        <div style={{ marginTop: '0.9rem', fontSize: '0.85rem' }}>
          <strong style={{ color: 'var(--accent-green)' }}>Coinciden:</strong> los dos eligieron «{textoOpcion(d, d.yo?.opcion)}».
        </div>
      )}

      {fallo && <div role="alert" style={{ marginTop: '0.8rem', fontSize: '0.83rem', color: 'var(--rec-danger, #ef4444)' }}>{fallo}</div>}
    </div>
  );
}
