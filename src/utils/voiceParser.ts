import { CurrencyType, TransactionType } from '../types';

/**
 * Convierte una frase dictada en los campos de una transaccion.
 *
 * "gaste 50 soles en almuerzo"      -> gasto 50 PEN, Alimentacion
 * "pague 120 de luz ayer"           -> gasto 120 PEN, Facturas, fecha de ayer
 * "cobre 3000 de sueldo"            -> ingreso 3000 PEN, Salario
 *
 * Todo aca es puro: recibe texto, devuelve datos. El reconocimiento de voz
 * vive aparte para poder probar esta parte sin navegador.
 */

export interface ParsedVoiceTransaction {
  type: TransactionType;
  amount: number | null;
  currency: CurrencyType;
  description: string;
  categoryId: string | null;
  /** yyyy-MM-dd */
  date: string | null;
  /** 0-1: cuantas piezas se pudieron extraer. */
  confidence: number;
}

const INCOME_WORDS = [
  'ingreso', 'ingrese', 'cobre', 'cobré', 'recibi', 'recibí', 'me pagaron',
  'me deposit', 'deposito', 'depósito', 'gane', 'gané', 'entro', 'entró',
];
const EXPENSE_WORDS = [
  'gaste', 'gasté', 'gasto', 'pague', 'pagué', 'compre', 'compré', 'compra',
  'sali', 'salió', 'salio', 'me costo', 'me costó', 'invertí', 'inverti',
];

/** El orden importa: la primera coincidencia gana. */
const CATEGORY_KEYWORDS: { id: string; words: string[] }[] = [
  { id: 'subscriptions', words: ['suscripcion', 'suscripción', 'netflix', 'spotify', 'disney', 'hbo', 'claude', 'chatgpt', 'youtube premium', 'prime'] },
  { id: 'bills', words: ['luz', 'agua', 'gas', 'internet', 'telefono', 'teléfono', 'celular', 'recibo', 'factura', 'cable', 'wifi', 'arbitrios'] },
  { id: 'health', words: ['farmacia', 'medico', 'médico', 'doctor', 'clinica', 'clínica', 'dentista', 'medicina', 'inkafarma', 'mifarma', 'seguro medico'] },
  { id: 'transport', words: ['taxi', 'uber', 'cabify', 'didi', 'gasolina', 'combustible', 'pasaje', 'metropolitano', 'peaje', 'estacionamiento', 'grifo', 'bus', 'movilidad'] },
  { id: 'food', words: ['almuerzo', 'comida', 'cena', 'desayuno', 'restaurante', 'menu', 'menú', 'mercado', 'supermercado', 'wong', 'plaza vea', 'tottus', 'polleria', 'pollería', 'chifa', 'cafe', 'café', 'panaderia', 'panadería', 'delivery'] },
  { id: 'education', words: ['curso', 'universidad', 'colegio', 'libro', 'matricula', 'matrícula', 'pension', 'pensión', 'capacitacion'] },
  { id: 'home', words: ['alquiler', 'renta', 'hogar', 'muebles', 'limpieza', 'ferreteria', 'ferretería', 'mantenimiento'] },
  { id: 'entertainment', words: ['cine', 'juego', 'salida', 'bar', 'discoteca', 'concierto', 'fiesta', 'viaje', 'paseo'] },
  { id: 'shopping', words: ['ropa', 'zapatillas', 'zapatos', 'tienda', 'saga', 'ripley', 'falabella', 'amazon', 'regalo para'] },
  // Ingresos
  { id: 'salary', words: ['sueldo', 'salario', 'planilla', 'quincena'] },
  { id: 'freelance', words: ['freelance', 'honorarios', 'proyecto', 'consultoria', 'consultoría'] },
  { id: 'investments', words: ['dividendo', 'interes', 'interés', 'rendimiento', 'ganancia'] },
  { id: 'gifts', words: ['regalo', 'propina', 'bono', 'aguinaldo'] },
];

const CURRENCY_WORDS: { code: CurrencyType; words: string[] }[] = [
  { code: 'USD', words: ['dolares', 'dólares', 'dolar', 'dólar', 'usd', 'verdes'] },
  { code: 'EUR', words: ['euros', 'euro', 'eur'] },
  { code: 'PEN', words: ['soles', 'sol', 'pen', 'lucas'] },
];

/** Quita tildes para comparar sin depender de como transcribio el dictado. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toIsoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseRelativeDate(norm: string, today: Date): string | null {
  const shift = (days: number) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    d.setDate(d.getDate() + days);
    return toIsoDay(d);
  };
  if (/\bantes de ayer\b|\banteayer\b/.test(norm)) return shift(-2);
  if (/\bayer\b/.test(norm)) return shift(-1);
  if (/\bhoy\b/.test(norm)) return shift(0);
  if (/\bmanana\b/.test(norm)) return shift(1);
  return null;
}

/**
 * Toma el primer numero de la frase. Acepta 1,200.50 y 1200,50: si hay coma y
 * punto gana el ultimo como decimal; con una sola coma se decide por la
 * cantidad de digitos que la siguen.
 */
function parseAmount(norm: string): number | null {
  const m = norm.match(/(\d[\d.,]*)/);
  if (!m) return null;
  let raw = m[1].replace(/[.,]$/, '');

  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');

  if (lastComma > -1 && lastDot > -1) {
    const decimalSep = lastComma > lastDot ? ',' : '.';
    const thousandSep = decimalSep === ',' ? '.' : ',';
    raw = raw.split(thousandSep).join('').replace(decimalSep, '.');
  } else if (lastComma > -1) {
    raw = raw.length - lastComma - 1 === 3 ? raw.split(',').join('') : raw.replace(',', '.');
  } else if (lastDot > -1) {
    if (raw.length - lastDot - 1 === 3) raw = raw.split('.').join('');
  }

  const value = parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function detectType(norm: string): TransactionType {
  const incomeAt = firstIndexOf(norm, INCOME_WORDS);
  const expenseAt = firstIndexOf(norm, EXPENSE_WORDS);
  if (incomeAt === -1) return 'expense';
  if (expenseAt === -1) return 'income';
  // Ambas presentes: manda la que aparece primero ("cobre y gaste...").
  return incomeAt < expenseAt ? 'income' : 'expense';
}

function firstIndexOf(norm: string, words: string[]): number {
  let best = -1;
  for (const w of words) {
    const i = norm.indexOf(w);
    if (i !== -1 && (best === -1 || i < best)) best = i;
  }
  return best;
}

/**
 * Con includes() sueltos, "gas" hacia match dentro de "gaste" y todos los
 * gastos caian en Facturas. Los limites de palabra son obligatorios aca.
 * Soporta claves de varias palabras como "plaza vea".
 */
function hasWord(norm: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(norm);
}

function detectCurrency(norm: string): CurrencyType {
  for (const { code, words } of CURRENCY_WORDS) {
    if (words.some(w => hasWord(norm, w))) return code;
  }
  return 'PEN';
}

function detectCategory(norm: string, type: TransactionType): string | null {
  for (const { id, words } of CATEGORY_KEYWORDS) {
    if (words.some(w => hasWord(norm, w))) return id;
  }
  return type === 'income' ? 'other-income' : 'other-expense';
}

/** Deja solo la parte util para el nombre del movimiento. */
function buildDescription(original: string, norm: string): string {
  // "en <algo>" o "de <algo>" suele ser exactamente el concepto dictado.
  const m = norm.match(/\b(?:en|de|por|para)\s+(.+)$/);
  let text = m ? m[1] : norm;

  const noise = [
    ...INCOME_WORDS, ...EXPENSE_WORDS,
    ...CURRENCY_WORDS.flatMap(c => c.words),
    'antes de ayer', 'anteayer', 'ayer', 'hoy', 'manana',
  ];
  for (const w of noise) text = text.replace(new RegExp(`\\b${w}\\b`, 'g'), ' ');
  text = text.replace(/[\d.,]+/g, ' ').replace(/\s+/g, ' ').trim();

  if (!text) return original.trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function parseVoiceTransaction(text: string, today: Date = new Date()): ParsedVoiceTransaction {
  const norm = normalize(text);
  const type = detectType(norm);
  const amount = parseAmount(norm);
  const currency = detectCurrency(norm);
  const date = parseRelativeDate(norm, today);
  const categoryId = detectCategory(norm, type);
  const description = buildDescription(text, norm);

  // La confianza mide cuanto se pudo extraer, no si acerto. Sirve para
  // decidir si vale la pena prellenar el formulario o pedir que repita.
  let score = 0;
  if (amount !== null) score += 0.5;
  if (description) score += 0.2;
  if (categoryId && !categoryId.startsWith('other-')) score += 0.2;
  if (firstIndexOf(norm, [...INCOME_WORDS, ...EXPENSE_WORDS]) !== -1) score += 0.1;

  return {
    type,
    amount,
    currency,
    description,
    categoryId,
    date,
    confidence: Math.round(score * 100) / 100,
  };
}
