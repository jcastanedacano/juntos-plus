import { describe, it, expect } from 'vitest';
import { relativas, aPen, simboloDe, DEFAULT_FX_RATES } from '../fxTasas';

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
