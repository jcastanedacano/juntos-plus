import { Transaction, ColumnMapping } from '../types';

let _XLSX: typeof import('xlsx') | null = null;
const getXLSX = async () => {
  if (!_XLSX) _XLSX = await import('xlsx');
  return _XLSX;
};
import { normalizeDescription } from './descriptionNormalizer';

// Common column name patterns for auto-detection
const DATE_PATTERNS = [
  /^fecha$/i, /^date$/i, /^fecha\s*de?\s*(operaci[oó]n|transacci[oó]n|movimiento|registro)/i,
  /^transaction\s*date$/i, /^posting\s*date$/i, /^fec/i, /^dia$/i,
];
const AMOUNT_PATTERNS = [
  /^monto$/i, /^amount$/i, /^importe$/i, /^valor$/i, /^cantidad$/i,
  /^cargo$/i, /^abono$/i, /^d[eé]bito$/i, /^cr[eé]dito$/i, /^total$/i,
  /^monto\s*(s\/|pen|usd)/i,
];
const DESC_PATTERNS = [
  /^descripci[oó]n$/i, /^description$/i, /^concepto$/i, /^detalle$/i,
  /^comercio$/i, /^merchant$/i, /^referencia$/i, /^glosa$/i, /^movimiento$/i,
];
const TYPE_PATTERNS = [
  /^tipo$/i, /^type$/i, /^tipo\s*de?\s*(operaci[oó]n|transacci[oó]n|movimiento)/i,
];

function matchColumn(header: string, patterns: RegExp[]): boolean {
  const h = header.trim();
  return patterns.some(p => p.test(h));
}

export function autoDetectColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    dateColumn: null,
    amountColumn: null,
    descriptionColumn: null,
    typeColumn: null,
    categoryColumn: null,
  };

  for (const header of headers) {
    if (!mapping.dateColumn && matchColumn(header, DATE_PATTERNS)) {
      mapping.dateColumn = header;
    } else if (!mapping.amountColumn && matchColumn(header, AMOUNT_PATTERNS)) {
      mapping.amountColumn = header;
    } else if (!mapping.descriptionColumn && matchColumn(header, DESC_PATTERNS)) {
      mapping.descriptionColumn = header;
    } else if (!mapping.typeColumn && matchColumn(header, TYPE_PATTERNS)) {
      mapping.typeColumn = header;
    }
  }

  return mapping;
}

export function isAutoDetectionComplete(mapping: ColumnMapping): boolean {
  return !!(mapping.dateColumn && mapping.amountColumn && mapping.descriptionColumn);
}

function parseDate(value: string | number): string | null {
  if (!value) return null;

  // Excel serial date
  if (typeof value === 'number' && _XLSX) {
    const date = _XLSX.SSF.parse_date_code(value);
    if (date) {
      const y = date.y;
      const m = String(date.m).padStart(2, '0');
      const d = String(date.d).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const str = String(value).trim();

  // ISO format: 2024-01-15
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // MM/DD/YYYY
  const mdyMatch = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch;
    const month = parseInt(m);
    const day = parseInt(d);
    if (month > 12 && day <= 12) {
      // Likely DD/MM/YYYY
      return `${y}-${d.padStart(2, '0')}-${m.padStart(2, '0')}`;
    }
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Try native Date parse as fallback
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function parseAmount(value: string | number): number | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') return value;

  // Remove currency symbols and whitespace
  let cleaned = String(value).trim()
    .replace(/^[A-Z]{0,3}\s*[S\/.$€£]+\s*/i, '')
    .replace(/\s/g, '');

  // Handle thousands separators: 1,234.56 or 1.234,56
  if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, '');
  } else if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    cleaned = cleaned.replace(/,/g, '.');
  }

  // Handle parentheses for negatives: (123.45)
  if (/^\([\d.]+\)$/.test(cleaned)) {
    cleaned = '-' + cleaned.replace(/[()]/g, '');
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function detectType(row: Record<string, string>, typeColumn: string | null, amount: number): 'income' | 'expense' {
  if (typeColumn && row[typeColumn]) {
    const typeValue = String(row[typeColumn]).toLowerCase().trim();
    if (/ingreso|income|cr[eé]dito|abono|dep[oó]sito|credit/i.test(typeValue)) {
      return 'income';
    }
    if (/gasto|expense|d[eé]bito|cargo|retiro|debit/i.test(typeValue)) {
      return 'expense';
    }
  }

  // Negative = expense, Positive can be either (default expense if no context)
  return amount < 0 ? 'expense' : amount > 0 ? 'income' : 'expense';
}

export async function readFileData(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'csv' || ext === 'txt') {
    return readCSVFile(file);
  } else if (ext === 'xlsx' || ext === 'xls') {
    return readExcelFile(file);
  } else if (ext === 'pdf') {
    const { readPdfFile } = await import('./pdfImporter');
    const { headers, rows } = await readPdfFile(file);
    return { headers, rows };
  }

  throw new Error(`Formato de archivo no soportado: .${ext}. Usa .csv, .xlsx, .xls o .pdf`);
}

async function readCSVFile(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(l => l.trim());

  if (lines.length < 2) {
    throw new Error('El archivo CSV está vacío o no tiene datos suficientes');
  }

  // Detect delimiter
  const firstLine = lines[0];
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  let delimiter = ',';
  if (semicolonCount > commaCount && semicolonCount > tabCount) delimiter = ';';
  else if (tabCount > commaCount && tabCount > semicolonCount) delimiter = '\t';

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map(line => parseCSVLine(line)).filter(row => row.some(cell => cell));

  return { headers, rows };
}

async function readExcelFile(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  const XLSX = await getXLSX();
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1, raw: false });

  if (jsonData.length < 2) {
    throw new Error('La hoja de Excel está vacía o no tiene datos suficientes');
  }

  const headers = (jsonData[0] as string[]).map(h => String(h || '').trim());
  const rows = jsonData.slice(1).map(row => (row as string[]).map(cell => String(cell ?? '')));

  return { headers, rows };
}

export function parseTransactions(
  headers: string[],
  rows: string[][],
  mapping: ColumnMapping
): Omit<Transaction, 'id'>[] {
  if (!mapping.dateColumn || !mapping.amountColumn) {
    throw new Error('Se requiere mapeo de columnas de Fecha y Monto como mínimo');
  }

  const dateIdx = headers.indexOf(mapping.dateColumn);
  const amountIdx = headers.indexOf(mapping.amountColumn);
  const descIdx = mapping.descriptionColumn ? headers.indexOf(mapping.descriptionColumn) : -1;
  const typeIdx = mapping.typeColumn ? headers.indexOf(mapping.typeColumn) : -1;

  if (dateIdx === -1 || amountIdx === -1) {
    throw new Error('No se encontraron las columnas mapeadas en los headers');
  }

  const transactions: Omit<Transaction, 'id'>[] = [];

  for (const row of rows) {
    const dateVal = row[dateIdx];
    const amountVal = row[amountIdx];
    const descVal = descIdx >= 0 ? row[descIdx] : '';
    const typeVal = typeIdx >= 0 ? row[typeIdx] : '';

    const parsedDate = parseDate(dateVal);
    const parsedAmount = parseAmount(amountVal);

    if (!parsedDate || parsedAmount === null || parsedAmount === 0) continue;

    const rowObj: Record<string, string> = {};
    headers.forEach((h, i) => { rowObj[h] = row[i] || ''; });

    const absAmount = Math.abs(parsedAmount);
    const type = detectType(rowObj, mapping.typeColumn, parsedAmount);

    // Normalize description
    const normalized = normalizeDescription(descVal || 'Sin descripción');

    transactions.push({
      type,
      amount: absAmount,
      category: normalized.suggestedCategory || (type === 'income' ? 'other-income' : 'other-expense'),
      description: normalized.normalizedName,
      date: parsedDate,
      accountId: '1',
    });
  }

  return transactions;
}

// Save/load column mappings for reuse
const MAPPINGS_KEY = 'juntos_column_mappings';

export function saveMappingForBank(bankName: string, mapping: ColumnMapping): void {
  try {
    const stored = localStorage.getItem(MAPPINGS_KEY);
    const mappings: Record<string, ColumnMapping> = stored ? JSON.parse(stored) : {};
    mappings[bankName.toLowerCase()] = mapping;
    localStorage.setItem(MAPPINGS_KEY, JSON.stringify(mappings));
  } catch { /* ignore storage errors */ }
}

export function loadMappingForBank(bankName: string): ColumnMapping | null {
  try {
    const stored = localStorage.getItem(MAPPINGS_KEY);
    if (!stored) return null;
    const mappings: Record<string, ColumnMapping> = JSON.parse(stored);
    return mappings[bankName.toLowerCase()] || null;
  } catch { return null; }
}
