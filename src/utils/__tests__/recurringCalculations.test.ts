import { describe, it, expect } from 'vitest';
import { getChargesInMonth } from '../recurringCalculations';
import { RecurringTransaction } from '../../types';

// getChargesInMonth trabaja con límites de mes en hora LOCAL (startOfMonth /
// endOfMonth de date-fns). Construimos las fechas del test igual, al mediodía,
// para que la suite no dependa de la zona horaria de la máquina que la corre.
const localNoon = (y: number, m1: number, d: number) => new Date(y, m1 - 1, d, 12, 0, 0);
const monthOf = (y: number, m1: number) => new Date(y, m1 - 1, 1, 12, 0, 0);
const iso = (d: Date) => d.toISOString();
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const mk = (over: Partial<RecurringTransaction> = {}): RecurringTransaction => ({
  id: 'r1',
  type: 'expense',
  amount: 100,
  category: 'home',
  description: 'Test',
  frequency: 'monthly',
  nextDate: iso(localNoon(2026, 9, 6)),
  isActive: true,
  ...over,
});

describe('getChargesInMonth', () => {
  it('no inventa cobros en meses anteriores a nextDate', () => {
    // El calendario mostraba cargos de agosto para recurrentes cuyo primer
    // cobro es en septiembre: el algoritmo rebobina para encontrar la
    // cadencia y emitía esas fechas como si fueran cobros reales.
    const r = mk();
    expect(getChargesInMonth(r, monthOf(2026, 8))).toHaveLength(0);
    expect(getChargesInMonth(r, monthOf(2026, 7))).toHaveLength(0);
  });

  it('sí devuelve el cobro del mes de nextDate', () => {
    const charges = getChargesInMonth(mk(), monthOf(2026, 9));
    expect(charges.map(ymd)).toEqual(['2026-09-06']);
  });

  it('sigue proyectando meses futuros', () => {
    expect(getChargesInMonth(mk(), monthOf(2026, 10)).map(ymd)).toEqual(['2026-10-06']);
    expect(getChargesInMonth(mk(), monthOf(2026, 12)).map(ymd)).toEqual(['2026-12-06']);
  });

  it('respeta el piso también en frecuencia semanal', () => {
    const r = mk({ frequency: 'weekly', nextDate: iso(localNoon(2026, 9, 3)) });
    expect(getChargesInMonth(r, monthOf(2026, 8))).toHaveLength(0);
    expect(getChargesInMonth(r, monthOf(2026, 9)).map(ymd)).toEqual([
      '2026-09-03', '2026-09-10', '2026-09-17', '2026-09-24',
    ]);
  });

  it('un recurrente pausado con nextDate vieja no proyecta hacia atrás', () => {
    // Los pausados no reciben el auto-avance de App.loadData, así que su
    // nextDate se queda en el pasado. Aun así no debe fabricar cobros en
    // los meses previos a esa fecha.
    const r = mk({ isActive: false, nextDate: iso(localNoon(2026, 9, 18)) });
    expect(getChargesInMonth(r, monthOf(2026, 8))).toHaveLength(0);
    expect(getChargesInMonth(r, monthOf(2026, 9)).map(ymd)).toEqual(['2026-09-18']);
  });
});
