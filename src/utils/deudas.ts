import { Debt } from '../types';

/**
 * Deudas que no son la tarjeta, y en que orden conviene pagarlas.
 *
 * Dos estrategias clasicas:
 *   - bola de nieve: primero la que termina antes (menos cuotas restantes).
 *     Cada deuda saldada libera su cuota para la siguiente, y la primera
 *     victoria llega pronto, que es lo que hace que se mantenga.
 *   - avalancha: primero la de mayor tasa. Es la que menos intereses paga en
 *     total, matematicamente.
 *
 * Todo aqui recibe las deudas YA en la moneda del hogar: no se convierte nada.
 * La TEA es una fraccion (0.185 = 18,5 %), igual que en el resto de la app.
 */

export type Estrategia = 'bola_de_nieve' | 'avalancha';

export const ESTRATEGIA_POR_DEFECTO: Estrategia = 'avalancha';

export const ESTRATEGIAS: { id: Estrategia; nombre: string; explicacion: string }[] = [
  { id: 'avalancha', nombre: 'Avalancha', explicacion: 'Primero la de mayor tasa: es la que menos intereses paga.' },
  { id: 'bola_de_nieve', nombre: 'Bola de nieve', explicacion: 'Primero la que termina antes: la primera victoria llega pronto.' },
];

/** Cuantos meses se simula como maximo: 50 anos. Mas alla es que no se salda. */
export const MAX_MESES = 600;

const round2 = (n: number) => Math.round(n * 100) / 100;
const CERO = 0.005;

export function normalizarEstrategia(e: unknown): Estrategia {
  return e === 'bola_de_nieve' || e === 'avalancha' ? e : ESTRATEGIA_POR_DEFECTO;
}

/** Un monto que no sea un numero finito y no negativo no es un pago extra. */
export function normalizarExtra(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? round2(n) : 0;
}

/**
 * De TEA anual a tasa mensual equivalente: (1 + TEA)^(1/12) - 1. Dividir la
 * TEA entre 12 sobrestima el interes, porque la TEA ya incluye capitalizar.
 */
export function tasaMensual(tea: number): number {
  return tea > 0 && Number.isFinite(tea) ? Math.pow(1 + tea, 1 / 12) - 1 : 0;
}

/**
 * Cuantas cuotas hacen falta para saldar ese saldo pagando siempre lo mismo.
 * Infinity si la cuota no cubre ni el interes del mes: la deuda crece.
 */
export function cuotasParaSaldar(saldo: number, tea: number, cuota: number): number {
  if (!(saldo > CERO)) return 0;
  if (!(cuota > 0)) return Infinity;
  const r = tasaMensual(tea);
  if (r === 0) return Math.ceil(saldo / cuota - 1e-9);
  const razon = (saldo * r) / cuota;
  if (razon >= 1) return Infinity;
  return Math.ceil(-Math.log(1 - razon) / Math.log(1 + r) - 1e-9);
}

/** Las cuotas que faltan: las que dio el usuario, o las que salen de la cuenta. */
export function cuotasRestantesDe(d: Debt): number {
  const dadas = Number(d.remainingInstallments);
  if (Number.isFinite(dadas) && dadas >= 1) return Math.round(dadas);
  return cuotasParaSaldar(d.balance, d.tea, d.monthlyPayment);
}

const vivas = (ds: Debt[]) => ds.filter(d => d.isActive !== false && d.balance > CERO);

/**
 * El orden en que se atacan. Fijo: se calcula una vez y es lo que se le
 * ensena a la persona, en vez de un orden que cambia cada mes.
 * Los empates se rompen por el saldo menor, que se termina antes.
 */
export function ordenDePago(deudas: Debt[], estrategia: Estrategia): Debt[] {
  const lista = vivas(deudas).slice();
  if (estrategia === 'bola_de_nieve') {
    return lista.sort((a, b) => {
      const ca = cuotasRestantesDe(a);
      const cb = cuotasRestantesDe(b);
      // Infinity - Infinity da NaN: dos deudas que nunca terminan empatan.
      if (ca !== cb) return ca < cb ? -1 : 1;
      return a.balance - b.balance;
    });
  }
  return lista.sort((a, b) => (b.tea - a.tea) || (a.balance - b.balance));
}

export interface DeudaSaldada {
  id: string;
  nombre: string;
  /** Mes, contado desde hoy, en que queda en cero. */
  mes: number;
}

export interface ResultadoPago {
  estrategia: Estrategia;
  /** Los ids en el orden en que se atacan. */
  orden: string[];
  /** Meses hasta no deber nada; null si con estos pagos no se salda. */
  meses: number | null;
  interesTotal: number;
  totalPagado: number;
  saldadas: DeudaSaldada[];
  /** Las que siguen vivas al llegar al tope: sus cuotas no cubren el interes. */
  sinFin: string[];
  /** Lo que se paga cada mes en total: las cuotas mas el extra. */
  presupuestoMensual: number;
}

/**
 * Simula mes a mes:
 *   1. corre el interes de cada deuda viva;
 *   2. se paga la cuota de cada una;
 *   3. lo que sobra del presupuesto --extra mas las cuotas de las ya
 *      saldadas-- va a la primera del orden, y de ahi a la siguiente.
 * El presupuesto es constante: por eso una deuda saldada no «libera dinero»
 * que se pierda, sigue pagando la siguiente. Ese es el efecto de bola de
 * nieve, y vale igual para la avalancha.
 */
export function simularPago(deudas: Debt[], extra: unknown, estrategia: Estrategia): ResultadoPago {
  const orden = ordenDePago(deudas, estrategia);
  const extraMensual = normalizarExtra(extra);
  const saldo = new Map(orden.map(d => [d.id, d.balance]));
  const tasa = new Map(orden.map(d => [d.id, tasaMensual(d.tea)]));
  const presupuesto = orden.reduce((s, d) => s + Math.max(0, d.monthlyPayment), 0) + extraMensual;

  let interesTotal = 0;
  let totalPagado = 0;
  const saldadas: DeudaSaldada[] = [];
  const yaSaldada = new Set<string>();

  const resultado = (meses: number | null): ResultadoPago => ({
    estrategia,
    orden: orden.map(d => d.id),
    meses,
    interesTotal: round2(interesTotal),
    totalPagado: round2(totalPagado),
    saldadas,
    sinFin: orden.filter(d => (saldo.get(d.id) || 0) > CERO).map(d => d.id),
    presupuestoMensual: round2(presupuesto),
  });

  if (orden.length === 0) return resultado(0);

  const marcar = (d: Debt, mes: number) => {
    if ((saldo.get(d.id) || 0) <= CERO && !yaSaldada.has(d.id)) {
      saldo.set(d.id, 0);
      yaSaldada.add(d.id);
      saldadas.push({ id: d.id, nombre: d.name, mes });
    }
  };

  for (let mes = 1; mes <= MAX_MESES; mes++) {
    for (const d of orden) {
      const s = saldo.get(d.id) || 0;
      if (s <= CERO) continue;
      const interes = s * (tasa.get(d.id) || 0);
      saldo.set(d.id, s + interes);
      interesTotal += interes;
    }

    let disponible = presupuesto;
    for (const d of orden) {
      const s = saldo.get(d.id) || 0;
      if (s <= CERO) continue;
      const pago = Math.min(Math.max(0, d.monthlyPayment), s, disponible);
      saldo.set(d.id, s - pago);
      disponible -= pago;
      totalPagado += pago;
    }
    for (const d of orden) {
      if (disponible <= CERO) break;
      const s = saldo.get(d.id) || 0;
      if (s <= CERO) continue;
      const pago = Math.min(disponible, s);
      saldo.set(d.id, s - pago);
      disponible -= pago;
      totalPagado += pago;
    }

    for (const d of orden) marcar(d, mes);
    if (saldadas.length === orden.length) return resultado(mes);
  }

  return resultado(null);
}

export interface ComparacionEstrategias {
  bolaDeNieve: ResultadoPago;
  avalancha: ResultadoPago;
  /** La que paga menos intereses; 'igual' si no hay diferencia. */
  masBarata: Estrategia | 'igual';
  /** Lo que ahorra la mas barata frente a la otra. Nunca negativo. */
  interesAhorrado: number;
  /** Meses de diferencia entre una y otra; null si alguna no se salda. */
  mesesDeDiferencia: number | null;
}

export function compararEstrategias(deudas: Debt[], extra: unknown): ComparacionEstrategias {
  const bolaDeNieve = simularPago(deudas, extra, 'bola_de_nieve');
  const avalancha = simularPago(deudas, extra, 'avalancha');
  const dif = round2(bolaDeNieve.interesTotal - avalancha.interesTotal);
  const masBarata: ComparacionEstrategias['masBarata'] =
    Math.abs(dif) < 0.01 ? 'igual' : dif > 0 ? 'avalancha' : 'bola_de_nieve';
  return {
    bolaDeNieve,
    avalancha,
    masBarata,
    interesAhorrado: Math.abs(dif),
    mesesDeDiferencia:
      bolaDeNieve.meses === null || avalancha.meses === null
        ? null
        : Math.abs(bolaDeNieve.meses - avalancha.meses),
  };
}

export interface TotalesDeuda {
  saldo: number;
  cuotasMensuales: number;
  /** TEA media ponderada por saldo; 0 si no hay saldo. */
  teaMedia: number;
}

export function totalesDeuda(deudas: Debt[]): TotalesDeuda {
  const v = vivas(deudas);
  const saldo = v.reduce((s, d) => s + d.balance, 0);
  const cuotas = v.reduce((s, d) => s + Math.max(0, d.monthlyPayment), 0);
  const ponderada = saldo > 0 ? v.reduce((s, d) => s + d.tea * d.balance, 0) / saldo : 0;
  return { saldo: round2(saldo), cuotasMensuales: round2(cuotas), teaMedia: ponderada };
}
