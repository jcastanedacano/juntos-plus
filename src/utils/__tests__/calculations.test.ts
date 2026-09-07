import { describe, it, expect } from 'vitest';
import { calculateStatistics, calculatePreviousMonthStats, formatCurrency } from '../calculations';
import { Transaction } from '../../types';

const makeTransaction = (overrides: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(),
  description: 'Test',
  amount: 100,
  type: 'expense',
  category: 'general',
  date: '2026-04-10',
  accountId: 'default',
  ...overrides,
});

// Use local Date constructor to avoid UTC timezone issues
const april2026 = new Date(2026, 3, 15);

describe('calculateStatistics', () => {
  it('returns zeros for empty transactions', () => {
    const stats = calculateStatistics([]);
    expect(stats.totalIncome).toBe(0);
    expect(stats.totalExpenses).toBe(0);
    expect(stats.balance).toBe(0);
    expect(stats.byCategory).toEqual({});
  });

  it('calculates income and expenses correctly', () => {
    const transactions: Transaction[] = [
      makeTransaction({ type: 'income', amount: 5000, date: '2026-04-10' }),
      makeTransaction({ type: 'expense', amount: 1500, category: 'food', date: '2026-04-11' }),
      makeTransaction({ type: 'expense', amount: 800, category: 'transport', date: '2026-04-12' }),
    ];
    const stats = calculateStatistics(transactions, april2026);
    expect(stats.totalIncome).toBe(5000);
    expect(stats.totalExpenses).toBe(2300);
    expect(stats.balance).toBe(2700);
  });

  it('groups expenses by category', () => {
    const transactions: Transaction[] = [
      makeTransaction({ type: 'expense', amount: 100, category: 'food', date: '2026-04-10' }),
      makeTransaction({ type: 'expense', amount: 200, category: 'food', date: '2026-04-11' }),
      makeTransaction({ type: 'expense', amount: 50, category: 'transport', date: '2026-04-12' }),
    ];
    const stats = calculateStatistics(transactions, april2026);
    expect(stats.byCategory).toEqual({ food: 300, transport: 50 });
  });

  it('filters by month when provided', () => {
    const transactions: Transaction[] = [
      makeTransaction({ type: 'expense', amount: 100, date: '2026-03-15' }),
      makeTransaction({ type: 'expense', amount: 200, date: '2026-04-15' }),
    ];
    const stats = calculateStatistics(transactions, april2026);
    expect(stats.totalExpenses).toBe(200);
  });

  it('generates trend with daily breakdown', () => {
    const transactions: Transaction[] = [
      makeTransaction({ type: 'income', amount: 1000, date: '2026-04-10' }),
      makeTransaction({ type: 'expense', amount: 50, date: '2026-04-10' }),
    ];
    const stats = calculateStatistics(transactions, april2026);
    expect(stats.trend.length).toBe(30); // April has 30 days
    // Find April 10 in the trend
    const day10 = stats.trend.find(d => d.date === '2026-04-10');
    expect(day10?.income).toBe(1000);
    expect(day10?.expense).toBe(50);
  });
});

describe('calculatePreviousMonthStats', () => {
  it('calculates stats for the previous month', () => {
    const transactions: Transaction[] = [
      makeTransaction({ type: 'expense', amount: 500, date: '2026-03-15' }),
      makeTransaction({ type: 'expense', amount: 100, date: '2026-04-15' }),
    ];
    const stats = calculatePreviousMonthStats(transactions, april2026);
    expect(stats.totalExpenses).toBe(500);
  });
});

describe('formatCurrency', () => {
  it('formats PEN correctly, with thousands separator', () => {
    expect(formatCurrency(1234.56, 'PEN')).toBe('S/ 1,234.56');
  });

  it('formats USD correctly, with thousands separator', () => {
    expect(formatCurrency(1234.56, 'USD')).toBe('$ 1,234.56');
  });

  it('does not add a separator under 1000', () => {
    expect(formatCurrency(234.56, 'PEN')).toBe('S/ 234.56');
  });
});

describe('agrupación por mes con fechas sin hora', () => {
  const tx = (date: string, amount: number): Transaction => ({
    id: date, type: 'expense', amount, category: 'other-expense',
    description: 'x', date, accountId: 'default',
  });

  it('una transacción del día 1 cuenta en SU mes, no en el anterior', () => {
    // Reportado: se registró un gasto el 01/09 y aparecía como 31/08,
    // sumando al mes equivocado. new Date("2026-09-01") es medianoche UTC
    // y en husos negativos cae en agosto.
    const septiembre = calculateStatistics([tx('2026-09-01', 5607)], new Date(2026, 8, 15));
    expect(septiembre.totalExpenses).toBe(5607);

    const agosto = calculateStatistics([tx('2026-09-01', 5607)], new Date(2026, 7, 15));
    expect(agosto.totalExpenses).toBe(0);
  });

  it('el último día del mes tampoco se corre', () => {
    const agosto = calculateStatistics([tx('2026-08-31', 100)], new Date(2026, 7, 15));
    expect(agosto.totalExpenses).toBe(100);
  });
});
