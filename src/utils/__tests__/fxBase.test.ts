import { describe, it, expect } from 'vitest';
import {
  relativas, aPen, simboloDe, DEFAULT_FX_RATES,
  convertirImporte, proyectarABase, proyectarMetaABase,
} from '../fxTasas';

/**
 * Las tasas se guardan ancladas a soles y se derivan a la moneda del hogar.
 * Si esas dos conversiones no son inversas exactas, una edicion a mano
 * desplaza la tasa un poquito cada vez que se guarda, y nadie lo nota hasta
 * que las cifras dejan de cuadrar.
 */

const PEN = { PEN: 1, USD: 3.5, EUR: 4 };

describe('de soles a la moneda del hogar', () => {
  it('con soles como base no cambia nada', () => {
    expect(relativas(PEN, 'PEN')).toEqual(PEN);
  });

  it('con euros como base, la base vale 1 y el resto se divide', () => {
    const r = relativas(PEN, 'EUR');
    expect(r.EUR).toBe(1);
    expect(r.USD).toBeCloseTo(0.875, 10);   // 3.5 / 4
    expect(r.PEN).toBeCloseTo(0.25, 10);    // 1 / 4
  });

  it('con dolares como base', () => {
    const r = relativas(PEN, 'USD');
    expect(r.USD).toBe(1);
    expect(r.EUR).toBeCloseTo(4 / 3.5, 10);
    expect(r.PEN).toBeCloseTo(1 / 3.5, 10);
  });

  it('una tasa cero o ausente no divide entre cero', () => {
    const r = relativas({ PEN: 1, USD: 0, EUR: 4 }, 'USD');
    expect(Number.isFinite(r.PEN)).toBe(true);
    expect(Number.isFinite(r.EUR)).toBe(true);
  });
});

describe('ida y vuelta', () => {
  it('derivar y volver a anclar devuelve lo mismo', () => {
    for (const base of ['PEN', 'USD', 'EUR'] as const) {
      const vuelta = aPen(relativas(PEN, base));
      expect(vuelta.PEN).toBeCloseTo(1, 10);
      expect(vuelta.USD).toBeCloseTo(3.5, 10);
      expect(vuelta.EUR).toBeCloseTo(4, 10);
    }
  });

  // El caso real: un hogar en euros edita «1 USD = 0,90 €». Lo que se guarda
  // tiene que seguir siendo soles por unidad, coherente con el resto.
  it('editar en euros se guarda anclado a soles', () => {
    const enEuros = { ...relativas(PEN, 'EUR'), USD: 0.9 };
    const guardado = aPen(enEuros);
    expect(guardado.PEN).toBe(1);
    expect(guardado.EUR).toBeCloseTo(4, 10);       // no se toco
    expect(guardado.USD).toBeCloseTo(3.6, 10);     // 0.9 euros x 4 soles/euro
  });
});

describe('simbolos', () => {
  it('uno por moneda, y soles por defecto', () => {
    expect(simboloDe('PEN')).toBe('S/');
    expect(simboloDe('USD')).toBe('$');
    expect(simboloDe('EUR')).toBe('€');
    expect(simboloDe('loquesea')).toBe('S/');
  });

  it('los valores por defecto siguen siendo soles por unidad', () => {
    expect(DEFAULT_FX_RATES.PEN).toBe(1);
    expect(DEFAULT_FX_RATES.USD).toBeGreaterThan(1);
  });
});

describe('convertir un importe segun su moneda', () => {
  const rel = relativas(PEN, 'EUR'); // hogar en euros: EUR=1, USD≈0.875, PEN=0.25

  it('sin moneda propia, el importe no cambia: ya esta en la base', () => {
    expect(convertirImporte(100, undefined, 'EUR', rel)).toBe(100);
  });

  it('en la propia moneda de la base, tampoco cambia', () => {
    expect(convertirImporte(100, 'EUR', 'EUR', rel)).toBe(100);
  });

  it('en otra moneda, se multiplica por su tasa relativa', () => {
    expect(convertirImporte(100, 'USD', 'EUR', rel)).toBeCloseTo(87.5, 10);
    expect(convertirImporte(100, 'PEN', 'EUR', rel)).toBeCloseTo(25, 10);
  });

  it('una moneda sin tasa conocida no revienta: se trata como 1', () => {
    expect(convertirImporte(100, 'BTC', 'EUR', rel)).toBe(100);
  });
});

describe('proyectar una lista a la base', () => {
  const rel = relativas(PEN, 'EUR');

  it('deja intacto lo que ya esta en la base o no tiene moneda', () => {
    const items = [{ id: 'a', amount: 10 }, { id: 'b', amount: 20, currency: 'EUR' }];
    const salida = proyectarABase(items, 'EUR', rel);
    expect(salida).toEqual(items);
    // Sin moneda propia, ni siquiera se copia el objeto: menos trabajo en
    // cada render de algo que no cambio.
    expect(salida[0]).toBe(items[0]);
  });

  it('convierte lo que trae otra moneda y la deja marcada como la base', () => {
    const items = [{ id: 'c', amount: 50, currency: 'USD' }];
    const salida = proyectarABase(items, 'EUR', rel);
    expect(salida[0].amount).toBeCloseTo(43.75, 10);
    expect(salida[0].currency).toBe('EUR');
  });

  it('no muta el original: la lista de origen sigue en dolares', () => {
    const items = [{ id: 'd', amount: 50, currency: 'USD' }];
    proyectarABase(items, 'EUR', rel);
    expect(items[0].currency).toBe('USD');
    expect(items[0].amount).toBe(50);
  });
});

describe('proyectar metas a la base', () => {
  const rel = relativas(PEN, 'EUR');

  it('convierte los DOS importes de una meta en otra moneda', () => {
    const metas = [{ id: 'm1', targetAmount: 1000, currentAmount: 400, currency: 'USD' }];
    const salida = proyectarMetaABase(metas, 'EUR', rel);
    expect(salida[0].targetAmount).toBeCloseTo(875, 10);
    expect(salida[0].currentAmount).toBeCloseTo(350, 10);
    expect(salida[0].currency).toBe('EUR');
  });

  it('una meta sin moneda propia se queda igual', () => {
    const metas = [{ id: 'm2', targetAmount: 1000, currentAmount: 400 }];
    expect(proyectarMetaABase(metas, 'EUR', rel)).toEqual(metas);
  });
});
