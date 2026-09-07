import { useState, useMemo } from 'react';
import { Budget, Transaction } from '../types';
import { formatCurrency } from '../utils/calculations';
import { getCategoryInfo } from '../data/categories';
import { Trash2, Edit2, Plus, AlertTriangle, Wallet, TrendingDown, PiggyBank, Lightbulb } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { parseDateOnly } from '../utils/stableDate';

interface BudgetsProps {
  budgets: Budget[];
  transactions: Transaction[];
  onAddBudget: () => void;
  onEditBudget: (budget: Budget) => void;
  onDeleteBudget: (id: string) => void;
  onSuggestBudget?: (categoryId: string, amount: number) => void;
  currency: string;
}

const periodLabels: Record<string, string> = {
  monthly: 'Mensual',
  weekly: 'Semanal',
  yearly: 'Anual',
};

export const Budgets = ({
  budgets,
  transactions,
  onAddBudget,
  onEditBudget,
  onDeleteBudget,
  onSuggestBudget,
  currency,
}: BudgetsProps) => {
  const [period, setPeriod] = useState<'monthly' | 'weekly' | 'yearly'>('monthly');

  const calculateSpent = (categoryId: string, budgetPeriod: string): number => {
    const now = new Date();
    let startDate = new Date();

    if (budgetPeriod === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (budgetPeriod === 'weekly') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(now.setDate(diff));
      startDate.setHours(0, 0, 0, 0);
    } else if (budgetPeriod === 'yearly') {
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    return transactions
      .filter((t) => {
        const transactionDate = parseDateOnly(t.date);
        return (
          t.type === 'expense' &&
          t.category === categoryId &&
          transactionDate >= startDate &&
          transactionDate <= now
        );
      })
      .reduce((sum, t) => sum + t.amount, 0);
  };

  const budgetsWithSpent = useMemo(() => {
    return budgets
      .filter((b) => b.period === period)
      .map((budget) => ({
        ...budget,
        spent: calculateSpent(budget.categoryId, budget.period),
      }));
  }, [budgets, transactions, period]);

  const totalBudget = budgetsWithSpent.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = budgetsWithSpent.reduce((sum, b) => sum + b.spent, 0);
  const totalRemaining = totalBudget - totalSpent;
  const overallPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  // Donut chart data
  const donutData = useMemo(() => {
    return budgetsWithSpent
      .filter(b => b.spent > 0)
      .map(b => {
        const cat = getCategoryInfo(b.categoryId);
        return {
          name: cat?.name || b.categoryId,
          value: b.spent,
          color: cat?.color || '#6C8EEF',
          budget: b.amount,
        };
      });
  }, [budgetsWithSpent]);

  // Smart suggestions: categories with spending but no budget
  const suggestions = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const budgetedCategoryIds = new Set(budgets.map(b => b.categoryId));

    const spendingByCategory = new Map<string, { total: number; count: number }>();
    transactions
      .filter(t => t.type === 'expense' && parseDateOnly(t.date) >= monthStart)
      .forEach(t => {
        const existing = spendingByCategory.get(t.category) || { total: 0, count: 0 };
        spendingByCategory.set(t.category, { total: existing.total + t.amount, count: existing.count + 1 });
      });

    const results: { categoryId: string; name: string; icon: string; color: string; amount: number; count: number }[] = [];
    spendingByCategory.forEach((data, categoryId) => {
      if (!budgetedCategoryIds.has(categoryId) && (data.count >= 3 || data.total >= 100)) {
        const cat = getCategoryInfo(categoryId);
        if (cat && cat.type === 'expense') {
          results.push({
            categoryId,
            name: cat.name,
            icon: cat.icon,
            color: cat.color,
            amount: Math.ceil(data.total / 50) * 50, // round up to nearest 50
            count: data.count,
          });
        }
      }
    });

    return results.sort((a, b) => b.amount - a.amount).slice(0, 4);
  }, [transactions, budgets]);

  // Custom donut tooltip
  const DonutTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;
    const { name, value, payload: data } = payload[0];
    const pct = data.budget > 0 ? ((value / data.budget) * 100).toFixed(0) : '0';
    return (
      <div className="bdg-tooltip">
        <p className="bdg-tooltip-name">{name}</p>
        <p className="bdg-tooltip-value">{formatCurrency(value, currency)} de {formatCurrency(data.budget, currency)}</p>
        <p className="bdg-tooltip-pct">{pct}% usado</p>
      </div>
    );
  };

  if (budgets.length === 0) {
    return (
      <div className="budgets">
        <div className="section-header">
          <h2>💰 Presupuestos</h2>
          <button className="add-btn" onClick={onAddBudget}>
            <Plus size={20} /> Nuevo
          </button>
        </div>

        <div className="bdg-empty">
          <Wallet size={56} strokeWidth={1.2} />
          <h3>Define tus presupuestos</h3>
          <p>Controla cuanto gastas en cada categoria</p>
          <button className="add-btn" onClick={onAddBudget}>
            <Plus size={20} /> Crear presupuesto
          </button>
        </div>

        {suggestions.length > 0 && (
          <div className="bdg-suggestions">
            <div className="bdg-suggestions-header">
              <Lightbulb size={18} />
              <span>Sugerencias basadas en tus gastos</span>
            </div>
            {suggestions.map(s => (
              <div key={s.categoryId} className="bdg-suggestion-item">
                <span className="bdg-suggestion-icon" style={{ background: `${s.color}18` }}>{s.icon}</span>
                <div className="bdg-suggestion-info">
                  <span className="bdg-suggestion-name">{s.name}</span>
                  <span className="bdg-suggestion-detail">{s.count} gastos este mes ~ {formatCurrency(s.amount, currency)}</span>
                </div>
                <button className="bdg-suggestion-btn" onClick={() => onSuggestBudget?.(s.categoryId, s.amount)}>
                  Crear
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="budgets">
      <div className="section-header">
        <h2>💰 Presupuestos</h2>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select
            className="currency-select"
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
          >
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensual</option>
            <option value="yearly">Anual</option>
          </select>
          <button className="add-btn" onClick={onAddBudget}>
            <Plus size={20} /> Nuevo
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="bdg-kpi-row">
        <div className="bdg-kpi">
          <div className="bdg-kpi-icon bdg-kpi-icon--blue"><Wallet size={20} /></div>
          <div className="bdg-kpi-content">
            <span className="bdg-kpi-label">Presupuesto {periodLabels[period]}</span>
            <span className="bdg-kpi-value">{formatCurrency(totalBudget, currency)}</span>
          </div>
        </div>
        <div className="bdg-kpi">
          <div className={`bdg-kpi-icon ${overallPct > 100 ? 'bdg-kpi-icon--red' : overallPct > 80 ? 'bdg-kpi-icon--amber' : 'bdg-kpi-icon--green'}`}>
            <TrendingDown size={20} />
          </div>
          <div className="bdg-kpi-content">
            <span className="bdg-kpi-label">Gastado</span>
            <span className="bdg-kpi-value">{formatCurrency(totalSpent, currency)}</span>
            <span className={`bdg-kpi-badge ${overallPct > 100 ? 'bdg-kpi-badge--red' : overallPct > 80 ? 'bdg-kpi-badge--amber' : 'bdg-kpi-badge--green'}`}>
              {overallPct.toFixed(0)}%
            </span>
          </div>
        </div>
        <div className="bdg-kpi">
          <div className={`bdg-kpi-icon ${totalRemaining < 0 ? 'bdg-kpi-icon--red' : 'bdg-kpi-icon--green'}`}>
            <PiggyBank size={20} />
          </div>
          <div className="bdg-kpi-content">
            <span className="bdg-kpi-label">Restante</span>
            <span className="bdg-kpi-value" style={{ color: totalRemaining < 0 ? 'var(--danger)' : 'var(--success)' }}>
              {formatCurrency(Math.abs(totalRemaining), currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Main content: Donut + Budget list */}
      <div className="bdg-main">
        {/* Donut Chart */}
        {donutData.length > 0 && (
          <div className="bdg-donut-card">
            <h3 className="bdg-card-title">Distribución de gastos</h3>
            <div className="bdg-donut-wrapper">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="var(--bg-card)"
                    strokeWidth={2}
                  >
                    {donutData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="bdg-donut-center">
                <span className="bdg-donut-pct">{overallPct.toFixed(0)}%</span>
                <span className="bdg-donut-label">usado</span>
              </div>
            </div>
            {/* Legend */}
            <div className="bdg-donut-legend">
              {donutData.map((d, i) => (
                <div key={i} className="bdg-donut-legend-item">
                  <span className="bdg-donut-legend-dot" style={{ background: d.color }} />
                  <span>{d.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Budget Items */}
        <div className="bdg-list">
          {budgetsWithSpent.length === 0 ? (
            <div className="bdg-empty-period">
              <p>No hay presupuestos {period === 'monthly' ? 'mensuales' : period === 'weekly' ? 'semanales' : 'anuales'}</p>
            </div>
          ) : (
            budgetsWithSpent.map((budget) => {
              const category = getCategoryInfo(budget.categoryId);
              const pct = budget.amount > 0 ? (budget.spent / budget.amount) * 100 : 0;
              const isOver = pct > 100;
              const isWarning = pct > 80;
              const remaining = budget.amount - budget.spent;
              const catColor = category?.color || 'var(--accent-blue)';
              const barColor = isOver ? 'var(--danger)' : isWarning ? 'var(--warning)' : catColor;

              return (
                <div key={budget.id} className={`bdg-item ${isOver ? 'bdg-item--danger' : isWarning ? 'bdg-item--warning' : ''}`}>
                  <div className="bdg-item-header">
                    <div className="bdg-item-left">
                      <span className="bdg-item-icon" style={{ background: `${catColor}18`, color: catColor }}>
                        {category?.icon || '📊'}
                      </span>
                      <div>
                        <h4 className="bdg-item-name">{category?.name || budget.categoryId}</h4>
                        <p className="bdg-item-amounts">
                          {formatCurrency(budget.spent, budget.currency || 'PEN')}
                          <span className="bdg-item-sep"> / </span>
                          {formatCurrency(budget.amount, budget.currency || 'PEN')}
                        </p>
                      </div>
                    </div>
                    <div className="bdg-item-actions">
                      <button className="icon-btn" onClick={() => onEditBudget(budget)} title="Editar">
                        <Edit2 size={15} />
                      </button>
                      <button
                        className="icon-btn danger"
                        onClick={() => {
                          if (window.confirm(`¿Eliminar presupuesto de "${category?.name}"?`)) {
                            onDeleteBudget(budget.id);
                          }
                        }}
                        title="Eliminar"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="bdg-bar">
                    <div className="bdg-bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
                    <div className="bdg-bar-marker" style={{ left: '80%' }} />
                  </div>

                  <div className="bdg-item-footer">
                    <span className="bdg-item-pct" style={{ color: isOver ? 'var(--danger)' : isWarning ? 'var(--warning)' : 'var(--text-muted)' }}>
                      {pct.toFixed(0)}% usado
                    </span>
                    <span className="bdg-item-remaining" style={{ color: remaining < 0 ? 'var(--danger)' : 'var(--success)' }}>
                      {remaining < 0 ? 'Excedido ' : 'Restan '}{formatCurrency(Math.abs(remaining), budget.currency || 'PEN')}
                    </span>
                  </div>

                  {isWarning && !isOver && (
                    <div className="bdg-alert bdg-alert--warning">
                      <AlertTriangle size={14} />
                      <span>Mas del 80% usado</span>
                    </div>
                  )}
                  {isOver && (
                    <div className="bdg-alert bdg-alert--danger">
                      <AlertTriangle size={14} />
                      <span>Presupuesto excedido</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Smart suggestions */}
      {suggestions.length > 0 && (
        <div className="bdg-suggestions">
          <div className="bdg-suggestions-header">
            <Lightbulb size={18} />
            <span>Sugerencias basadas en tus gastos</span>
          </div>
          {suggestions.map(s => (
            <div key={s.categoryId} className="bdg-suggestion-item">
              <span className="bdg-suggestion-icon" style={{ background: `${s.color}18` }}>{s.icon}</span>
              <div className="bdg-suggestion-info">
                <span className="bdg-suggestion-name">{s.name}</span>
                <span className="bdg-suggestion-detail">{s.count} gastos este mes ~ {formatCurrency(s.amount, currency)}</span>
              </div>
              <button className="bdg-suggestion-btn" onClick={() => onSuggestBudget?.(s.categoryId, s.amount)}>
                Crear
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
