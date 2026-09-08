import { CurrencyType } from '../types';

/**
 * Conversion entre monedas, sin nada alrededor.
 *
 * Vive aparte de fx.ts a proposito: alli hay fetch, localStorage y MSAL, y esto
 * es aritmetica. Separado se puede probar de verdad, que sobre tipos de cambio
 * importa: si derivar y volver a anclar no son inversas exactas, cada guardado
 * desplaza la tasa un poco y nadie lo nota hasta que las cifras no cuadran.
 */

export type FxRates = Record<CurrencyType, number>;

/**
 * Soles por unidad. Es el pivote: en almacenamiento las tasas SIEMPRE van
 * ancladas asi --que es como las publica el servidor-- y se derivan a la
 * moneda del hogar al leerlas. Anclar a un pivote fijo evita que la misma
 * cifra guardada signifique una cosa u otra segun quien la lea.
 */
export const DEFAULT_FX_RATES: FxRates = {
  PEN: 1,
  USD: 3.50,
  EUR: 4.00,
};

/** El simbolo de cada moneda, en un solo sitio. */
export function simboloDe(c: CurrencyType | string): string {
  return c === 'USD' ? '$' : c === 'EUR' ? '€' : 'S/';
}

/**
 * El idioma con el que se agrupan las cifras. No es lo mismo que el simbolo:
 * decide si mil doscientos treinta y cuatro con cincuenta y seis se escribe
 * 1,234.56 o 1.234,56. Estaba fijo en es-PE, asi que un hogar en euros veia
 * «1,234.56 €», que a quien usa euros le parece un error de tipeo.
 */
export function localeDe(c: CurrencyType | string): string {
  return c === 'USD' ? 'en-US' : c === 'EUR' ? 'es-ES' : 'es-PE';
}

/**
 * La moneda del hogar. Vive aqui --y no en fx.ts-- porque de ella depende el
 * formato de cada cifra de la aplicacion, y calculations.ts no puede importar
 * fx.ts sin arrastrar MSAL y localStorage detras.
 */
let monedaBase: CurrencyType = 'PEN';

export function fijarMonedaBase(c: string | undefined): void {
  if (c === 'PEN' || c === 'USD' || c === 'EUR') monedaBase = c;
}

export function getMonedaBase(): CurrencyType {
  return monedaBase;
}

/** El idioma de la moneda del hogar. */
export function localeActual(): string {
  return localeDe(monedaBase);
}

/**
 * De soles-por-unidad a base-por-unidad. Dividir entre lo que vale la base
 * deja la base en 1, que es lo que significa «la moneda de la casa».
 */
export function relativas(enPen: FxRates, base: CurrencyType): FxRates {
  const div = enPen[base] > 0 ? enPen[base] : 1;
  return { PEN: enPen.PEN / div, USD: enPen.USD / div, EUR: enPen.EUR / div };
}

/** El camino de vuelta, para guardar lo que el usuario escribe en su moneda. */
export function aPen(rel: FxRates): FxRates {
  const relPen = rel.PEN > 0 ? rel.PEN : 1;
  return { PEN: 1, USD: rel.USD / relPen, EUR: rel.EUR / relPen };
}
