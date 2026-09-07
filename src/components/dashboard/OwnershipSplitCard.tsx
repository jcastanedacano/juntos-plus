import { useMemo } from 'react';
import { Transaction } from '../../types';
import { calculateOwnershipSplit } from '../../utils/ownership';
import { useOwnerLabels } from '../../utils/ownerLabels';
import { formatCurrency } from '../../utils/calculations';
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { parseDateOnly } from '../../utils/stableDate';

interface OwnershipSplitCardProps {
  transactions: Transaction[];
  currency: string;
  selectedMonth?: Date;
}

export function OwnershipSplitCard({ transactions, currency, selectedMonth }: OwnershipSplitCardProps) {
  const ownerLabels = useOwnerLabels();
  const monthTx = useMemo(() => {
    const ref = selectedMonth || new Date();
    const start = startOfMonth(ref);
    const end = endOfMonth(ref);
    return transactions.filter(t => {
      const d = parseDateOnly(t.date);
      return !isNaN(d.getTime()) && isWithinInterval(d, { start, end });
    });
  }, [transactions, selectedMonth]);

  const split = useMemo(() => calculateOwnershipSplit(monthTx), [monthTx]);
  const total = split.totalExpense || 1;
  const fmt = (n: number) => formatCurrency(n, currency);

  const sharedPct  = (split.shared.expense / total) * 100;
  const mePct      = (split.me.expense / total) * 100;
  const partnerPct = (split.partner.expense / total) * 100;

  const hasAny =
    split.shared.expense > 0 ||
    split.me.expense > 0 ||
    split.partner.expense > 0;

  return (
    <div className="dr-card">
      <div className="dr-card-head">
        <div>
          <div className="dr-card-title">Compartido vs individual</div>
          <div className="dr-card-sub">¿Quién pagó qué este mes?</div>
        </div>
      </div>
      {!hasAny ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          Sin gastos registrados este mes.
        </div>
      ) : (
        <div className="split-card">
          <div className="split-bar" aria-hidden="true">
            <span className="seg-shared"  style={{ width: `${sharedPct}%` }} />
            <span className="seg-me"      style={{ width: `${mePct}%` }} />
            <span className="seg-partner" style={{ width: `${partnerPct}%` }} />
          </div>
          <div className="split-rows">
            <div className="split-row">
              <span className="split-row-label">
                <span className="owner-badge owner-shared">{ownerLabels.shared.charAt(0).toUpperCase()}</span>
                {ownerLabels.shared}
              </span>
              <span className="split-row-meta">
                {sharedPct.toFixed(0)}% · {split.shared.count} cargos
              </span>
              <span className="split-row-amt">{fmt(split.shared.expense)}</span>
            </div>
            <div className="split-row">
              <span className="split-row-label">
                <span className="owner-badge owner-me">{ownerLabels.me.charAt(0).toUpperCase()}</span>
                {ownerLabels.me}
              </span>
              <span className="split-row-meta">
                {mePct.toFixed(0)}% · {split.me.count} cargos
              </span>
              <span className="split-row-amt">{fmt(split.me.expense)}</span>
            </div>
            <div className="split-row">
              <span className="split-row-label">
                <span className="owner-badge owner-partner">{ownerLabels.partner.charAt(0).toUpperCase()}</span>
                {ownerLabels.partner}
              </span>
              <span className="split-row-meta">
                {partnerPct.toFixed(0)}% · {split.partner.count} cargos
              </span>
              <span className="split-row-amt">{fmt(split.partner.expense)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
