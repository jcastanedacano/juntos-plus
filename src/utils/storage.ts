import { Transaction, Account, Budget, User, SavingsGoal, Investment, RecurringTransaction, AutoSave } from '../types';

// Export API storage for network sync
export { storageAPI } from './storageAPI';

const STORAGE_KEYS = {
  TRANSACTIONS: 'finance_transactions',
  ACCOUNTS: 'finance_accounts',
  BUDGETS: 'finance_budgets',
  CURRENCY: 'finance_currency',
  USER: 'finance_user',
  USERS: 'finance_users',
  GOALS: 'finance_goals',
  INVESTMENTS: 'finance_investments',
  RECURRING: 'finance_recurring',
  AUTOSAVE: 'finance_autosave',
};

export const storage = {
  getTransactions: (): Transaction[] => {
    const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    return data ? JSON.parse(data) : [];
  },

  saveTransactions: (transactions: Transaction[]): void => {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  },

  getAccounts: (): Account[] => {
    const data = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    return data ? JSON.parse(data) : [
      {
        id: 'default',
        name: 'Cuenta Principal',
        balance: 0,
        color: '#00D1B2',
        icon: '🏦',
        type: 'debit' as const,
      },
    ];
  },

  saveAccounts: (accounts: Account[]): void => {
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
  },

  getBudgets: (): Budget[] => {
    const data = localStorage.getItem(STORAGE_KEYS.BUDGETS);
    return data ? JSON.parse(data) : [];
  },

  saveBudgets: (budgets: Budget[]): void => {
    localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(budgets));
  },

  getCurrency: (): string => {
    const data = localStorage.getItem(STORAGE_KEYS.CURRENCY);
    return data || 'PEN';
  },

  saveCurrency: (currency: string): void => {
    localStorage.setItem(STORAGE_KEYS.CURRENCY, currency);
  },

  getUser: (): User | null => {
    const data = localStorage.getItem(STORAGE_KEYS.USER);
    return data ? JSON.parse(data) : null;
  },

  saveUser: (user: User | null): void => {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
  },

  getGoals: (): SavingsGoal[] => {
    const data = localStorage.getItem(STORAGE_KEYS.GOALS);
    return data ? JSON.parse(data) : [];
  },

  saveGoals: (goals: SavingsGoal[]): void => {
    localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals));
  },

  getInvestments: (): Investment[] => {
    const data = localStorage.getItem(STORAGE_KEYS.INVESTMENTS);
    return data ? JSON.parse(data) : [];
  },

  saveInvestments: (investments: Investment[]): void => {
    localStorage.setItem(STORAGE_KEYS.INVESTMENTS, JSON.stringify(investments));
  },

  getRecurring: (): RecurringTransaction[] => {
    const data = localStorage.getItem(STORAGE_KEYS.RECURRING);
    return data ? JSON.parse(data) : [];
  },

  saveRecurring: (recurring: RecurringTransaction[]): void => {
    localStorage.setItem(STORAGE_KEYS.RECURRING, JSON.stringify(recurring));
  },

  getAutoSave: (): AutoSave[] => {
    const data = localStorage.getItem(STORAGE_KEYS.AUTOSAVE);
    return data ? JSON.parse(data) : [];
  },

  saveAutoSave: (autoSave: AutoSave[]): void => {
    localStorage.setItem(STORAGE_KEYS.AUTOSAVE, JSON.stringify(autoSave));
  },

  getUsers: (): User[] => {
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    return data ? JSON.parse(data) : [];
  },

  saveUsers: (users: User[]): void => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  },
};
