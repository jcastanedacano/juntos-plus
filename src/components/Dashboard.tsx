import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Transaction, SavingsGoal, Statistics, Account, RecurringTransaction, Budget } from '../types';
import { useFxRates, projectToBase } from '../utils/fx';
import {
  MonthlyPlan,
  calculateHealthScore,
  calculateCashflowForecast,
  calculateDisponibleReal,
  calculateRule503020,
  calculateMonthEndForecast,
  calculateHeatmapData,
} from '../utils/calculations';
import { FinancialHealthScore } from './FinancialHealthScore';
import { CashflowForecast } from './CashflowForecast';
import { TopSpendingCard } from './dashboard/TopSpendingCard';
import { CalendarHeatmap } from './CalendarHeatmap';
import { SubscriptionsPanel } from './dashboard/SubscriptionsPanel';
import { Rule503020Card } from './dashboard/Rule503020Card';
import { HeroCard } from './dashboard/HeroCard';
import { InsightsRow } from './dashboard/InsightsRow';
import { OwnershipSplitCard } from './dashboard/OwnershipSplitCard';
import { GoalsStrip } from './dashboard/GoalsStrip';
import { RecentTransactionsCard } from './dashboard/RecentTransactionsCard';
import { WalletSection } from './WalletSection';

interface DashboardProps {
  stats: Statistics;
  previousStats: Statistics;
  transactions: Transaction[];
  goals: SavingsGoal[];
  accounts: Account[];
  currency: string;
  monthlyPlan: MonthlyPlan;
  recurring?: RecurringTransaction[];
  selectedMonth?: Date;
  budgets?: Budget[];
  onRefresh?: () => void;
  onAddAccount?: () => void;
  onEditAccount?: (account: Account) => void;
  onDeleteAccount?: (id: string) => void;
  onAdjustBalance?: (accountId: string, newBalance: number) => void;
  onQuickReconcile?: () => void;
  onCreateGoal?: () => void;
}

export function Dashboard({
  stats,
  previousStats,
  transactions,
  goals,
  accounts,
  currency,
  monthlyPlan,
  recurring = [],
  selectedMonth,
  budgets = [],
  onRefresh,
  onAddAccount,
  onEditAccount,
  onDeleteAccount,
  onAdjustBalance,
  onQuickReconcile,
  onCreateGoal,
}: DashboardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    await onRefresh();
    // refresh complete
    setIsRefreshing(false);
  };

  // ─── Currency normalization ──────────────────────────────────────
  // Every transaction is projected to the base currency (PEN) using the
  // user-configurable FX rates (default 3.50 PEN/USD, 4.00 PEN/EUR).
  // Recurring items follow the same projection. The original currency
  // tag stays on each row for the table view; here we feed already-
  // converted numbers into the single-currency calculation helpers.
  const fxRates = useFxRates();
  const txnsBase = useMemo(
    () => projectToBase(transactions, fxRates),
    [transactions, fxRates]
  );
  const recurringBase = useMemo(
    () => recurring.map(r => {
      if (!r.currency || r.currency === 'PEN') return r;
      const rate = fxRates[r.currency as keyof typeof fxRates] || 1;
      return { ...r, amount: r.amount * rate, currency: 'PEN' as const };
    }),
    [recurring, fxRates]
  );

  // ─── Computed data (always on dominant-currency slice) ────────────
  const disponibleReal = useMemo(
    () => calculateDisponibleReal(recurringBase, budgets, goals, txnsBase, selectedMonth),
    [recurringBase, budgets, goals, txnsBase, selectedMonth]
  );
  const rule503020 = useMemo(
    () => calculateRule503020(recurringBase, budgets, goals, txnsBase, selectedMonth),
    [recurringBase, budgets, goals, txnsBase, selectedMonth]
  );
  const monthEndForecast = useMemo(
    () => calculateMonthEndForecast(txnsBase, recurringBase, currency, selectedMonth),
    [txnsBase, recurringBase, currency, selectedMonth]
  );

  const heatmapData = useMemo(
    () => calculateHeatmapData(transactions, selectedMonth),
    [transactions, selectedMonth]
  );
  const healthScore = useMemo(
    () => calculateHealthScore(txnsBase, goals, selectedMonth, budgets),
    [txnsBase, goals, selectedMonth, budgets]
  );
  const cashflowData = useMemo(
    () => calculateCashflowForecast(txnsBase, recurringBase, selectedMonth),
    [txnsBase, recurringBase, selectedMonth]
  );

  return (
    <div className="dash-12">
      {/* Refresh bar */}
      {onRefresh && (
        <div className="dash-col-12" style={{
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem',
        }}>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.4rem 0.85rem', borderRadius: '8px',
              border: '1px solid var(--border-color)', background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)', cursor: isRefreshing ? 'not-allowed' : 'pointer',
              fontSize: '0.8rem', fontWeight: 500, transition: 'all 0.2s',
            }}
          >
            <RefreshCw size={14} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            {isRefreshing ? 'Actualizando...' : 'Actualizar datos'}
          </button>
        </div>
      )}

      {/* ═══ Row 1: Hero — Disponible real + Ritmo del mes ═══ */}
      <div className="dash-col-12">
        <HeroCard
          disponibleReal={disponibleReal}
          monthEndForecast={monthEndForecast}
          stats={stats}
          previousStats={previousStats}
          budgets={budgets}
          currency={currency}
          selectedMonth={selectedMonth}
          allTransactions={transactions}
        />
      </div>

      {/* ═══ Row 1.5: Wallet / Accounts ═══ */}
      <div className="dash-col-12">
        <WalletSection
          accounts={accounts}
          currency={currency as any}
          onAddAccount={onAddAccount}
          onEditAccount={onEditAccount}
          onDeleteAccount={onDeleteAccount}
          onAdjustBalance={onAdjustBalance}
          onQuickReconcile={onQuickReconcile}
        />
      </div>

      {/* ═══ Row 2: Cashflow — full width ═══ */}
      <div className="dash-col-12">
        <CashflowForecast data={cashflowData} currency={currency} transactions={transactions} />
      </div>

      {/* ═══ Row 3: 50/30/20 (4 col) + Top "Lo que más pagas" (4 col) + Score (4 col) ═══ */}
      <div className="dash-col-4">
        <Rule503020Card result={rule503020} currency={currency} />
      </div>
      <div className="dash-col-4">
        <TopSpendingCard
          transactions={transactions}
          recurring={recurring}
          currency={currency}
          selectedMonth={selectedMonth}
        />
      </div>
      <div className="dash-col-4">
        <FinancialHealthScore score={healthScore} />
      </div>

      {/* ═══ Row 3.5: Ownership split (compartido vs individual) ═══ */}
      <div className="dash-col-12">
        <OwnershipSplitCard
          transactions={txnsBase}
          currency="PEN"
          selectedMonth={selectedMonth}
        />
      </div>

      {/* ═══ Row 4: Insights (full width, actionable) ═══ */}
      <div className="dash-col-12">
        <InsightsRow
          transactions={transactions}
          recurring={recurring}
          budgets={budgets}
          goals={goals}
          selectedMonth={selectedMonth}
          onCreateGoal={onCreateGoal}
        />
      </div>

      {/* ═══ Row 5: Suscripciones — full width ═══ */}
      <div className="dash-col-12">
        <SubscriptionsPanel
          transactions={transactions}
          recurring={recurring}
          currency={currency}
          selectedMonth={selectedMonth}
        />
      </div>

      {/* ═══ Row 6: Metas activas (strip horizontal) ═══ */}
      <div className="dash-col-12">
        <GoalsStrip goals={goals} currency={currency} />
      </div>

      {/* ═══ Row 7: Mapa de calor de los ultimos 3 meses ═══ */}
      <div className="dash-col-12">
        <CalendarHeatmap data={heatmapData} currency={currency} />
      </div>

      {/* ═══ Row 8: Movimientos recientes (con cuenta) ═══ */}
      <div className="dash-col-12">
        <RecentTransactionsCard
          transactions={transactions}
          accounts={accounts}
          currency={currency}
          limit={6}
        />
      </div>
    </div>
  );
}
