import { SavingsGoal } from '../types';
import { formatCurrency } from './calculations';
import { differenceInDays, differenceInWeeks, differenceInMonths, format } from 'date-fns';

export function getGoalProgress(goal: SavingsGoal): number {
  if (goal.targetAmount <= 0) return 0;
  return Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
}

export function isGoalCompleted(goal: SavingsGoal): boolean {
  return goal.currentAmount >= goal.targetAmount;
}

export function isGoalExpired(goal: SavingsGoal): boolean {
  return new Date(goal.deadline) < new Date() && !isGoalCompleted(goal);
}

export function getDaysRemaining(goal: SavingsGoal): number {
  return differenceInDays(new Date(goal.deadline), new Date());
}

export function getRemainingAmount(goal: SavingsGoal): number {
  return Math.max(0, goal.targetAmount - goal.currentAmount);
}

export interface RequiredContribution {
  daily: number;
  weekly: number;
  monthly: number;
}

export function getRequiredContribution(goal: SavingsGoal): RequiredContribution {
  const remaining = getRemainingAmount(goal);
  if (remaining <= 0) return { daily: 0, weekly: 0, monthly: 0 };

  const now = new Date();
  const deadline = new Date(goal.deadline);
  const days = Math.max(1, differenceInDays(deadline, now));
  const weeks = Math.max(1, differenceInWeeks(deadline, now));
  const months = Math.max(1, differenceInMonths(deadline, now));

  return {
    daily: remaining / days,
    weekly: remaining / weeks,
    monthly: remaining / months,
  };
}

export function getGoalStatusLabel(goal: SavingsGoal): { text: string; color: string } {
  if (isGoalCompleted(goal)) return { text: 'Completada', color: 'var(--goal-success)' };
  if (!goal.isActive) return { text: 'Pausada', color: 'var(--goal-text-muted)' };
  if (isGoalExpired(goal)) return { text: 'Vencida', color: 'var(--goal-danger)' };
  const days = getDaysRemaining(goal);
  if (days <= 7) return { text: `${days}d restantes`, color: 'var(--goal-warning)' };
  return { text: 'Activa', color: 'var(--goal-success)' };
}

export function getProgressColor(progress: number, goalColor: string): string {
  if (progress >= 100) return 'var(--goal-success)';
  if (progress >= 75) return goalColor;
  if (progress >= 50) return goalColor;
  if (progress >= 25) return goalColor;
  return goalColor;
}

export function formatContributionSuggestion(goal: SavingsGoal, currency: string): string {
  const req = getRequiredContribution(goal);
  if (req.monthly <= 0) return 'Meta alcanzada';
  return `${formatCurrency(req.monthly, currency)}/mes`;
}

export function projectCompletion(goal: SavingsGoal, monthlyContribution: number): Date | null {
  const remaining = getRemainingAmount(goal);
  if (remaining <= 0) return new Date();
  if (monthlyContribution <= 0) return null;
  const monthsNeeded = Math.ceil(remaining / monthlyContribution);
  const result = new Date();
  result.setMonth(result.getMonth() + monthsNeeded);
  return result;
}

export function getGoalSummary(goals: SavingsGoal[]) {
  const active = goals.filter(g => g.isActive && !isGoalCompleted(g));
  const completed = goals.filter(g => isGoalCompleted(g));
  const paused = goals.filter(g => !g.isActive && !isGoalCompleted(g));

  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
  const totalCurrent = goals.reduce((s, g) => s + Math.min(g.currentAmount, g.targetAmount), 0);
  const overallProgress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;

  const totalMonthlyNeeded = active.reduce((s, g) => {
    return s + getRequiredContribution(g).monthly;
  }, 0);

  return {
    total: goals.length,
    active: active.length,
    completed: completed.length,
    paused: paused.length,
    totalTarget,
    totalCurrent,
    overallProgress,
    totalMonthlyNeeded,
  };
}
