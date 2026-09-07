import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { collectSubscriptions, getUpcomingChargesIn30Days } from '../subscriptionDetector';
import { RecurringTransaction } from '../../types';

const rec = (description: string, nextDate: string, amount = 10): RecurringTransaction => ({
  id: description, type: 'expense', amount, category: 'subscriptions',
  description, frequency: 'monthly', nextDate, isActive: true,
});

// 6 de setiembre de 2026, 11:09 hora de Lima. La hora avanzada importa: con
// la comparacion anterior, un cobro de hoy quedaba fuera pasada la medianoche.
const AHORA = new Date(2026, 8, 6, 11, 9);

describe('getUpcomingChargesIn30Days', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(AHORA); });
  afterEach(() => { vi.useRealTimers(); });

  it('no adelanta el cobro un dia', () => {
    // Reportado: el panel mostraba Netflix como "5 set - Hoy" cuando en
    // realidad cobra el 7. Eran dos errores de un dia sumados: new Date()
    // leia "2026-09-07" como UTC (el 6 en Lima) y format() lo reescribia en
    // local, restando otro dia en cada vuelta del bucle.
    const charges = getUpcomingChargesIn30Days(
      collectSubscriptions([], [rec('Netflix', '2026-09-07T12:00:00.000Z', 70.7)])
    );
    expect(charges[0].date).toBe('2026-09-07');
  });

  it('un cobro de hoy sigue apareciendo aunque ya sea media maniana', () => {
    const charges = getUpcomingChargesIn30Days(
      collectSubscriptions([], [rec('Luz', '2026-09-06T12:00:00.000Z', 325.8)])
    );
    expect(charges[0].date).toBe('2026-09-06');
  });

  it('respeta el orden real de los cobros', () => {
    const charges = getUpcomingChargesIn30Days(collectSubscriptions([], [
      rec('Netflix', '2026-09-07T12:00:00.000Z'),
      rec('Luz', '2026-09-06T12:00:00.000Z'),
      rec('Youtube', '2026-09-09T12:00:00.000Z'),
    ]));
    expect(charges.slice(0, 3).map(c => `${c.subscription.normalizedName} ${c.date}`))
      .toEqual(['Luz 2026-09-06', 'Netflix 2026-09-07', 'Youtube 2026-09-09']);
  });

  it('un cobro de ayer se adelanta al siguiente periodo, no se repite hoy', () => {
    const charges = getUpcomingChargesIn30Days(
      collectSubscriptions([], [rec('Viejo', '2026-09-05T12:00:00.000Z')])
    );
    expect(charges[0].date).toBe('2026-10-05');
  });

  it('un mensual cae dos veces solo si ambas entran en la ventana', () => {
    // Desde el 6 de setiembre la ventana termina el 6 de octubre.
    const dentro = getUpcomingChargesIn30Days(
      collectSubscriptions([], [rec('Luz', '2026-09-06T12:00:00.000Z')])
    );
    expect(dentro.map(c => c.date)).toEqual(['2026-09-06', '2026-10-06']);

    // El cobro del 7 de octubre cae un dia despues del limite.
    const fuera = getUpcomingChargesIn30Days(
      collectSubscriptions([], [rec('Netflix', '2026-09-07T12:00:00.000Z')])
    );
    expect(fuera.map(c => c.date)).toEqual(['2026-09-07']);
  });

  it('los pausados no generan cobros', () => {
    const pausado = { ...rec('Restream', '2026-09-08T12:00:00.000Z'), isActive: false };
    expect(getUpcomingChargesIn30Days(collectSubscriptions([], [pausado]))).toHaveLength(0);
  });
});
