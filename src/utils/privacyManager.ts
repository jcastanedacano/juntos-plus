import { PrivacyLog } from '../types';

const PRIVACY_LOG_KEY = 'juntos_privacy_log';
const MAX_LOG_ENTRIES = 100;

export function addPrivacyLog(action: string, details: string): void {
  const logs = getPrivacyLogs();
  const entry: PrivacyLog = {
    id: Date.now().toString(),
    action,
    details,
    timestamp: new Date().toISOString(),
  };
  logs.unshift(entry);
  // Keep only last N entries
  const trimmed = logs.slice(0, MAX_LOG_ENTRIES);
  localStorage.setItem(PRIVACY_LOG_KEY, JSON.stringify(trimmed));
}

export function getPrivacyLogs(): PrivacyLog[] {
  try {
    const stored = localStorage.getItem(PRIVACY_LOG_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function clearPrivacyLogs(): void {
  localStorage.removeItem(PRIVACY_LOG_KEY);
}

export function logImportEvent(fileName: string, transactionCount: number): void {
  addPrivacyLog(
    'Importación de archivo',
    `Se importaron ${transactionCount} transacciones del archivo "${fileName}". El archivo original no fue almacenado: solo se guardaron las transacciones normalizadas.`
  );
}

export function logDataExport(format: string, count: number): void {
  addPrivacyLog(
    'Exportación de datos',
    `Se exportaron ${count} transacciones en formato ${format}.`
  );
}
