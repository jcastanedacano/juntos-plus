import { Shield } from 'lucide-react';

export function ImportPrivacyNotice() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.75rem 1rem',
      background: 'rgba(34, 211, 166, 0.08)',
      border: '1px solid rgba(34, 211, 166, 0.2)',
      borderRadius: '10px',
      fontSize: '0.8rem',
      color: 'var(--text-secondary)',
    }}>
      <Shield size={18} style={{ color: 'var(--success)', flexShrink: 0 }} />
      <div>
        <strong style={{ color: 'var(--success)' }}>Procesamiento local</strong>
        {': '}
        Tus archivos se procesan directamente en tu navegador y no se almacenan en ningún servidor.
        Solo se guardan las transacciones normalizadas.
      </div>
    </div>
  );
}
