/**
 * Parser for BCP "Estado de Cuenta Tarjeta Visa" PDFs (credit card statements).
 *
 * Input: the raw text extracted by pdfjs (already concatenated, with column
 * boundaries collapsed to spaces).
 *
 * Output: array of Transaction-shaped rows for handleImport to consume.
 *
 * What we capture:
 *   - CONSUMO   → expense
 *   - CARGO     → expense (ITF, fees, monthly installment "cuota del mes")
 *   - DEVOLUCION→ income
 *
 * What we skip:
 *   - PAGO          (payments to the card, not a real movement)
 *   - PASE CUOTAS   (installment plan setup — not a discrete charge)
 *   - PREPAGO       (advance pay to the card)
 *   - SALDO ANTERIOR / Suma de... / membership renewals
 */
import { Transaction, CurrencyType, CreditInstallment, CreditStatement } from '../types';
import { getMyOwnerRole } from './userIdentity';

const SPANISH_MONTH: Record<string, number> = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
  jul: 6, ago: 7, set: 8, sep: 8, oct: 9, nov: 10, dic: 11,
};

const DAY_MONTH_RE = /\b(\d{1,2})\s*(ene|feb|mar|abr|may|jun|jul|ago|set|sep|oct|nov|dic)\b/gi;
const CARD_LAST4_RE = /\b4280[-\s]*82\w*[-\s]*[Xx\w]*[-\s]*[Xx\w]*[-\s]*(\d{4})\b/;
const CYCLE_RE = /(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2})\/(\d{2})\/(\d{2})/;

const TIPO_TO_TYPE: Record<string, 'expense' | 'income' | 'skip'> = {
  CONSUMO: 'expense',
  CARGO: 'expense',
  DEVOLUCION: 'income',
  PAGO: 'skip',           // internal transfer, not a movement
  PREPAGO: 'skip',
  PASE: 'skip',
  CUOTAS: 'skip',
};

export type BcpPdfKind = 'credit' | 'debit' | 'unknown';

export interface BcpPdfParseResult {
  kind: BcpPdfKind;
  cardLastFour?: string;
  accountCode?: string;       // "193-79465387-0-65" for debit statements
  cycleStart?: string;        // ISO yyyy-mm-dd
  cycleEnd?: string;
  transactions: Transaction[];
  skipped: number;
  /** Statement metadata pulled from headers/footers — only for credit PDFs. */
  statement?: CreditStatement;
}

const monthFromShort = (m: string): number | null => {
  const k = m.toLowerCase().slice(0, 3);
  return SPANISH_MONTH[k] ?? null;
};

// Parse "27Mar" / "01Abr" given the cycle's year. If the parsed month is
// greater than the cycleEnd month, assume it belongs to the prior year.
function buildDate(day: number, monthIdx: number, cycleEndYear: number, cycleEndMonth: number): string {
  let year = cycleEndYear;
  // Roll back if the month sits after the cycle-end month (i.e. December
  // transaction shown on a January-cycle statement).
  if (monthIdx > cycleEndMonth) year -= 1;
  const y = String(year).padStart(4, '0');
  const mm = String(monthIdx + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

const normalizeAmount = (raw: string): number | null => {
  // BCP uses Peruvian format: "1,234.56" or "98.12". Trailing dash = negative.
  let s = raw.trim();
  const negative = s.endsWith('-');
  if (negative) s = s.slice(0, -1).trim();
  // Remove thousands separators (commas)
  s = s.replace(/,/g, '');
  const n = parseFloat(s);
  if (!isFinite(n)) return null;
  return negative ? -n : n;
};

// A row chunk = a substring of the PDF text starting at one date pair and
// going up to the next date pair (or end of relevant section).
function splitIntoRowChunks(text: string): string[] {
  const out: string[] = [];
  // Match TWO consecutive day-month tokens (proceso + consumo). PDFs may
  // collapse spaces unpredictably, so accept any whitespace between.
  const pairRe = /\b(\d{1,2})\s*(ene|feb|mar|abr|may|jun|jul|ago|set|sep|oct|nov|dic)\s+(\d{1,2})\s*(ene|feb|mar|abr|may|jun|jul|ago|set|sep|oct|nov|dic)\b/gi;
  const positions: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = pairRe.exec(text)) !== null) positions.push(m.index);

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i];
    const end = i + 1 < positions.length ? positions[i + 1] : text.length;
    out.push(text.slice(start, end));
  }
  return out;
}

const TIPO_RE = /\b(CONSUMO|CARGO|DEVOLUCI(?:O|Ó)N|PAGO|PREPAGO|PASE\s+CUOTAS?|OPERACI(?:O|Ó)N|DISPOSICI(?:O|Ó)N)\b/i;
const AMOUNT_RE = /-?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?-?/g;

function parseRowChunk(
  chunk: string,
  cycleEndYear: number,
  cycleEndMonth: number,
  cardLastFour: string | undefined,
  bcpAccountId: string | undefined
): { tx: Transaction; skipped: boolean } | null {
  // Extract the first two day-month tokens — the second is "fecha de consumo".
  DAY_MONTH_RE.lastIndex = 0;
  const dates: { day: number; mon: number }[] = [];
  let dm: RegExpExecArray | null;
  while ((dm = DAY_MONTH_RE.exec(chunk)) !== null && dates.length < 2) {
    const monIdx = monthFromShort(dm[2]);
    if (monIdx !== null) dates.push({ day: parseInt(dm[1], 10), mon: monIdx });
  }
  if (dates.length < 2) return null;

  // fecha de consumo is the second date — use as the user-facing date.
  const consumoDate = buildDate(dates[1].day, dates[1].mon, cycleEndYear, cycleEndMonth);

  // Tipo de operación — required to classify.
  const tipoMatch = chunk.match(TIPO_RE);
  if (!tipoMatch) return null;
  const tipoRaw = tipoMatch[1].toUpperCase().replace(/\s+/g, ' ');
  let kind: 'expense' | 'income' | 'skip' = 'skip';
  if (tipoRaw.startsWith('CONSUMO')) kind = 'expense';
  else if (tipoRaw.startsWith('CARGO')) kind = 'expense';
  else if (tipoRaw.startsWith('DEVOLUCI')) kind = 'income';
  else if (tipoRaw.startsWith('PAGO')) kind = 'skip';
  else if (tipoRaw.startsWith('PREPAGO')) kind = 'skip';
  else if (tipoRaw.startsWith('PASE')) kind = 'skip';
  else if (tipoRaw.startsWith('OPERACI')) kind = 'expense';
  else if (tipoRaw.startsWith('DISPOSICI')) kind = 'expense';   // Cash advance — kept here (PDF is canonical, Outlook side is now skipped)
  else kind = TIPO_TO_TYPE[tipoRaw] || 'skip';

  if (kind === 'skip') {
    // Still return so the caller can count skipped rows
    return null;
  }

  // Pull amounts from the chunk after the Tipo token. There may be 1 (Soles
  // OR Dólares column populated) or 2 (both have content). Pick the LAST
  // non-zero amount and infer currency by position later.
  const afterTipo = chunk.slice(chunk.indexOf(tipoMatch[0]) + tipoMatch[0].length);
  AMOUNT_RE.lastIndex = 0;
  const amounts: number[] = [];
  let am: RegExpExecArray | null;
  while ((am = AMOUNT_RE.exec(afterTipo)) !== null) {
    const n = normalizeAmount(am[0]);
    if (n !== null && Math.abs(n) >= 0.01 && Math.abs(n) < 10_000_000) {
      amounts.push(n);
    }
  }
  if (amounts.length === 0) return null;

  // Pick the last meaningful amount. Trailing column = Dólares; the second-
  // to-last (if present and non-zero) = Soles. We assume only one column
  // carries the actual charge per row.
  // Heuristic: if there's only one number, it's the charge. If multiple,
  // the LAST one is the charge (the table prints Soles then Dólares with
  // empty spaces collapsing). Currency: looking at the chunk text — if it
  // mentions "$" or "USD" or appears in the Dólares column (i.e. there's a
  // soles-empty pattern), tag as USD. Otherwise PEN.
  // Pragmatic version: if amount > 0 AND the last amount is significantly
  // smaller than typical PEN amounts and the chunk has " CA " (US merchants
  // often end with country code) or matches known $ keywords, treat as USD.
  // SAFER: read the COUNT of amounts — if 2 amounts and both non-zero, the
  // last is USD. If only 1, infer from chunk markers.
  let currency: CurrencyType = 'PEN';
  let amount = amounts[amounts.length - 1];

  if (amounts.length >= 2) {
    // Two columns populated → second is dólares.
    currency = 'USD';
  } else {
    // Look for USD hints in the description text. Most BCP rows are PEN.
    const usdHint = /\b(USD|US\$|\$\s*\d|ANTHROPIC|MICROSOFT|AIRBNB|AMAZON\.COM|EBN\*|NETFLIX\.COM)\b/i.test(chunk);
    if (usdHint && Math.abs(amount) < 500) {
      // USD heuristic — small amount + foreign merchant likely USD.
      currency = 'USD';
    }
  }

  // Description = chunk minus the dates, tipo token, and trailing amounts.
  let desc = chunk;
  // Strip date tokens at start
  desc = desc.replace(/^\s*\d{1,2}\s*[A-Za-z]{3}\s+\d{1,2}\s*[A-Za-z]{3}\s+/i, '');
  // Strip tipo token
  desc = desc.replace(TIPO_RE, ' ');
  // Strip trailing amounts
  desc = desc.replace(/\s*-?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?-?\s*$/, '');
  desc = desc.replace(/\s*-?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?-?\s*$/, '');
  // Collapse whitespace and trim
  desc = desc.replace(/\s{2,}/g, ' ').trim();
  // Strip trailing country code like "PE" or "CA" alone
  desc = desc.replace(/\s+\b[A-Z]{2}\b\s*$/, '').trim();
  if (!desc) desc = tipoRaw;

  const type: 'income' | 'expense' = kind === 'income' ? 'income' : 'expense';
  const finalAmount = Math.abs(amount);

  return {
    tx: {
      id: `bcp-pdf-${cardLastFour || 'xxxx'}-${consumoDate}-${finalAmount}-${desc.slice(0, 24)}`.replace(/\s+/g, '_'),
      type,
      amount: finalAmount,
      category: 'other-expense',
      description: `Crédito - ${desc}`,
      date: consumoDate,
      accountId: bcpAccountId || 'default',
      currency,
      owner: getMyOwnerRole(),
    },
    skipped: false,
  };
}

// ─── Debit (Cuenta Digital BCP) ─────────────────────────────────────
// Statement layout is "FECHA PROC | FECHA VALOR | DESCRIPCION | CARGOS/DEBE
// | ABONOS/HABER". When pdfjs flattens columns to space-separated text, we
// classify each row by description keywords instead of column position.

const DEBIT_DATE_RE = /\b(\d{1,2})\s*(ene|feb|mar|abr|may|jun|jul|ago|set|sep|oct|nov|dic)\b/gi;
const DEBIT_ACCOUNT_RE = /\b(\d{3}-\d{6,9}-\d-\d{2})\b/;
const DEBIT_PERIOD_RE = /DEL\s+(\d{2})\/(\d{2})\/(\d{2})\s+AL\s+(\d{2})\/(\d{2})\/(\d{2})/i;

// Rows we want to skip entirely (internal transfers / echoes already
// captured from another source).
const DEBIT_SKIP_RE = /\b(DISP\.?\s*EFECT\.?\s*TC\.?\s*VISA|PAGO\.?\s*TC\b|PAG\.?\s*T\.?\s*PROP\.?\s*VISA|TRAN\.?\s*CTAS?\.?\s*PROP)\b/i;

// Description hints that flip a row from expense (default) to income.
// "Pago YAPE a XXX" = outgoing yapeo, "Pago YAPE de XXX" = incoming yapeo.
const INCOME_HINT_RE = /\b(HABERES|TRANSF\.?\s*BCO|TRANSF\.?\s*RECIBIDA|ABONO|DEP[oó]SITO|DEVOLUCION|INTERES\s*HABER|EXT\s+PYU\*UBER|Pago\s+YAPE\s+de)\b/i;

function parseDebitRowLine(
  line: string,
  cycleEndYear: number,
  cycleEndMonth: number
): { tx: Transaction; isIncome: boolean } | null {
  // Pull date(s)
  DEBIT_DATE_RE.lastIndex = 0;
  const dates: { day: number; mon: number }[] = [];
  let dm: RegExpExecArray | null;
  while ((dm = DEBIT_DATE_RE.exec(line)) !== null && dates.length < 2) {
    const monIdx = monthFromShort(dm[2]);
    if (monIdx !== null) dates.push({ day: parseInt(dm[1], 10), mon: monIdx });
  }
  if (dates.length === 0) return null;
  const useDate = dates.length >= 2 ? dates[1] : dates[0];
  const date = buildDate(useDate.day, useDate.mon, cycleEndYear, cycleEndMonth);

  // Extract amounts
  AMOUNT_RE.lastIndex = 0;
  const amounts: number[] = [];
  let am: RegExpExecArray | null;
  while ((am = AMOUNT_RE.exec(line)) !== null) {
    const n = normalizeAmount(am[0]);
    if (n !== null && Math.abs(n) >= 0.01 && Math.abs(n) < 10_000_000) {
      amounts.push(n);
    }
  }
  if (amounts.length === 0) return null;
  const amount = Math.abs(amounts[amounts.length - 1]);

  // Description = strip leading dates + trailing amounts + asterisks.
  let desc = line;
  desc = desc.replace(/^\s*\d{1,2}\s*[A-Za-z]{3}\s+\d{1,2}\s*[A-Za-z]{3}\s+/i, '');
  desc = desc.replace(/^\s*\d{1,2}\s*[A-Za-z]{3}\s+/i, '');
  desc = desc.replace(/\s*-?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?-?\s*$/, '');
  desc = desc.replace(/\s*\*+\s*$/, '');
  desc = desc.replace(/\s{2,}/g, ' ').trim();
  if (!desc) return null;

  // Skip internal transfers / echoes.
  if (DEBIT_SKIP_RE.test(desc) || DEBIT_SKIP_RE.test(line)) return null;
  if (/SALDO\s+ANTERIOR|TOTAL\s+MOVIMIENTO/i.test(desc)) return null;

  const isIncome = INCOME_HINT_RE.test(desc);
  return {
    tx: {
      id: `bcp-debit-${date}-${amount}-${desc.slice(0, 24)}`.replace(/\s+/g, '_'),
      type: isIncome ? 'income' : 'expense',
      amount,
      category: isIncome ? 'other-income' : 'other-expense',
      description: `Débito - ${desc}`,
      date,
      accountId: 'default',
      currency: 'PEN',
      owner: getMyOwnerRole(),
    },
    isIncome,
  };
}

function parseDebitStatement(text: string): BcpPdfParseResult {
  const accountMatch = text.match(DEBIT_ACCOUNT_RE);
  const accountCode = accountMatch ? accountMatch[1] : undefined;

  const periodMatch = text.match(DEBIT_PERIOD_RE);
  let cycleStart: string | undefined;
  let cycleEnd: string | undefined;
  let cycleEndYear = new Date().getFullYear();
  let cycleEndMonth = new Date().getMonth();
  if (periodMatch) {
    cycleStart = `20${periodMatch[3]}-${periodMatch[2]}-${periodMatch[1]}`;
    cycleEnd = `20${periodMatch[6]}-${periodMatch[5]}-${periodMatch[4]}`;
    cycleEndYear = parseInt(`20${periodMatch[6]}`, 10);
    cycleEndMonth = parseInt(periodMatch[5], 10) - 1;
  }

  // Each row begins with two day-month tokens (FECHA PROC + FECHA VALOR).
  // Reuse the same chunking strategy from credit but the rows have no
  // "Tipo de Operación" — we infer expense/income from description keywords.
  const chunks = splitIntoRowChunks(text);
  const out: Transaction[] = [];
  let skipped = 0;
  for (const chunk of chunks) {
    if (/Estado de Cuenta|FECHA PROC|CODIGO DE CUENTA|MONEDA|TOTAL MOVIMIENTO/i.test(chunk) && chunk.length < 80) {
      skipped++;
      continue;
    }
    const parsed = parseDebitRowLine(chunk, cycleEndYear, cycleEndMonth);
    if (!parsed) {
      skipped++;
      continue;
    }
    out.push(parsed.tx);
  }

  return {
    kind: 'debit',
    accountCode,
    cycleStart,
    cycleEnd,
    transactions: out,
    skipped,
  };
}

// ─── Credit statement metadata + installments ─────────────────────

const PAGO_MINIMO_PEN_RE = /Pago\s*m[ií]nimo\s*S\/\s*[\s\S]{0,40}?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i;
const PAGO_TOTAL_PEN_RE = /Pago\s*total\s*S\/\s*[\s\S]{0,40}?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i;
const PAGO_MINIMO_USD_RE = /Pago\s*m[ií]nimo\s*US\$\s*[\s\S]{0,40}?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i;
const PAGO_TOTAL_USD_RE = /Pago\s*total\s*US\$\s*[\s\S]{0,40}?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i;
const FECHA_LIMITE_RE = /Fecha\s*l[ií]mite\s*de\s*pago\s*(\d{2}\/\d{2}\/\d{2})/i;
// TEA appears multiple times in the PDF, all near the rates table. Capture
// the first decimal it shows next to "%" inside the rates section.
const TEA_PEN_RE = /Compras\s+(\d{1,3}(?:\.\d{1,2})?)\s*%/i;
const TEA_USD_RE = /Compras\s+\d{1,3}(?:\.\d{1,2})?\s*%\s+\d+(?:\.\d{1,2})?\s+(\d{1,3}(?:\.\d{1,2})?)\s*%/i;
const SALDO_TOTAL_PEN_RE = /Saldo\s*Total\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i;
const SALDO_TOTAL_USD_RE = /Saldo\s*Total\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s+(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i;

// Installment rows look like:
//   "26Abr 27Feb PASE CUOTAS BM 2,191.17 02/12 95.89% 249.86 21.21 271.07"
//   day mon  day mon  desc...    capital  nn/NN  tea     capPart intPart total
const INSTALLMENT_RE =
  /(\d{1,2}\s*[A-Za-z]{3})\s+(\d{1,2}\s*[A-Za-z]{3})\s+([A-Z][A-Z0-9*\s.]+?)\s+(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s+(\d{1,2})\/(\d{1,2})\s+(\d{1,3}(?:\.\d{1,2})?)\s*%\s+(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s+(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s+(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g;

function parseInstallments(text: string): CreditInstallment[] {
  // Limit to the "DETALLE PLAN CUOTAS" section if present, otherwise scan all.
  const start = text.search(/DETALLE\s+PLAN\s+CUOTAS/i);
  const end = text.search(/COMO\s+ESTA\s+COMPUESTA|INFORMACI[OÓ]N\s+IMPORTANTE/i);
  const section = start >= 0
    ? text.slice(start, end > start ? end : start + 5000)
    : text;
  const out: CreditInstallment[] = [];
  // detect whether we're in the USD block (after "DETALLE PLAN CUOTAS DOLARES")
  // — for now we set currency based on amount and chunk context.
  const usdMarkerPos = section.search(/DETALLE\s+PLAN\s+CUOTAS\s+DOLARES/i);

  INSTALLMENT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INSTALLMENT_RE.exec(section)) !== null) {
    const desc = m[3].trim().replace(/\s+BM$/i, ' BM');
    const originalAmount = parseFloat(m[4].replace(/,/g, ''));
    const paidInstallments = parseInt(m[5], 10);
    const totalInstallments = parseInt(m[6], 10);
    const tea = parseFloat(m[7]) / 100;
    const monthlyCapital = parseFloat(m[8].replace(/,/g, ''));
    const monthlyInterest = parseFloat(m[9].replace(/,/g, ''));
    const monthlyTotal = parseFloat(m[10].replace(/,/g, ''));
    const isUSD = usdMarkerPos >= 0 && m.index > usdMarkerPos;
    out.push({
      id: `inst-${desc.replace(/\s+/g, '_')}-${originalAmount}-${totalInstallments}`,
      description: desc,
      originalAmount,
      paidInstallments,
      totalInstallments,
      monthlyCapital,
      monthlyInterest,
      monthlyTotal,
      tea,
      currency: isUSD ? 'USD' : 'PEN',
    });
  }
  return out;
}

function parseCreditStatementMeta(text: string): CreditStatement {
  const grab = (re: RegExp): number | undefined => {
    const m = text.match(re);
    if (!m) return undefined;
    const n = parseFloat(m[1].replace(/,/g, ''));
    return isFinite(n) ? n : undefined;
  };
  const grabDate = (re: RegExp): string | undefined => {
    const m = text.match(re);
    if (!m) return undefined;
    const [dd, mm, yy] = m[1].split('/');
    return `20${yy}-${mm}-${dd}`;
  };
  return {
    pagoMinimoPEN: grab(PAGO_MINIMO_PEN_RE),
    pagoTotalPEN: grab(PAGO_TOTAL_PEN_RE),
    pagoMinimoUSD: grab(PAGO_MINIMO_USD_RE),
    pagoTotalUSD: grab(PAGO_TOTAL_USD_RE),
    paymentDueDate: grabDate(FECHA_LIMITE_RE),
    teaPEN: (() => { const v = grab(TEA_PEN_RE); return v !== undefined ? v / 100 : undefined; })(),
    teaUSD: (() => { const v = grab(TEA_USD_RE); return v !== undefined ? v / 100 : undefined; })(),
    saldoTotalPEN: grab(SALDO_TOTAL_PEN_RE),
    saldoTotalUSD: grab(SALDO_TOTAL_USD_RE),
    installments: parseInstallments(text),
    importedAt: new Date().toISOString(),
  };
}

export function parseBcpStatementText(
  text: string,
  bcpAccountId?: string
): BcpPdfParseResult {
  // Dispatch: credit-card "Estado de Cuenta Tarjeta Visa" vs
  //          debit "Estado de Cuenta de Ahorros Cuenta Digital".
  const isCredit = /Estado\s+de\s+Cuenta\s+Tarjeta\s+Visa/i.test(text) ||
                   /Ciclo\s+de\s+Facturaci/i.test(text);
  const isDebit  = /Estado\s+de\s+Cuenta\s+de\s+Ahorros|Cuenta\s+Digital/i.test(text);

  if (isDebit && !isCredit) {
    return parseDebitStatement(text);
  }

  // 1) Last-4 of the card
  const cardMatch = text.match(CARD_LAST4_RE);
  const cardLastFour = cardMatch ? cardMatch[1] : undefined;

  // 2) Cycle dates "26/03/26 26/04/26" — use cycle end to anchor the year.
  const cycleMatch = text.match(CYCLE_RE);
  let cycleStart: string | undefined;
  let cycleEnd: string | undefined;
  let cycleEndYear = new Date().getFullYear();
  let cycleEndMonth = new Date().getMonth();
  if (cycleMatch) {
    cycleStart = `20${cycleMatch[3]}-${cycleMatch[2]}-${cycleMatch[1]}`;
    cycleEnd = `20${cycleMatch[6]}-${cycleMatch[5]}-${cycleMatch[4]}`;
    cycleEndYear = parseInt(`20${cycleMatch[6]}`, 10);
    cycleEndMonth = parseInt(cycleMatch[5], 10) - 1;
  }

  // 3) Walk row chunks
  const chunks = splitIntoRowChunks(text);
  const out: Transaction[] = [];
  let skipped = 0;
  for (const chunk of chunks) {
    // Skip obvious header / footer / inter-month banner lines
    if (/SALDO ANTERIOR|SUB ?TOTAL|MONTO TOTAL FACTURADO|DETALLE PLAN CUOTAS|COMO ESTA COMPUESTA/i.test(chunk)) {
      skipped++;
      continue;
    }
    const parsed = parseRowChunk(chunk, cycleEndYear, cycleEndMonth, cardLastFour, bcpAccountId);
    if (!parsed) {
      skipped++;
      continue;
    }
    out.push(parsed.tx);
  }

  const statement = parseCreditStatementMeta(text);
  if (cycleStart) statement.cycleStart = cycleStart;
  if (cycleEnd) statement.cycleEnd = cycleEnd;

  return {
    kind: 'credit',
    cardLastFour,
    cycleStart,
    cycleEnd,
    transactions: out,
    skipped,
    statement,
  };
}
