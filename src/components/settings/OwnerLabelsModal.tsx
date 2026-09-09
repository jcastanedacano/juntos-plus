import { useState, FormEvent, useEffect } from 'react';
import { X, RotateCcw, Send, Check } from 'lucide-react';
import { DEFAULT_OWNER_LABELS, getOwnerLabels, setOwnerLabels } from '../../utils/ownerLabels';
import { DEFAULT_FX_RATES, getFxRates, setFxRates, getFxMeta, clearFxOverride, getMonedaBase, simboloDe, relativas } from '../../utils/fx';
import { getCurrentUserEmail, setUserEmailMap } from '../../utils/userIdentity';
import { consultarHogar, invitarAlHogar, cambiarMonedaHogar, explicar, EstadoHogar, MONEDAS } from '../../utils/hogar';

interface OwnerLabelsModalProps {
  onClose: () => void;
  /** Seccion a la que abrir: la fila de Ajustes que lo invoca ya dice cual. */
  foco?: 'pareja' | 'cambio' | 'moneda';
}

export function OwnerLabelsModal({ onClose , foco}: OwnerLabelsModalProps) {
  const initial = getOwnerLabels();
  // Las tasas se enseñan y se editan EN LA MONEDA DEL HOGAR. Un hogar en euros
  // no quiere leer «USD -> PEN»: quiere saber cuantos euros vale un dolar.
  const base = getMonedaBase();
  const simboloBase = simboloDe(base);
  const otras = MONEDAS.filter(m => m.codigo !== base);
  const porDefecto = relativas(DEFAULT_FX_RATES, base);
  // Derivar entre monedas saca colas de quince decimales. Nadie edita eso, y
  // cuatro cifras bastan: al guardar se vuelve a anclar a soles igual.
  const conPocosDecimales = (n: number) => String(Number(n.toFixed(4)));
  const initialFx = getFxRates();
  const [shared, setShared] = useState(initial.shared);
  const [me, setMe] = useState(initial.me);
  const [partner, setPartner] = useState(initial.partner);
  const [tasas, setTasas] = useState<Record<string, string>>(() => ({
    PEN: conPocosDecimales(initialFx.PEN),
    USD: conPocosDecimales(initialFx.USD),
    EUR: conPocosDecimales(initialFx.EUR),
  }));
  const [fxMeta, setFxMeta] = useState(getFxMeta());
  const [fxBusy, setFxBusy] = useState(false);
  const [hogar, setHogar] = useState<EstadoHogar | null>(null);
  const [invitado, setInvitado] = useState('');
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Seleccion pendiente de confirmar: un clic no cambia nada por si solo,
  // porque esto reescribe datos financieros reales y recarga la aplicacion.
  const [monedaElegida, setMonedaElegida] = useState<string | null>(null);
  const [monedaBusy, setMonedaBusy] = useState(false);
  const [avisoMoneda, setAvisoMoneda] = useState<string | null>(null);

  // Quien esta dentro lo dice el servidor, no el navegador: es el token el que
  // trae el correo, y el mapa de identidades depende de acertarlo.
  useEffect(() => {
    let vigente = true;
    consultarHogar().then(e => {
      if (!vigente) return;
      setHogar(e);
      // El correo de la pareja deja de escribirse a mano: se deduce de quien
      // comparte el hogar. Es lo que reparte los gastos por persona.
      const otro = e.miembros.find(c => c && c !== e.correo);
      if (otro) setUserEmailMap({ partner: otro });
    });
    return () => { vigente = false; };
  }, []);

  const miCorreo = hogar?.correo || getCurrentUserEmail() || null;
  const pareja = hogar ? hogar.miembros.find(c => c && c !== hogar.correo) || null : null;
  const pendiente = hogar?.enviadas[0] || null;

  const invitar = async () => {
    const correo = invitado.trim().toLowerCase();
    if (!correo) return;
    setEnviando(true);
    setAviso(null);
    const r = await invitarAlHogar(correo);
    setEnviando(false);
    if (r.ok) {
      setInvitado('');
      setAviso({ tipo: 'ok', texto: `Invitación enviada a ${correo}. La verá al entrar.` });
      setHogar(await consultarHogar());
    } else {
      setAviso({ tipo: 'error', texto: explicar(r.codigo) });
    }
  };

  useEffect(() => {
    // Abrir directo en la seccion pedida: la fila de Ajustes ya prometio a
    // cual iba, y hacer buscar al usuario lo desmiente.
    if (foco === 'cambio' || foco === 'moneda') {
      const id = foco === 'moneda' ? 'ol-moneda' : 'ol-cambio';
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ block: 'start' });
      });
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, foco]);

  const confirmarMoneda = async () => {
    if (!monedaElegida) return;
    setMonedaBusy(true);
    setAvisoMoneda(null);
    const r = await cambiarMonedaHogar(monedaElegida);
    if (r.ok) {
      // Recarga completa a proposito: la moneda del hogar vive en un modulo
      // que se fija una sola vez al cargar (fijarMonedaBase), y desde aqui no
      // hay forma limpia de propagarla a todo lo que ya la leyo.
      window.location.reload();
      return;
    }
    setMonedaBusy(false);
    setAvisoMoneda(explicar(r.codigo));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setOwnerLabels({
      shared: shared.trim() || DEFAULT_OWNER_LABELS.shared,
      me: me.trim() || DEFAULT_OWNER_LABELS.me,
      partner: partner.trim() || DEFAULT_OWNER_LABELS.partner,
    });
    const nuevas: Record<string, number> = {};
    for (const m of otras) {
      const v = parseFloat(tasas[m.codigo]);
      nuevas[m.codigo] = v > 0 ? v : (porDefecto as Record<string, number>)[m.codigo];
    }
    setFxRates(nuevas);
    onClose();
  };

  const handleReset = () => {
    setShared(DEFAULT_OWNER_LABELS.shared);
    setMe(DEFAULT_OWNER_LABELS.me);
    setPartner(DEFAULT_OWNER_LABELS.partner);
    setTasas({
      PEN: conPocosDecimales(porDefecto.PEN),
      USD: conPocosDecimales(porDefecto.USD),
      EUR: conPocosDecimales(porDefecto.EUR),
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h2 className="modal-title">Pareja · personalizar nombres</h2>
          <button className="close-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
            Sustituye los nombres genéricos por los reales. Aparecerán en los selectores
            de "Pagado por" / "Para quién", en los chips de filtro y en los reportes
            (Compartido vs individual, Recap anual).
          </p>

          <div className="form-group">
            <label className="form-label">Tu nombre</label>
            <input
              type="text"
              className="form-input"
              placeholder={DEFAULT_OWNER_LABELS.me}
              value={me}
              onChange={(e) => setMe(e.target.value)}
              maxLength={20}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Nombre de tu pareja</label>
            <input
              type="text"
              className="form-input"
              placeholder={DEFAULT_OWNER_LABELS.partner}
              value={partner}
              onChange={(e) => setPartner(e.target.value)}
              maxLength={20}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Etiqueta para gastos compartidos</label>
            <input
              type="text"
              className="form-input"
              placeholder={DEFAULT_OWNER_LABELS.shared}
              value={shared}
              onChange={(e) => setShared(e.target.value)}
              maxLength={20}
            />
          </div>

          <div style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: '1px solid var(--border)',
            fontSize: 11.5,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
            fontWeight: 600,
            marginBottom: 10,
          }}>
            Quién comparte este hogar
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
            Las dos personas de un hogar ven exactamente los mismos datos. Lo que
            registre tu pareja se etiqueta como <strong>{partner || DEFAULT_OWNER_LABELS.partner}</strong>{' '}
            en vez de <strong>{me || DEFAULT_OWNER_LABELS.me}</strong>.
          </p>

          <div className="form-group">
            <label className="form-label">Tu correo</label>
            <input
              type="email"
              className="form-input"
              value={miCorreo || 'Cargando…'}
              disabled
              style={{ opacity: 0.6 }}
            />
          </div>

          {pareja ? (
            <div className="form-group">
              <label className="form-label">Tu pareja</label>
              <div className="hogar-miembro">
                <Check size={14} />
                <span>{pareja}</span>
              </div>
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Invitar a tu pareja</label>
              {/* Se invita por correo a quien ya entro alguna vez. Escribir la
                  direccion a mano no unia nada: solo etiquetaba en este
                  navegador, y en el otro telefono no existia. */}
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="email"
                  className="form-input"
                  placeholder="su correo"
                  value={invitado}
                  onChange={(e) => setInvitado(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); invitar(); }
                  }}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={enviando || !invitado.trim()}
                  onClick={invitar}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
                >
                  <Send size={14} /> Invitar
                </button>
              </div>
              {pendiente && !aviso && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                  Invitación pendiente para <strong>{pendiente}</strong>. Se unirá cuando la acepte.
                </p>
              )}
              {aviso && (
                <p style={{
                  fontSize: 12, marginTop: 8, lineHeight: 1.45,
                  color: aviso.tipo === 'ok' ? 'var(--text-secondary)' : '#ff8f8f',
                }}>
                  {aviso.texto}
                </p>
              )}
            </div>
          )}

          <div style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: '1px solid var(--border)',
            fontSize: 11.5,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
            fontWeight: 600,
            marginBottom: 10,
          }}>
            <span id="ol-moneda">Moneda del hogar</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
            En qué moneda apuntáis los gastos. Si se eligió mal al crear el
            hogar, se puede corregir: no convierte ningún importe, marca lo ya
            registrado con la moneda actual antes de cambiar, y esos movimientos
            siguen mostrándose y sumándose bien, como cualquier gasto en otra
            moneda. Los saldos de cuentas y las inversiones no tienen moneda
            propia, así que sí quedan leídos con el símbolo nuevo.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
            {MONEDAS.map(m => {
              const activa = (monedaElegida ?? base) === m.codigo;
              return (
                <button
                  key={m.codigo}
                  type="button"
                  disabled={monedaBusy}
                  aria-pressed={activa}
                  onClick={() => {
                    setAvisoMoneda(null);
                    setMonedaElegida(m.codigo === base ? null : m.codigo);
                  }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    padding: '10px 6px', borderRadius: 10, cursor: monedaBusy ? 'default' : 'pointer',
                    border: `1px solid ${activa ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                    background: activa ? 'rgba(108, 142, 239, 0.12)' : 'transparent',
                    color: activa ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  <span style={{ fontSize: 16, fontWeight: 600 }}>{m.simbolo}</span>
                  <span style={{ fontSize: 11 }}>{m.nombre}</span>
                </button>
              );
            })}
          </div>

          {monedaElegida && monedaElegida !== base && (
            <div style={{
              padding: 12, marginBottom: 12, borderRadius: 10,
              border: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.03)',
            }}>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.5 }}>
                Cambiar de <strong>{simboloDe(base)}</strong> a <strong>{simboloDe(monedaElegida)}</strong>.
                La aplicación se recarga al terminar.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="cancel-btn"
                  disabled={monedaBusy}
                  onClick={() => setMonedaElegida(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="submit-btn"
                  disabled={monedaBusy}
                  onClick={confirmarMoneda}
                >
                  {monedaBusy ? 'Cambiando…' : 'Confirmar cambio'}
                </button>
              </div>
            </div>
          )}

          {avisoMoneda && (
            <p style={{ fontSize: 12, color: '#ff8f8f', marginTop: -4, marginBottom: 12, lineHeight: 1.45 }}>
              {avisoMoneda}
            </p>
          )}

          <div style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: '1px solid var(--border)',
            fontSize: 11.5,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
            fontWeight: 600,
            marginBottom: 10,
          }}>
            <span id="ol-cambio">Tipo de cambio</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
            Cualquier transacción en otra moneda se multiplica por estos valores
            para sumarse en <strong>{simboloBase}</strong> en los KPIs del Dashboard,
            Recap anual y banners.
            La moneda original de cada fila se conserva en la tabla.
          </p>

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 10, marginBottom: 12, fontSize: 12, color: 'var(--text-muted)',
          }}>
            <span>
              {fxMeta.manual
                ? 'Fijado a mano: no se actualiza solo.'
                : fxMeta.updatedAt
                  ? `Automático · actualizado ${new Date(fxMeta.updatedAt).toLocaleString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                  : 'Automático · se actualiza al abrir la app.'}
            </span>
            {fxMeta.manual && (
              <button
                type="button"
                className="btn-secondary"
                disabled={fxBusy}
                onClick={async () => {
                  setFxBusy(true);
                  try {
                    await clearFxOverride();
                    // clearFxOverride devuelve el pivote; lo que se enseña es
                    // la version en la moneda del hogar.
                    const enBase = getFxRates();
                    setTasas({
                      PEN: conPocosDecimales(enBase.PEN),
                      USD: conPocosDecimales(enBase.USD),
                      EUR: conPocosDecimales(enBase.EUR),
                    });
                    setFxMeta(getFxMeta());
                  } finally {
                    setFxBusy(false);
                  }
                }}
                style={{ whiteSpace: 'nowrap' }}
              >
                Volver a automático
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {otras.map(m => (
              <div className="form-group" key={m.codigo}>
                <label className="form-label">{m.codigo} → {simboloBase}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.0001"
                  className="form-input"
                  placeholder={conPocosDecimales((porDefecto as Record<string, number>)[m.codigo])}
                  value={tasas[m.codigo]}
                  onChange={(e) => setTasas({ ...tasas, [m.codigo]: e.target.value })}
                />
              </div>
            ))}
          </div>

          <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
            <button
              type="button"
              className="cancel-btn"
              onClick={handleReset}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <RotateCcw size={14} /> Restaurar default
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="cancel-btn" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="submit-btn">
                Guardar
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
