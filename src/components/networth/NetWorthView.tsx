import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Wallet, LineChart, CreditCard } from 'lucide-react';
import { Account, Investment } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { calculateNetWorth, investmentsByType, INVESTMENT_TYPE_LABEL } from '../../utils/netWorth';
import { InvestmentModal } from './InvestmentModal';

interface NetWorthViewProps {
  accounts: Account[];
  investments: Investment[];
  currency: string;
  onSaveInvestment: (inv: Investment) => void;
  onDeleteInvestment: (id: string) => void;
}

const card: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: 14,
  padding: '1.1rem',
};

export function NetWorthView({
  accounts,
  investments,
  currency,
  onSaveInvestment,
  onDeleteInvestment,
}: NetWorthViewProps) {
  const [editing, setEditing] = useState<Investment | null>(null);
  const [showModal, setShowModal] = useState(false);

  const nw = useMemo(() => calculateNetWorth(accounts, investments), [accounts, investments]);
  const byType = useMemo(() => investmentsByType(investments), [investments]);

  const openNew = () => { setEditing(null); setShowModal(true); };
  const openEdit = (inv: Investment) => { setEditing(inv); setShowModal(true); };

  const gainPositive = nw.investmentGain >= 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Cifra principal */}
      <div style={{ ...card, padding: '1.5rem' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
          Patrimonio neto
        </div>
        <div
          style={{
            fontSize: '2.2rem', fontWeight: 700, lineHeight: 1.1,
            fontVariantNumeric: 'tabular-nums',
            color: nw.netWorth >= 0 ? 'var(--text-primary)' : 'var(--rec-danger, #ef4444)',
          }}
        >
          {formatCurrency(nw.netWorth, currency)}
        </div>
        <div style={{ marginTop: '0.85rem', display: 'flex', flexWrap: 'wrap', gap: '1.25rem', fontSize: '0.82rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            Activos <strong style={{ color: 'var(--accent-green)' }}>{formatCurrency(nw.totalAssets, currency)}</strong>
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            Deudas <strong style={{ color: 'var(--rec-danger, #ef4444)' }}>{formatCurrency(nw.totalLiabilities, currency)}</strong>
          </span>
        </div>
      </div>

      {/* Tres columnas de resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            <Wallet size={14} /> Efectivo en cuentas
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 600, marginTop: '0.3rem', fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(nw.totalCash, currency)}
          </div>
        </div>

        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            <LineChart size={14} /> Inversiones
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 600, marginTop: '0.3rem', fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(nw.totalInvested, currency)}
          </div>
          {nw.investmentGainPct !== null && (
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.25rem',
                fontSize: '0.78rem',
                color: gainPositive ? 'var(--accent-green)' : 'var(--rec-danger, #ef4444)',
              }}
            >
              {gainPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {gainPositive ? '+' : ''}{formatCurrency(nw.investmentGain, currency)} ({nw.investmentGainPct.toFixed(1)}%)
            </div>
          )}
        </div>

        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            <CreditCard size={14} /> Deuda de tarjetas
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 600, marginTop: '0.3rem', fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(nw.totalLiabilities, currency)}
          </div>
        </div>
      </div>

      {/* Inversiones */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.9rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Inversiones</h3>
          <button className="btn-primary" onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Plus size={15} /> Agregar
          </button>
        </div>

        {investments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Todavia no registraste inversiones. Agregá acciones, cripto, bonos o inmuebles
            para que entren en tu patrimonio.
          </div>
        ) : (
          <>
            {byType.length > 1 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.9rem' }}>
                {byType.map(t => (
                  <span
                    key={t.type}
                    style={{
                      fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: 999,
                      background: 'var(--bg-hover, rgba(255,255,255,0.04))',
                      border: '1px solid var(--border-color)', color: 'var(--text-muted)',
                    }}
                  >
                    {t.label} · {formatCurrency(t.total, currency)}
                  </span>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {investments.map(inv => {
                const gain = inv.currentAmount - inv.initialAmount;
                const pct = inv.initialAmount > 0 ? (gain / inv.initialAmount) * 100 : null;
                const up = gain >= 0;
                return (
                  <div
                    key={inv.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.7rem 0.85rem', borderRadius: 10,
                      background: 'var(--bg-hover, rgba(255,255,255,0.02))',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {inv.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {INVESTMENT_TYPE_LABEL[inv.type]} · invertido {formatCurrency(inv.initialAmount, currency)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.92rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(inv.currentAmount, currency)}
                      </div>
                      {pct !== null && (
                        <div
                          style={{
                            fontSize: '0.74rem',
                            color: up ? 'var(--accent-green)' : 'var(--rec-danger, #ef4444)',
                          }}
                        >
                          {up ? '+' : ''}{pct.toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <button
                      className="icon-btn"
                      onClick={() => openEdit(inv)}
                      aria-label={`Editar ${inv.name}`}
                      style={{ minWidth: 32, minHeight: 32 }}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => onDeleteInvestment(inv.id)}
                      aria-label={`Eliminar ${inv.name}`}
                      style={{ minWidth: 32, minHeight: 32 }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Composicion */}
      <div style={card}>
        <h3 style={{ margin: '0 0 0.9rem', fontSize: '0.95rem', fontWeight: 600 }}>Composicion</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--accent-green)', marginBottom: '0.5rem' }}>Activos</div>
            {nw.assets.length === 0 ? (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Sin activos registrados.</div>
            ) : nw.assets.map(a => (
              <Row key={a.kind + a.id} label={a.label} amount={a.amount} currency={currency} />
            ))}
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--rec-danger, #ef4444)', marginBottom: '0.5rem' }}>Deudas</div>
            {nw.liabilities.length === 0 ? (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Sin deudas registradas.</div>
            ) : nw.liabilities.map(l => (
              <Row key={l.kind + l.id} label={l.label} amount={l.amount} currency={currency} />
            ))}
          </div>
        </div>
      </div>

      {showModal && (
        <InvestmentModal
          editing={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={inv => { onSaveInvestment(inv); setShowModal(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function Row({ label, amount, currency }: { label: string; amount: number; currency: string }) {
  return (
    <div
      style={{
        display: 'flex', justifyContent: 'space-between', gap: '1rem',
        padding: '0.35rem 0', fontSize: '0.85rem',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
        {formatCurrency(amount, currency)}
      </span>
    </div>
  );
}
