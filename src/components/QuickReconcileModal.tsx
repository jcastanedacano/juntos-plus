import { useState, useMemo } from 'react';
import { X, Check, Zap } from 'lucide-react';
import { Account } from '../types';
import { formatCurrency } from '../utils/calculations';

export interface ReconcileRow {
  accountId: string;
  realBalance: number;       // what BCP shows
  diff: number;              // realBalance − account.balance (signed)
  historical: boolean;       // backdate to last month if true
}

interface QuickReconcileModalProps {
  accounts: Account[];
  onClose: () => void;
  /** Called with the parsed rows that have a non-zero diff. */
  onApply: (rows: ReconcileRow[]) => void;
}

// Smart decimal parser — same logic as the credit editor, accepts Spanish
// (229,62) and English (229.62) conventions.
const parseSmart = (v: string): number | undefined => {
  if (!v) return undefined;
  const t = v.trim();
  if (!t) return undefined;
  const hasDot = t.includes('.');
  const hasComma = t.includes(',');
  let cleaned: string;
  if (hasDot && hasComma) {
    const lastDot = t.lastIndexOf('.');
    const lastComma = t.lastIndexOf(',');
    cleaned = lastComma > lastDot
      ? t.replace(/\./g, '').replace(',', '.')
      : t.replace(/,/g, '');
  } else if (hasComma) {
    const parts = t.split(',');
    cleaned = (parts.length === 2 && parts[1].length <= 2)
      ? t.replace(',', '.')
      : t.replace(/,/g, '');
  } else {
    cleaned = t;
  }
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : undefined;
};

export function QuickReconcileModal({ accounts, onClose, onApply }: QuickReconcileModalProps) {
  // Only debit accounts can be reconciled via this flow — credit accounts
  // belong to the "Editar datos del ciclo" form because the model is different.
  const debit = useMemo(() => accounts.filter(a => a.type !== 'credit'), [accounts]);

  // String inputs so the user can leave fields empty.
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    debit.forEach(a => { map[a.id] = ''; });
    return map;
  });
  const [historicals, setHistoricals] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    debit.forEach(a => { map[a.id] = true; }); // default histórico para no inflar mes
    return map;
  });

  const rows = useMemo(() => {
    const out: ReconcileRow[] = [];
    for (const a of debit) {
      const real = parseSmart(drafts[a.id]);
      if (real === undefined) continue;
      const diff = real - a.balance;
      if (Math.abs(diff) < 0.005) continue;
      out.push({ accountId: a.id, realBalance: real, diff, historical: historicals[a.id] });
    }
    return out;
  }, [debit, drafts, historicals]);

  const handleApply = () => {
    if (rows.length === 0) {
      onClose();
      return;
    }
    onApply(rows);
  };

  if (debit.length === 0) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal modal-narrow" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2><Zap size={18} style={{ marginRight: 6, verticalAlign: -3 }} />Reconciliación express</h2>
            <button className="modal-close" onClick={onClose}><X size={20} /></button>
          </div>
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
            No tenés cuentas de débito configuradas todavía.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-narrow" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <Zap size={18} style={{ marginRight: 6, verticalAlign: -3 }} />
            Reconciliación express
          </h2>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="reconcile-body">
          <p className="reconcile-intro">
            Pegá el <strong>saldo real</strong> de cada cuenta tal como lo muestra tu app BCP.
            La diferencia con el saldo guardado se registra como una transacción de ajuste
            (categoría <em>Otros gastos</em> / <em>Otros ingresos</em>).
          </p>

          <div className="reconcile-list">
            {debit.map(acct => {
              const real = parseSmart(drafts[acct.id]);
              const diff = real !== undefined ? real - acct.balance : 0;
              const significant = Math.abs(diff) >= 0.005;
              const isExpense = diff < 0;
              return (
                <div key={acct.id} className="reconcile-row">
                  <div className="reconcile-row-head">
                    <div>
                      <div className="reconcile-row-name">{acct.name}</div>
                      <div className="reconcile-row-meta">
                        Guardado: {formatCurrency(acct.balance, 'PEN')}
                        {acct.lastFourDigits && ` · ••${acct.lastFourDigits}`}
                      </div>
                    </div>
                    <input
                      inputMode="decimal"
                      placeholder="Saldo real"
                      value={drafts[acct.id]}
                      onChange={(e) => setDrafts(d => ({ ...d, [acct.id]: e.target.value }))}
                      className="reconcile-input"
                    />
                  </div>

                  {significant && (
                    <div className="reconcile-row-diff">
                      <span>
                        Diferencia:{' '}
                        <strong style={{ color: isExpense ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                          {isExpense ? '−' : '+'}{formatCurrency(Math.abs(diff), 'PEN')}
                        </strong>
                        {' '}({isExpense ? 'gasto no capturado' : 'ingreso no capturado'})
                      </span>
                      <div className="reconcile-row-toggle">
                        <label className={!historicals[acct.id] ? 'active' : ''}>
                          <input
                            type="radio"
                            name={`when-${acct.id}`}
                            checked={!historicals[acct.id]}
                            onChange={() => setHistoricals(h => ({ ...h, [acct.id]: false }))}
                          />
                          <span>Gasto de hoy</span>
                        </label>
                        <label className={historicals[acct.id] ? 'active' : ''}>
                          <input
                            type="radio"
                            name={`when-${acct.id}`}
                            checked={historicals[acct.id]}
                            onChange={() => setHistoricals(h => ({ ...h, [acct.id]: true }))}
                          />
                          <span>Histórico (mes anterior)</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {rows.length > 0 && (
            <div className="reconcile-summary">
              <strong>{rows.length}</strong> cuenta{rows.length === 1 ? '' : 's'} a reconciliar.
              Se crearán <strong>{rows.length}</strong> transacciones de ajuste.
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleApply} disabled={rows.length === 0}>
            <Check size={14} />
            Aplicar reconciliación
          </button>
        </div>
      </div>
    </div>
  );
}
