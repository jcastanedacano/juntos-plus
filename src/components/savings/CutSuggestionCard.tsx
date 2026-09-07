import { Scissors, Clock, EyeOff, ExternalLink } from 'lucide-react';
import { CutSuggestion, CancellationGuideData } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { findGuide } from '../../data/cancellationGuides';

interface CutSuggestionCardProps {
  suggestion: CutSuggestion;
  currency: string;
  onDismiss: (id: string) => void;
  onReminder: (id: string) => void;
  onShowGuide: (guide: CancellationGuideData) => void;
}

const reasonIcons: Record<string, string> = {
  duplicate: '🔄',
  unused: '💤',
  phantom: '👻',
  expensive: '💰',
  forgotten: '🤔',
};

const reasonColors: Record<string, string> = {
  duplicate: 'var(--warning)',
  unused: 'var(--text-muted)',
  phantom: 'var(--accent-blue)',
  expensive: 'var(--danger)',
  forgotten: 'var(--warning)',
};

export function CutSuggestionCard({ suggestion, currency, onDismiss, onReminder, onShowGuide }: CutSuggestionCardProps) {
  const guide = findGuide(suggestion.serviceName);

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: '12px',
      padding: '1rem 1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.5rem' }}>{reasonIcons[suggestion.reason]}</span>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
              {suggestion.serviceName}
            </div>
            <div style={{
              fontSize: '0.75rem',
              color: reasonColors[suggestion.reason],
              fontWeight: 500,
            }}>
              {suggestion.reasonLabel}
            </div>
          </div>
        </div>
      </div>

      {/* Costs */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: '0.5rem',
      }}>
        <div style={{
          padding: '0.6rem', background: 'var(--bg-elevated)',
          borderRadius: '8px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Costo mensual
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--danger)' }}>
            {formatCurrency(suggestion.monthlyCost, currency)}
          </div>
        </div>
        <div style={{
          padding: '0.6rem', background: 'var(--bg-elevated)',
          borderRadius: '8px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Costo anual
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--danger)' }}>
            {formatCurrency(suggestion.annualCost, currency)}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {guide && (
          <button
            onClick={() => onShowGuide(guide)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              padding: '0.45rem 0.75rem', borderRadius: '8px',
              border: 'none', background: 'var(--danger)',
              color: '#fff', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 500,
            }}
          >
            <Scissors size={13} /> Guía para cancelar
          </button>
        )}
        <button
          onClick={() => onReminder(suggestion.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem',
            padding: '0.45rem 0.75rem', borderRadius: '8px',
            border: '1px solid var(--border-color)',
            background: 'transparent', color: 'var(--text-secondary)',
            cursor: 'pointer', fontSize: '0.78rem',
          }}
        >
          <Clock size={13} /> Recordarme
        </button>
        <button
          onClick={() => onDismiss(suggestion.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem',
            padding: '0.45rem 0.75rem', borderRadius: '8px',
            border: '1px solid var(--border-color)',
            background: 'transparent', color: 'var(--text-muted)',
            cursor: 'pointer', fontSize: '0.78rem',
          }}
        >
          <EyeOff size={13} /> No mostrar
        </button>
      </div>
    </div>
  );
}
