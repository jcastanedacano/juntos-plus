import { Account, Investment } from '../types';

/**
 * Patrimonio neto = activos - pasivos.
 *
 * Activos: saldo de las cuentas de debito mas el valor actual de las
 * inversiones. Pasivos: lo usado en las tarjetas de credito.
 *
 * Ni Account ni Investment guardan moneda, asi que todo se trata como PEN.
 * Si algun dia llevan moneda, la conversion entra aca y no en la vista.
 */

export type NetWorthKind = 'cash' | 'investment' | 'credit';

export interface NetWorthItem {
  id: string;
  label: string;
  amount: number;
  kind: NetWorthKind;
  /** Solo para inversiones: cuanto se puso y cuanto vale hoy. */
  cost?: number;
  gain?: number;
}

export interface NetWorthBreakdown {
  assets: NetWorthItem[];
  liabilities: NetWorthItem[];
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  totalCash: number;
  totalInvested: number;
  investedCost: number;
  investmentGain: number;
  /** Rendimiento en %, null cuando no hay costo del que partir. */
  investmentGainPct: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calculateNetWorth(
  accounts: Account[],
  investments: Investment[]
): NetWorthBreakdown {
  const assets: NetWorthItem[] = [];
  const liabilities: NetWorthItem[] = [];

  let totalCash = 0;
  for (const a of accounts.filter(x => x.type !== 'credit')) {
    totalCash += a.balance;
    assets.push({ id: a.id, label: a.name, amount: a.balance, kind: 'cash' });
  }

  let investedCost = 0;
  let totalInvested = 0;
  for (const inv of investments) {
    const value = inv.currentAmount;
    const cost = inv.initialAmount;
    totalInvested += value;
    investedCost += cost;
    assets.push({
      id: inv.id,
      label: inv.name,
      amount: value,
      kind: 'investment',
      cost,
      gain: round2(value - cost),
    });
  }

  let totalLiabilities = 0;
  for (const a of accounts.filter(x => x.type === 'credit')) {
    // En este modelo `balance` de una tarjeta es lo consumido, no un saldo a
    // favor. Un valor negativo seria un saldo a favor y no es una deuda.
    const used = Math.max(0, a.balance);
    if (used === 0 && !a.creditLimit) continue;
    totalLiabilities += used;
    liabilities.push({ id: a.id, label: a.name, amount: used, kind: 'credit' });
  }

  const totalAssets = totalCash + totalInvested;
  const investmentGain = totalInvested - investedCost;

  return {
    assets: assets.sort((x, y) => y.amount - x.amount),
    liabilities: liabilities.sort((x, y) => y.amount - x.amount),
    totalAssets: round2(totalAssets),
    totalLiabilities: round2(totalLiabilities),
    netWorth: round2(totalAssets - totalLiabilities),
    totalCash: round2(totalCash),
    totalInvested: round2(totalInvested),
    investedCost: round2(investedCost),
    investmentGain: round2(investmentGain),
    investmentGainPct: investedCost > 0 ? round2((investmentGain / investedCost) * 100) : null,
  };
}

export const INVESTMENT_TYPE_LABEL: Record<Investment['type'], string> = {
  stocks: 'Acciones / ETFs',
  crypto: 'Cripto',
  bonds: 'Bonos',
  realestate: 'Inmuebles',
  other: 'Otro',
};

/** Valor actual agrupado por tipo, para el desglose de la vista. */
export function investmentsByType(investments: Investment[]): { type: Investment['type']; label: string; total: number }[] {
  const totals = new Map<Investment['type'], number>();
  for (const inv of investments) {
    totals.set(inv.type, (totals.get(inv.type) || 0) + inv.currentAmount);
  }
  return [...totals.entries()]
    .map(([type, total]) => ({ type, label: INVESTMENT_TYPE_LABEL[type], total: round2(total) }))
    .sort((a, b) => b.total - a.total);
}
