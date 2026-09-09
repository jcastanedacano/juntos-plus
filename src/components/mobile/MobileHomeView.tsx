import { useMemo, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { RecurringTransaction, Transaction } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { useFxRates, projectToBase, projectRecurringToBase } from '../../utils/fx';
import { parseDateOnly } from '../../utils/stableDate';
import {
  calcularResumenMes, gastoPorDia, mayoresDelMes,
  pendientesDeAsignar, repartoPorPersona, toMonthly, ocultar, nombreCategoria,
  serieRitmo,
} from '../../utils/homeMobile';
import { useOwnerLabels } from '../../utils/ownerLabels';
import type { ViewType } from '../Sidebar';

export type HomeSection = 'resumen' | 'fijos' | 'nosotros';

interface MobileHomeViewProps {
  transactions: Transaction[];
  recurring: RecurringTransaction[];
  currency: string;
  section: HomeSection;
  onSectionChange: (s: HomeSection) => void;
  onGoSubscriptions: () => void;
  onAssignAuthors: () => void;
  onNavigate: (v: ViewType) => void;
  onImport?: () => void;
}

/**
 * Cada seccion enlaza a las vistas que hablan de lo mismo. Antes vivian todas
 * en Ajustes, que las mezclaba con notificaciones y categorias: una meta de
 * ahorro no es una preferencia.
 */
const SALTOS: Record<HomeSection, { label: string; view: ViewType }[]> = {
  resumen: [
    { label: 'Presupuestos', view: 'budgets' },
    { label: 'Metas', view: 'goals' },
    { label: 'Crédito', view: 'credit' },
    { label: 'Recap anual', view: 'recap' },
  ],
  fijos: [
    { label: 'Recurrentes', view: 'recurring' },
    { label: 'Suscripciones', view: 'subscriptions' },
    { label: 'Centro de ahorro', view: 'savings' },
  ],
  nosotros: [
    { label: 'Patrimonio', view: 'networth' },
    { label: 'Movimientos', view: 'transactions' },
  ],
};

const SECCIONES: { id: HomeSection; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'fijos', label: 'Fijos' },
  { id: 'nosotros', label: 'Nosotros' },
];

export function MobileHomeView({
  transactions, recurring, currency, section, onSectionChange,
  onGoSubscriptions, onAssignAuthors, onNavigate, onImport,
}: MobileHomeViewProps) {
  // El handoff pide explicitamente que esto NO se persista: al reabrir la app
  // las cifras se ven.
  const [oculto, setOculto] = useState(false);
  const hoy = useMemo(() => new Date(), []);

  const money = (n: number) => ocultar(formatCurrency(n, currency), oculto);

  // Los calculos de esta pantalla --lo libre, el ritmo, lo mas grande del
  // mes, el reparto por persona-- suman importes de toda la lista y necesitan
  // una sola moneda para que sumar signifique algo. Antes recibian
  // transactions/recurring tal cual llegan del servidor, con la moneda
  // propia de cada fila cuando la trae (por ejemplo, tras corregir la moneda
  // del hogar): un gasto de 50 dolares se sumaba como 50 a secas, mezclado
  // con gastos en soles.
  //
  // Se proyecta UNA vez aqui arriba y se reparte a las tres secciones, igual
  // que ya hace el Dashboard de escritorio con calculateDisponibleReal.
  const fxRates = useFxRates();
  const transactionsBase = useMemo(
    () => projectToBase(transactions, fxRates),
    [transactions, fxRates]
  );
  const recurringBase = useMemo(
    () => projectRecurringToBase(recurring, fxRates),
    [recurring, fxRates]
  );

  return (
    <div className="cl-screen">
      <header className="cl-home-header">
        <h1 className="cl-title" style={{ margin: 0 }}>Inicio</h1>
        <div className="cl-home-header-right">
          <span className="cl-num cl-home-date">
            {format(hoy, "d MMM yyyy", { locale: es })}
          </span>
          <button
            className="cl-icon-btn"
            aria-pressed={oculto}
            aria-label={oculto ? 'Mostrar montos' : 'Ocultar montos'}
            onClick={() => setOculto(v => !v)}
          >
            {oculto ? <EyeOff size={15} strokeWidth={1.5} /> : <Eye size={15} strokeWidth={1.5} />}
          </button>
        </div>
      </header>

      <div
        className="cl-segmented cl-home-segmented"
        role="tablist"
        style={{
          '--cl-seg-total': SECCIONES.length,
          '--cl-seg-activo': SECCIONES.findIndex(s => s.id === section),
        } as React.CSSProperties}
      >
        {SECCIONES.map(s => (
          <button
            key={s.id}
            role="tab"
            aria-selected={section === s.id}
            onClick={() => onSectionChange(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'resumen' && (
        <Resumen
          transactions={transactionsBase}
          recurring={recurringBase}
          hoy={hoy}
          money={money}
          oculto={oculto}
          onImport={onImport}
          onVerFijos={() => onSectionChange('fijos')}
        />
      )}
      {section === 'fijos' && (
        <Fijos recurring={recurringBase} money={money} onGoSubscriptions={onGoSubscriptions} />
      )}
      {section === 'nosotros' && (
        <Nosotros transactions={transactionsBase} money={money} onAssignAuthors={onAssignAuthors} />
      )}

      <div className="cl-kicker cl-section-kicker">Ver también</div>
      <div className="cl-jump">
        {SALTOS[section].map(s => (
          <button key={s.view} onClick={() => onNavigate(s.view)}>{s.label}</button>
        ))}
      </div>
    </div>
  );
}

/* ── Resumen ───────────────────────────────────────────────────────── */

function Resumen({
  transactions, recurring, hoy, money, oculto, onImport, onVerFijos,
}: {
  transactions: Transaction[];
  recurring: RecurringTransaction[];
  hoy: Date;
  money: (n: number) => string;
  oculto: boolean;
  onImport?: () => void;
  onVerFijos: () => void;
}) {
  const r = useMemo(() => calcularResumenMes(transactions, recurring, hoy), [transactions, recurring, hoy]);
  const dias = useMemo(() => gastoPorDia(transactions, hoy), [transactions, hoy]);
  const mayores = useMemo(() => mayoresDelMes(transactions, hoy, 4), [transactions, hoy]);

  // «N× el ritmo» solo dice algo mientras N sea una cifra que se pueda leer.
  // Con poco margen el cociente se dispara --con S/ 20 libres en 24 dias da
  // 1140×-- y deja de informar: por encima de 5× la frase honesta es que el
  // ritmo no se sostiene, no el numero.
  const ritmo = (() => {
    if (r.libre <= 0) return { texto: 'sin margen este mes', alerta: true };
    const v = r.vecesElRitmo;
    if (v === null) return { texto: `${r.diasRestantes} días por delante`, alerta: false };
    if (v > 5) return { texto: 'muy por encima del ritmo', alerta: true };
    if (v > 1) return { texto: `${v.toFixed(1)}× el ritmo`, alerta: true };
    return { texto: 'dentro del ritmo', alerta: false };
  })();

  const mesLabel = format(hoy, 'MMMM', { locale: es });

  // El exceso en soles. «3.2x el ritmo» no dice cuanto hay que recortar, y es
  // lo que decide si vale la pena entrar a mirar los fijos.
  const fijosMensuales = r.fijosMensuales;
  const gastadoQueTocaba =
    ((r.gastoVariable + Math.max(r.libre, 0)) * r.diasTranscurridos) /
    new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  const exceso = Math.round((r.gastoVariable - gastadoQueTocaba) * 100) / 100;

  // Acumulado real frente a la diagonal del gasto parejo.
  //
  // El dominio va de 0 al presupuesto del mes --lo gastado mas lo libre--, y
  // se estira hasta el acumulado cuando este lo supera. Sin eso el acumulado
  // se recortaba en el tope y un mes pasado de gasto se veia igual que uno
  // justo: ahora la linea real cruza por encima de la punteada, que es lo que
  // hay que ver de un vistazo.
  const presupuesto = Math.max(r.gastoVariable + Math.max(r.libre, 0), 1);
  // El dominio deja 4 unidades de margen arriba y abajo. Sin eso, un mes
  // gastado el dia 1 dibuja la linea pegada al borde superior y la mitad del
  // trazo queda cortada: parecia un filete decorativo, no un dato.
  const TOPE = 4;
  const BASE = 36;
  const serie = useMemo(
    () => serieRitmo(dias, presupuesto, r.diasTranscurridos, TOPE, BASE),
    [dias, presupuesto, r.diasTranscurridos]
  );
  // Poligono del area bajo la linea real: la propia serie, y de vuelta por la
  // linea base hasta el origen. Con un solo dia transcurrido sale de ancho
  // cero y no se ve, que es justo lo que corresponde.
  const areaRitmo = `${serie.puntos} ${serie.xHoy.toFixed(2)},${BASE} 0,${BASE}`;

  const acumuladoHoy = dias
    .slice(0, r.diasTranscurridos)
    .reduce((a, d) => a + d.total, 0);
  const referenciaHoy = (presupuesto * r.diasTranscurridos) / dias.length;

  return (
    <>
      {/* Libre y Gastado pesaban igual --mismo tamanio, mismo color-- y el dato
          que decide es Libre. Ahora Libre ocupa el ancho completo con la cifra
          grande y color de estado; Gastado queda como contexto de una linea. */}
      <div className={`cl-hero ${r.libre <= 0 ? 'alerta' : ''}`}>
        <div className="cl-kicker">Libre</div>
        <div className="cl-amount is-l cl-hero-value">{money(r.libre)}</div>
        <div className="cl-meta">
          para los {r.diasRestantes} días que quedan
          {r.libre > 0 && r.diasRestantes > 0 && ` · ${money(r.ritmoSostenible)} por día`}
        </div>
      </div>

      <div className="cl-subline">
        <span className="cl-meta">Gastado este mes</span>
        <span className="cl-amount">{money(r.gastoVariable)}</span>
      </div>
      <div className={`cl-meta ${ritmo.alerta ? 'cl-alerta' : ''}`}>{ritmo.texto}</div>

      {/* Resumen solo informaba: cifras, grafico y atajos, y ninguna salida.
          La frase que nombra el problema con el boton que lo cierra ya estaba
          resuelta en Nosotros; esto la trae a la pantalla que se abre primero.
          Los fijos son donde de verdad se recorta, no los gastos del dia. */}
      {ritmo.alerta && exceso > 0 && (
        <div className="cl-card cl-insight">
          <p className="cl-insight-text">
            Vas <strong>{money(exceso)}</strong> por encima de lo que tocaba a
            estas alturas del mes.
            {fijosMensuales > 0 && ' Los cargos fijos son donde más se recorta.'}
          </p>
          <button className="cl-btn" onClick={onVerFijos}>Revisar tus fijos</button>
        </div>
      )}

      {/* Barras por dia no dicen nada cuando el gasto se concentra en una
          fecha: queda un pico y 29 dias de linea plana. El acumulado contra
          el ritmo sostenible si responde «voy adelantado o no». */}
      <div className="cl-kicker cl-section-kicker">Ritmo de {mesLabel}</div>
      <svg className="cl-trend" viewBox="0 0 100 40" preserveAspectRatio="none"
           role="img" aria-label={`Gasto acumulado de ${mesLabel} contra el ritmo sostenible`}>
        <line x1="0" y1="36" x2="100" y2="36" className="cl-trend-base" vectorEffect="non-scaling-stroke" />
        {/* Referencia: si gastaras parejo todo el mes. Termina en la altura
            del presupuesto, que solo coincide con el tope cuando no te has
            pasado. */}
        <line
          x1="0" y1={BASE} x2="100" y2={serie.yPresupuesto}
          className="cl-trend-ref" vectorEffect="non-scaling-stroke"
        />
        {/* Hoy. Sin esta marca no se sabe donde termina lo ocurrido y
            «vas por delante del ritmo» no tiene contra que leerse. */}
        <line
          x1={serie.xHoy} y1={TOPE - 2} x2={serie.xHoy} y2={BASE}
          className="cl-trend-hoy" vectorEffect="non-scaling-stroke"
        />
        {/* El area bajo la curva va ANTES del trazo para que la linea quede
            por encima del tinte y no se lea difuminada. */}
        <polygon points={areaRitmo} className="cl-trend-area" />
        <polyline points={serie.puntos} className="cl-trend-real" vectorEffect="non-scaling-stroke" />
      </svg>
      {/* La escala es del grafico: va pegada a el. La leyenda explica que es
          cada trazo y puede ir despues. Al reves se leia «1 sep / 30» como si
          fuera parte de la leyenda. */}
      <div className="cl-chart-axis">
        <span className="cl-num">1 {mesLabel.slice(0, 3)}</span>
        <span className="cl-num">{dias.length}</span>
      </div>
      {/* Sin leyenda, dos lineas sin nombre no son un grafico. */}
      <div className="cl-trend-legend">
        <span><i className="cl-swatch real" /> lo que llevas</span>
        <span><i className="cl-swatch ref" /> ritmo parejo</span>
        <span><i className="cl-swatch hoy" /> hoy</span>
      </div>

      <div className="cl-kicker cl-section-kicker">Lo más grande del mes</div>
      {mayores.length === 0 ? (
        /* Una frase suelta dejaba el resto de la pantalla en blanco sin decir
           que hacer con ella. */
        <div className="cl-empty">
          <h2 className="cl-title cl-empty-title">Este mes todavía está en blanco</h2>
          <p className="cl-empty-body">
            Importá el estado de tu banco y quedan cargados de una vez, o
            registrá uno con el botón de la barra.
          </p>
          {onImport && (
            <button className="cl-btn" onClick={onImport}>Importar estado del banco</button>
          )}
        </div>
      ) : (
        mayores.map(t => (
          <div className="cl-row" key={t.id}>
            <div className="cl-row-main">
              <div className="cl-row-name">{t.description}</div>
              <div className="cl-meta">
                {format(parseDateOnly(t.date), "d MMM", { locale: es })} · {nombreCategoria(t.category)}
              </div>
            </div>
            <div className="cl-amount">{money(t.amount)}</div>
          </div>
        ))
      )}
    </>
  );
}

/* ── Fijos ─────────────────────────────────────────────────────────── */

function Fijos({
  recurring, money, onGoSubscriptions,
}: {
  recurring: RecurringTransaction[];
  money: (n: number) => string;
  onGoSubscriptions: () => void;
}) {
  const fijos = useMemo(
    () => recurring
      .filter(r => r.isActive && r.type === 'expense')
      .map(r => ({ r, mensual: toMonthly(r) }))
      .sort((a, b) => b.mensual - a.mensual),
    [recurring]
  );
  const total = fijos.reduce((s, f) => s + f.mensual, 0);
  const ingreso = recurring
    .filter(r => r.isActive && r.type === 'income')
    .reduce((s, r) => s + toMonthly(r), 0);
  const pct = ingreso > 0 ? Math.round((total / ingreso) * 100) : 0;

  const subs = fijos.filter(f => f.r.category === 'subscriptions');
  const totalSubs = subs.reduce((s, f) => s + f.mensual, 0);

  return (
    <>
      <div className="cl-section-head cl-rule-strong">
        <div>
          <div className="cl-kicker">{fijos.length} gastos fijos</div>
          <div className="cl-amount is-m" style={{ marginTop: 4 }}>{money(total)}</div>
        </div>
        {ingreso > 0 && <div className="cl-meta">{pct}% del ingreso</div>}
      </div>

      {fijos.length === 0 ? (
        <p className="cl-meta" style={{ marginTop: 16 }}>Todavía no hay gastos fijos registrados.</p>
      ) : (
        fijos.map(({ r, mensual }) => (
          <div className="cl-row" key={r.id}>
            <div className="cl-row-main">
              <div className="cl-row-name">{r.description}</div>
              <div className="cl-meta">
                día {parseDateOnly(String(r.nextDate).slice(0, 10)).getDate()} · {nombreCategoria(r.category)}
              </div>
            </div>
            <div className="cl-amount">{money(mensual)}</div>
          </div>
        ))
      )}

      {subs.length > 0 && (
        <div className="cl-card cl-insight">
          <p className="cl-insight-text">
            {subs.length === 1 ? 'Una suscripción se cobra sola' : `${subs.length} suscripciones se cobran solas`}
            : <strong>{money(totalSubs)}</strong> al mes. Al año son{' '}
            <strong>{money(totalSubs * 12)}</strong>
            {total > 0 && totalSubs > 0
              ? `, ${(totalSubs * 12 / total).toFixed(1)} veces lo que pagas de fijos en un mes.`
              : '.'}
          </p>
          <button className="cl-btn" onClick={onGoSubscriptions}>Revisar suscripciones</button>
        </div>
      )}
    </>
  );
}

/* ── Nosotros ──────────────────────────────────────────────────────── */

function Nosotros({
  transactions, money, onAssignAuthors,
}: {
  transactions: Transaction[];
  money: (n: number) => string;
  onAssignAuthors: () => void;
}) {
  const labels = useOwnerLabels();
  const reparto = useMemo(() => repartoPorPersona(transactions), [transactions]);
  const pendientes = useMemo(() => pendientesDeAsignar(transactions, 12), [transactions]);
  const sinAsignar = reparto.asignados === 0;

  const personas = [
    { id: 'me', nombre: labels.me, monto: reparto.me },
    { id: 'partner', nombre: labels.partner, monto: reparto.partner },
  ];

  const cubren = reparto.total > 0
    ? Math.round((pendientes.reduce((s, t) => s + t.amount, 0) / reparto.total) * 100)
    : 0;

  return (
    <>
      <div className="cl-persons">
        {personas.map(p => (
          <div className="cl-card cl-person" key={p.id}>
            <div className="cl-person-avatar cl-num">{p.nombre.charAt(0).toUpperCase()}</div>
            <div className="cl-person-name">{p.nombre}</div>
            <div className="cl-amount is-m cl-person-amount">
              {sinAsignar ? <span className="cl-person-vacio">—</span> : money(p.monto)}
            </div>
          </div>
        ))}
      </div>

      {sinAsignar ? (
        <div className="cl-empty">
          <h2 className="cl-title cl-empty-title">Todavía no sabemos quién pagó qué</h2>
          <p className="cl-empty-body">
            Los {transactions.length} movimientos llegaron sin nombre.
            {pendientes.length > 0 && cubren > 0 && (
              <> Los {pendientes.length} más grandes explican el {cubren}% del gasto: asígnalos una vez y la vista queda viva para siempre.</>
            )}
          </p>
          {pendientes.length > 0 && (
            <button className="cl-btn" onClick={onAssignAuthors}>
              Asignar {pendientes.length} movimientos
            </button>
          )}
        </div>
      ) : (
        pendientes.length > 0 && (
          <div className="cl-card cl-insight">
            <p className="cl-insight-text">
              Quedan <strong>{pendientes.length}</strong> movimientos sin autor.
            </p>
            <button className="cl-btn" onClick={onAssignAuthors}>Asignar pendientes</button>
          </div>
        )
      )}

      {sinAsignar && pendientes.length > 0 && (
        <>
          <div className="cl-kicker cl-section-kicker">Cómo quedaría</div>
          <div className="cl-preview">
            {pendientes.slice(0, 3).map((t, i) => (
              <div className="cl-row" key={t.id}>
                <span className="cl-preview-initial cl-num">
                  {(i % 2 === 0 ? labels.me : labels.partner).charAt(0).toUpperCase()}
                </span>
                <div className="cl-row-main">
                  <div className="cl-row-name">{t.description}</div>
                </div>
                <div className="cl-amount">{money(t.amount)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
