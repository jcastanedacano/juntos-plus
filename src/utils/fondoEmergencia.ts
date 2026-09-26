import { SavingsGoal, RecurringTransaction } from '../types';
import { toMonthlyAmount } from './recurringCalculations';
import { FxRates } from './fxTasas';

/**
 * Fondo de emergencia: una meta cuyo objetivo NO se escribe a mano sino que se
 * deduce de lo que cuesta vivir cada mes.
 *
 *   objetivo = gasto recurrente mensual x meses de cobertura
 *
 * Los recurrentes son la base porque son lo que no se puede dejar de pagar:
 * alquiler, servicios, suscripciones. Con un ingreso en pausa es eso lo que
 * hay que seguir cubriendo.
 *
 * El objetivo se DERIVA al pintar, no se guarda como verdad: si sube el
 * alquiler, el fondo lo sabe solo, sin que nadie tenga que acordarse de
 * editar la meta.
 */

export const MESES_POR_DEFECTO = 3;

/** Los que se ofrecen en pantalla: el minimo habitual y el prudente. */
export const MESES_OFRECIDOS = [3, 6] as const;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function esFondoEmergencia(g: Pick<SavingsGoal, 'tipo'>): boolean {
  return g.tipo === 'emergencia';
}

/** Un numero de meses que no sea razonable vuelve al minimo habitual. */
export function normalizarMeses(m: unknown): number {
  if (m === null || m === undefined || m === '') return MESES_POR_DEFECTO;
  const n = Math.round(Number(m));
  return Number.isFinite(n) && n >= 1 && n <= 24 ? n : MESES_POR_DEFECTO;
}

/**
 * Lo que cuestan al mes los gastos recurrentes que siguen activos. Los
 * ingresos recurrentes no cuentan --el sueldo no es un gasto-- y tampoco los
 * pausados, que hoy no se estan pagando.
 *
 * Recibe los recurrentes YA proyectados a la moneda del hogar: aqui no se
 * convierte nada.
 */
export function gastoRecurrenteMensual(recurrentes: RecurringTransaction[]): number {
  const total = recurrentes
    .filter(r => r.type === 'expense' && r.isActive)
    .reduce((s, r) => s + toMonthlyAmount(r), 0);
  return round2(total);
}

/** El objetivo del fondo para ese gasto y esa cobertura. */
export function metaFondo(gastoMensual: number, meses: unknown): number {
  return round2(gastoMensual * normalizarMeses(meses));
}

/**
 * Cuantos meses de gasto cubre lo ahorrado. Sale de la propia meta --el
 * objetivo ES gasto x meses--, asi que no hace falta conocer el gasto ni su
 * moneda.
 */
export function mesesCubiertos(g: Pick<SavingsGoal, 'currentAmount' | 'targetAmount' | 'mesesCobertura'>): number {
  if (!(g.targetAmount > 0)) return 0;
  return (Math.max(0, g.currentAmount) / g.targetAmount) * normalizarMeses(g.mesesCobertura);
}

/** De la moneda del hogar a la de la meta, con tasas ya relativas a la base. */
function desdeBase(monto: number, moneda: string | undefined, base: string, tasas: FxRates): number {
  if (!moneda || moneda === base) return monto;
  const tasa = (tasas as unknown as Record<string, number>)[moneda];
  return tasa > 0 ? monto / tasa : monto;
}

/**
 * Pone al dia el objetivo de cada fondo de emergencia. Devuelve la MISMA lista
 * si nada cambia, para no provocar repintados de algo que no se movio.
 *
 * - Sin gasto recurrente no hay de que derivar nada: el objetivo se deja como
 *   esta. Ponerlo a cero marcaria el fondo como cumplido con 0 ahorrado.
 * - Si la meta esta en otra moneda que la del hogar, el objetivo se convierte
 *   a la de la meta, que es en la que esta apuntado lo ahorrado.
 */
export function aplicarMetaEmergencia(
  metas: SavingsGoal[],
  gastoMensualBase: number,
  base: string,
  tasas: FxRates,
): SavingsGoal[] {
  if (!(gastoMensualBase > 0) || !metas.some(esFondoEmergencia)) return metas;

  let cambio = false;
  const salida = metas.map(g => {
    if (!esFondoEmergencia(g)) return g;
    const objetivo = round2(desdeBase(metaFondo(gastoMensualBase, g.mesesCobertura), g.currency, base, tasas));
    if (Math.abs(objetivo - g.targetAmount) < 0.005) return g;
    cambio = true;
    return { ...g, targetAmount: objetivo };
  });
  return cambio ? salida : metas;
}

/** La meta nueva, lista para guardar. El objetivo real lo pone aplicarMetaEmergencia. */
export function nuevoFondoEmergencia(
  gastoMensualBase: number,
  meses: unknown,
  ahora: Date = new Date(),
): Omit<SavingsGoal, 'id'> {
  const m = normalizarMeses(meses);
  const plazo = new Date(ahora);
  plazo.setFullYear(plazo.getFullYear() + 1);
  return {
    name: 'Fondo de emergencia',
    tipo: 'emergencia',
    mesesCobertura: m,
    targetAmount: metaFondo(gastoMensualBase, m),
    currentAmount: 0,
    deadline: plazo.toISOString(),
    startDate: ahora.toISOString(),
    isActive: true,
    icon: '🛟',
    color: '#02B08D',
    description: `Cubre ${m} meses de tus gastos recurrentes`,
  };
}
