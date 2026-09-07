import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// El servidor es CommonJS; exporta solo los helpers puros del resumen.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildDigest, limaDateStr, addDaysStr } = require('../../../server.cjs');

const rec = (nextDate: string, amount: number, description: string, extra: any = {}) => ({
  id: description, type: 'expense', amount, category: 'other-expense',
  description, frequency: 'monthly', nextDate, isActive: true, ...extra,
});

// 6 de setiembre de 2026, 20:00 UTC = 15:00 en Lima. La hora tardia importa:
// es cuando un dia calendario leido en UTC todavia coincide con Lima.
const AHORA = new Date('2026-09-06T20:00:00.000Z');

describe('resumen diario de push', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(AHORA); });
  afterEach(() => { vi.useRealTimers(); });

  it('lee el dia de Lima, no el UTC', () => {
    expect(limaDateStr()).toBe('2026-09-06');
    // 02:00 UTC del dia 7 siguen siendo las 21:00 del dia 6 en Lima.
    expect(limaDateStr(new Date('2026-09-07T02:00:00.000Z'))).toBe('2026-09-06');
  });

  it('suma dias sin correrse de fecha', () => {
    expect(addDaysStr('2026-09-06', 3)).toBe('2026-09-09');
    expect(addDaysStr('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDaysStr('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('incluye solo los cobros de los proximos 3 dias', () => {
    const d = buildDigest({ recurring: [
      rec('2026-09-06T12:00:00.000Z', 325.8, 'Luz'),        // hoy
      rec('2026-09-07T12:00:00.000Z', 70.7, 'Netflix'),      // manana
      rec('2026-09-09T12:00:00.000Z', 53.9, 'Youtube'),      // dentro de 3
      rec('2026-09-29T12:00:00.000Z', 6785.76, 'Prestamo'),  // fuera
      rec('2026-09-05T12:00:00.000Z', 99, 'Ayer'),           // pasado
    ]});
    expect(d.body).toContain('Luz');
    expect(d.body).toContain('hoy');
    expect(d.body).toContain('manana');
    expect(d.body).not.toContain('Prestamo');
    expect(d.body).not.toContain('Ayer');
    expect(d.title).toBe('S/ 450.40 en cobros esta semana');
  });

  it('ignora los recurrentes pausados', () => {
    expect(buildDigest({ recurring: [
      rec('2026-09-07T12:00:00.000Z', 70.7, 'Netflix', { isActive: false }),
    ]})).toBeNull();
  });

  it('el ingreso no suma al total de cobros pero si se lista', () => {
    const d = buildDigest({ recurring: [
      rec('2026-09-07T12:00:00.000Z', 5000, 'Pago', { type: 'income' }),
      rec('2026-09-07T12:00:00.000Z', 70.7, 'Netflix'),
    ]});
    expect(d.title).toBe('S/ 70.70 en cobros esta semana');
    expect(d.body).toContain('Pago');
  });

  it('avisa de subidas de precio aunque no haya cobros cercanos', () => {
    const d = buildDigest({ recurring: [
      rec('2026-12-01T12:00:00.000Z', 80, 'Netflix', {
        previousAmounts: [{ date: '2026-06-01', amount: 70 }],
      }),
    ]});
    expect(d.title).toBe('Cambios en tus suscripciones');
    expect(d.body).toContain('1 suscripcion subio de precio');
  });

  it('no manda nada cuando no hay novedades', () => {
    expect(buildDigest({ recurring: [] })).toBeNull();
    expect(buildDigest({})).toBeNull();
  });
});
