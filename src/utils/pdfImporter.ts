/**
 * PDF Import with OCR support
 * - Tries text extraction first (digital PDFs / bank statements)
 * - Falls back to Tesseract.js OCR for scanned PDFs
 */

export type PdfProgressCallback = (message: string, progress?: number) => void;

// ---------------------------------------------------------------------------
// PDF.js text extraction
// ---------------------------------------------------------------------------
async function extractTextFromPdf(
  file: File,
  onProgress?: PdfProgressCallback
): Promise<{ text: string; pageCount: number }> {
  const pdfjsLib = await import('pdfjs-dist');

  // Configure worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).href;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageCount = pdf.numPages;

  let fullText = '';
  for (let i = 1; i <= pageCount; i++) {
    onProgress?.(`Extrayendo texto… página ${i} de ${pageCount}`, (i / pageCount) * 60);
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? (item.str ?? '') : ''))
      .join(' ');
    fullText += pageText + '\n';
  }

  return { text: fullText, pageCount };
}

// ---------------------------------------------------------------------------
// OCR via Tesseract.js (fallback for scanned PDFs)
// ---------------------------------------------------------------------------
async function extractTextWithOcr(
  file: File,
  onProgress?: PdfProgressCallback
): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).href;

  const { createWorker } = await import('tesseract.js');

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageCount = pdf.numPages;

  onProgress?.('Iniciando OCR (esto puede tomar un momento)…', 10);

  const worker = await createWorker('spa+eng', 1, {
    logger: () => {},
  });

  let fullText = '';
  for (let i = 1; i <= pageCount; i++) {
    onProgress?.(`OCR página ${i} de ${pageCount}…`, 10 + (i / pageCount) * 80);
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const dataUrl = canvas.toDataURL('image/png');
    const result = await worker.recognize(dataUrl);
    fullText += result.data.text + '\n';
  }

  await worker.terminate();
  return fullText;
}

// ---------------------------------------------------------------------------
// Parse raw text into transaction rows
// ---------------------------------------------------------------------------
const DATE_RE =
  /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/;

const AMOUNT_RE =
  /(?<![a-zA-Z])([+\-]?[\d]{1,3}(?:[.,][\d]{3})*(?:[.,][\d]{1,2})?)(?![a-zA-Z%])/g;

function normalizeAmount(raw: string): number | null {
  let s = raw.trim();
  // 1.234,56 → 1234.56
  if (/^\-?[\d]{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  // 1,234.56 → 1234.56
  else if (/^\-?[\d]{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    s = s.replace(/,/g, '');
  }
  // simple comma decimal: 123,45 → 123.45
  else {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parsePdfText(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 3);

  const rows: string[][] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const dateMatch = line.match(DATE_RE);
    if (!dateMatch) continue;

    // Extract all numbers from the line
    const amounts: number[] = [];
    const rawAmounts: string[] = [];
    let m: RegExpExecArray | null;
    AMOUNT_RE.lastIndex = 0;
    while ((m = AMOUNT_RE.exec(line)) !== null) {
      const n = normalizeAmount(m[1]);
      if (n !== null && Math.abs(n) >= 0.01 && Math.abs(n) < 10_000_000) {
        amounts.push(n);
        rawAmounts.push(m[1]);
      }
    }

    if (amounts.length === 0) continue;

    // Use last meaningful amount
    const amount = amounts[amounts.length - 1];
    const rawAmount = rawAmounts[rawAmounts.length - 1];

    // Description = everything except the date and last amount
    const desc = line
      .replace(dateMatch[0], '')
      .replace(new RegExp(rawAmount.replace(/[.+\-]/g, c => '\\' + c) + '\\s*$'), '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (!desc || desc.length < 2) continue;

    const key = `${dateMatch[0]}|${desc}|${amount}`;
    if (seen.has(key)) continue;
    seen.add(key);

    rows.push([dateMatch[0], desc, String(amount)]);
  }

  if (rows.length === 0) {
    throw new Error(
      'No se encontraron transacciones en el PDF. ' +
      'Asegúrate de que el PDF sea un estado de cuenta bancario.'
    );
  }

  return { headers: ['Fecha', 'Descripcion', 'Monto'], rows };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------
const MIN_TEXT_LENGTH_PER_PAGE = 80;

export async function readPdfFile(
  file: File,
  onProgress?: PdfProgressCallback
): Promise<{ headers: string[]; rows: string[][]; isOcr: boolean }> {
  onProgress?.('Abriendo PDF…', 5);

  let text = '';
  let isOcr = false;

  try {
    const { text: extracted, pageCount } = await extractTextFromPdf(file, onProgress);
    const avgLen = extracted.length / Math.max(pageCount, 1);

    if (avgLen >= MIN_TEXT_LENGTH_PER_PAGE) {
      text = extracted;
    } else {
      // Sparse text → scanned PDF, use OCR
      onProgress?.('PDF escaneado detectado, iniciando OCR…', 62);
      text = await extractTextWithOcr(file, onProgress);
      isOcr = true;
    }
  } catch {
    // PDF.js failed completely → try OCR
    onProgress?.('Texto no extraíble, usando OCR…', 30);
    text = await extractTextWithOcr(file, onProgress);
    isOcr = true;
  }

  onProgress?.('Analizando transacciones…', 95);
  const { headers, rows } = parsePdfText(text);
  onProgress?.(`Listo: ${rows.length} transacciones encontradas`, 100);

  return { headers, rows, isOcr };
}
