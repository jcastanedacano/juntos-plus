import { Transaction, Account, Budget, User, SavingsGoal, Investment, RecurringTransaction, AutoSave } from '../types';
import { getToken } from '../auth/getToken';

const API_URL = 'http://localhost:3007/api';

// Get API URL based on current location
export const getAPIUrl = () => {
  // Si estamos en localhost, usar la URL local
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return API_URL;
  }

  // Si la URL actual usa HTTPS (Cloudflare Tunnel), usar la misma URL base
  if (window.location.protocol === 'https:') {
    return `${window.location.protocol}//${window.location.host}/api`;
  }

  // Si estamos en la red local (HTTP), usar el mismo host con puerto 3007
  return `http://${window.location.hostname}:3007/api`;
};

interface AppData {
  transactions: Transaction[];
  accounts: Account[];
  budgets: Budget[];
  currency: string;
  user: User | null;
  users: User[];
  goals: SavingsGoal[];
  investments: Investment[];
  recurring: RecurringTransaction[];
  autosave: AutoSave[];
  /** Ids de suscripciones detectadas que el usuario descarto. */
  dismissedSubscriptions: string[];
}

let cachedData: AppData | null = null;
let pendingFetch: Promise<AppData> | null = null;
let lastLoadError: string | null = null;

export const getLastLoadError = (): string | null => lastLoadError;

// Fetch all data from server (deduplicated — concurrent calls share one request)
const fetchAllData = async (): Promise<AppData> => {
  if (pendingFetch) return pendingFetch;

  pendingFetch = (async () => {
    try {
      const apiUrl = getAPIUrl();
      const token = await getToken();
      const response = await fetch(`${apiUrl}/data`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        // Skip the SW cache for the auth-bearing call so we always hit
        // the real server. Stale cached responses were silently shadowing
        // real data on returning devices.
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`HTTP_${response.status}`);
      }
      cachedData = await response.json();
      lastLoadError = null;
      return cachedData!;
    } catch (error: any) {
      const code = error?.message || 'unknown';
      console.error('[storageAPI] /api/data failed:', error);
      // Surface a user-friendly reason. UI can read it via getLastLoadError().
      if (code === 'HTTP_401' || code === 'HTTP_403') {
        lastLoadError = 'Tu sesión expiró o no tienes acceso. Cierra sesión y vuelve a iniciar.';
      } else if (code.startsWith('HTTP_5')) {
        lastLoadError = `El servidor respondió ${code.replace('HTTP_', '')}. Reintenta en un momento.`;
      } else if (code === 'No authenticated account' || code === 'MSAL not initialized') {
        lastLoadError = 'No hay sesión de Microsoft activa. Inicia sesión.';
      } else {
        lastLoadError = `No se pudieron cargar tus datos (${code}).`;
      }

      if (cachedData) {
        return cachedData;
      }
      // First-load failure: return empty shell so the UI doesn't crash, but
      // an "Error cargando datos" banner shows up via getLastLoadError().
      return {
        transactions: [],
        accounts: [],
        budgets: [],
        currency: 'PEN',
        user: null,
        users: [],
        goals: [],
        investments: [],
        recurring: [],
        autosave: [],
        dismissedSubscriptions: [],
      };
    } finally {
      pendingFetch = null;
    }
  })();

  return pendingFetch;
};

// Save data to server
const saveToServer = async (collection: string, data: any): Promise<void> => {
  try {
    // Para el caso especial de 'user' siendo null, enviar un objeto con una bandera
    const bodyData = data === null && collection === 'user' ? { __null__: true } : data;

    const token = await getToken();
    const response = await fetch(`${getAPIUrl()}/data/${collection}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(bodyData),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to save ${collection}: ${response.status} - ${errorText}`);
    }

    // Update local cache
    if (cachedData) {
      (cachedData as any)[collection] = data;
    }

    // Ya no hace falta invalidar nada: el service worker dejo de cachear
    // /api/ (NetworkOnly). Abrir el cache aca solo lo recreaba vacio.
  } catch (error) {
    console.error(`Error saving ${collection}:`, error);
    throw error;
  }
};

export const storageAPI = {
  getTransactions: async (): Promise<Transaction[]> => {
    const data = await fetchAllData();
    return data.transactions;
  },

  saveTransactions: async (transactions: Transaction[]): Promise<void> => {
    await saveToServer('transactions', transactions);
  },

  getAccounts: async (): Promise<Account[]> => {
    const data = await fetchAllData();
    return data.accounts;
  },

  saveAccounts: async (accounts: Account[]): Promise<void> => {
    await saveToServer('accounts', accounts);
  },

  getBudgets: async (): Promise<Budget[]> => {
    const data = await fetchAllData();
    return data.budgets;
  },

  saveBudgets: async (budgets: Budget[]): Promise<void> => {
    await saveToServer('budgets', budgets);
  },

  getCurrency: async (): Promise<string> => {
    const data = await fetchAllData();
    return data.currency;
  },

  saveCurrency: async (currency: string): Promise<void> => {
    await saveToServer('currency', currency);
  },

  getUser: async (): Promise<User | null> => {
    const data = await fetchAllData();
    return data.user;
  },

  saveUser: async (user: User | null): Promise<void> => {
    await saveToServer('user', user);
  },

  getGoals: async (): Promise<SavingsGoal[]> => {
    const data = await fetchAllData();
    return data.goals;
  },

  saveGoals: async (goals: SavingsGoal[]): Promise<void> => {
    await saveToServer('goals', goals);
  },

  getInvestments: async (): Promise<Investment[]> => {
    const data = await fetchAllData();
    return data.investments;
  },

  saveInvestments: async (investments: Investment[]): Promise<void> => {
    await saveToServer('investments', investments);
  },

  getRecurring: async (): Promise<RecurringTransaction[]> => {
    const data = await fetchAllData();
    return data.recurring;
  },

  saveRecurring: async (recurring: RecurringTransaction[]): Promise<void> => {
    await saveToServer('recurring', recurring);
  },

  getAutoSave: async (): Promise<AutoSave[]> => {
    const data = await fetchAllData();
    return data.autosave;
  },

  saveAutoSave: async (autoSave: AutoSave[]): Promise<void> => {
    await saveToServer('autosave', autoSave);
  },

  getDismissedSubscriptions: async (): Promise<string[]> => {
    const data = await fetchAllData();
    return data.dismissedSubscriptions || [];
  },

  saveDismissedSubscriptions: async (ids: string[]): Promise<void> => {
    await saveToServer('dismissedSubscriptions', ids);
  },

  getUsers: async (): Promise<User[]> => {
    const data = await fetchAllData();
    return data.users;
  },

  saveUsers: async (users: User[]): Promise<void> => {
    await saveToServer('users', users);
  },

  // Clear cache to force refresh
  clearCache: async (): Promise<void> => {
    cachedData = null;
  },

  // Lightweight poll target — lets the app detect a save made from another
  // device without re-downloading the full data blob every time.
  getVersion: async (): Promise<{ version: number; updatedAt: string } | null> => {
    try {
      const token = await getToken();
      const response = await fetch(`${getAPIUrl()}/data/version`, {
        headers: { 'Authorization': `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  },

  // Triggers a browser download of the full current dataset — manual backup
  // button, independent of the server's own daily rotation.
  downloadBackup: async (): Promise<void> => {
    const token = await getToken();
    const response = await fetch(`${getAPIUrl()}/backup`, {
      headers: { 'Authorization': `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`Failed to download backup: ${response.status}`);
    }
    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match?.[1] || `juntos-backup_${new Date().toISOString().slice(0, 10)}.json`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
