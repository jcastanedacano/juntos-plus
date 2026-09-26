import { describe, it, expect } from 'vitest';
import {
  normalizarMesada, gastoPersonalDelMes, estadoDe, calcularMesada, calcularMesadas,
} from '../mesada';
import { Transaction } from '../../types';

const gasto = (id: string, date: string, amount: number, owner?: Transaction['owner'], extra: Partial<Transaction> = {}): Transaction => ({
  id, type: 'expense', amount, category: 'entertainment', description: id, date, accountId: 'a1', owner, ...extra,
});

const SEPT = new Date(2026, 8, 15);

describe('normalizar el monto', () => {
  it('acepta un numero positivo y lo redondea a centimos', () => {
    expect(normalizarMesada(300)).toBe(300);
    expect(normalizarMesada('250.5')).toBe(250.5);
    expect(normalizarMesada(10.006)).toBe(10.01);
  });

  it('cualquier otra cosa no es una mesada', () => {
    for (const malo of [0, -50, NaN, Infinity, undefined, null, '', 'abc']) {
      expect(normalizarMesada(malo)).toBe(0);
    }
  });
});

describe('lo que gasto cada quien con lo suyo', () => {
  const t = [
    gasto('a', '2026-09-03', 40, 'me'),
    gasto('b', '2026-09-20', 60, 'me'),
    gasto('c', '2026-09-05', 500, 'shared'),   // de la casa: no sale de la mesada
    gasto('d', '2026-09-06', 80, 'partner'),
    gasto('e', '2026-09-07', 25),              // sin duenio: es compartido
  ];

  it('suma solo los gastos con su nombre', () => {
    expect(gastoPersonalDelMes(t, 'me', SEPT)).toBe(100);
    expect(gastoPersonalDelMes(t, 'partner', SEPT)).toBe(80);
  });

  it('lo compartido y lo que no tiene duenio no cuentan', () => {
    expect(gastoPersonalDelMes([gasto('x', '2026-09-01', 999, 'shared'), gasto('y', '2026-09-01', 999)], 'me', SEPT)).toBe(0);
  });

  it('solo el mes en curso: ni el anterior ni el siguiente', () => {
    const otros = [gasto('ago', '2026-08-31', 70, 'me'), gasto('oct', '2026-10-01', 90, 'me'), gasto('sep', '2026-09-15', 10, 'me')];
    expect(gastoPersonalDelMes(otros, 'me', SEPT)).toBe(10);
  });

  it('los ingresos y los ajustes de saldo no son gasto', () => {
    const raros = [
      { ...gasto('i', '2026-09-02', 500, 'me'), type: 'income' as const },
      gasto('adj_1699', '2026-09-02', 700, 'me'),
      gasto('real', '2026-09-02', 30, 'me'),
    ];
    expect(gastoPersonalDelMes(raros, 'me', SEPT)).toBe(30);
  });

  it('una fecha ilegible no rompe la suma', () => {
    expect(gastoPersonalDelMes([gasto('x', 'no-es-fecha', 50, 'me'), gasto('y', '2026-09-02', 5, 'me')], 'me', SEPT)).toBe(5);
  });

  it('suma en centimos sin arrastrar error de coma flotante', () => {
    expect(gastoPersonalDelMes([gasto('a', '2026-09-01', 0.1, 'me'), gasto('b', '2026-09-02', 0.2, 'me')], 'me', SEPT)).toBe(0.3);
  });
});

describe('estado de la mesada', () => {
  it('sin mesada no hay estado que juzgar', () => {
    expect(estadoDe(0, 500)).toBe('sin_mesada');
  });

  it('dentro, cerca (desde el 80%) y excedida', () => {
    expect(estadoDe(100, 50)).toBe('dentro');
    expect(estadoDe(100, 79.99)).toBe('dentro');
    expect(estadoDe(100, 80)).toBe('cerca');
    expect(estadoDe(100, 100)).toBe('cerca');   // gastarla justo no es pasarse
    expect(estadoDe(100, 100.01)).toBe('excedida');
  });
});

describe('calcular la mesada', () => {
  it('cuanto queda y cuanto lleva gastado', () => {
    const m = calcularMesada([gasto('a', '2026-09-03', 120, 'me')], 'me', 300, SEPT);
    expect(m.asignada).toBe(300);
    expect(m.gastado).toBe(120);
    expect(m.restante).toBe(180);
    expect(m.avance).toBeCloseTo(0.4, 10);
    expect(m.estado).toBe('dentro');
  });

  it('pasarse deja el restante en negativo, para poder decir cuanto', () => {
    const m = calcularMesada([gasto('a', '2026-09-03', 350, 'me')], 'me', 300, SEPT);
    expect(m.restante).toBe(-50);
    expect(m.estado).toBe('excedida');
  });

  it('sin mesada fijada, avance null y sin dividir entre cero', () => {
    const m = calcularMesada([gasto('a', '2026-09-03', 350, 'me')], 'me', undefined, SEPT);
    expect(m.asignada).toBe(0);
    expect(m.avance).toBeNull();
    expect(m.estado).toBe('sin_mesada');
  });

  it('cada persona con la suya, sin mezclar', () => {
    const t = [gasto('a', '2026-09-03', 50, 'me'), gasto('b', '2026-09-03', 90, 'partner')];
    const r = calcularMesadas(t, { mesadaMe: 100, mesadaPartner: 100 }, SEPT);
    expect(r.me.estado).toBe('dentro');
    expect(r.partner.estado).toBe('cerca');
    expect(r.me.gastado).toBe(50);
    expect(r.partner.gastado).toBe(90);
  });

  it('una sin fijar y la otra fijada', () => {
    const r = calcularMesadas([], { mesadaMe: 200 }, SEPT);
    expect(r.me.estado).toBe('dentro');
    expect(r.partner.estado).toBe('sin_mesada');
  });
});
