import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calculateMonthEndForecast } from '../calculations';
import { Transaction, RecurringTransaction } from '../../types';

const gasto = (date: string, amount: number): Transaction => ({
  id: date + amount, type: 'expense', amount, category: 'other-expense',
  description: 'x', date, accountId: 'default',
});

const rec = (
  nextDate: string, amount: number, type: 'income' | 'expense' = 'expense'
): RecurringTransaction => ({
  id: nextDate + amount, type, amount, category: 'other-expense',
  description: 'r', frequency: 'monthly', nextDate, isActive: true,
  accountId: 'default',
} as RecurringTransaction);

// 5 de setiembre de 2026, 18:39 hora local (Lima, UTC-5). La hora importa:
// es la que hacía desaparecer los cargos del día siguiente.
const AHORA = new Date(2026, 8, 5, 18, 39, 0);
const SETIEMBRE = new Date(2026, 8, 5);

describe('calculateMonthEndForecast', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(AHORA); });
  afterEach(() => { vi.useRealTimers(); });

  it('no extrapola un gasto puntual como si fuera hábito diario', () => {
    // Reportado: el pronóstico decía -S/ 27,657.54. Dos gastos del 1 de
    // setiembre (5,607 + 28) se dividían entre 5 días y se multiplicaban por
    // los 25 restantes => S/ 28,175 de gasto futuro inventado.
    const f = calculateMonthEndForecast(
      [gasto('2026-09-01', 5607), gasto('2026-09-01', 28)], [], 'PEN', SETIEMBRE
    );
    expect(f.expensesToDate).toBe(5635);
    expect(f.projectedVariableExpenses).toBe(0);
    expect(f.projectedMonthEndBalance).toBe(-5635);
  });

  it('sí proyecta cuando el gasto es un hábito real de todos los días', () => {
    // Contrapeso: la corrección no debe apagar la proyección legítima.
    const diarios = [1, 2, 3, 4, 5].map(d => gasto(`2026-09-0${d}`, 50));
    const f = calculateMonthEndForecast(diarios, [], 'PEN', SETIEMBRE);
    expect(f.dailyAvgExpense).toBe(50);
    expect(f.projectedVariableExpenses).toBe(50 * 25);
  });

  it('un solo día atípico no arrastra la mediana de un hábito', () => {
    const mixto = [
      gasto('2026-09-01', 50), gasto('2026-09-02', 50), gasto('2026-09-03', 5000),
      gasto('2026-09-04', 50), gasto('2026-09-05', 50),
    ];
    const f = calculateMonthEndForecast(mixto, [], 'PEN', SETIEMBRE);
    expect(f.dailyAvgExpense).toBe(50);
  });

  it('cuenta el cargo recurrente de mañana aunque ya pasen de las 07:00', () => {
    // Reportado: "Luz" S/ 325.80 del 6 de setiembre desaparecía del pronóstico.
    // La ventana arrancaba en addDays(hoy, 1), que conserva la hora actual
    // (18:39), y el cargo está anclado al mediodía UTC = 07:00 en Lima.
    const f = calculateMonthEndForecast([], [rec('2026-09-06T12:00:00.000Z', 325.8)], 'PEN', SETIEMBRE);
    expect(f.pendingRecurringExpenses).toBe(325.8);
  });

  it('también cuenta un nextDate guardado a medianoche UTC', () => {
    // Formato antiguo, anterior al ancla de mediodía.
    const f = calculateMonthEndForecast([], [rec('2026-09-06T00:00:00.000Z', 325.8)], 'PEN', SETIEMBRE);
    expect(f.pendingRecurringExpenses).toBe(325.8);
  });

  it('no cuenta cargos del mes siguiente', () => {
    const f = calculateMonthEndForecast([], [rec('2026-10-04T12:00:00.000Z', 80)], 'PEN', SETIEMBRE);
    expect(f.pendingRecurringExpenses).toBe(0);
  });

  it('reproduce el cierre real de setiembre 2026', () => {
    // Ingreso 13,364.52 contra 5,635.00 ya gastado y 7,537.86 recurrente
    // pendiente => cierra en +191.66, no en -27,657.54.
    const f = calculateMonthEndForecast(
      [gasto('2026-09-01', 5607), gasto('2026-09-01', 28)],
      [
        rec('2026-09-30T12:00:00.000Z', 13364.52, 'income'),
        rec('2026-09-06T12:00:00.000Z', 325.8), rec('2026-09-07T12:00:00.000Z', 70.7),
        rec('2026-09-08T12:00:00.000Z', 3.9), rec('2026-09-09T12:00:00.000Z', 53.9),
        rec('2026-09-10T12:00:00.000Z', 159), rec('2026-09-12T12:00:00.000Z', 75),
        rec('2026-09-21T12:00:00.000Z', 31.9), rec('2026-09-21T12:00:00.000Z', 31.9),
        rec('2026-09-29T12:00:00.000Z', 6785.76),
      ],
      'PEN', SETIEMBRE
    );
    expect(f.pendingRecurringExpenses).toBeCloseTo(7537.86, 2);
    expect(f.projectedMonthEndBalance).toBeCloseTo(191.66, 2);
    expect(f.isPositive).toBe(true);
  });
});
