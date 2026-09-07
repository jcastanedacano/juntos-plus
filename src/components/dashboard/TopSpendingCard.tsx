import { useState, useMemo } from 'react';
import { TrendingUp, ShoppingBag, X } from 'lucide-react';
import { Transaction, DetectedSubscription, RecurringTransaction } from '../../types';
import { getCategoryById } from '../../utils/categoryHelpers';
import { normalizeDescription } from '../../utils/descriptionNormalizer';
import { detectSubscriptions } from '../../utils/subscriptionDetector';
import { formatCurrencyCompact } from '../../utils/calculations';

type ViewMode = 'subscriptions' | 'merchants' | 'categories';

interface TopItem {
  id: string;
  name: string;
  icon: string;
  color: string;
  total: number;
  percentage: number;
  count: number;
  freq?: string;
}

interface TopSpendingCardProps {
  transactions: Transaction[];
  recurring?: RecurringTransaction[];
  currency: string;
  selectedMonth?: Date;
}

const freqLabel: Record<string, string> = {
  weekly: 'Semanal',
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  yearly: 'Anual',
};

function getMonthExpenses(transactions: Transaction[], selectedMonth?: Date): Transaction[] {
  const now = selectedMonth || new Date();
  const yy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `${yy}-${mm}`;
  return transactions.filter(t => {
    if (t.type !== 'expense') return false;
    return t.date.startsWith(prefix);
  });
}

function getTopCategories(expenses: Transaction[], limit: number): TopItem[] {
  const total = expenses.reduce((s, t) => s + t.amount, 0);
  const map = new Map<string, { sum: number; count: number }>();
  for (const tx of expenses) {
    const cur = map.get(tx.category) || { sum: 0, count: 0 };
    cur.sum += tx.amount;
    cur.count++;
    map.set(tx.category, cur);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1].sum - a[1].sum)
    .slice(0, limit)
    .map(([catId, data]) => {
      const cat = getCategoryById(catId);
      return {
        id: catId,
        name: cat?.name || catId,
        icon: cat?.icon || '📦',
        color: cat?.color || '#6B7280',
        total: data.sum,
        percentage: total > 0 ? (data.sum / total) * 100 : 0,
        count: data.count,
      };
    });
}

function getTopMerchants(expenses: Transaction[], limit: number): TopItem[] {
  const total = expenses.reduce((s, t) => s + t.amount, 0);
  const map = new Map<string, { name: string; sum: number; count: number }>();
  const colors = ['#6C8EEF', '#F59E0B', '#00D1B2', '#FF6B81', '#A78BFA',
    '#EC4899', '#14B8A6', '#F97316', '#8B5CF6', '#06B6D4',
    '#EF4444', '#10B981', '#6366F1', '#E11D48', '#0EA5E9',
    '#84CC16', '#D946EF', '#FBBF24', '#34D399', '#FB923C'];

  for (const tx of expenses) {
    const norm = normalizeDescription(tx.description);
    const key = norm.normalizedName.toLowerCase();
    const cur = map.get(key) || { name: norm.normalizedName, sum: 0, count: 0 };
    cur.sum += tx.amount;
    cur.count++;
    map.set(key, cur);
  }
  return Array.from(map.values())
    .sort((a, b) => b.sum - a.sum)
    .slice(0, limit)
    .map((data, i) => ({
      id: data.name,
      name: data.name,
      icon: '🏪',
      color: colors[i % colors.length],
      total: data.sum,
      percentage: total > 0 ? (data.sum / total) * 100 : 0,
      count: data.count,
    }));
}

function monthlyEquivalent(sub: DetectedSubscription): number {
  switch (sub.frequency) {
    case 'weekly': return sub.estimatedAmount * 4.33;
    case 'monthly': return sub.estimatedAmount;
    case 'quarterly': return sub.estimatedAmount / 3;
    case 'yearly': return sub.estimatedAmount / 12;
  }
}

function recurringMonthly(r: RecurringTransaction): number {
  switch (r.frequency) {
    case 'weekly': return r.amount * 4.33;
    case 'daily': return r.amount * 30;
    case 'yearly': return r.amount / 12;
    default: return r.amount;
  }
}

function getTopSubscriptions(transactions: Transaction[], recurring: RecurringTransaction[], limit: number): TopItem[] {
  const detected = detectSubscriptions(transactions);
  const active = detected.filter(s => !s.isDismissed);

  // Build items from recurring transactions (primary source)
  const recItems = recurring
    .filter(r => r.isActive && r.type === 'expense')
    .map(r => ({
      id: r.id,
      name: r.description,
      monthly: recurringMonthly(r),
      freq: freqLabel[r.frequency] || r.frequency,
    }));

  // Add auto-detected that aren't already in recurring (by name match)
  const recNames = new Set(recItems.map(r => r.name.toLowerCase()));
  const autoItems = active
    .filter(s => !recNames.has(s.merchantName.toLowerCase()) && !recNames.has(s.normalizedName.toLowerCase()))
    .map(s => ({
      id: s.id,
      name: s.merchantName,
      monthly: monthlyEquivalent(s),
      freq: freqLabel[s.frequency] || s.frequency,
    }));

  const all = [...recItems, ...autoItems];
  const totalMonthly = all.reduce((s, item) => s + item.monthly, 0);

  const colors = ['#A78BFA', '#6C8EEF', '#F59E0B', '#00D1B2', '#FF6B81',
    '#EC4899', '#14B8A6', '#F97316', '#8B5CF6', '#06B6D4'];

  return all
    .sort((a, b) => b.monthly - a.monthly)
    .slice(0, limit)
    .map((item, i) => ({
      id: item.id,
      name: item.name,
      icon: '🔄',
      color: colors[i % colors.length],
      total: item.monthly,
      percentage: totalMonthly > 0 ? (item.monthly / totalMonthly) * 100 : 0,
      count: 0,
      freq: item.freq,
    }));
}

const tabLabels: Record<ViewMode, string> = {
  subscriptions: 'Suscripciones',
  merchants: 'Comercios',
  categories: 'Categorías',
};

export function TopSpendingCard({ transactions, recurring = [], currency, selectedMonth }: TopSpendingCardProps) {
  const [mode, setMode] = useState<ViewMode>('subscriptions');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const expenses = useMemo(() => getMonthExpenses(transactions, selectedMonth), [transactions, selectedMonth]);
  const totalExpenses = useMemo(() => expenses.reduce((s, t) => s + t.amount, 0), [expenses]);

  const top5 = useMemo(() => {
    if (mode === 'subscriptions') return getTopSubscriptions(transactions, recurring, 5);
    if (mode === 'merchants') return getTopMerchants(expenses, 5);
    return getTopCategories(expenses, 5);
  }, [expenses, transactions, recurring, mode]);

  const topAll = useMemo(() => {
    if (mode === 'subscriptions') return getTopSubscriptions(transactions, recurring, 20);
    if (mode === 'merchants') return getTopMerchants(expenses, 20);
    return getTopCategories(expenses, 20);
  }, [expenses, transactions, recurring, mode]);

  const subtitle = mode === 'subscriptions'
    ? `${top5.length} activas`
    : `Total: ${formatCurrencyCompact(totalExpenses, currency)}`;

  return (
    <>
      <div className="top-spending-card">
        {/* Header */}
        <div className="top-spending-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '8px',
              background: 'rgba(96,165,250,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <TrendingUp size={16} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                Lo que más pagas al mes
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {subtitle}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="top-spending-tabs">
          {(['subscriptions', 'merchants', 'categories'] as ViewMode[]).map(tab => (
            <button
              key={tab}
              className={mode === tab ? 'active' : ''}
              onClick={() => setMode(tab)}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        {/* Items */}
        <div className="top-spending-list">
          {top5.map((item, i) => (
            <div key={item.id} className="top-spending-item">
              <div className="top-spending-rank" style={{ background: `${item.color}18`, color: item.color }}>
                {i + 1}
              </div>
              <span className="top-spending-icon">{item.icon}</span>
              <div className="top-spending-info">
                <div className="top-spending-name">
                  {item.name}
                  {item.freq && <span className="top-spending-freq">{item.freq}</span>}
                </div>
                <div className="top-spending-bar-track">
                  <div
                    className="top-spending-bar-fill"
                    style={{ width: `${Math.min(item.percentage, 100)}%`, background: item.color }}
                  />
                </div>
              </div>
              <div className="top-spending-amount">
                <span className="top-spending-value">
                  {formatCurrencyCompact(item.total, currency)}
                  {mode === 'subscriptions' && <span style={{ fontSize: 'var(--fs-micro)', color: 'var(--text-muted)' }}>/mes</span>}
                </span>
                <span className="top-spending-pct">{item.percentage.toFixed(1)}%</span>
              </div>
            </div>
          ))}

          {top5.length === 0 && (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              {mode === 'subscriptions' ? 'Sin suscripciones detectadas' : 'Sin gastos este mes'}
            </div>
          )}
        </div>

        {/* Ver todo → drawer */}
        {top5.length > 0 && (
          <button className="top-spending-more" onClick={() => setDrawerOpen(true)}>
            <ShoppingBag size={14} />
            Ver todo
          </button>
        )}
      </div>

      {/* Drawer (instead of modal) */}
      {drawerOpen && <div className="top-spending-drawer-backdrop" onClick={() => setDrawerOpen(false)} />}
      <div className={`top-spending-drawer ${drawerOpen ? 'top-spending-drawer--open' : ''}`}>
        <div className="top-spending-drawer-header">
          <h3>Top — {tabLabels[mode]}</h3>
          <button onClick={() => setDrawerOpen(false)} aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="top-spending-drawer-body">
          {topAll.map((item, i) => (
            <div key={item.id} className="top-spending-item">
              <div className="top-spending-rank" style={{ background: `${item.color}18`, color: item.color }}>
                {i + 1}
              </div>
              <span className="top-spending-icon">{item.icon}</span>
              <div className="top-spending-info">
                <div className="top-spending-name">
                  {item.name}
                  {item.freq && <span className="top-spending-freq">{item.freq}</span>}
                </div>
                <div className="top-spending-bar-track">
                  <div
                    className="top-spending-bar-fill"
                    style={{ width: `${Math.min(item.percentage, 100)}%`, background: item.color }}
                  />
                </div>
              </div>
              <div className="top-spending-amount">
                <span className="top-spending-value">
                  {formatCurrencyCompact(item.total, currency)}
                  {mode === 'subscriptions' && <span style={{ fontSize: 'var(--fs-micro)', color: 'var(--text-muted)' }}>/mes</span>}
                </span>
                <span className="top-spending-pct">{item.percentage.toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
