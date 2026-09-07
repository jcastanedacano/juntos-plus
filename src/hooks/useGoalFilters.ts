import { useMemo, useState, useDeferredValue, useCallback } from 'react';
import { SavingsGoal, GoalStatusFilter, GoalPeriodFilter, GoalSortBy, GoalViewMode } from '../types';
import { getGoalProgress, isGoalCompleted, getRequiredContribution, getDaysRemaining } from '../utils/goalCalculations';
import { addMonths, addYears, isWithinInterval } from 'date-fns';

export function useGoalFilters(goals: SavingsGoal[]) {
  const [statusFilter, setStatusFilter] = useState<GoalStatusFilter>('all');
  const [periodFilter, setPeriodFilter] = useState<GoalPeriodFilter>('year');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<GoalSortBy>('progress');
  const [viewMode, setViewMode] = useState<GoalViewMode>('cards');

  const deferredSearch = useDeferredValue(searchTerm);

  const filteredGoals = useMemo(() => {
    return goals
      .filter(g => {
        // Status filter
        switch (statusFilter) {
          case 'active': return g.isActive && !isGoalCompleted(g);
          case 'paused': return !g.isActive;
          case 'completed': return isGoalCompleted(g);
          case 'all': return true;
        }
      })
      .filter(g => {
        // Period filter: deadline within period
        if (periodFilter === 'year') return true; // show all
        const now = new Date();
        const end = periodFilter === 'month' ? addMonths(now, 1) : addMonths(now, 3);
        const deadline = new Date(g.deadline);
        return deadline <= end;
      })
      .filter(g => {
        // Search
        if (!deferredSearch) return true;
        const term = deferredSearch.toLowerCase();
        return (
          g.name.toLowerCase().includes(term) ||
          g.description?.toLowerCase().includes(term) ||
          g.targetAmount.toString().includes(term)
        );
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'progress':
            return getGoalProgress(b) - getGoalProgress(a);
          case 'amount':
            return b.targetAmount - a.targetAmount;
          case 'deadline':
            return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
          case 'name':
            return a.name.localeCompare(b.name);
          default:
            return 0;
        }
      });
  }, [goals, statusFilter, periodFilter, deferredSearch, sortBy]);

  const filterCounts = useMemo(() => ({
    all: goals.length,
    active: goals.filter(g => g.isActive && !isGoalCompleted(g)).length,
    paused: goals.filter(g => !g.isActive).length,
    completed: goals.filter(g => isGoalCompleted(g)).length,
  }), [goals]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (periodFilter !== 'year') count++;
    if (deferredSearch) count++;
    return count;
  }, [statusFilter, periodFilter, deferredSearch]);

  const resetFilters = useCallback(() => {
    setStatusFilter('all');
    setPeriodFilter('year');
    setSearchTerm('');
  }, []);

  return {
    statusFilter,
    setStatusFilter,
    periodFilter,
    setPeriodFilter,
    searchTerm,
    setSearchTerm,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    filteredGoals,
    filterCounts,
    activeFilterCount,
    resetFilters,
  };
}
