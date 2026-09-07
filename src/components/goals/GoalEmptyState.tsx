import { Target, Plus, Search } from 'lucide-react';

interface GoalEmptyStateProps {
  variant: 'no-data' | 'no-results';
  onAddGoal: () => void;
  onResetFilters?: () => void;
}

export const GoalEmptyState = ({ variant, onAddGoal, onResetFilters }: GoalEmptyStateProps) => {
  if (variant === 'no-results') {
    return (
      <div className="gl-empty">
        <div className="gl-empty-icon"><Search size={48} /></div>
        <h3 className="gl-empty-title">Sin resultados</h3>
        <p className="gl-empty-text">No hay metas que coincidan con los filtros actuales</p>
        {onResetFilters && (
          <button className="gl-empty-btn" onClick={onResetFilters}>Limpiar filtros</button>
        )}
      </div>
    );
  }

  return (
    <div className="gl-empty">
      <div className="gl-empty-icon"><Target size={48} /></div>
      <h3 className="gl-empty-title">Crea tu primera meta</h3>
      <p className="gl-empty-text">Define metas de ahorro y sigue tu progreso paso a paso</p>
      <div className="gl-empty-tips">
        <span className="gl-empty-tip">🏖️ Vacaciones</span>
        <span className="gl-empty-tip">🚗 Auto nuevo</span>
        <span className="gl-empty-tip">🎓 Estudios</span>
        <span className="gl-empty-tip">🏠 Casa propia</span>
      </div>
      <button className="gl-empty-btn gl-empty-btn--primary" onClick={onAddGoal}>
        <Plus size={16} /> Nueva Meta
      </button>
    </div>
  );
};
