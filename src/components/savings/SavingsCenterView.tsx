import { useMemo, useState } from 'react';
import { Scissors, PiggyBank, TrendingDown } from 'lucide-react';
import { DetectedSubscription, CutSuggestion, CancellationGuideData } from '../../types';
import { analyzeSavings, getTotalPotentialSavings } from '../../utils/savingsAnalyzer';
import { formatCurrency } from '../../utils/calculations';
import { CutSuggestionCard } from './CutSuggestionCard';
import { CancellationGuide } from './CancellationGuide';

interface SavingsCenterViewProps {
  subscriptions: DetectedSubscription[];
  currency: string;
}

export function SavingsCenterView({ subscriptions, currency }: SavingsCenterViewProps) {
  const [suggestions, setSuggestions] = useState<CutSuggestion[]>(() =>
    analyzeSavings(subscriptions)
  );
  const [activeGuide, setActiveGuide] = useState<CancellationGuideData | null>(null);

  const activeSuggestions = suggestions.filter(s => !s.isDismissed);
  const totals = useMemo(() => getTotalPotentialSavings(activeSuggestions), [activeSuggestions]);

  const handleDismiss = (id: string) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, isDismissed: true } : s));
  };

  const handleReminder = (id: string) => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    setSuggestions(prev => prev.map(s =>
      s.id === id ? { ...s, reminderDate: date.toISOString() } : s
    ));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Hero card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(245, 158, 11, 0.1))',
        border: '1px solid rgba(239, 68, 68, 0.15)',
        borderRadius: '16px',
        padding: '2rem',
        display: 'flex',
        alignItems: 'center',
        gap: '2rem',
        flexWrap: 'wrap',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '16px',
          background: 'rgba(239, 68, 68, 0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Scissors size={32} style={{ color: 'var(--danger)' }} />
        </div>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.3rem', color: 'var(--text-primary)' }}>
            Centro de Recortes
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Hemos analizado tus suscripciones y encontrado {activeSuggestions.length} oportunidades de ahorro.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
              Ahorro potencial/mes
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>
              {formatCurrency(totals.monthly, currency)}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
              Ahorro potencial/año
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>
              {formatCurrency(totals.annual, currency)}
            </div>
          </div>
        </div>
      </div>

      {/* Suggestions list */}
      {activeSuggestions.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '3rem',
          color: 'var(--text-muted)', fontSize: '0.9rem',
          background: 'var(--bg-card)', borderRadius: '12px',
          border: '1px solid var(--border-color)',
        }}>
          <PiggyBank size={40} style={{ color: 'var(--success)', marginBottom: '0.75rem' }} />
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            No hay sugerencias de recorte
          </div>
          <div>
            Tus suscripciones se ven optimizadas. Sigue así.
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          // min() para que en pantallas angostas la columna se encoja en
          // vez de desbordar: 340px no entran en un viewport de 375.
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(340px, 100%), 1fr))',
          gap: '1rem',
        }}>
          {activeSuggestions.map(suggestion => (
            <CutSuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              currency={currency}
              onDismiss={handleDismiss}
              onReminder={handleReminder}
              onShowGuide={setActiveGuide}
            />
          ))}
        </div>
      )}

      {/* Dismissed count */}
      {suggestions.filter(s => s.isDismissed).length > 0 && (
        <div style={{
          fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center',
        }}>
          {suggestions.filter(s => s.isDismissed).length} sugerencia(s) descartada(s)
        </div>
      )}

      {/* Cancellation Guide Modal */}
      {activeGuide && (
        <CancellationGuide guide={activeGuide} onClose={() => setActiveGuide(null)} />
      )}
    </div>
  );
}
