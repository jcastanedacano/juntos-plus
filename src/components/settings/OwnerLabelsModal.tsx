import { useState, FormEvent, useEffect } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { DEFAULT_OWNER_LABELS, getOwnerLabels, setOwnerLabels } from '../../utils/ownerLabels';
import { DEFAULT_FX_RATES, getFxRates, setFxRates, getFxMeta, clearFxOverride } from '../../utils/fx';
import { getCurrentUserEmail, getUserEmailMap, setUserEmailMap } from '../../utils/userIdentity';

interface OwnerLabelsModalProps {
  onClose: () => void;
  /** Seccion a la que abrir: la fila de Ajustes que lo invoca ya dice cual. */
  foco?: 'pareja' | 'cambio';
}

export function OwnerLabelsModal({ onClose , foco}: OwnerLabelsModalProps) {
  const initial = getOwnerLabels();
  const initialFx = getFxRates();
  const initialMap = getUserEmailMap();
  const currentEmail = getCurrentUserEmail();
  const [shared, setShared] = useState(initial.shared);
  const [me, setMe] = useState(initial.me);
  const [partner, setPartner] = useState(initial.partner);
  const [usdRate, setUsdRate] = useState(String(initialFx.USD));
  const [eurRate, setEurRate] = useState(String(initialFx.EUR));
  const [partnerEmail, setPartnerEmail] = useState(initialMap.partner ?? '');
  const [fxMeta, setFxMeta] = useState(getFxMeta());
  const [fxBusy, setFxBusy] = useState(false);

  useEffect(() => {
    // Abrir directo en la seccion pedida: la fila de Ajustes ya prometio a
    // cual iba, y hacer buscar al usuario lo desmiente.
    if (foco === 'cambio') {
      requestAnimationFrame(() => {
        document.getElementById('ol-cambio')?.scrollIntoView({ block: 'start' });
      });
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setOwnerLabels({
      shared: shared.trim() || DEFAULT_OWNER_LABELS.shared,
      me: me.trim() || DEFAULT_OWNER_LABELS.me,
      partner: partner.trim() || DEFAULT_OWNER_LABELS.partner,
    });
    const parsedUsd = parseFloat(usdRate);
    const parsedEur = parseFloat(eurRate);
    setFxRates({
      USD: parsedUsd > 0 ? parsedUsd : DEFAULT_FX_RATES.USD,
      EUR: parsedEur > 0 ? parsedEur : DEFAULT_FX_RATES.EUR,
    });
    setUserEmailMap({
      partner: partnerEmail.trim().toLowerCase() || undefined,
    });
    onClose();
  };

  const handleReset = () => {
    setShared(DEFAULT_OWNER_LABELS.shared);
    setMe(DEFAULT_OWNER_LABELS.me);
    setPartner(DEFAULT_OWNER_LABELS.partner);
    setUsdRate(String(DEFAULT_FX_RATES.USD));
    setEurRate(String(DEFAULT_FX_RATES.EUR));
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
            Sesión multi-usuario
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
            Cuando tu pareja entra con su correo, las cuentas creadas, transacciones
            importadas y ajustes se tagueean como <strong>{partner || DEFAULT_OWNER_LABELS.partner}</strong>{' '}
            en vez de <strong>{me || DEFAULT_OWNER_LABELS.me}</strong>.
          </p>

          <div className="form-group">
            <label className="form-label">
              Tu correo (sesión actual)
            </label>
            <input
              type="email"
              className="form-input"
              value={currentEmail || '(no detectado)'}
              disabled
              style={{ opacity: 0.6 }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Correo de tu pareja</label>
            <input
              type="email"
              className="form-input"
              placeholder="ej. me@zumyalvarez.com"
              value={partnerEmail}
              onChange={(e) => setPartnerEmail(e.target.value)}
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
            <span id="ol-cambio">Tipo de cambio</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
            Cualquier transacción en USD o EUR se multiplica por estos valores
            para sumarse en los KPIs del Dashboard, Recap anual y banners.
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
                    const next = await clearFxOverride();
                    setUsdRate(String(next.USD));
                    setEurRate(String(next.EUR));
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
            <div className="form-group">
              <label className="form-label">USD → PEN</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="form-input"
                placeholder={String(DEFAULT_FX_RATES.USD)}
                value={usdRate}
                onChange={(e) => setUsdRate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">EUR → PEN</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="form-input"
                placeholder={String(DEFAULT_FX_RATES.EUR)}
                value={eurRate}
                onChange={(e) => setEurRate(e.target.value)}
              />
            </div>
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
