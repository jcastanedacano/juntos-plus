import { useCallback, useEffect, useState } from 'react';
import { X, Bell, BellOff, Send, AlertTriangle, Check } from 'lucide-react';
import {
  getPushStatus,
  enablePush,
  disablePush,
  sendTestPush,
  type PushStatus,
} from '../../utils/pushNotifications';

interface NotificationSettingsProps {
  onClose: () => void;
}

export function NotificationSettings({ onClose }: NotificationSettingsProps) {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getPushStatus());
    } catch {
      setStatus({ state: 'unconfigured', reason: 'No se pudo leer el estado de las notificaciones.' });
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const run = async (fn: () => Promise<unknown>, okText: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      setMessage({ kind: 'ok', text: okText });
      await refresh();
    } catch (err: any) {
      setMessage({ kind: 'error', text: err?.message || 'Algo salio mal.' });
    } finally {
      setBusy(false);
    }
  };

  const isOn = status?.state === 'on';
  const canToggle = status?.state === 'on' || status?.state === 'off';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2 className="modal-title">Notificaciones</h2>
          <button className="close-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '0 1.25rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Un aviso al dia, a las 9 de la manana, con los cobros que vencen en los
            proximos 3 dias y las suscripciones que subieron de precio.
          </p>

          {status === null ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Consultando…</div>
          ) : canToggle ? (
            <>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.85rem', borderRadius: 12,
                  background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                }}
              >
                {isOn ? <Bell size={18} color="var(--accent-green)" /> : <BellOff size={18} color="var(--text-muted)" />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {isOn ? 'Activadas en este dispositivo' : 'Desactivadas'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {isOn
                      ? 'Se activan por dispositivo: repetilo en el celular si lo queres ahi tambien.'
                      : 'El navegador te va a pedir permiso.'}
                  </div>
                </div>
                <button
                  className={isOn ? 'btn-secondary' : 'btn-primary'}
                  disabled={busy}
                  onClick={() =>
                    isOn
                      ? run(disablePush, 'Notificaciones desactivadas en este dispositivo.')
                      : run(enablePush, 'Listo, notificaciones activadas.')
                  }
                >
                  {isOn ? 'Desactivar' : 'Activar'}
                </button>
              </div>

              {isOn && (
                <button
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const sent = await sendTestPush();
                      if (sent === 0) throw new Error('No se pudo entregar en ningun dispositivo.');
                    }, 'Aviso de prueba enviado.')
                  }
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  <Send size={15} /> Enviar aviso de prueba
                </button>
              )}
            </>
          ) : (
            <div
              style={{
                display: 'flex', gap: '0.65rem', padding: '0.85rem', borderRadius: 12,
                background: 'var(--warning-soft, rgba(245, 158, 11, 0.1))',
                border: '1px solid rgba(245, 158, 11, 0.25)',
              }}
            >
              <AlertTriangle size={18} color="var(--warning)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {status.reason || 'Las notificaciones no estan disponibles.'}
              </div>
            </div>
          )}

          {message && (
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                fontSize: '0.82rem',
                color: message.kind === 'ok' ? 'var(--accent-green)' : 'var(--danger, #ef4444)',
              }}
            >
              {message.kind === 'ok' ? <Check size={15} /> : <AlertTriangle size={15} />}
              {message.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
