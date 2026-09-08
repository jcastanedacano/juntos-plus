import type { RecurringTransaction, Transaction } from '../src/types';

/**
 * Datos de escaparate. Inventados a mano: ni un nombre ni una cifra sale de
 * una cuenta real. Estan calibrados para que las capturas muestren la app
 * trabajando --un mes a medias, con margen ajustado-- y no un estado vacio.
 */
const gasto = (
  date: string, amount: number, description: string, category: string,
  extra: Partial<Transaction> = {}
): Transaction => ({
  id: date + description, type: 'expense', amount, description, category,
  date: date + 'T12:00:00.000Z', accountId: 'default', ...extra,
});

export const transacciones: Transaction[] = [
  gasto('2026-09-01', 1450, 'Alquiler', 'home', { sourceRecurringId: 'r1', paidBy: 'both' }),
  gasto('2026-09-02', 44.9, 'Netflix', 'subscriptions', { sourceRecurringId: 'r2' }),
  gasto('2026-09-03', 128.4, 'Mercado del barrio', 'food', { paidBy: 'me' }),
  gasto('2026-09-04', 62, 'Taxi al aeropuerto', 'transport', { paidBy: 'partner' }),
  gasto('2026-09-05', 219.9, 'Zapatillas', 'shopping', { paidBy: 'me' }),
  gasto('2026-09-06', 38.5, 'Almuerzo en el centro', 'food', { paidBy: 'both' }),
  gasto('2026-09-08', 95, 'Farmacia', 'health'),
  gasto('2026-09-09', 26.9, 'Spotify', 'subscriptions', { sourceRecurringId: 'r3' }),
  gasto('2026-09-10', 310, 'Luz y agua', 'bills', { sourceRecurringId: 'r4', paidBy: 'both' }),
  gasto('2026-09-11', 74.2, 'Verduras y fruta', 'food', { paidBy: 'partner' }),
  gasto('2026-09-12', 52, 'Cena del viernes', 'food'),
  { id: 'i1', type: 'income', amount: 6800, description: 'Sueldo', category: 'salary',
    date: '2026-09-01T12:00:00.000Z', accountId: 'default' },
];

const rec = (
  id: string, description: string, amount: number, category: string, dia: number
): RecurringTransaction => ({
  id, description, amount, category, type: 'expense', frequency: 'monthly',
  nextDate: `2026-10-${String(dia).padStart(2, '0')}T12:00:00.000Z`,
  isActive: true, accountId: 'default',
} as RecurringTransaction);

export const recurrentes: RecurringTransaction[] = [
  { id: 'ing', description: 'Sueldo', amount: 6800, category: 'salary', type: 'income',
    frequency: 'monthly', nextDate: '2026-10-01T12:00:00.000Z', isActive: true,
    accountId: 'default' } as RecurringTransaction,
  rec('r1', 'Alquiler', 1450, 'home', 1),
  rec('r4', 'Luz y agua', 310, 'bills', 10),
  rec('r2', 'Netflix', 44.9, 'subscriptions', 2),
  rec('r3', 'Spotify', 26.9, 'subscriptions', 9),
  rec('r5', 'Gimnasio', 89, 'health', 5),
];
