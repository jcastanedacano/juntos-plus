import { describe, it, expect } from 'vitest';
import {
  gastoMensualPromedio, numeroIndependencia, gastoQueSostiene, progreso,
  normalizarTasa, calcularIndependencia, TASA_POR_DEFECTO,
} from '../independencia';
import { calculateNetWorth } from '../netWorth';
import { Transaction, Investment, Account } from '../../types';

const gasto = (id: string, date: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id, type: 'expense', amount, category: 'food', description: id, date, accountId: 'a1', ...extra,
});

// «Hoy» es el 15 de septiembre de 2026: los meses completos son agosto hacia atras.
const HOY = new Date(2026, 8, 15);

describe('gasto mensual promedio', () => {
  it('promedia los meses completos y deja fuera el mes en curso', () => {
    const t = [
      gasto('a', '2026-08-10', 1000),
      gasto('b', '2026-07-10', 2000),
      gasto('c', '2026-06-10', 3000),
      gasto('actual', '2026-09-02', 99999), // a mitad de mes: no cuenta
    ];
    const r = gastoMensualPromedio(t, HOY);
    expect(r.promedio).toBe(2000);
    expect(r.mesesConDatos).toBe(3);
    expect(r.suficiente).toBe(true);
  });

  it('suma varios gastos del mismo mes antes de promediar', () => {
    const t = [
      gasto('a1', '2026-08-01', 400), gasto('a2', '2026-08-20', 600),
      gasto('b1', '2026-07-05', 1000),
      gasto('c1', '2026-06-05', 1000),
    ];
    expect(gastoMensualPromedio(t, HOY).promedio).toBe(1000);
  });

  it('un mes sin ningun gasto no se promedia como cero', () => {
    // Junio vacio: casi seguro es un mes sin apuntar, no un mes gratis.
    const t = [gasto('a', '2026-08-10', 1000), gasto('b', '2026-07-10', 1000), gasto('c', '2026-05-10', 1000)];
    const r = gastoMensualPromedio(t, HOY);
    expect(r.promedio).toBe(1000);
    expect(r.mesesConDatos).toBe(3);
  });

  it('con menos de tres meses no es suficiente, pero dice lo que hay', () => {
    const r = gastoMensualPromedio([gasto('a', '2026-08-10', 800), gasto('b', '2026-07-10', 1200)], HOY);
    expect(r.suficiente).toBe(false);
    expect(r.mesesConDatos).toBe(2);
    expect(r.promedio).toBe(1000);
  });

  it('ignora los ingresos y los ajustes de saldo', () => {
    const t = [
      gasto('a', '2026-08-10', 1000),
      { ...gasto('i', '2026-08-11', 5000), type: 'income' as const },
      gasto('adj_1699999', '2026-08-12', 7777),
    ];
    const r = gastoMensualPromedio(t, HOY);
    expect(r.promedio).toBe(1000);
    expect(r.mesesConDatos).toBe(1);
  });

  it('solo mira la ventana: un gasto de hace un año no entra', () => {
    const r = gastoMensualPromedio([gasto('viejo', '2025-08-10', 5000)], HOY);
    expect(r.mesesConDatos).toBe(0);
    expect(r.promedio).toBe(0);
  });

  it('el limite de la ventana: seis meses atras entra, siete no', () => {
    const dentro = gastoMensualPromedio([gasto('x', '2026-03-10', 100)], HOY);
    const fuera = gastoMensualPromedio([gasto('y', '2026-02-10', 100)], HOY);
    expect(dentro.mesesConDatos).toBe(1);
    expect(fuera.mesesConDatos).toBe(0);
  });

  it('cruza el cambio de año sin perder meses', () => {
    const t = [gasto('a', '2026-01-10', 300), gasto('b', '2025-12-10', 300), gasto('c', '2025-11-10', 300)];
    const r = gastoMensualPromedio(t, new Date(2026, 1, 10)); // febrero de 2026
    expect(r.mesesConDatos).toBe(3);
  });

  it('una fecha ilegible no rompe la cuenta', () => {
    const r = gastoMensualPromedio([gasto('a', 'no-es-fecha', 100), gasto('b', '2026-08-10', 500)], HOY);
    expect(r.promedio).toBe(500);
  });
});

describe('numero de independencia', () => {
  it('gasto anual dividido entre la tasa: 1.000 al mes con el 4% son 300.000', () => {
    expect(numeroIndependencia(1000, 0.04)).toBeCloseTo(300000, 6);
  });

  it('con una tasa mas prudente la meta sube', () => {
    expect(numeroIndependencia(1000, 0.03)).toBeCloseTo(400000, 6);
  });

  it('una tasa inutil vuelve al 4% en vez de dividir entre cero', () => {
    for (const mala of [0, -1, NaN, undefined, null, '', 5, 0.0001]) {
      expect(normalizarTasa(mala)).toBe(TASA_POR_DEFECTO);
    }
    expect(Number.isFinite(numeroIndependencia(1000, 0))).toBe(true);
  });

  it('acepta las tasas razonables tal cual', () => {
    expect(normalizarTasa(0.03)).toBe(0.03);
    expect(normalizarTasa('0.035')).toBe(0.035);
  });
});

describe('cuanto sostiene el patrimonio', () => {
  it('es la inversa: 300.000 al 4% sostienen 1.000 al mes', () => {
    expect(gastoQueSostiene(300000, 0.04)).toBeCloseTo(1000, 6);
  });

  it('un patrimonio negativo no sostiene nada, ni resta', () => {
    expect(gastoQueSostiene(-5000, 0.04)).toBe(0);
  });
});

describe('progreso', () => {
  it('fraccion de la meta, y pasa de 1 cuando se supera', () => {
    expect(progreso(150000, 300000)).toBe(0.5);
    expect(progreso(450000, 300000)).toBe(1.5);
  });

  it('sin meta no hay progreso que contar', () => {
    expect(progreso(1000, 0)).toBeNull();
  });

  it('un patrimonio negativo es 0%, no un porcentaje negativo', () => {
    expect(progreso(-100, 300000)).toBe(0);
  });
});

describe('calcularIndependencia', () => {
  const cuentas = [
    { id: 'a1', name: 'Debito', type: 'debit', balance: 20000 },
    { id: 'c1', name: 'Tarjeta', type: 'credit', balance: 5000, creditLimit: 10000 },
  ] as unknown as Account[];
  const inversiones: Investment[] = [
    { id: 'i1', name: 'Fondo', type: 'stocks', initialAmount: 40000, currentAmount: 50000, purchaseDate: '2025-01-01' },
    { id: 'i2', name: 'Depa', type: 'realestate', initialAmount: 100000, currentAmount: 120000, purchaseDate: '2020-01-01' },
  ];
  const txns = [
    gasto('a', '2026-08-10', 1000), gasto('b', '2026-07-10', 1000), gasto('c', '2026-06-10', 1000),
  ];

  it('el neto cuenta el inmueble y el invertible no', () => {
    const neto = calculateNetWorth(cuentas, inversiones);
    const r = calcularIndependencia({ transacciones: txns, neto, inversiones, ref: HOY });
    expect(r.patrimonioNeto).toBe(20000 + 50000 + 120000 - 5000); // 185.000
    expect(r.patrimonioInvertible).toBe(65000);                   // sin el depa
    expect(r.numero).toBeCloseTo(300000, 6);
    expect(r.progresoNeto).toBeCloseTo(185000 / 300000, 10);
    expect(r.progresoInvertible).toBeCloseTo(65000 / 300000, 10);
  });

  it('con datos insuficientes no inventa el numero ni el progreso', () => {
    const neto = calculateNetWorth(cuentas, inversiones);
    const r = calcularIndependencia({
      transacciones: [gasto('a', '2026-08-10', 1000)], neto, inversiones, ref: HOY,
    });
    expect(r.numero).toBeNull();
    expect(r.progresoNeto).toBeNull();
    expect(r.progresoInvertible).toBeNull();
    // Lo que si se sabe sin gasto: cuanto sostiene el patrimonio que hay.
    expect(r.sostieneNeto).toBeGreaterThan(0);
  });

  it('la tasa elegida cambia la meta', () => {
    const neto = calculateNetWorth(cuentas, inversiones);
    const r = calcularIndependencia({ transacciones: txns, neto, inversiones, tasa: 0.03, ref: HOY });
    expect(r.tasa).toBe(0.03);
    expect(r.numero).toBeCloseTo(400000, 6);
  });
});
