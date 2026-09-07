import { X, ExternalLink, Clock, Copy, CheckCircle } from 'lucide-react';
import { CancellationGuideData } from '../../types';
import { useState } from 'react';

interface CancellationGuideProps {
  guide: CancellationGuideData;
  onClose: () => void;
}

export function CancellationGuide({ guide, onClose }: CancellationGuideProps) {
  const [copiedEmail, setCopiedEmail] = useState(false);

  const handleCopyEmail = () => {
    if (guide.emailTemplate) {
      navigator.clipboard.writeText(guide.emailTemplate);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      <div style={{
        position: 'relative',
        width: '90%', maxWidth: '520px',
        background: 'var(--bg-card)', borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
              Cancelar {guide.name}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
              <Clock size={12} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Tiempo estimado: {guide.estimatedTime}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 4,
          }}>
            <X size={20} />
          </button>
        </div>

        {/* Steps */}
        <div style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {guide.steps.map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'var(--accent-blue)',
                  color: '#fff', fontWeight: 700, fontSize: '0.8rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {i + 1}
                </div>
                <div style={{
                  fontSize: '0.9rem', color: 'var(--text-primary)',
                  paddingTop: '0.2rem', lineHeight: 1.5,
                }}>
                  {step}
                </div>
              </div>
            ))}
          </div>

          {/* Link */}
          <a
            href={guide.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              padding: '0.7rem 1rem', borderRadius: '10px',
              background: 'var(--accent-blue)', color: '#fff',
              textDecoration: 'none', fontWeight: 500, fontSize: '0.9rem',
              marginBottom: guide.emailTemplate ? '1rem' : 0,
            }}
          >
            <ExternalLink size={16} />
            Ir a la página de cancelación
          </a>

          {/* Email template */}
          {guide.emailTemplate && (
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{
                fontSize: '0.8rem', fontWeight: 600,
                color: 'var(--text-secondary)', marginBottom: '0.5rem',
              }}>
                Plantilla de correo para solicitar baja:
              </div>
              <div style={{
                padding: '0.75rem 1rem',
                background: 'var(--bg-elevated)',
                borderRadius: '8px',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.5,
                position: 'relative',
              }}>
                {guide.emailTemplate}
                <button
                  onClick={handleCopyEmail}
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.3rem 0.6rem', borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-card)', color: 'var(--text-muted)',
                    cursor: 'pointer', fontSize: '0.7rem',
                  }}
                >
                  {copiedEmail ? <><CheckCircle size={11} /> Copiado</> : <><Copy size={11} /> Copiar</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
