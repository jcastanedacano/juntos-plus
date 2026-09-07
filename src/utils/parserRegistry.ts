import { BankParser, ImportProblemReport } from '../types';
import { bankParsers } from '../data/bankParsers';

const PROBLEMS_KEY = 'juntos_import_problems';

export function detectBank(headers: string[], rows: string[][]): BankParser | null {
  for (const parser of bankParsers) {
    if (parser.detect(headers, rows)) {
      return parser;
    }
  }
  return null;
}

export function getAllParsers(): BankParser[] {
  return [...bankParsers];
}

export function reportProblem(
  fileName: string,
  bankName: string | null,
  errorMessage: string,
  headers: string[],
  rowCount: number
): void {
  const report: ImportProblemReport = {
    id: Date.now().toString(),
    fileName,
    bankName,
    errorMessage,
    headersSample: headers.slice(0, 10),
    rowCount,
    timestamp: new Date().toISOString(),
  };

  const problems = getProblems();
  problems.unshift(report);
  localStorage.setItem(PROBLEMS_KEY, JSON.stringify(problems.slice(0, 50)));
}

export function getProblems(): ImportProblemReport[] {
  try {
    const stored = localStorage.getItem(PROBLEMS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function clearProblems(): void {
  localStorage.removeItem(PROBLEMS_KEY);
}
