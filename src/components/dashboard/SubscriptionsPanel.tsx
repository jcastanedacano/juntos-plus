import { useState, useMemo } from 'react';
import { CreditCard, ChevronDown, ChevronUp, Check, EyeOff, Ban, List, AlertTriangle, Calendar, TrendingUp } from 'lucide-react';
import { Transaction, DetectedSubscription, RecurringTransaction } from '../../types';
import { detectSubscriptions, getSubscriptionStats } from '../../utils/subscriptionDetector';
import { formatCurrency, formatCurrencyCompact } from '../../utils/calculations';
import { addMonths, addWeeks, addYears } from 'date-fns';
import { parseDateOnly } from '../../utils/stableDate';

interface SubscriptionsPanelProps {
  transactions: Transaction[];
  recurring?: RecurringTransaction[];
  currency: string;
  selectedMonth?: Date;
}

function recurringToSubscription(r: RecurringTransaction): DetectedSubscription {
  const freqMap: Record<string, 'weekly' | 'monthly' | 'quarterly' | 'yearly'> = {
    daily: 'weekly', weekly: 'weekly', monthly: 'monthly', yearly: 'yearly',
  };
  const nextDate = () => {
    const base = new Date(r.nextDate);
    switch (r.frequency) {
      case 'weekly': return addWeeks(base, 1);
      case 'yearly': return addYears(base, 1);
      default: return addMonths(base, 1);
    }
  };
  return {
    id: `recurring-${r.id}`,
    merchantName: r.description,
    normalizedName: r.description,
    category: r.category,
    estimatedAmount: r.amount,
    frequency: freqMap[r.frequency] || 'monthly',
    confidence: 'high',
    confidenceScore: 100,
    lastChargeDate: r.nextDate,
    nextExpectedDate: nextDate().toISOString(),
    totalLast12Months: r.amount * (r.frequency === 'yearly' ? 1 : r.frequency === 'weekly' ? 52 : 12),
    chargeCount: 0,
    transactionIds: [],
    alerts: [],
    isConfirmed: true,
    isDismissed: !r.isActive,
  };
}

type SubStatus = 'all' | 'active' | 'dismissed';

const freqLabel: Record<string, string> = {
  weekly: 'Semanal',
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  yearly: 'Anual',
};

function monthlyEquivalent(sub: DetectedSubscription): number {
  switch (sub.frequency) {
    case 'weekly': return sub.estimatedAmount * 4.33;
    case 'monthly': return sub.estimatedAmount;
    case 'quarterly': return sub.estimatedAmount / 3;
    case 'yearly': return sub.estimatedAmount / 12;
  }
}

export function SubscriptionsPanel({ transactions, recurring = [], currency, selectedMonth }: SubscriptionsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [filter, setFilter] = useState<SubStatus>('all');
  const [localDismissed, setLocalDismissed] = useState<Set<string>>(new Set());
  const [localConfirmed, setLocalConfirmed] = useState<Set<string>>(new Set());
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [showTransactions, setShowTransactions] = useState<string | null>(null);

  const detected = useMemo(() => {
    const autoDetected = detectSubscriptions(transactions);
    const fromRecurring = recurring
      .filter(r => r.type === 'expense')
      .map(recurringToSubscription);
    // Merge: recurring first, then auto-detected (avoid duplicates by name)
    const names = new Set(fromRecurring.map(s => s.normalizedName.toLowerCase()));
    const uniqueAuto = autoDetected.filter(s => !names.has(s.normalizedName.toLowerCase()));
    return [...fromRecurring, ...uniqueAuto];
  }, [transactions, recurring]);

  // Apply local state overrides
  const subs = useMemo(() => detected.map(s => ({
    ...s,
    isDismissed: localDismissed.has(s.id) ? true : s.isDismissed,
    isConfirmed: localConfirmed.has(s.id) ? true : s.isConfirmed,
  })), [detected, localDismissed, localConfirmed]);

  const filtered = useMemo(() => {
    switch (filter) {
      case 'active': return subs.filter(s => !s.isDismissed);
      case 'dismissed': return subs.filter(s => s.isDismissed);
      default: return subs;
    }
  }, [subs, filter]);

  // Sort: confirmed first, then by monthly equivalent descending
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (a.isConfirmed !== b.isConfirmed) return a.isConfirmed ? -1 : 1;
    return monthlyEquivalent(b) - monthlyEquivalent(a);
  }), [filtered]);

  const stats = useMemo(() => getSubscriptionStats(subs), [subs]);

  const handleConfirm = (id: string) => {
    setLocalConfirmed(prev => new Set(prev).add(id));
    setLocalDismissed(prev => { const n = new Set(prev); n.delete(id); return n; });
  };
  const handleDismiss = (id: string) => {
    setLocalDismissed(prev => new Set(prev).add(id));
    setLocalConfirmed(prev => { const n = new Set(prev); n.delete(id); return n; });
  };
  const handleSilence = (id: string) => {
    setLocalDismissed(prev => new Set(prev).add(id));
  };

  const getConfidenceBadge = (sub: DetectedSubscription) => {
    const colors = {
      high: { bg: 'rgba(0,209,178,0.12)', text: '#00D1B2' },
      medium: { bg: 'rgba(245,158,11,0.12)', text: '#F59E0B' },
      low: { bg: 'rgba(107,114,128,0.12)', text: '#6B7280' },
    };
    const c = colors[sub.confidence];
    return (
      <span style={{
        fontSize: 'var(--fs-micro)', fontWeight: 600, padding: '2px 6px',
        borderRadius: '4px', background: c.bg, color: c.text,
      }}>
        {sub.confidenceScore}%
      </span>
    );
  };

  // Get transactions for a subscription
  const getSubTransactions = (sub: DetectedSubscription) => {
    return transactions.filter(t => sub.transactionIds.includes(t.id))
      .sort((a, b) => parseDateOnly(b.date).getTime() - parseDateOnly(a.date).getTime());
  };

  return (
    <div className="subs-panel">
      {/* Header */}
      <button className="subs-panel-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: 32, height: 32, borderRadius: '8px',
            background: 'rgba(168,85,247,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CreditCard size={16} style={{ color: '#A855F7' }} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
              Suscripciones y Recurrentes
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {stats.count} activas &bull; {formatCurrencyCompact(stats.monthlyTotal, currency)}/mes
            </div>
          </div>
        </div>
        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {isExpanded && (
        <div className="subs-panel-body">
          {/* KPI Strip */}
          <div className="subs-kpi-strip">
            <div className="subs-kpi">
              <span className="subs-kpi-value">{stats.count}</span>
              <span className="subs-kpi-label">Activas</span>
            </div>
            <div className="subs-kpi">
              <span className="subs-kpi-value">{formatCurrencyCompact(stats.monthlyTotal, currency)}</span>
              <span className="subs-kpi-label">Mensual</span>
            </div>
            <div className="subs-kpi">
              <span className="subs-kpi-value">{formatCurrencyCompact(stats.annualTotal, currency)}</span>
              <span className="subs-kpi-label">Anual est.</span>
            </div>
            {stats.withAlerts > 0 && (
              <div className="subs-kpi subs-kpi-alert">
                <span className="subs-kpi-value">{stats.withAlerts}</span>
                <span className="subs-kpi-label">Alertas</span>
              </div>
            )}
          </div>

          {/* Filter tabs */}
          <div className="subs-filter-tabs">
            {(['all', 'active', 'dismissed'] as SubStatus[]).map(f => (
              <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
                {f === 'all' ? 'Todas' : f === 'active' ? 'Activas' : 'Descartadas'}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="subs-list">
            {sorted.map(sub => (
              <div key={sub.id} className={`subs-item ${sub.isDismissed ? 'dismissed' : ''} ${sub.isConfirmed ? 'confirmed' : ''}`}>
                <div className="subs-item-main" onClick={() => setSelectedSub(selectedSub === sub.id ? null : sub.id)}>
                  <div className="subs-item-left">
                    <div className="subs-item-name">
                      {sub.normalizedName}
                      {sub.isConfirmed && <Check size={12} style={{ color: 'var(--success)', marginLeft: 4 }} />}
                    </div>
                    <div className="subs-item-meta">
                      <span className="subs-freq-badge">{freqLabel[sub.frequency]}</span>
                      {getConfidenceBadge(sub)}
                      {sub.alerts.length > 0 && (
                        <AlertTriangle size={12} style={{ color: 'var(--warning)' }} />
                      )}
                    </div>
                  </div>
                  <div className="subs-item-right">
                    <div className="subs-item-amount">{formatCurrency(sub.estimatedAmount, currency)}</div>
                    <div className="subs-item-monthly">
                      {sub.frequency !== 'monthly' && (
                        <span style={{ fontSize: 'var(--fs-micro)', color: 'var(--text-muted)' }}>
                          ~{formatCurrencyCompact(monthlyEquivalent(sub), currency)}/mes
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded detail */}
                {selectedSub === sub.id && (
                  <div className="subs-item-detail">
                    <div className="subs-detail-grid">
                      <div className="subs-detail-item">
                        <Calendar size={12} />
                        <span>Último cobro: {new Date(sub.lastChargeDate).toLocaleDateString('es-PE')}</span>
                      </div>
                      <div className="subs-detail-item">
                        <Calendar size={12} />
                        <span>Próximo est.: {new Date(sub.nextExpectedDate).toLocaleDateString('es-PE')}</span>
                      </div>
                      <div className="subs-detail-item">
                        <TrendingUp size={12} />
                        <span>Últimos 12m: {formatCurrencyCompact(sub.totalLast12Months, currency)}</span>
                      </div>
                      <div className="subs-detail-item">
                        <List size={12} />
                        <span>{sub.chargeCount} cobros registrados</span>
                      </div>
                    </div>

                    {/* Alerts */}
                    {sub.alerts.length > 0 && (
                      <div className="subs-alerts">
                        {sub.alerts.map((alert, i) => (
                          <div key={i} className={`subs-alert subs-alert-${alert.severity}`}>
                            <AlertTriangle size={12} />
                            <span>{alert.message}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="subs-actions">
                      {!sub.isConfirmed && !sub.isDismissed && (
                        <button className="subs-action-btn confirm" onClick={() => handleConfirm(sub.id)}>
                          <Check size={12} /> Confirmar
                        </button>
                      )}
                      {!sub.isDismissed && (
                        <>
                          <button className="subs-action-btn dismiss" onClick={() => handleDismiss(sub.id)}>
                            <Ban size={12} /> No es suscripción
                          </button>
                          <button className="subs-action-btn silence" onClick={() => handleSilence(sub.id)}>
                            <EyeOff size={12} /> Silenciar
                          </button>
                        </>
                      )}
                      <button className="subs-action-btn view" onClick={() => setShowTransactions(showTransactions === sub.id ? null : sub.id)}>
                        <List size={12} /> Ver transacciones
                      </button>
                    </div>

                    {/* Transaction list */}
                    {showTransactions === sub.id && (
                      <div className="subs-tx-list">
                        {getSubTransactions(sub).slice(0, 10).map(tx => (
                          <div key={tx.id} className="subs-tx-row">
                            <span className="subs-tx-date">{parseDateOnly(tx.date).toLocaleDateString('es-PE')}</span>
                            <span className="subs-tx-desc">{tx.description}</span>
                            <span className="subs-tx-amount">{formatCurrency(tx.amount, currency)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {sorted.length === 0 && (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                {filter === 'dismissed' ? 'No hay suscripciones descartadas' : 'No se detectaron suscripciones'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
