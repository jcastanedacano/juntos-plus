import { describe, it, expect } from 'vitest';
import {
  calcularResumenMes, gastoPorDia, mayoresDelMes, clasificar,
  pendientesDeAsignar, repartoPorPersona, ocultar, serieRitmo,
} from '../homeMobile';
import { RecurringTransaction, Transaction } from '../../types';

const tx = (date: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id: date + amount, type: 'expense', amount, category: 'other-expense',
  description: 'x', date, accountId: 'default', ...extra,
});

const rec = (amount: number, type: 'income' | 'expense', extra: Partial<RecurringTransaction> = {}): RecurringTransaction => ({
  id: String(amount) + type, type, amount, category: 'other-expense',
  description: 'r', frequency: 'monthly', nextDate: '2026-09-10T12:00:00.000Z',
  isActive: true, ...extra,
} as RecurringTransaction);

// 6 de setiembre: 6 dias transcurridos, 24 restantes de 30.
const HOY = new Date(2026, 8, 6);

describe('calcularResumenMes', () => {
  it('libre = ingresos - fijos - variable', () => {
    const r = calcularResumenMes(
      [tx('2026-09-01', 500), tx('2026-09-03', 300)],
      [rec(12177, 'income'), rec(7310, 'expense')],
      HOY
    );
    expect(r.ingresoMensual).toBe(12177);
    expect(r.fijosMensuales).toBe(7310);
    expect(r.gastoVariable).toBe(800);
    expect(r.libre).toBe(4067);
    expect(r.pctFijos).toBe(60);
  });

  it('no cuenta dos veces lo que ya es un recurrente', () => {
    // Un gasto con sourceRecurringId ya esta dentro de fijosMensuales.
    const r = calcularResumenMes(
      [tx('2026-09-02', 325.8, { sourceRecurringId: 'luz' })],
      [rec(1000, 'income'), rec(325.8, 'expense')],
      HOY
    );
    expect(r.gastoVariable).toBe(0);
    expect(r.libre).toBe(674.2);
  });

  it('ignora los movimientos de otros meses', () => {
    const r = calcularResumenMes([tx('2026-08-28', 999)], [], HOY);
    expect(r.gastoVariable).toBe(0);
  });

  it('calcula el ritmo y cuantas veces se excede', () => {
    // 600 en 6 dias = 100/dia. Libre 1200 en 24 dias = 50/dia sostenible.
    const r = calcularResumenMes(
      [tx('2026-09-01', 600)],
      [rec(1800, 'income'), rec(0, 'expense')],
      HOY
    );
    expect(r.diasTranscurridos).toBe(6);
    expect(r.diasRestantes).toBe(24);
    expect(r.ritmoDiario).toBe(100);
    expect(r.ritmoSostenible).toBe(50);
    expect(r.vecesElRitmo).toBe(2);
  });

  it('sin margen no inventa un multiplicador', () => {
    const r = calcularResumenMes([tx('2026-09-01', 5000)], [rec(1000, 'income')], HOY);
    expect(r.libre).toBeLessThan(0);
    expect(r.vecesElRitmo).toBeNull();
  });

  it('los recurrentes pausados no cuentan', () => {
    const r = calcularResumenMes([], [rec(500, 'expense', { isActive: false })], HOY);
    expect(r.fijosMensuales).toBe(0);
  });

  it('convierte frecuencias a su equivalente mensual', () => {
    const r = calcularResumenMes([], [rec(1200, 'expense', { frequency: 'yearly' })], HOY);
    expect(r.fijosMensuales).toBe(100);
  });
});

describe('gastoPorDia', () => {
  it('devuelve una entrada por dia del mes', () => {
    const d = gastoPorDia([tx('2026-09-03', 50), tx('2026-09-03', 25)], HOY);
    expect(d).toHaveLength(30);
    expect(d[2]).toEqual({ dia: 3, total: 75 });
    expect(d[0].total).toBe(0);
  });
});

describe('mayoresDelMes', () => {
  it('ordena de mayor a menor y recorta', () => {
    const r = mayoresDelMes([tx('2026-09-01', 10), tx('2026-09-02', 900), tx('2026-09-03', 50)], HOY, 2);
    expect(r.map(t => t.amount)).toEqual([900, 50]);
  });
});

describe('clasificar', () => {
  const recs = [
    rec(70, 'expense', { id: 'netflix', category: 'subscriptions' }),
    rec(325, 'expense', { id: 'luz', category: 'bills' }),
  ];
  it('sin origen recurrente es variable', () => {
    expect(clasificar(tx('2026-09-01', 10), recs)).toBe('var');
  });
  it('suscripcion gana sobre fijo', () => {
    expect(clasificar(tx('2026-09-01', 70, { sourceRecurringId: 'netflix' }), recs)).toBe('sub');
  });
  it('el resto de recurrentes es fijo', () => {
    expect(clasificar(tx('2026-09-01', 325, { sourceRecurringId: 'luz' }), recs)).toBe('fijo');
  });
});

describe('reparto y asignacion', () => {
  it('los pendientes salen ordenados por importe', () => {
    const r = pendientesDeAsignar([tx('2026-09-01', 10), tx('2026-09-02', 900, { paidBy: 'jorge' }), tx('2026-09-03', 500)]);
    expect(r.map(t => t.amount)).toEqual([500, 10]);
  });

  it('«ambos» reparte mitad y mitad', () => {
    const r = repartoPorPersona([tx('2026-09-01', 100, { paidBy: 'both' }), tx('2026-09-02', 60, { paidBy: 'jorge' })]);
    expect(r.jorge).toBe(110);
    expect(r.zumy).toBe(50);
    expect(r.asignados).toBe(160);
  });

  it('lo no asignado suma al total pero no a nadie', () => {
    const r = repartoPorPersona([tx('2026-09-01', 100)]);
    expect(r.total).toBe(100);
    expect(r.asignados).toBe(0);
    expect(r.jorge).toBe(0);
  });
});

describe('ocultar', () => {
  it('enmascara solo cuando toca', () => {
    expect(ocultar('S/ 4,059', false)).toBe('S/ 4,059');
    expect(ocultar('S/ 4,059', true)).toBe('S/ ••••');
  });
});

describe('serieRitmo', () => {
  const mes = (totales: number[]) =>
    totales.map((total, i) => ({ dia: i + 1, total }));

  it('termina en hoy y no recorre el mes entero', () => {
    // Todo gastado el dia 1, y hoy es el 7 de un mes de 30.
    const dias = mes([5635, ...Array(29).fill(0)]);
    const s = serieRitmo(dias, 5713.76, 7);
    const puntos = s.puntos.split(' ');
    expect(puntos).toHaveLength(7);
    // El ultimo punto cae en la marca de hoy, no en el borde derecho.
    expect(Number(puntos[6].split(',')[0])).toBeCloseTo(s.xHoy, 2);
    expect(s.xHoy).toBeCloseTo((6 / 29) * 100, 2);
    expect(s.xHoy).toBeLessThan(100);
  });

  it('deja la linea real por encima de la punteada cuando te pasas', () => {
    const dias = mes([1200, ...Array(29).fill(0)]);
    const s = serieRitmo(dias, 1000, 10);
    // El eje se estira al acumulado, asi que el presupuesto ya no toca el tope.
    expect(s.tope).toBe(1200);
    expect(s.yPresupuesto).toBeGreaterThan(4);
    // Y en y menor es mas arriba: lo real queda sobre la referencia.
    const yReal = Number(s.puntos.split(' ')[0].split(',')[1]);
    expect(yReal).toBeLessThan(s.yPresupuesto);
  });

  it('con el presupuesto sin agotar la punteada llega al tope', () => {
    const dias = mes([100, ...Array(29).fill(0)]);
    const s = serieRitmo(dias, 1000, 5);
    expect(s.tope).toBe(1000);
    expect(s.yPresupuesto).toBe(4);
  });

  it('el dia 1 dibuja un punto, no una serie vacia', () => {
    const s = serieRitmo(mes([50, ...Array(29).fill(0)]), 1000, 1);
    expect(s.puntos.split(' ')).toHaveLength(1);
    expect(s.xHoy).toBe(0);
  });
});
