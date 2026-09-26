import { useCallback, useEffect, useMemo, useState } from 'react';
import { Minus, Plus, HeartHandshake } from 'lucide-react';
import { useOwnerLabels } from '../../utils/ownerLabels';
import { useMyOwnerRole } from '../../utils/userIdentity';
import { localeActual } from '../../utils/fxTasas';
import {
  consultarCuestionario, responderCuestionario, explicarCuestionario,
  VistaCuestionario, CategoriaCuestionario,
} from '../../utils/cuestionario';
import {
  Puntos, PASO, TOTAL_PUNTOS, ajustar, restantes, sumar, vacio, repartirParejo,
  solapamiento, nivelDeAlineacion, diferencias, paraConversar, cambios, evolucion,
} from '../../utils/alineacion';

const card: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: 14,
  padding: '1.1rem',
};
const muted: React.CSSProperties = { color: 'var(--text-muted)' };

const COLOR_YO = 'var(--accent-blue, #3b82f6)';
const COLOR_PAREJA = 'var(--accent-pink, #ec4899)';

const num = (n: number) => n.toLocaleString(localeActual(), { maximumFractionDigits: 0 });
const con = (n: number) => (n > 0 ? `+${num(n)}` : num(n));

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'error'; codigo: string }
  | { tipo: 'listo'; vista: VistaCuestionario };

/**
 * Cuestionario de alineacion: cada persona reparte 100 puntos entre lo que le
 * importa y, cuando las dos terminan, se ven juntas las respuestas. Una vez al
 * año hay una ronda nueva y se compara con la anterior.
 *
 * Lo que respondio la otra persona NO llega a esta pantalla hasta entonces: lo
 * decide el servidor, no esta vista.
 */
export function AlignmentView() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState<Puntos>({});
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const etiquetas = useOwnerLabels();
  const miRol = useMyOwnerRole();
  // «Tu» para uno mismo, y el nombre que le pusieron a la otra persona. Los
  // nombres se guardan por dispositivo: llamarse «Pareja» a uno mismo desde el
  // dispositivo de la otra persona confundiria.
  const nombrePareja = etiquetas[miRol === 'me' ? 'partner' : 'me'];

  const cargar = useCallback(async () => {
    setEstado({ tipo: 'cargando' });
    const r = await consultarCuestionario();
    setEstado(r.ok ? { tipo: 'listo', vista: r.vista } : { tipo: 'error', codigo: r.codigo });
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const vista = estado.tipo === 'listo' ? estado.vista : null;
  const ids = useMemo(() => (vista ? vista.categorias.map(c => c.id) : []), [vista]);

  // Sin respuesta propia se responde; con ella se espera o se ven resultados.
  const respondiendo = vista !== null && (vista.yo === null || editando);

  // Al entrar al formulario se parte de lo ultimo que la persona respondio:
  // lo suyo de este año si edita, o lo del año pasado si empieza una ronda.
  useEffect(() => {
    if (!vista || !respondiendo) return;
    setBorrador(vista.yo ? vista.yo.puntos : vista.previa ? vista.previa.yo : vacio(ids));
    setFallo(null);
  }, [respondiendo, vista, ids]);

  const guardar = async () => {
    setGuardando(true);
    setFallo(null);
    const r = await responderCuestionario(borrador);
    setGuardando(false);
    if (!r.ok) {
      setFallo(explicarCuestionario(r.codigo));
      return;
    }
    setEditando(false);
    setEstado({ tipo: 'listo', vista: r.vista });
  };

  if (estado.tipo === 'cargando') {
    return <div style={{ ...card, ...muted }} role="status">Cargando el cuestionario...</div>;
  }

  if (estado.tipo === 'error') {
    return (
      <div style={card} role="alert">
        <div style={{ fontWeight: 600 }}>No pudimos cargar el cuestionario</div>
        <div style={{ marginTop: '0.3rem', fontSize: '0.85rem', ...muted }}>{explicarCuestionario(estado.codigo)}</div>
        <button className="btn-primary" onClick={() => void cargar()} style={{ marginTop: '0.8rem' }}>Reintentar</button>
      </div>
    );
  }

  const v = estado.vista;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={card}>
        <h2 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <HeartHandshake size={18} aria-hidden="true" /> Alineación {v.ronda}
        </h2>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', ...muted }}>
          Cada uno reparte {TOTAL_PUNTOS} puntos entre lo que más le importa este año. Los resultados se ven
          juntos cuando los dos terminan: nadie ve lo del otro antes de responder.
        </p>
      </div>

      {respondiendo ? (
        <Formulario
          categorias={v.categorias}
          borrador={borrador}
          setBorrador={setBorrador}
          previa={v.previa ? v.previa.ronda : null}
          guardando={guardando}
          fallo={fallo}
          puedeCancelar={v.yo !== null}
          onGuardar={() => void guardar()}
          onCancelar={() => setEditando(false)}
        />
      ) : v.completa && v.yo && v.pareja.puntos ? (
        <Resultados vista={v} yo={v.yo.puntos} pareja={v.pareja.puntos} nombrePareja={nombrePareja} />
      ) : (
        <Espera vista={v} nombrePareja={nombrePareja} onEditar={() => setEditando(true)} />
      )}
    </div>
  );
}

// ─── Formulario ──────────────────────────────────────────────────────

function Formulario({
  categorias, borrador, setBorrador, previa, guardando, fallo, puedeCancelar, onGuardar, onCancelar,
}: {
  categorias: CategoriaCuestionario[];
  borrador: Puntos;
  setBorrador: (p: Puntos) => void;
  previa: string | null;
  guardando: boolean;
  fallo: string | null;
  puedeCancelar: boolean;
  onGuardar: () => void;
  onCancelar: () => void;
}) {
  const ids = categorias.map(c => c.id);
  const quedan = restantes(borrador);
  const listo = quedan === 0;

  return (
    <div style={card}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        {categorias.map(c => {
          const valor = borrador[c.id] || 0;
          return (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{c.nombre}</div>
                <div style={{ fontSize: '0.75rem', ...muted }}>{c.descripcion}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Quitar ${PASO} puntos a ${c.nombre}`}
                  disabled={valor <= 0}
                  onClick={() => setBorrador(ajustar(borrador, c.id, valor - PASO))}
                  style={{ minWidth: 36, minHeight: 36 }}
                >
                  <Minus size={15} />
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={TOTAL_PUNTOS}
                  step={1}
                  aria-label={`Puntos para ${c.nombre}`}
                  value={valor}
                  onChange={e => setBorrador(ajustar(borrador, c.id, e.target.valueAsNumber))}
                  className="form-input"
                  style={{ width: 64, minHeight: 36, textAlign: 'center' }}
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Agregar ${PASO} puntos a ${c.nombre}`}
                  disabled={quedan <= 0}
                  onClick={() => setBorrador(ajustar(borrador, c.id, valor + PASO))}
                  style={{ minWidth: 36, minHeight: 36 }}
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: '1.1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }} role="status" aria-live="polite">
          <span style={muted}>Repartidos {sumar(borrador)} de {TOTAL_PUNTOS}</span>
          <strong style={{ color: listo ? 'var(--accent-green)' : 'var(--text-primary)' }}>
            {listo ? 'Listo' : `Te quedan ${quedan}`}
          </strong>
        </div>
        <div
          role="progressbar"
          aria-label="Puntos repartidos"
          aria-valuemin={0}
          aria-valuemax={TOTAL_PUNTOS}
          aria-valuenow={sumar(borrador)}
          style={{ marginTop: '0.35rem', height: 8, borderRadius: 999, background: 'var(--border-color)', overflow: 'hidden' }}
        >
          <div style={{ width: `${Math.min(100, sumar(borrador))}%`, height: '100%', background: listo ? 'var(--accent-green)' : COLOR_YO, transition: 'width 0.3s ease' }} />
        </div>
      </div>

      {previa && (
        <div style={{ marginTop: '0.8rem', fontSize: '0.78rem', ...muted }}>
          Partimos de lo que respondiste en {previa}. Cámbialo si algo se movió.
        </div>
      )}

      {fallo && (
        <div role="alert" style={{ marginTop: '0.8rem', fontSize: '0.83rem', color: 'var(--rec-danger, #ef4444)' }}>{fallo}</div>
      )}

      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn-primary" disabled={!listo || guardando} onClick={onGuardar}>
          {guardando ? 'Guardando...' : 'Guardar mis respuestas'}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setBorrador(repartirParejo(ids))}>
          Repartir parejo
        </button>
        {puedeCancelar && (
          <button type="button" className="btn-secondary" onClick={onCancelar}>Cancelar</button>
        )}
      </div>
    </div>
  );
}

// ─── Espera ──────────────────────────────────────────────────────────

function Espera({ vista, nombrePareja, onEditar }: { vista: VistaCuestionario; nombrePareja: string; onEditar: () => void }) {
  const yo = vista.yo!.puntos;
  const mayores = vista.categorias
    .map(c => ({ ...c, puntos: yo[c.id] || 0 }))
    .filter(c => c.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos);

  return (
    <div style={card}>
      <div style={{ fontWeight: 600 }}>Ya respondiste</div>
      <div style={{ marginTop: '0.3rem', fontSize: '0.85rem', ...muted }}>
        {vista.miembros < 2
          ? 'Para ver los resultados falta tu pareja: invítala desde «Pareja» y que responda.'
          : vista.pareja.respondio
            ? 'Las dos respuestas están listas.'
            : `Cuando ${nombrePareja} responda, verán los resultados juntos.`}
      </div>

      <div style={{ marginTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        {mayores.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.83rem' }}>
            <span style={{ flex: 1, minWidth: 0 }}>{c.nombre}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{num(c.puntos)}</span>
          </div>
        ))}
      </div>

      <button type="button" className="btn-secondary" onClick={onEditar} style={{ marginTop: '1rem' }}>
        Cambiar mis respuestas
      </button>
      <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', ...muted }}>
        Puedes cambiarlas hasta que {nombrePareja} responda.
      </div>
    </div>
  );
}

// ─── Resultados ──────────────────────────────────────────────────────

const LECTURA: Record<'alta' | 'media' | 'baja', string> = {
  alta: 'Van muy alineados: lo que quieren es en gran parte lo mismo.',
  media: 'Hay bastante en común, y algunas diferencias que conviene hablar.',
  baja: 'Ven las prioridades de forma distinta. Es un buen momento para conversarlo.',
};

function Resultados({
  vista, yo, pareja, nombrePareja,
}: { vista: VistaCuestionario; yo: Puntos; pareja: Puntos; nombrePareja: string }) {
  const ids = vista.categorias.map(c => c.id);
  const nombreDe = (id: string) => vista.categorias.find(c => c.id === id)?.nombre || id;

  const pct = solapamiento(yo, pareja, ids);
  const difs = diferencias(yo, pareja, ids);
  const hablar = paraConversar(difs);
  const previa = vista.previa;
  const antes = previa ? solapamiento(previa.yo, previa.pareja, ids) : null;
  const mios = previa ? cambios(previa.yo, yo, ids).slice(0, 3) : [];
  const escala = Math.max(1, ...difs.flatMap(d => [d.yo, d.pareja]));

  return (
    <>
      <div style={card}>
        <div style={{ fontSize: '0.78rem', ...muted }}>Coinciden en</div>
        <div style={{ fontSize: '2.2rem', fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{num(pct)}%</div>
        <div style={{ marginTop: '0.4rem', fontSize: '0.85rem' }}>{LECTURA[nivelDeAlineacion(pct)]}</div>
        {previa && antes !== null && (
          <div style={{ marginTop: '0.6rem', fontSize: '0.8rem', ...muted }}>
            En {previa.ronda} coincidían en {num(antes)}%: {evolucion(previa, pct, ids) === 0
              ? 'igual que ahora.'
              : `ahora ${con(evolucion(previa, pct, ids))} puntos.`}
          </div>
        )}
      </div>

      {hablar.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>Para conversar</div>
          <div style={{ marginTop: '0.2rem', fontSize: '0.78rem', ...muted }}>Donde más se separan sus prioridades.</div>
          <ul style={{ margin: '0.7rem 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {hablar.map(d => (
              <li key={d.id} style={{ fontSize: '0.85rem' }}>
                <strong>{nombreDe(d.id)}</strong>
                <span style={muted}>: tú {num(d.yo)}, {nombrePareja} {num(d.pareja)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={card}>
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', flexWrap: 'wrap' }}>
          <span><span aria-hidden="true" style={{ color: COLOR_YO }}>●</span> Tú</span>
          <span><span aria-hidden="true" style={{ color: COLOR_PAREJA }}>●</span> {nombrePareja}</span>
        </div>
        <div style={{ marginTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
          {difs.map(d => (
            <div key={d.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 600 }}>{nombreDe(d.id)}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', ...muted }}>
                  {d.distancia === 0 ? 'Igual' : `${num(d.distancia)} de diferencia`}
                </span>
              </div>
              <Barra valor={d.yo} escala={escala} color={COLOR_YO} etiqueta={`Tú: ${num(d.yo)} puntos en ${nombreDe(d.id)}`} />
              <Barra valor={d.pareja} escala={escala} color={COLOR_PAREJA} etiqueta={`${nombrePareja}: ${num(d.pareja)} puntos en ${nombreDe(d.id)}`} />
            </div>
          ))}
        </div>
      </div>

      {previa && mios.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>Lo que cambió en ti desde {previa.ronda}</div>
          <ul style={{ margin: '0.6rem 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem' }}>
            {mios.map(c => (
              <li key={c.id}>
                <strong>{nombreDe(c.id)}</strong>
                <span style={muted}> {con(c.delta)} (de {num(c.antes)} a {num(c.ahora)})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ fontSize: '0.75rem', ...muted }}>
        La ronda de {vista.ronda} quedó cerrada. El año que viene se abre una nueva y se compara con esta.
      </div>
    </>
  );
}

function Barra({ valor, escala, color, etiqueta }: { valor: number; escala: number; color: string; etiqueta: string }) {
  return (
    <div
      role="img"
      aria-label={etiqueta}
      style={{ marginTop: '0.3rem', height: 8, borderRadius: 999, background: 'var(--border-color)', overflow: 'hidden' }}
    >
      <div style={{ width: `${(valor / escala) * 100}%`, height: '100%', background: color, borderRadius: 999 }} />
    </div>
  );
}
