import { useState } from 'react';
import { Shield, Trash2, Eye, FileText, CheckCircle } from 'lucide-react';
import { getPrivacyLogs, clearPrivacyLogs } from '../../utils/privacyManager';
import { PrivacyLog } from '../../types';

export function PrivacySettings() {
  const [logs, setLogs] = useState<PrivacyLog[]>(() => getPrivacyLogs());
  const [showLogs, setShowLogs] = useState(false);

  const handleClearLogs = () => {
    clearPrivacyLogs();
    setLogs([]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '700px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Shield size={24} style={{ color: 'var(--success)' }} />
        <div>
          <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>
            Privacidad y Datos
          </h2>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Juntos+1 procesa todo localmente. Tus datos financieros nunca salen de tu dispositivo.
          </p>
        </div>
      </div>

      {/* Info cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <InfoCard
          icon={<Shield size={18} />}
          title="Procesamiento 100% local"
          description="Todos los archivos importados se procesan directamente en tu navegador. No se envían a ningún servidor externo."
          color="var(--success)"
        />
        <InfoCard
          icon={<Trash2 size={18} />}
          title="Borrado automático de archivos"
          description="Los archivos Excel/CSV que importas se procesan en memoria y se descartan inmediatamente. Solo se guardan las transacciones normalizadas."
          color="var(--accent-blue)"
        />
        <InfoCard
          icon={<FileText size={18} />}
          title="Datos almacenados"
          description="Solo se almacenan: transacciones normalizadas, metas, presupuestos y configuraciones. Nunca archivos originales ni datos bancarios sin procesar."
          color="var(--warning)"
        />
      </div>

      {/* Activity log */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}>
        <button
          onClick={() => setShowLogs(!showLogs)}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '1rem 1.25rem',
            background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--text-primary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Eye size={16} style={{ color: 'var(--accent-blue)' }} />
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              Log de actividad ({logs.length} registros)
            </span>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {showLogs ? 'Ocultar' : 'Ver'}
          </span>
        </button>

        {showLogs && (
          <div style={{ padding: '0 1.25rem 1.25rem' }}>
            {logs.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '1.5rem',
                color: 'var(--text-muted)', fontSize: '0.85rem',
              }}>
                No hay registros de actividad
              </div>
            ) : (
              <>
                <div style={{
                  maxHeight: '300px', overflow: 'auto',
                  display: 'flex', flexDirection: 'column', gap: '0.5rem',
                }}>
                  {logs.map(log => (
                    <div key={log.id} style={{
                      padding: '0.6rem 0.75rem',
                      background: 'var(--bg-elevated)',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{log.action}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                          {new Date(log.timestamp).toLocaleString('es-PE')}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)' }}>{log.details}</div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleClearLogs}
                  style={{
                    marginTop: '0.75rem',
                    padding: '0.4rem 0.75rem', borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'transparent', color: 'var(--text-muted)',
                    cursor: 'pointer', fontSize: '0.78rem',
                  }}
                >
                  Limpiar logs
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCard({ icon, title, description, color }: {
  icon: React.ReactNode; title: string; description: string; color: string;
}) {
  return (
    <div style={{
      display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
      padding: '1rem 1.25rem',
      background: `${color}08`,
      border: `1px solid ${color}20`,
      borderRadius: '12px',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '10px',
        background: `${color}15`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
          {title}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {description}
        </div>
      </div>
    </div>
  );
}
