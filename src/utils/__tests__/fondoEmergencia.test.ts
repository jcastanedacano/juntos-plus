import { describe, it, expect } from 'vitest';
import {
  esFondoEmergencia, normalizarMeses, gastoRecurrenteMensual, metaFondo,
  mesesCubiertos, aplicarMetaEmergencia, nuevoFondoEmergencia, MESES_POR_DEFECTO,
} from '../fondoEmergencia';
import { SavingsGoal, RecurringTransaction } from '../../types';
import { relativas } from '../fxTasas';

const rec = (over: Partial<RecurringTransaction>): RecurringTransaction => ({
  id: 'r', type: 'expense', amount: 100, category: 'home', description: 'x',
  frequency: 'monthly', nextDate: '2026-10-01', isActive: true, ...over,
});

const fondo = (over: Partial<SavingsGoal> = {}): SavingsGoal => ({
  id: 'f', name: 'Fondo', tipo: 'emergencia', mesesCobertura: 3,
  targetAmount: 1, currentAmount: 0, deadline: '2027-01-01', startDate: '2026-01-01',
  isActive: true, icon: '🛟', color: '#000', ...over,
});

const PEN_BASE = relativas({ PEN: 1, USD: 3.5, EUR: 4 }, 'PEN');
const EUR_BASE = relativas({ PEN: 1, USD: 3.5, EUR: 4 }, 'EUR');

describe('gasto recurrente mensual', () => {
  it('suma los gastos activos llevados a su equivalente mensual', () => {
    const r = [
      rec({ amount: 1500 }),                              // alquiler
      rec({ id: '2', amount: 120, frequency: 'yearly' }),  // 10 al mes
      rec({ id: '3', amount: 100, frequency: 'weekly' }),  // 433
    ];
    expect(gastoRecurrenteMensual(r)).toBeCloseTo(1500 + 10 + 433, 2);
  });

  it('el sueldo recurrente no es un gasto', () => {
    expect(gastoRecurrenteMensual([rec({ type: 'income', amount: 5000 }), rec({ id: '2', amount: 200 })])).toBe(200);
  });

  it('un recurrente pausado no se esta pagando: no cuenta', () => {
    expect(gastoRecurrenteMensual([rec({ isActive: false, amount: 999 }), rec({ id: '2', amount: 50 })])).toBe(50);
  });

  it('sin recurrentes, cero', () => {
    expect(gastoRecurrenteMensual([])).toBe(0);
  });
});

describe('meses de cobertura', () => {
  it('normaliza lo que no es razonable al minimo habitual', () => {
    for (const malo of [0, -3, NaN, undefined, null, '', 99, 'abc']) {
      expect(normalizarMeses(malo)).toBe(MESES_POR_DEFECTO);
    }
    expect(normalizarMeses(6)).toBe(6);
    expect(normalizarMeses('6')).toBe(6);
  });

  it('el objetivo es gasto x meses', () => {
    expect(metaFondo(2000, 3)).toBe(6000);
    expect(metaFondo(2000, 6)).toBe(12000);
  });
});

describe('cuantos meses cubre lo ahorrado', () => {
  it('sale de la propia meta, sin conocer el gasto', () => {
    // objetivo 6000 = 2000 x 3; con 2000 ahorrados cubre un mes.
    expect(mesesCubiertos({ currentAmount: 2000, targetAmount: 6000, mesesCobertura: 3 })).toBeCloseTo(1, 10);
    expect(mesesCubiertos({ currentAmount: 6000, targetAmount: 6000, mesesCobertura: 3 })).toBeCloseTo(3, 10);
  });

  it('sin objetivo no hay cobertura que contar', () => {
    expect(mesesCubiertos({ currentAmount: 500, targetAmount: 0, mesesCobertura: 3 })).toBe(0);
  });
});

describe('poner al dia el objetivo', () => {
  it('lo deriva del gasto y de los meses, y no toca las otras metas', () => {
    const otra: SavingsGoal = { ...fondo({ id: 'v', tipo: undefined, name: 'Vacaciones', targetAmount: 777 }) };
    const r = aplicarMetaEmergencia([fondo({ mesesCobertura: 6 }), otra], 2000, 'PEN', PEN_BASE);
    expect(r[0].targetAmount).toBe(12000);
    expect(r[1]).toBe(otra);
  });

  it('si el alquiler sube, el fondo lo sabe solo', () => {
    const antes = aplicarMetaEmergencia([fondo()], 2000, 'PEN', PEN_BASE);
    const despues = aplicarMetaEmergencia(antes, 2500, 'PEN', PEN_BASE);
    expect(antes[0].targetAmount).toBe(6000);
    expect(despues[0].targetAmount).toBe(7500);
  });

  it('devuelve la MISMA lista si nada cambia', () => {
    const metas = [fondo({ targetAmount: 6000 })];
    expect(aplicarMetaEmergencia(metas, 2000, 'PEN', PEN_BASE)).toBe(metas);
  });

  it('sin gasto recurrente no lo pone a cero: quedaria «cumplido» con 0 ahorrado', () => {
    const metas = [fondo({ targetAmount: 6000, currentAmount: 100 })];
    expect(aplicarMetaEmergencia(metas, 0, 'PEN', PEN_BASE)).toBe(metas);
  });

  it('sin ningun fondo no toca nada', () => {
    const metas = [fondo({ tipo: undefined })];
    expect(aplicarMetaEmergencia(metas, 2000, 'PEN', PEN_BASE)).toBe(metas);
  });

  it('una meta en otra moneda que la del hogar recibe el objetivo en la suya', () => {
    // Hogar en euros, gasto de 1000 EUR al mes, fondo llevado en soles (4 PEN por euro).
    const r = aplicarMetaEmergencia([fondo({ currency: 'PEN' })], 1000, 'EUR', EUR_BASE);
    expect(r[0].targetAmount).toBeCloseTo(3000 * 4, 6);
  });

  it('una meta en la moneda del hogar no se convierte', () => {
    const r = aplicarMetaEmergencia([fondo({ currency: 'EUR' })], 1000, 'EUR', EUR_BASE);
    expect(r[0].targetAmount).toBe(3000);
  });
});

describe('crear el fondo', () => {
  it('nace como emergencia, con el objetivo calculado y a un año', () => {
    const f = nuevoFondoEmergencia(2000, 6, new Date('2026-09-26T12:00:00Z'));
    expect(esFondoEmergencia(f)).toBe(true);
    expect(f.mesesCobertura).toBe(6);
    expect(f.targetAmount).toBe(12000);
    expect(f.currentAmount).toBe(0);
    expect(f.isActive).toBe(true);
    expect(new Date(f.deadline).getFullYear()).toBe(2027);
    // Sin moneda propia: es la del hogar, y sigue a la del hogar si esta cambia.
    expect(f.currency).toBeUndefined();
  });

  it('unos meses raros vuelven al minimo habitual', () => {
    expect(nuevoFondoEmergencia(1000, 'x').mesesCobertura).toBe(MESES_POR_DEFECTO);
  });
});
