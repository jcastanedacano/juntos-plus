import { useState, useRef, useEffect } from 'react';
import { Plus, CreditCard, Edit2, Trash2, Check, X, Zap } from 'lucide-react';
import { Account, CurrencyType } from '../types';
import { formatCurrency } from '../utils/calculations';

interface WalletSectionProps {
  accounts: Account[];
  currency?: CurrencyType;
  onAddAccount?: () => void;
  onEditAccount?: (account: Account) => void;
  onDeleteAccount?: (id: string) => void;
  /** Quick inline balance adjustment — sets account.balance + timestamp. */
  onAdjustBalance?: (accountId: string, newBalance: number) => void;
  /** Open the express reconciliation modal (multi-account at once). */
  onQuickReconcile?: () => void;
}

const timeAgo = (iso?: string): string | null => {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return null;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'recién';
  if (mins < 60) return `hace ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days}d`;
  return null;
};

const getDaysUntil = (day: number | undefined): number | null => {
  if (!day) return null;
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), day);
  if (target <= now) target.setMonth(target.getMonth() + 1);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

const initial = (acct: Account): string => {
  const source = acct.bank || acct.name;
  return source.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || '?';
};

const iconStyle = (color: string): React.CSSProperties => ({
  background: `${color}26`,    // ~15% alpha
  color,
});

const buildMeta = (acct: Account): string => {
  const parts: string[] = [];
  if (acct.type === 'credit') {
    const closeDays = getDaysUntil(acct.statementCloseDay);
    const payDays = getDaysUntil(acct.paymentDueDay);
    if (closeDays !== null) parts.push(`Cierra en ${closeDays}d`);
    if (payDays !== null) parts.push(`Paga en ${payDays}d`);
  } else {
    if (acct.bank) parts.push(acct.bank);
  }
  if (acct.lastFourDigits) parts.push(`••${acct.lastFourDigits}`);
  return parts.join(' · ') || (acct.type === 'credit' ? 'Tarjeta de crédito' : 'Cuenta');
};

export function WalletSection({
  accounts,
  currency = 'PEN',
  onAddAccount,
  onEditAccount,
  onDeleteAccount,
  onAdjustBalance,
  onQuickReconcile,
}: WalletSectionProps) {
  // Inline balance editor state — which account is being edited and the
  // draft value the user is typing.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const startEdit = (acct: Account) => {
    setEditingId(acct.id);
    setDraft(String(acct.balance));
  };

  const commitEdit = () => {
    if (!editingId) return;
    const next = parseFloat(draft.replace(/,/g, ''));
    if (Number.isFinite(next) && onAdjustBalance) {
      onAdjustBalance(editingId, next);
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };
  const debit = accounts.filter(a => a.type !== 'credit');
  const credit = accounts.filter(a => a.type === 'credit');
  const totalDebit = debit.reduce((s, a) => s + a.balance, 0);
  const totalCreditUsed = credit.reduce((s, a) => s + a.balance, 0);
  const netWorth = totalDebit - totalCreditUsed;
  const total = accounts.length;

  // The server seeds a single placeholder "Cuenta Principal" (id: 'default',
  // balance 0) on first run so the app never renders against an undefined
  // accounts array. Left untouched, it looks exactly like a sync failure —
  // "1 cuenta · S/ 0.00 neto" reads as a bug, not as "you haven't set up
  // your real accounts yet." Treat it as the empty state too.
  const isUnconfiguredSeed = accounts.length === 1
    && accounts[0].id === 'default'
    && accounts[0].balance === 0
    && !accounts[0].bank
    && !accounts[0].lastFourDigits;

  if (accounts.length === 0 || isUnconfiguredSeed) {
    return (
      <div className="dr-card">
        <div className="dr-card-head">
          <div>
            <div className="dr-card-title">Cuentas</div>
            <div className="dr-card-sub">Agrega tus cuentas para ver saldos</div>
          </div>
          {onAddAccount && (
            <button className="dr-card-action" onClick={onAddAccount}>
              <Plus size={14} /> Agregar
            </button>
          )}
        </div>
        <div className="acc-empty">
          <CreditCard size={28} strokeWidth={1.2} />
          <p>
            {isUnconfiguredSeed
              ? 'Todavía no configuraste tus cuentas reales. Agrega tu débito y tu tarjeta de crédito para ver saldos exactos aquí.'
              : 'Agrega tus cuentas de débito y crédito para ver tus saldos aquí'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="dr-card">
      <div className="dr-card-head">
        <div>
          <div className="dr-card-title">Cuentas</div>
          <div className="dr-card-sub">
            {total} {total === 1 ? 'cuenta' : 'cuentas'} · {formatCurrency(netWorth, currency)} neto
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className={`acc-net-pill ${netWorth >= 0 ? 'pos' : 'neg'}`}>
            Patrimonio
            <span className="acc-net-value">{formatCurrency(netWorth, currency)}</span>
          </span>
          {onQuickReconcile && (
            <button
              className="acc-reconcile-btn"
              onClick={onQuickReconcile}
              title="Reconciliar saldos con tu app BCP en un solo paso"
            >
              <Zap size={13} />
              <span>Reconciliar</span>
            </button>
          )}
          {onAddAccount && (
            <button className="dr-card-action" onClick={onAddAccount} title="Agregar cuenta">
              <Plus size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="acc-list">
        {[...debit, ...credit].map(acct => {
          const isCredit = acct.type === 'credit';
          const displayAmount = isCredit ? -acct.balance : acct.balance;
          const isEditing = editingId === acct.id;
          const ago = timeAgo(acct.balanceUpdatedAt);
          return (
            <div
              key={acct.id}
              className="acc-row"
            >
              <div className="acc-icon" style={iconStyle(acct.color || '#6C8EEF')}>
                {initial(acct)}
              </div>
              <div>
                <div className="acc-name">{acct.name}</div>
                <div className="acc-meta">
                  {buildMeta(acct)}
                  {ago && <span className="acc-meta-sync"> · saldo {ago}</span>}
                </div>
              </div>
              {isEditing ? (
                <div className="acc-amt-edit" onClick={(e) => e.stopPropagation()}>
                  <input
                    ref={inputRef}
                    inputMode="decimal"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit();
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    onBlur={commitEdit}
                  />
                  <button
                    className="acc-amt-edit-ok"
                    onClick={(e) => { e.stopPropagation(); commitEdit(); }}
                    title="Guardar"
                  >
                    <Check size={13} />
                  </button>
                  <button
                    className="acc-amt-edit-cancel"
                    onMouseDown={(e) => { e.preventDefault(); cancelEdit(); }}
                    title="Cancelar"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <div
                  className={`acc-amt ${isCredit && acct.balance > 0 ? 'neg' : ''} ${onAdjustBalance ? 'acc-amt-clickable' : ''}`}
                  onClick={(e) => {
                    if (!onAdjustBalance) return;
                    e.stopPropagation();
                    startEdit(acct);
                  }}
                  title={onAdjustBalance ? 'Clic para ajustar saldo' : undefined}
                >
                  {isCredit && acct.balance > 0 ? '−' : ''}
                  {formatCurrency(Math.abs(displayAmount), currency)}
                </div>
              )}
              <div className="acc-actions">
                {onEditAccount && (
                  <button
                    className="acc-action-btn"
                    onClick={(e) => { e.stopPropagation(); onEditAccount(acct); }}
                    title="Editar"
                  >
                    <Edit2 size={13} />
                  </button>
                )}
                {onDeleteAccount && (
                  <button
                    className="acc-action-btn danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`¿Eliminar "${acct.name}"?`)) onDeleteAccount(acct.id);
                    }}
                    title="Eliminar"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
