import { BankParser, Transaction } from '../types';
import { normalizeDescription } from '../utils/descriptionNormalizer';

export const bankParsers: BankParser[] = [
  // BCP / Yape
  {
    bankName: 'BCP / Yape',
    version: '1.0',
    detect: (headers: string[]) => {
      const joined = headers.join('|').toLowerCase();
      return (
        (joined.includes('fecha') && joined.includes('operación') && joined.includes('monto')) ||
        joined.includes('yape') ||
        (joined.includes('fecha') && joined.includes('descripción') && joined.includes('importe'))
      );
    },
    parse: (headers: string[], rows: string[][]): Omit<Transaction, 'id'>[] => {
      const dateIdx = headers.findIndex(h => /fecha/i.test(h));
      const descIdx = headers.findIndex(h => /descripci[oó]n|operaci[oó]n|concepto|glosa/i.test(h));
      const amountIdx = headers.findIndex(h => /monto|importe|cargo|abono/i.test(h));
      const typeIdx = headers.findIndex(h => /tipo/i.test(h));

      if (dateIdx === -1 || amountIdx === -1) return [];

      return rows
        .filter(row => row[dateIdx] && row[amountIdx])
        .map(row => {
          const rawAmount = parseFloat(String(row[amountIdx]).replace(/[^0-9.\-,]/g, '').replace(',', '.'));
          if (isNaN(rawAmount) || rawAmount === 0) return null;

          const desc = descIdx >= 0 ? row[descIdx] : 'Sin descripción';
          const normalized = normalizeDescription(desc);
          const type = rawAmount < 0 || (typeIdx >= 0 && /cargo|gasto|d[eé]bito/i.test(row[typeIdx]))
            ? 'expense' as const : 'income' as const;

          // Parse date
          const dateStr = row[dateIdx];
          let date = dateStr;
          const dmyMatch = dateStr.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
          if (dmyMatch) {
            date = `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
          }

          return {
            type,
            amount: Math.abs(rawAmount),
            category: normalized.suggestedCategory || (type === 'income' ? 'other-income' : 'other-expense'),
            description: normalized.normalizedName,
            date,
            accountId: '1',
          };
        })
        .filter((t): t is Omit<Transaction, 'id'> => t !== null);
    },
  },

  // Interbank
  {
    bankName: 'Interbank',
    version: '1.0',
    detect: (headers: string[]) => {
      const joined = headers.join('|').toLowerCase();
      return joined.includes('interbank') ||
        (joined.includes('fecha') && joined.includes('movimiento') && joined.includes('monto'));
    },
    parse: (headers: string[], rows: string[][]): Omit<Transaction, 'id'>[] => {
      const dateIdx = headers.findIndex(h => /fecha/i.test(h));
      const descIdx = headers.findIndex(h => /movimiento|descripci[oó]n|concepto/i.test(h));
      const amountIdx = headers.findIndex(h => /monto|importe/i.test(h));

      if (dateIdx === -1 || amountIdx === -1) return [];

      return rows
        .filter(row => row[dateIdx] && row[amountIdx])
        .map(row => {
          const rawAmount = parseFloat(String(row[amountIdx]).replace(/[^0-9.\-,]/g, '').replace(',', '.'));
          if (isNaN(rawAmount) || rawAmount === 0) return null;

          const desc = descIdx >= 0 ? row[descIdx] : '';
          const normalized = normalizeDescription(desc);
          const type = rawAmount < 0 ? 'expense' as const : 'income' as const;

          const dateStr = row[dateIdx];
          let date = dateStr;
          const dmyMatch = dateStr.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
          if (dmyMatch) {
            date = `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
          }

          return {
            type,
            amount: Math.abs(rawAmount),
            category: normalized.suggestedCategory || (type === 'income' ? 'other-income' : 'other-expense'),
            description: normalized.normalizedName,
            date,
            accountId: '1',
          };
        })
        .filter((t): t is Omit<Transaction, 'id'> => t !== null);
    },
  },

  // BBVA Continental
  {
    bankName: 'BBVA',
    version: '1.0',
    detect: (headers: string[]) => {
      const joined = headers.join('|').toLowerCase();
      return joined.includes('bbva') ||
        (joined.includes('fecha') && joined.includes('referencia') && (joined.includes('cargo') || joined.includes('abono')));
    },
    parse: (headers: string[], rows: string[][]): Omit<Transaction, 'id'>[] => {
      const dateIdx = headers.findIndex(h => /fecha/i.test(h));
      const descIdx = headers.findIndex(h => /referencia|descripci[oó]n|concepto/i.test(h));
      const cargoIdx = headers.findIndex(h => /cargo|d[eé]bito/i.test(h));
      const abonoIdx = headers.findIndex(h => /abono|cr[eé]dito/i.test(h));
      const amountIdx = headers.findIndex(h => /monto|importe/i.test(h));

      if (dateIdx === -1) return [];

      return rows
        .filter(row => row[dateIdx])
        .map(row => {
          let amount = 0;
          let type: 'income' | 'expense' = 'expense';

          if (cargoIdx >= 0 && abonoIdx >= 0) {
            const cargo = parseFloat(String(row[cargoIdx] || '0').replace(/[^0-9.\-,]/g, '').replace(',', '.'));
            const abono = parseFloat(String(row[abonoIdx] || '0').replace(/[^0-9.\-,]/g, '').replace(',', '.'));
            if (!isNaN(abono) && abono > 0) { amount = abono; type = 'income'; }
            else if (!isNaN(cargo) && cargo > 0) { amount = cargo; type = 'expense'; }
            else return null;
          } else if (amountIdx >= 0) {
            const raw = parseFloat(String(row[amountIdx]).replace(/[^0-9.\-,]/g, '').replace(',', '.'));
            if (isNaN(raw) || raw === 0) return null;
            amount = Math.abs(raw);
            type = raw < 0 ? 'expense' : 'income';
          } else {
            return null;
          }

          const desc = descIdx >= 0 ? row[descIdx] : '';
          const normalized = normalizeDescription(desc);

          const dateStr = row[dateIdx];
          let date = dateStr;
          const dmyMatch = dateStr.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
          if (dmyMatch) {
            date = `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
          }

          return {
            type,
            amount,
            category: normalized.suggestedCategory || (type === 'income' ? 'other-income' : 'other-expense'),
            description: normalized.normalizedName,
            date,
            accountId: '1',
          };
        })
        .filter((t): t is Omit<Transaction, 'id'> => t !== null);
    },
  },

  // Scotiabank
  {
    bankName: 'Scotiabank',
    version: '1.0',
    detect: (headers: string[]) => {
      const joined = headers.join('|').toLowerCase();
      return joined.includes('scotiabank') ||
        (joined.includes('fecha') && joined.includes('detalle') && joined.includes('monto'));
    },
    parse: (headers: string[], rows: string[][]): Omit<Transaction, 'id'>[] => {
      const dateIdx = headers.findIndex(h => /fecha/i.test(h));
      const descIdx = headers.findIndex(h => /detalle|descripci[oó]n/i.test(h));
      const amountIdx = headers.findIndex(h => /monto|importe/i.test(h));

      if (dateIdx === -1 || amountIdx === -1) return [];

      return rows
        .filter(row => row[dateIdx] && row[amountIdx])
        .map(row => {
          const rawAmount = parseFloat(String(row[amountIdx]).replace(/[^0-9.\-,]/g, '').replace(',', '.'));
          if (isNaN(rawAmount) || rawAmount === 0) return null;

          const desc = descIdx >= 0 ? row[descIdx] : '';
          const normalized = normalizeDescription(desc);
          const type = rawAmount < 0 ? 'expense' as const : 'income' as const;

          const dateStr = row[dateIdx];
          let date = dateStr;
          const dmyMatch = dateStr.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
          if (dmyMatch) {
            date = `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
          }

          return {
            type,
            amount: Math.abs(rawAmount),
            category: normalized.suggestedCategory || (type === 'income' ? 'other-income' : 'other-expense'),
            description: normalized.normalizedName,
            date,
            accountId: '1',
          };
        })
        .filter((t): t is Omit<Transaction, 'id'> => t !== null);
    },
  },
];
