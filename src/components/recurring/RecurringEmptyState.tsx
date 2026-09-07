import { RefreshCw, Plus, Search } from 'lucide-react';

interface RecurringEmptyStateProps {
  variant: 'no-data' | 'no-results';
  onAddRecurring: () => void;
  onResetFilters?: () => void;
}

const suggestions = [
  { label: 'Netflix', icon: '🎬' },
  { label: 'Spotify', icon: '🎵' },
  { label: 'Gym', icon: '💪' },
  { label: 'Internet', icon: '🌐' },
];

export const RecurringEmptyState = ({ variant, onAddRecurring, onResetFilters }: RecurringEmptyStateProps) => {
  if (variant === 'no-results') {
    return (
      <div className="rec-empty">
        <div className="rec-empty-icon">
          <Search size={48} />
        </div>
        <h3 className="rec-empty-title">Sin resultados</h3>
        <p className="rec-empty-text">No se encontraron recurrentes con los filtros actuales</p>
        {onResetFilters && (
          <button className="rec-empty-btn" onClick={onResetFilters}>
            <RefreshCw size={16} />
            Limpiar filtros
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rec-empty">
      <div className="rec-empty-icon">
        <RefreshCw size={48} />
      </div>
      <h3 className="rec-empty-title">No hay gastos recurrentes</h3>
      <p className="rec-empty-text">Registra tus suscripciones y gastos fijos para tener mejor control</p>
      <div className="rec-empty-suggestions">
        {suggestions.map(s => (
          <span key={s.label} className="rec-empty-chip" onClick={onAddRecurring}>
            {s.icon} {s.label}
          </span>
        ))}
      </div>
      <button className="rec-empty-btn rec-empty-btn--primary" onClick={onAddRecurring}>
        <Plus size={16} />
        Nuevo Gasto Recurrente
      </button>
    </div>
  );
};
