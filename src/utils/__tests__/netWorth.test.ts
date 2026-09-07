import { describe, it, expect } from 'vitest';
import { calculateNetWorth, investmentsByType } from '../netWorth';
import { Account, Investment } from '../../types';

const cuenta = (id: string, name: string, balance: number, type: Account['type'] = 'debit'): Account =>
  ({ id, name, balance, color: '#000', icon: 'wallet', type });

const inv = (id: string, name: string, cost: number, value: number, type: Investment['type'] = 'stocks'): Investment =>
  ({ id, name, type, initialAmount: cost, currentAmount: value, purchaseDate: '2026-01-01' });

describe('calculateNetWorth', () => {
  it('devuelve ceros sin datos', () => {
    const r = calculateNetWorth([], []);
    expect(r.netWorth).toBe(0);
    expect(r.investmentGainPct).toBeNull();
  });

  it('activos menos pasivos', () => {
    const r = calculateNetWorth(
      [cuenta('a', 'Ahorros', 10000), cuenta('t', 'Visa', 3500, 'credit')],
      [inv('i', 'ETF', 5000, 6200)]
    );
    expect(r.totalCash).toBe(10000);
    expect(r.totalInvested).toBe(6200);
    expect(r.totalAssets).toBe(16200);
    expect(r.totalLiabilities).toBe(3500);
    expect(r.netWorth).toBe(12700);
  });

  it('calcula el rendimiento de las inversiones', () => {
    const r = calculateNetWorth([], [inv('a', 'ETF', 1000, 1250), inv('b', 'BTC', 1000, 750, 'crypto')]);
    expect(r.investedCost).toBe(2000);
    expect(r.totalInvested).toBe(2000);
    expect(r.investmentGain).toBe(0);
    expect(r.investmentGainPct).toBe(0);
  });

  it('el patrimonio puede ser negativo si la deuda supera los activos', () => {
    const r = calculateNetWorth([cuenta('a', 'Cuenta', 500), cuenta('t', 'Visa', 4000, 'credit')], []);
    expect(r.netWorth).toBe(-3500);
  });

  it('un saldo a favor en la tarjeta no cuenta como deuda', () => {
    // balance negativo = pagaste de mas; no es un pasivo.
    const r = calculateNetWorth([cuenta('t', 'Visa', -200, 'credit')], []);
    expect(r.totalLiabilities).toBe(0);
  });

  it('ordena los activos de mayor a menor', () => {
    const r = calculateNetWorth([cuenta('a', 'Chica', 100), cuenta('b', 'Grande', 900)], [inv('i', 'Media', 400, 400)]);
    expect(r.assets.map(x => x.label)).toEqual(['Grande', 'Media', 'Chica']);
  });

  it('no arrastra errores de coma flotante', () => {
    const r = calculateNetWorth([cuenta('a', 'A', 0.1), cuenta('b', 'B', 0.2)], []);
    expect(r.totalAssets).toBe(0.3);
  });
});

describe('investmentsByType', () => {
  it('agrupa por tipo y ordena por monto', () => {
    const r = investmentsByType([
      inv('a', 'ETF1', 100, 500), inv('b', 'ETF2', 100, 300),
      inv('c', 'BTC', 100, 1000, 'crypto'),
    ]);
    expect(r).toEqual([
      { type: 'crypto', label: 'Cripto', total: 1000 },
      { type: 'stocks', label: 'Acciones / ETFs', total: 800 },
    ]);
  });
});
