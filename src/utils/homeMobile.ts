import { PaidBy, RecurringTransaction, Transaction } from '../types';
import { parseDateOnly } from './stableDate';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getCategoryById } from './categoryHelpers';

/**
 * Derivados de la pantalla de Inicio movil (handoff 1c).
 *
 * Todo aca es puro y sin dependencias de React, para poder fijarlo con tests:
 * son las cifras que el usuario lee primero y equivocarlas es peor que no
 * mostrarlas.
 */

/** Equivalente mensual de un recurrente, sea cual sea su frecuencia. */
export function toMonthly(r: RecurringTransaction): number {
  switch (r.frequency) {
    case 'daily': return r.amount * 30;
    case 'weekly': return r.amount * 4.33;
    case 'yearly': return r.amount / 12;
    default: return r.amount;
  }
}

export interface ResumenMes {
  ingresoMensual: number;
  fijosMensuales: number;
  /** Gasto no recurrente registrado en el mes en curso. */
  gastoVariable: number;
  /** Lo que queda tras fijos y variable. Puede ser negativo. */
  libre: number;
  diasTranscurridos: number;
  diasRestantes: number;
  /** Gasto variable por dia transcurrido. */
  ritmoDiario: number;
  /** Lo que se podria gastar por dia con lo que queda. */
  ritmoSostenible: number;
  /**
   * Cuantas veces el ritmo actual supera al sostenible. null cuando no hay
   * dias restantes o no hay nada libre con lo que comparar.
   */
  vecesElRitmo: number | null;
  /** % de los ingresos que se van en cargos automaticos. */
  pctFijos: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function mismoMes(d: Date, ref: Date): boolean {
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

export function calcularResumenMes(
  transactions: Transaction[],
  recurring: RecurringTransaction[],
  hoy: Date = new Date()
): ResumenMes {
  const activos = recurring.filter(r => r.isActive);
  const ingresoMensual = activos
    .filter(r => r.type === 'income')
    .reduce((s, r) => s + toMonthly(r), 0);
  const fijosMensuales = activos
    .filter(r => r.type === 'expense')
    .reduce((s, r) => s + toMonthly(r), 0);

  // Solo el gasto que NO viene de un recurrente: los fijos ya estan contados
  // arriba y sumarlos otra vez descontaria dos veces lo mismo.
  const gastoVariable = transactions
    .filter(t => t.type === 'expense' && !t.sourceRecurringId)
    .filter(t => mismoMes(parseDateOnly(t.date), hoy))
    .reduce((s, t) => s + t.amount, 0);

  const diasDelMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  const diasTranscurridos = Math.max(1, hoy.getDate());
  const diasRestantes = Math.max(0, diasDelMes - diasTranscurridos);

  const libre = ingresoMensual - fijosMensuales - gastoVariable;
  const ritmoDiario = gastoVariable / diasTranscurridos;
  const ritmoSostenible = diasRestantes > 0 ? Math.max(0, libre) / diasRestantes : 0;

  return {
    ingresoMensual: round2(ingresoMensual),
    fijosMensuales: round2(fijosMensuales),
    gastoVariable: round2(gastoVariable),
    libre: round2(libre),
    diasTranscurridos,
    diasRestantes,
    ritmoDiario: round2(ritmoDiario),
    ritmoSostenible: round2(ritmoSostenible),
    vecesElRitmo:
      ritmoSostenible > 0 ? round2(ritmoDiario / ritmoSostenible) : null,
    pctFijos: ingresoMensual > 0 ? Math.round((fijosMensuales / ingresoMensual) * 100) : 0,
  };
}

/** Gasto total por dia del mes indicado, para el grafico de barras. */
export function gastoPorDia(
  transactions: Transaction[],
  mes: Date
): { dia: number; total: number }[] {
  const dias = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const out = Array.from({ length: dias }, (_, i) => ({ dia: i + 1, total: 0 }));
  for (const t of transactions) {
    if (t.type !== 'expense') continue;
    const d = parseDateOnly(t.date);
    if (!mismoMes(d, mes)) continue;
    out[d.getDate() - 1].total = round2(out[d.getDate() - 1].total + t.amount);
  }
  return out;
}

/** Los movimientos mas grandes del mes, ya ordenados. */
export function mayoresDelMes(
  transactions: Transaction[],
  mes: Date,
  limite = 4
): Transaction[] {
  return transactions
    .filter(t => t.type === 'expense' && mismoMes(parseDateOnly(t.date), mes))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limite);
}

export type ClaseMovimiento = 'var' | 'fijo' | 'sub';

/**
 * Clasifica un movimiento. `sub` gana sobre `fijo`: una suscripcion tambien
 * es un cargo fijo, y el filtro mas especifico es el util.
 */
export function clasificar(
  t: Transaction,
  recurring: RecurringTransaction[]
): ClaseMovimiento {
  if (!t.sourceRecurringId) return 'var';
  const r = recurring.find(x => x.id === t.sourceRecurringId);
  if (r && r.category === 'subscriptions') return 'sub';
  return 'fijo';
}

/**
 * Los movimientos de mayor importe que aun no tienen autor. Son los que mas
 * mueven el reparto, asi que asignarlos primero es lo que hace util la vista
 * de «Nosotros» con el menor trabajo.
 */
export function pendientesDeAsignar(
  transactions: Transaction[],
  limite = 12
): Transaction[] {
  return transactions
    .filter(t => t.type === 'expense' && !t.paidBy)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limite);
}

/**
 * Traduce los valores que se guardaron cuando el tipo llevaba nombres
 * propios. Todo lo que lea paidBy tiene que pasar por aqui: los movimientos
 * ya escritos siguen diciendo 'jorge' y 'zumy', y no se reescribe el archivo
 * --tocar datos financieros para renombrar una etiqueta no compensa--.
 */
export function normalizarPaidBy(valor: string | undefined): PaidBy | undefined {
  if (!valor) return undefined;
  if (valor === 'jorge') return 'me';
  if (valor === 'zumy') return 'partner';
  if (valor === 'me' || valor === 'partner' || valor === 'both') return valor;
  return undefined;
}

/** Reparto por persona de lo ya asignado. */
export function repartoPorPersona(transactions: Transaction[]): {
  me: number;
  partner: number;
  asignados: number;
  total: number;
} {
  let me = 0;
  let partner = 0;
  let asignados = 0;
  let total = 0;
  for (const t of transactions) {
    if (t.type !== 'expense') continue;
    total += t.amount;
    const quien = normalizarPaidBy(t.paidBy);
    if (!quien) continue;
    asignados += t.amount;
    if (quien === 'me') me += t.amount;
    else if (quien === 'partner') partner += t.amount;
    else {
      me += t.amount / 2;
      partner += t.amount / 2;
    }
  }
  return { me: round2(me), partner: round2(partner), asignados: round2(asignados), total: round2(total) };
}

/** Enmascara una cifra cuando el modo privado esta activo. */
export function ocultar(valor: string, oculto: boolean): string {
  return oculto ? 'S/ ••••' : valor;
}


/**
 * Nombre legible de una categoria. Los ids son internos y en ingles
 * ('other-expense', 'subscriptions'), y se estaban pintando crudos en una
 * app que por lo demas esta toda en espaniol.
 */
export function nombreCategoria(id: string): string {
  return getCategoryById(id)?.name ?? id;
}

/** «1 de septiembre», con la inicial en mayuscula y el mes en minuscula. */
export function diaLargo(d: Date): string {
  const t = format(d, "d 'de' MMMM", { locale: es });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Geometria del grafico de ritmo, en el espacio del viewBox. */
export interface SerieRitmo {
  /** Puntos del acumulado real, de dia 1 a hoy. */
  puntos: string;
  /** x de la marca de hoy. */
  xHoy: number;
  /** y donde termina la diagonal del gasto parejo. */
  yPresupuesto: number;
  /** Maximo del eje: el presupuesto, o el acumulado si lo supera. */
  tope: number;
}

/**
 * Acumulado real contra la diagonal del gasto parejo.
 *
 * Dos decisiones que el dibujo hace o no hace legible:
 *
 * El eje va de 0 al presupuesto, y se estira hasta el acumulado cuando este
 * lo pasa. Recortando en el presupuesto, un mes pasado de gasto se dibujaba
 * igual que uno justo --los dos tocando el techo--; estirando, la linea real
 * cruza por encima de la punteada y eso ya es un dato.
 *
 * Y la serie termina hoy. Recorriendo el mes entero, los dias que no han
 * pasado suman cero y la linea seguia plana hasta el borde derecho, que se
 * lee como un mes terminado sin gastar nada mas.
 */
export function serieRitmo(
  dias: { dia: number; total: number }[],
  presupuesto: number,
  diasTranscurridos: number,
  TOPE = 4,
  BASE = 36
): SerieRitmo {
  const acumuladoTotal = dias.reduce((a, d) => a + d.total, 0);
  const tope = Math.max(presupuesto, acumuladoTotal, 1);
  const alturaDe = (valor: number) => BASE - Math.min(valor / tope, 1) * (BASE - TOPE);
  const xDelDia = (i: number) => (i / Math.max(dias.length - 1, 1)) * 100;
  const hasta = Math.min(Math.max(diasTranscurridos, 1), dias.length);

  let acumulado = 0;
  const puntos = dias
    .slice(0, hasta)
    .map((d, i) => {
      acumulado += d.total;
      return `${xDelDia(i).toFixed(2)},${alturaDe(acumulado).toFixed(2)}`;
    })
    .join(' ');

  return {
    puntos,
    xHoy: xDelDia(hasta - 1),
    yPresupuesto: alturaDe(presupuesto),
    tope,
  };
}
