import { describe, it, expect } from 'vitest';
import { collectSubscriptions, recurringToSubscription } from '../subscriptionDetector';
import { analyzeSavings } from '../savingsAnalyzer';
import { RecurringTransaction, Transaction } from '../../types';

const rec = (
  description: string, amount: number, nextDate: string, extra: Partial<RecurringTransaction> = {}
): RecurringTransaction => ({
  id: description, type: 'expense', amount, category: 'subscriptions',
  description, frequency: 'monthly', nextDate, isActive: true, ...extra,
});

// Los 14 recurrentes reales, tal como estan en produccion.
const REALES: RecurringTransaction[] = [
  rec('Netflix', 70.7, '2026-09-07T12:00:00.000Z'),
  rec('Youtube', 53.9, '2026-09-09T12:00:00.000Z'),
  rec('Spootify', 32.9, '2026-10-04T12:00:00.000Z'),
  rec('Claude', 75, '2026-09-12T12:00:00.000Z'),
  rec('Win_Internet', 159, '2026-09-10T12:00:00.000Z'),
  rec('Luz', 325.8, '2026-09-06T12:00:00.000Z'),
  rec('Streaming Restream', 71.25, '2026-09-18T12:00:00.000Z', { isActive: false }),
  rec('Pago', 13364.52, '2026-09-30T12:00:00.000Z', { type: 'income' }),
];

describe('collectSubscriptions', () => {
  it('incluye los recurrentes declarados aunque no haya historial', () => {
    // Reportado: Netflix no aparecia ni en Suscripciones ni en Ahorro.
    // detectSubscriptions exige 2 cargos del mismo comercio en transactions,
    // y estos viven en la coleccion recurring.
    const subs = collectSubscriptions([], REALES);
    expect(subs.map(s => s.normalizedName)).toContain('Netflix');
    expect(subs.map(s => s.normalizedName)).toContain('Spootify');
  });

  it('deja fuera los ingresos', () => {
    expect(collectSubscriptions([], REALES).map(s => s.normalizedName)).not.toContain('Pago');
  });

  it('un recurrente pausado queda descartado, no borrado', () => {
    const pausado = collectSubscriptions([], REALES).find(s => s.normalizedName === 'Streaming Restream');
    expect(pausado).toBeDefined();
    expect(pausado!.isDismissed).toBe(true);
  });

  it('el Centro de Ahorro ya ve los duplicados de streaming y musica', () => {
    // Con la lista vacia analyzeSavings no podia sugerir nada.
    const cuts = analyzeSavings(collectSubscriptions([], [
      rec('Netflix', 70.7, '2026-09-07T12:00:00.000Z'),
      rec('HBO Max', 40, '2026-09-08T12:00:00.000Z'),
    ]));
    expect(cuts.length).toBeGreaterThan(0);
    expect(cuts.some(c => c.reason === 'duplicate')).toBe(true);
  });

  it('marca la subida de precio', () => {
    const s = recurringToSubscription(rec('Netflix', 80, '2026-09-07T12:00:00.000Z', {
      previousAmounts: [{ date: '2026-06-01', amount: 70 }],
    }));
    expect(s.alerts).toHaveLength(1);
    expect(s.alerts[0].type).toBe('price_increase');
  });

  it('lee el dia del prefijo ISO, sin correrse por el huso', () => {
    expect(recurringToSubscription(rec('Luz', 325.8, '2026-09-06T12:00:00.000Z')).nextExpectedDate)
      .toBe('2026-09-06');
    expect(recurringToSubscription(rec('X', 10, '2026-09-01T00:00:00.000Z')).nextExpectedDate)
      .toBe('2026-09-01');
  });

  it('el ultimo cobro es un periodo antes del proximo', () => {
    expect(recurringToSubscription(rec('Netflix', 70.7, '2026-09-07T12:00:00.000Z')).lastChargeDate)
      .toBe('2026-08-07');
    expect(recurringToSubscription(rec('Dominio', 60, '2026-09-07T12:00:00.000Z', { frequency: 'yearly' })).lastChargeDate)
      .toBe('2025-09-07');
  });

  it('un recurrente diario se expresa como semanal sin perder magnitud', () => {
    const s = recurringToSubscription(rec('Cafe', 10, '2026-09-07T12:00:00.000Z', { frequency: 'daily' }));
    expect(s.frequency).toBe('weekly');
    expect(s.estimatedAmount).toBe(70);
  });

  it('ante el mismo nombre gana el declarado, sin duplicar', () => {
    const tx = (date: string): Transaction => ({
      id: date, type: 'expense', amount: 70.7, category: 'subscriptions',
      description: 'Netflix', date, accountId: 'default',
    });
    const subs = collectSubscriptions(
      [tx('2026-06-07'), tx('2026-07-07'), tx('2026-08-07')],
      [rec('Netflix', 70.7, '2026-09-07T12:00:00.000Z')]
    );
    expect(subs.filter(s => s.normalizedName.toLowerCase() === 'netflix')).toHaveLength(1);
    expect(subs.find(s => s.normalizedName.toLowerCase() === 'netflix')!.confidence).toBe('high');
  });
});

describe('descartes persistidos', () => {
  it('un id descartado vuelve marcado como tal', () => {
    // Reportado: marcar "No es suscripción" no se guardaba. La lista se
    // rearma desde recurring en cada visita, asi que el descarte tiene que
    // reaplicarse o el item reaparece.
    const subs = collectSubscriptions([], REALES, ['rec_Luz']);
    const luz = subs.find(s => s.normalizedName === 'Luz');
    expect(luz).toBeDefined();
    expect(luz!.isDismissed).toBe(true);
  });

  it('sin descartes nada cambia', () => {
    const luz = collectSubscriptions([], REALES).find(s => s.normalizedName === 'Luz');
    expect(luz!.isDismissed).toBe(false);
  });

  it('el descarte saca el item del Centro de Ahorro', () => {
    const conDuplicados = [
      rec('Netflix', 70.7, '2026-09-07T12:00:00.000Z'),
      rec('HBO Max', 40, '2026-09-08T12:00:00.000Z'),
    ];
    expect(analyzeSavings(collectSubscriptions([], conDuplicados)).length).toBeGreaterThan(0);
    // Descartado uno de los dos, ya no hay duplicado de streaming.
    const cuts = analyzeSavings(collectSubscriptions([], conDuplicados, ['rec_HBO Max']));
    expect(cuts.some(c => c.reason === 'duplicate')).toBe(false);
  });

  it('un id que ya no existe no rompe nada', () => {
    expect(() => collectSubscriptions([], REALES, ['rec_borrado_hace_meses'])).not.toThrow();
  });
});
