import { Transaction, CurrencyType } from '../types';
import { getMyOwnerRole } from './userIdentity';

// BCP/Yape exports Moneda as 'S/', '$', or '€'. Map to the app's CurrencyType.
const parseCurrency = (moneda: string): CurrencyType => {
  const m = (moneda || '').trim();
  if (m === '$' || /USD/i.test(m)) return 'USD';
  if (m === '€' || /EUR/i.test(m)) return 'EUR';
  return 'PEN';
};

// Mapeo de categorías BCP/Yape a categorías de la app
const categoryMapping: { [key: string]: string } = {
  'Delivery/Transporte': 'transport',
  'Transferencias': 'other-expense',
  'Educación': 'education',
  'Suscripciones/Tecnología': 'subscriptions',
  'Retiros': 'other-expense',
  'Servicios': 'bills',
  'Restaurantes': 'food',
  'Transporte Público': 'transport',
  'Financiero': 'bills',
  'Rechazos': 'other-expense',
  'Configuración': 'other-expense',
  'Otros': 'other-expense',
};

// Tipos de transacciones que son ingresos
const incomeTypes = ['Ingreso', 'Deposito', 'Transferencia Recibida'];

// Tipos de transacciones que deben ser ignoradas:
//   - Rechazo / Configuración        → not a real movement
//   - Disposición Efectivo (débito)  → bookkeeping echo of the credit-card
//     cash advance. The canonical entry comes from the credit-card PDF /
//     Outlook "Operación con tu Tarjeta de Crédito" email instead.
//   - Operación Crédito (sin descripción) → empty-description sibling
//     of the consumo notification; same charge appears with merchant
//     detail elsewhere.
const ignoredTypes = ['Rechazo', 'Configuración', 'Disposición Efectivo', 'Operación Crédito'];

export const convertBcpYapeToTransaction = (
  fecha: string,
  tipo: string,
  categoria: string,
  descripcion: string,
  moneda: string,
  monto: string
): Transaction | null => {
  // Ignorar transacciones rechazadas o configuraciones
  if (ignoredTypes.includes(tipo)) {
    return null;
  }

  // Ignorar si el monto es N/A o 0
  if (monto === 'N/A' || monto === '0.00' || monto === '0') {
    return null;
  }

  // Parsear fecha (formato: "2025-10-17 12:00:42")
  const date = fecha.split(' ')[0]; // Toma solo la fecha

  // Determinar si es ingreso o gasto
  const isIncome = incomeTypes.some(incomeType =>
    tipo.toLowerCase().includes(incomeType.toLowerCase())
  );

  // Obtener categoría mapeada
  const mappedCategory = categoryMapping[categoria] || 'other-expense';

  // Parsear monto
  const amount = parseFloat(monto.replace(',', ''));

  // Honor the Moneda column — BCP/Yape rows tagged with $ are real USD
  // transactions (Claude subscription, ESCUELA EDTE, etc.) and the dashboard
  // / cashflow / 50-30-20 must treat them as such. Previously we dropped
  // this and everything ended up as PEN.
  const currency = parseCurrency(moneda);

  return {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    type: isIncome ? 'income' : 'expense',
    amount: amount,
    category: mappedCategory,
    description: `${tipo} - ${descripcion}`.trim(),
    date: date,
    accountId: 'default',
    currency,
    owner: getMyOwnerRole(),  // BCP/Yape rows come from whoever is signed in.
  };
};

// Parse a raw CSV text (already loaded — e.g. from SharePoint download).
// Mirrors importBcpYapeCSV but doesn't require a File object.
export const parseBcpYapeCSV = (text: string): Transaction[] => {
  const stripped = text.replace(/^﻿/, '');
  const lines = stripped.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase();
  const isBcpYape = header.includes('fecha') && header.includes('tipo') && header.includes('moneda');
  if (!isBcpYape) {
    throw new Error('CSV no tiene formato BCP/Yape (faltan columnas Fecha/Tipo/Moneda)');
  }

  const out: Transaction[] = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const parts: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') inQ = !inQ;
      else if (ch === ',' && !inQ) { parts.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    parts.push(cur.trim());
    if (parts.length >= 6) {
      const [fecha, tipo, categoria, descripcion, moneda, monto] = parts;
      const tx = convertBcpYapeToTransaction(fecha, tipo, categoria, descripcion, moneda, monto);
      if (tx) out.push(tx);
    }
  }
  return out;
};

export const importBcpYapeCSV = (file: File): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
          reject(new Error('El archivo CSV está vacío'));
          return;
        }

        // Verificar si es formato BCP/Yape (buscar encabezados específicos)
        const header = lines[0].toLowerCase();
        const isBcpYape = header.includes('fecha') &&
                         header.includes('tipo') &&
                         header.includes('moneda');

        if (!isBcpYape) {
          reject(new Error('Este no es un archivo de BCP/Yape válido'));
          return;
        }

        // Omitir la primera línea (encabezados)
        const dataLines = lines.slice(1);

        const transactions: Transaction[] = [];

        dataLines.forEach((line) => {
          if (!line.trim()) return;

          // Parsear CSV teniendo en cuenta las comas
          const parts: string[] = [];
          let currentPart = '';
          let insideQuotes = false;

          for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
              insideQuotes = !insideQuotes;
            } else if (char === ',' && !insideQuotes) {
              parts.push(currentPart.trim());
              currentPart = '';
            } else {
              currentPart += char;
            }
          }
          parts.push(currentPart.trim());

          if (parts.length >= 6) {
            const [fecha, tipo, categoria, descripcion, moneda, monto] = parts;
            const transaction = convertBcpYapeToTransaction(
              fecha,
              tipo,
              categoria,
              descripcion,
              moneda,
              monto
            );

            if (transaction) {
              transactions.push(transaction);
            }
          }
        });

        resolve(transactions);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Error al leer el archivo'));
    };

    reader.readAsText(file, 'UTF-8');
  });
};
