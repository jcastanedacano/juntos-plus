export type TransactionType = 'income' | 'expense';
export type CurrencyType = 'PEN' | 'USD' | 'EUR';

// Who paid for / earned this transaction in a couple-finance setup.
//   shared  → shared household money
//   me      → the signed-in user
//   partner → the user's partner
// Undefined defaults to 'shared' for backwards compat with old data.
export type Owner = 'shared' | 'me' | 'partner';

/** Quien pago un gasto. Opcional: los movimientos importados del banco no lo
 *  traen y no se debe inventar. */
export type PaidBy = 'jorge' | 'zumy' | 'both';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  date: string;
  accountId: string;
  currency?: CurrencyType;
  sourceRecurringId?: string;
  receiptImageUrl?: string; // Base64 data URL of attached receipt image
  owner?: Owner;            // Couple-finance tag: shared (default) | me | partner
  /** Quien pago. Ausente en los movimientos importados. */
  paidBy?: PaidBy;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: TransactionType;
}

export type AccountType = 'debit' | 'credit';

/** A single installment plan attached to a credit card (PASE CUOTAS BM). */
export interface CreditInstallment {
  id: string;
  description: string;     // "PASE CUOTAS BM" or "EBN*AMAZON" etc.
  originalAmount: number;
  paidInstallments: number;
  totalInstallments: number;
  monthlyCapital: number;
  monthlyInterest: number;
  monthlyTotal: number;
  tea: number;             // annual rate, 0.9589 = 95.89%
  currency: 'PEN' | 'USD';
}

/** Historical snapshot of a closed cycle — used for trend visualization
 *  (utilization over time, interest vs principal, FX drift on USD). */
export interface CreditStatementHistoryEntry {
  cycleEnd: string;          // ISO yyyy-mm-dd of the cycle close
  saldoTotalPEN?: number;
  saldoTotalUSD?: number;
  pagoTotalPEN?: number;
  pagoTotalUSD?: number;
  pagoMinimoPEN?: number;
  pagoMinimoUSD?: number;
  utilization?: number;      // 0..1, computed at the time of capture
  teaPEN?: number;
  teaUSD?: number;
  fxRateUSD?: number;        // PEN/USD at the time the entry was recorded
  recordedAt: string;        // ISO timestamp
}

/** Snapshot pulled from the most recent imported credit-card PDF.
 *  Lives on Account to keep it co-located with the card the user sees. */
export interface CreditStatement {
  cycleStart?: string;      // ISO yyyy-mm-dd
  cycleEnd?: string;
  paymentDueDate?: string;
  saldoTotalPEN?: number;
  saldoTotalUSD?: number;
  pagoMinimoPEN?: number;
  pagoTotalPEN?: number;
  pagoMinimoUSD?: number;
  pagoTotalUSD?: number;
  teaPEN?: number;          // 0.9589 means 95.89%
  teaUSD?: number;
  installments?: CreditInstallment[];
  importedAt: string;       // ISO timestamp of when we parsed the PDF
}

export interface Account {
  id: string;
  name: string;
  balance: number;
  color: string;
  icon: string;
  type: AccountType;
  bank?: string;
  lastFourDigits?: string;
  creditLimit?: number;
  statementCloseDay?: number;
  paymentDueDay?: number;
  /** Latest snapshot from a BCP credit-card statement PDF. */
  latestStatement?: CreditStatement;
  /** Rolling history of closed cycles — capped at 12 entries. */
  statementHistory?: CreditStatementHistoryEntry[];
  /** ISO timestamp of the last manual balance reconciliation
   *  ("Ajustar saldo"). Used to show "actualizado hace Xh" hint. */
  balanceUpdatedAt?: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  amount: number;
  spent: number;
  period: 'monthly' | 'weekly' | 'yearly';
  currency?: CurrencyType;
}

export interface Statistics {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  byCategory: { [key: string]: number };
  trend: Array<{ date: string; income: number; expense: number }>;
}

export type UserRole = 'admin' | 'user';
export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface User {
  id: string;
  email: string;
  password?: string;
  name: string;
  createdAt: string;
  role: UserRole;
  status: UserStatus;
  avatar?: string;
  entraId?: string;
}

export interface GoalContribution {
  date: string;
  amount: number;
  note?: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  startDate: string;
  isActive: boolean;
  icon: string;
  color: string;
  description?: string;
  currency?: CurrencyType;
  contributions?: GoalContribution[];
  owner?: Owner;            // Couple-finance tag: shared (default) | me | partner
}

export type GoalStatusFilter = 'all' | 'active' | 'paused' | 'completed';
export type GoalPeriodFilter = 'month' | 'quarter' | 'year';
export type GoalSortBy = 'progress' | 'amount' | 'deadline' | 'name';
export type GoalViewMode = 'cards' | 'list';

export interface Investment {
  id: string;
  name: string;
  type: 'stocks' | 'crypto' | 'bonds' | 'realestate' | 'other';
  initialAmount: number;
  currentAmount: number;
  purchaseDate: string;
  notes?: string;
}

export interface RecurringPriceEntry {
  date: string;
  amount: number;
}

export interface RecurringTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  nextDate: string;
  isActive: boolean;
  currency?: CurrencyType;
  tags?: string[];
  notes?: string;
  previousAmounts?: RecurringPriceEntry[];
  owner?: Owner;            // Couple-finance tag: shared (default) | me | partner
  pausedUntil?: string;     // ISO date — auto-paused after early payment, auto-resumes on or after this date
}

export type RecurringQuickFilter = 'next7days' | 'annual' | 'monthly' | 'withIncreases' | 'active' | 'paused';

export interface RecurringFilter {
  type: 'all' | TransactionType;
  searchTerm: string;
  statuses: ('active' | 'paused')[];
  frequencies: RecurringTransaction['frequency'][];
  categories: string[];
  quickFilter: RecurringQuickFilter | null;
}

export type RecurringPeriod = 'current' | 'next' | 'last3';
export type RecurringSortBy = 'nextDate' | 'amount' | 'name' | 'category';
export type RecurringSortDir = 'asc' | 'desc';

export interface AutoSave {
  id: string;
  name: string;
  percentage: number;
  isActive: boolean;
  goalId?: string;
}

export interface TransactionFilter {
  type: 'all' | TransactionType;
  dateRange: { start: string; end: string } | null;
  categories: string[];
  searchTerm: string;
}

export interface TransactionFilterPreset {
  id: string;
  name: string;
  filter: TransactionFilter;
}

// ─── Import Types ────────────────────────────────────────────────────────
export interface ColumnMapping {
  dateColumn: string | null;
  amountColumn: string | null;
  descriptionColumn: string | null;
  typeColumn: string | null;
  categoryColumn: string | null;
}

export interface ImportSession {
  id: string;
  fileName: string;
  bankName: string | null;
  mapping: ColumnMapping;
  rawHeaders: string[];
  rawRows: string[][];
  parsedTransactions: Transaction[];
  status: 'mapping' | 'preview' | 'completed' | 'cancelled';
  createdAt: string;
}

// ─── Subscription Detection Types ────────────────────────────────────────
export interface DetectedSubscription {
  id: string;
  merchantName: string;
  normalizedName: string;
  category: string;
  estimatedAmount: number;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  confidence: 'high' | 'medium' | 'low';
  confidenceScore: number;
  lastChargeDate: string;
  nextExpectedDate: string;
  totalLast12Months: number;
  chargeCount: number;
  transactionIds: string[];
  alerts: SubscriptionAlert[];
  isConfirmed: boolean;
  isDismissed: boolean;
}

export interface SubscriptionAlert {
  type: 'price_increase' | 'double_charge' | 'missing_charge' | 'new_subscription';
  message: string;
  severity: 'info' | 'warning' | 'danger';
  date: string;
}

// ─── Savings Center Types ────────────────────────────────────────────────
export interface CutSuggestion {
  id: string;
  serviceName: string;
  monthlyCost: number;
  annualCost: number;
  reason: 'duplicate' | 'unused' | 'phantom' | 'expensive' | 'forgotten';
  reasonLabel: string;
  relatedSubscriptionIds: string[];
  isDismissed: boolean;
  reminderDate: string | null;
}

export interface CancellationGuideData {
  name: string;
  url: string;
  steps: string[];
  estimatedTime: string;
  emailTemplate: string | null;
  category: string;
}

// ─── Insights Types ──────────────────────────────────────────────────────
export interface FinancialInsight {
  id: string;
  type: 'phantom_spending' | 'unusual_spending' | 'month_forecast' | 'spending_pace' | 'daily_budget' | 'trend_alert';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'danger' | 'success';
  value?: number;
  action?: string;
  category?: string;
}

// ─── Privacy Types ───────────────────────────────────────────────────────
export interface PrivacyLog {
  id: string;
  action: string;
  details: string;
  timestamp: string;
}

// ─── Parser Registry Types ───────────────────────────────────────────────
export interface BankParser {
  bankName: string;
  version: string;
  detect: (headers: string[], rows: string[][]) => boolean;
  parse: (headers: string[], rows: string[][]) => Omit<Transaction, 'id'>[];
}

export interface ImportProblemReport {
  id: string;
  fileName: string;
  bankName: string | null;
  errorMessage: string;
  headersSample: string[];
  rowCount: number;
  timestamp: string;
}
