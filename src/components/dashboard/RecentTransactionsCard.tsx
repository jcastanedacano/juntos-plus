import { Transaction, Account } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { getCategoryById } from '../../utils/categoryHelpers';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseDateOnly } from '../../utils/stableDate';

interface RecentTransactionsCardProps {
  transactions: Transaction[];
  accounts: Account[];
  currency: string;
  limit?: number;
  onSeeAll?: () => void;
}

const formatDate = (iso: string): string => {
  try {
    return format(new Date(iso), 'd MMM', { locale: es });
  } catch {
    return iso;
  }
};

export function RecentTransactionsCard({
  transactions,
  accounts,
  currency,
  limit = 6,
  onSeeAll,
}: RecentTransactionsCardProps) {
  const recent = [...transactions]
    .sort((a, b) => parseDateOnly(b.date).getTime() - parseDateOnly(a.date).getTime())
    .slice(0, limit);

  const accountMap = new Map(accounts.map(a => [a.id, a]));

  return (
    <div className="dr-card">
      <div className="dr-card-head">
        <div>
          <div className="dr-card-title">Movimientos recientes</div>
          <div className="dr-card-sub">
            Últimas {recent.length} {recent.length === 1 ? 'transacción' : 'transacciones'}
          </div>
        </div>
        {onSeeAll && (
          <button className="dr-section-more" onClick={onSeeAll}>
            Ver todas →
          </button>
        )}
      </div>

      {recent.length === 0 ? (
        <div className="tx-empty">No hay transacciones</div>
      ) : (
        <div className="tx-list">
          {recent.map(tx => {
            const cat = getCategoryById(tx.category);
            const acct = accountMap.get(tx.accountId);
            const sign = tx.type === 'income' ? '+' : '−';
            const tone = tx.type === 'income' ? 'income' : 'expense';
            return (
              <div key={tx.id} className="tx-row">
                <div
                  className="tx-icon"
                  style={{
                    background: `${cat?.color || '#6B7280'}26`,
                    color: cat?.color || '#9CA3AF',
                  }}
                >
                  {cat?.icon || '📦'}
                </div>
                <div className="tx-info">
                  <div className="tx-title">{tx.description || cat?.name || tx.category}</div>
                  <div className="tx-sub">
                    {cat?.name || tx.category} · {formatDate(tx.date)}
                  </div>
                </div>
                <div className="tx-account">{acct?.name || '—'}</div>
                <div className={`tx-amt ${tone}`}>
                  {sign}{formatCurrency(tx.amount, currency)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
