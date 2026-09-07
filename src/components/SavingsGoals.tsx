import { useState, useRef, useCallback, useMemo } from 'react';
import { SavingsGoal } from '../types';
import { formatCurrency } from '../utils/calculations';
import { getGoalSummary } from '../utils/goalCalculations';
import { useGoalFilters } from '../hooks/useGoalFilters';
import { useGoalKeyboard } from '../hooks/useGoalKeyboard';
import { GoalFilterBar, GoalFilterBarRef } from './goals/GoalFilterBar';
import { GoalCard } from './goals/GoalCard';
import { GoalListRow } from './goals/GoalListRow';
import { GoalDrawer } from './goals/GoalDrawer';
import { GoalContributeModal } from './goals/GoalContributeModal';
import { GoalEmptyState } from './goals/GoalEmptyState';
import { GoalSkeleton } from './goals/GoalSkeleton';
import { useToast } from './ui/Toast';
import { Plus, Target, TrendingUp, PiggyBank, CalendarClock } from 'lucide-react';

interface SavingsGoalsProps {
  goals: SavingsGoal[];
  onAddGoal: () => void;
  onEditGoal: (goal: SavingsGoal) => void;
  onDeleteGoal: (id: string) => void;
  onContribute: (goalId: string, amount: number, note?: string) => void;
  onToggleGoalActive?: (id: string) => void;
  currency: string;
}

export const SavingsGoals = ({
  goals,
  onAddGoal,
  onEditGoal,
  onDeleteGoal,
  onContribute,
  onToggleGoalActive,
  currency,
}: SavingsGoalsProps) => {
  const {
    statusFilter, setStatusFilter,
    periodFilter, setPeriodFilter,
    searchTerm, setSearchTerm,
    sortBy, setSortBy,
    viewMode, setViewMode,
    filteredGoals,
    filterCounts,
    activeFilterCount,
    resetFilters,
  } = useGoalFilters(goals);

  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [contributeGoalId, setContributeGoalId] = useState<string | null>(null);

  const filterBarRef = useRef<GoalFilterBarRef>(null);
  const { addToast } = useToast();

  const summary = useMemo(() => getGoalSummary(goals), [goals]);

  const drawerGoal = useMemo(() => goals.find(g => g.id === drawerId) || null, [goals, drawerId]);
  const contributeGoal = useMemo(() => goals.find(g => g.id === contributeGoalId) || null, [goals, contributeGoalId]);

  const handleToggleActive = useCallback((id: string) => {
    if (onToggleGoalActive) {
      onToggleGoalActive(id);
    }
    const goal = goals.find(g => g.id === id);
    if (goal) {
      addToast({
        type: 'success',
        message: goal.isActive ? `"${goal.name}" pausada` : `"${goal.name}" reactivada`,
      });
    }
  }, [onToggleGoalActive, goals, addToast]);

  const handleContribute = useCallback((goalId: string, amount: number, note?: string) => {
    onContribute(goalId, amount, note);
    const goal = goals.find(g => g.id === goalId);
    if (goal) {
      addToast({
        type: 'success',
        message: `+${formatCurrency(amount, goal.currency || currency)} aportado a "${goal.name}"`,
      });
    }
  }, [onContribute, goals, currency, addToast]);

  const handleDelete = useCallback((id: string) => {
    const goal = goals.find(g => g.id === id);
    onDeleteGoal(id);
    if (drawerId === id) setDrawerId(null);
    if (goal) {
      addToast({ type: 'info', message: `"${goal.name}" eliminada` });
    }
  }, [onDeleteGoal, goals, drawerId, addToast]);

  // Keyboard
  useGoalKeyboard({
    onNewGoal: onAddGoal,
    onFocusSearch: () => filterBarRef.current?.focusSearch(),
    onCloseDrawer: () => setDrawerId(null),
    drawerOpen: drawerId !== null,
  });

  // Empty state
  if (goals.length === 0) {
    return (
      <div className="gl-container">
        <GoalEmptyState variant="no-data" onAddGoal={onAddGoal} />
      </div>
    );
  }

  return (
    <div className="gl-container">
      {/* Top bar */}
      <div className="gl-top-bar">
        <h2 className="gl-title">Metas de Ahorro</h2>
        <button className="gl-add-btn" onClick={onAddGoal}>
          <Plus size={16} /> Nueva Meta
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="gl-summary">
        <div className="gl-summary-card">
          <div className="gl-summary-icon gl-summary-icon--blue"><Target size={20} /></div>
          <div className="gl-summary-content">
            <span className="gl-summary-label">Total metas</span>
            <span className="gl-summary-value">{summary.total}</span>
            <span className="gl-summary-sub">{summary.active} activa{summary.active !== 1 ? 's' : ''} · {summary.paused} pausada{summary.paused !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="gl-summary-card">
          <div className={`gl-summary-icon ${summary.overallProgress >= 50 ? 'gl-summary-icon--green' : 'gl-summary-icon--amber'}`}><TrendingUp size={20} /></div>
          <div className="gl-summary-content">
            <span className="gl-summary-label">Progreso general</span>
            <span className="gl-summary-value">{summary.overallProgress.toFixed(0)}%</span>
            <div className="gl-summary-minibar">
              <div className="gl-summary-minibar-fill" style={{ width: `${Math.min(summary.overallProgress, 100)}%` }} />
            </div>
          </div>
        </div>
        <div className="gl-summary-card">
          <div className="gl-summary-icon gl-summary-icon--green"><PiggyBank size={20} /></div>
          <div className="gl-summary-content">
            <span className="gl-summary-label">Ahorrado</span>
            <span className="gl-summary-value gl-summary-value--success">{formatCurrency(summary.totalCurrent, currency)}</span>
            <span className="gl-summary-sub">de {formatCurrency(summary.totalTarget, currency)}</span>
          </div>
        </div>
        <div className="gl-summary-card">
          <div className="gl-summary-icon gl-summary-icon--purple"><CalendarClock size={20} /></div>
          <div className="gl-summary-content">
            <span className="gl-summary-label">Aporte mensual</span>
            <span className="gl-summary-value">{formatCurrency(summary.totalMonthlyNeeded, currency)}</span>
            <span className="gl-summary-sub">para cumplir a tiempo</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <GoalFilterBar
        ref={filterBarRef}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        periodFilter={periodFilter}
        onPeriodChange={setPeriodFilter}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        sortBy={sortBy}
        onSortChange={setSortBy}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        filterCounts={filterCounts}
        activeFilterCount={activeFilterCount}
        onResetFilters={resetFilters}
      />

      {/* Count label */}
      <div className="gl-count-label">
        {filteredGoals.length} meta{filteredGoals.length !== 1 ? 's' : ''}
      </div>

      {/* Content */}
      {filteredGoals.length === 0 ? (
        <GoalEmptyState variant="no-results" onAddGoal={onAddGoal} onResetFilters={resetFilters} />
      ) : viewMode === 'cards' ? (
        <div className="gl-grid">
          {filteredGoals.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              currency={currency}
              onEdit={onEditGoal}
              onDelete={handleDelete}
              onContribute={id => setContributeGoalId(id)}
              onToggleActive={handleToggleActive}
              onViewDetail={id => setDrawerId(id)}
            />
          ))}
        </div>
      ) : (
        <div className="gl-list">
          <div className="gl-list-header">
            <span />
            <span>Meta</span>
            <span>Progreso</span>
            <span>Monto</span>
            <span>Plazo</span>
            <span>Aporte/mes</span>
            <span />
          </div>
          {filteredGoals.map(goal => (
            <GoalListRow
              key={goal.id}
              goal={goal}
              currency={currency}
              onContribute={id => setContributeGoalId(id)}
              onToggleActive={handleToggleActive}
              onViewDetail={id => setDrawerId(id)}
            />
          ))}
        </div>
      )}

      {/* Drawer */}
      <GoalDrawer
        goal={drawerGoal}
        isOpen={drawerId !== null}
        onClose={() => setDrawerId(null)}
        onEdit={onEditGoal}
        onDelete={handleDelete}
        onToggleActive={handleToggleActive}
        onContribute={id => { setDrawerId(null); setContributeGoalId(id); }}
        currency={currency}
      />

      {/* Contribute Modal */}
      <GoalContributeModal
        goal={contributeGoal}
        isOpen={contributeGoalId !== null}
        onClose={() => setContributeGoalId(null)}
        onContribute={handleContribute}
        currency={currency}
      />
    </div>
  );
};
