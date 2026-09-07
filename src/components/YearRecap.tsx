import { useMemo, useState, useRef } from 'react';
import { Printer } from 'lucide-react';
import { Transaction, SavingsGoal, Owner } from '../types';
import { calculateYearRecap, getAvailableYears } from '../utils/yearRecap';
import { formatCurrency } from '../utils/calculations';
import { useOwnerLabels } from '../utils/ownerLabels';
import { useFxRates, projectToBase } from '../utils/fx';
import { parseDateOnly } from '../utils/stableDate';

interface YearRecapProps {
  transactions: Transaction[];
  goals: SavingsGoal[];
  currency: string;
}

const formatPct = (n: number, digits = 1) => `${n.toFixed(digits)}%`;
const monthDate = (year: number, m: number) =>
  new Date(year, m, 1).toLocaleDateString('es-PE', { month: 'long' });

export function YearRecap({ transactions, goals, currency }: YearRecapProps) {
  const ownerLabels = useOwnerLabels();
  const fxRates = useFxRates();
  // Project every transaction into PEN equivalent so USD/EUR rows are
  // counted at the user's configured FX rate.
  const txnsBase = useMemo(() => projectToBase(transactions, fxRates), [transactions, fxRates]);
  const availableYears = useMemo(() => getAvailableYears(txnsBase), [txnsBase]);
  const defaultYear = availableYears[0] || new Date().getFullYear();
  const [year, setYear] = useState<number>(defaultYear);
  const pageRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    document.body.classList.add('printing-recap');
    // Give the browser a tick to apply the class before opening the dialog.
    requestAnimationFrame(() => {
      window.print();
      // Cleanup after the dialog closes (covers both print and cancel).
      setTimeout(() => document.body.classList.remove('printing-recap'), 600);
    });
  };

  const recap = useMemo(
    () => calculateYearRecap(txnsBase, goals, year),
    [txnsBase, goals, year]
  );

  const fmt = (n: number) => formatCurrency(n, currency);

  // Comparison deltas vs previous year
  const incDelta = recap.prev && recap.prev.totalIncome > 0
    ? ((recap.totalIncome - recap.prev.totalIncome) / recap.prev.totalIncome) * 100
    : null;
  const expDelta = recap.prev && recap.prev.totalExpense > 0
    ? ((recap.totalExpense - recap.prev.totalExpense) / recap.prev.totalExpense) * 100
    : null;
  const savingsDelta = recap.prev
    ? recap.savingsRate - recap.prev.savingsRate
    : null;

  // Maximum month value for chart scaling
  const maxMonth = Math.max(
    ...recap.byMonth.map(m => Math.max(m.income, m.expense)),
    1
  );

  return (
    <div className="recap-page" ref={pageRef}>
      <div className="recap-head">
        <div>
          <h1 className="recap-title">Recap {recap.year}</h1>
          <p className="recap-subtitle">
            Resumen anual · {recap.txCount} {recap.txCount === 1 ? 'transacción' : 'transacciones'} · USD a TC {fxRates.USD.toFixed(2)}
          </p>
        </div>
        <div className="recap-head-actions">
          <div className="recap-year-selector" role="tablist">
            {availableYears.map(y => (
              <button
                key={y}
                role="tab"
                aria-selected={y === year}
                className={`recap-year-btn ${y === year ? 'active' : ''}`}
                onClick={() => setYear(y)}
              >
                {y}
              </button>
            ))}
          </div>
          <button
            className="recap-print-btn"
            onClick={handlePrint}
            title="Imprimir o guardar como PDF para tu PowerPoint Night"
            type="button"
          >
            <Printer size={14} />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>

      {/* ─── KPI hero strip ─────────────────────────────────────────── */}
      <div className="recap-kpis">
        <div className="recap-kpi income">
          <div className="recap-kpi-label">Ingresos</div>
          <div className="recap-kpi-value">{fmt(recap.totalIncome)}</div>
          {incDelta !== null && (
            <div className={`recap-kpi-delta ${incDelta >= 0 ? 'up' : 'down'}`}>
              {incDelta >= 0 ? '▲' : '▼'} {Math.abs(incDelta).toFixed(1)}% vs {recap.prev!.year}
            </div>
          )}
        </div>
        <div className="recap-kpi expense">
          <div className="recap-kpi-label">Gastos</div>
          <div className="recap-kpi-value">{fmt(recap.totalExpense)}</div>
          {expDelta !== null && (
            <div className={`recap-kpi-delta ${expDelta <= 0 ? 'up' : 'down'}`}>
              {expDelta >= 0 ? '▲' : '▼'} {Math.abs(expDelta).toFixed(1)}% vs {recap.prev!.year}
            </div>
          )}
        </div>
        <div className="recap-kpi net">
          <div className="recap-kpi-label">Neto</div>
          <div className={`recap-kpi-value ${recap.net >= 0 ? 'pos' : 'neg'}`}>
            {recap.net >= 0 ? '+' : '−'}{fmt(Math.abs(recap.net))}
          </div>
          <div className="recap-kpi-delta flat">
            Tasa de ahorro {formatPct(recap.savingsRate)}
          </div>
        </div>
        <div className="recap-kpi savings">
          <div className="recap-kpi-label">Tasa de ahorro</div>
          <div className="recap-kpi-value">{formatPct(recap.savingsRate)}</div>
          {savingsDelta !== null && (
            <div className={`recap-kpi-delta ${savingsDelta >= 0 ? 'up' : 'down'}`}>
              {savingsDelta >= 0 ? '▲' : '▼'} {Math.abs(savingsDelta).toFixed(1)} pts vs {recap.prev!.year}
            </div>
          )}
        </div>
      </div>

      {recap.txCount === 0 && (
        <div className="recap-empty">
          Sin transacciones registradas para {recap.year}.
        </div>
      )}

      {recap.txCount > 0 && (
        <>
          {/* ─── Mes a mes (sparkline-style bars) ────────────────────── */}
          <div className="dr-card">
            <div className="dr-card-head">
              <div>
                <div className="dr-card-title">Ingresos vs gastos · mes a mes</div>
                <div className="dr-card-sub">
                  Mejor mes:{' '}
                  {recap.bestMonth ? (
                    <strong>{monthDate(recap.year, recap.bestMonth.month)} ({fmt(recap.bestMonth.net)} neto)</strong>
                  ) : '—'}
                  {' · '}
                  Peor:{' '}
                  {recap.worstMonth ? (
                    <strong>{monthDate(recap.year, recap.worstMonth.month)} ({fmt(recap.worstMonth.net)} neto)</strong>
                  ) : '—'}
                </div>
              </div>
            </div>
            <div className="recap-chart">
              {recap.byMonth.map(m => {
                const incH = (m.income / maxMonth) * 100;
                const expH = (m.expense / maxMonth) * 100;
                return (
                  <div key={m.month} className="recap-chart-col" title={`${m.label}: +${fmt(m.income)} / −${fmt(m.expense)}`}>
                    <div className="recap-chart-stack">
                      <span className="recap-chart-bar income" style={{ height: `${incH}%` }} />
                      <span className="recap-chart-bar expense" style={{ height: `${expH}%` }} />
                    </div>
                    <span className="recap-chart-label">{m.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="recap-chart-legend">
              <span><i className="dot income" /> Ingresos</span>
              <span><i className="dot expense" /> Gastos</span>
            </div>
          </div>

          {/* ─── Top categories + merchants ──────────────────────────── */}
          <div className="recap-two">
            <div className="dr-card">
              <div className="dr-card-head">
                <div>
                  <div className="dr-card-title">Top 5 categorías</div>
                  <div className="dr-card-sub">¿Dónde se fue el dinero?</div>
                </div>
              </div>
              {recap.topCategories.length === 0 ? (
                <div className="recap-empty-inline">Sin gastos categorizados.</div>
              ) : (
                <div className="alloc-list">
                  {recap.topCategories.map(c => (
                    <div key={c.id} className="alloc-row">
                      <span className="alloc-name">
                        <span style={{ marginRight: 6 }}>{c.icon}</span>{c.name}
                      </span>
                      <span className="alloc-amt">
                        {fmt(c.total)} <span className="target">· {c.count} cargos</span>
                      </span>
                      <div className="alloc-bar">
                        <span className="alloc-fill" style={{ width: `${c.pct}%`, background: c.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="dr-card">
              <div className="dr-card-head">
                <div>
                  <div className="dr-card-title">Top 10 comercios</div>
                  <div className="dr-card-sub">Por monto total acumulado</div>
                </div>
              </div>
              {recap.topMerchants.length === 0 ? (
                <div className="recap-empty-inline">Sin gastos descritos.</div>
              ) : (
                <ol className="recap-list">
                  {recap.topMerchants.map((m, i) => (
                    <li key={i}>
                      <span className="recap-list-rank">{i + 1}</span>
                      <span className="recap-list-name">{m.description}</span>
                      <span className="recap-list-meta">{m.count}×</span>
                      <span className="recap-list-amt">{fmt(m.total)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          {/* ─── Big expenses + Goals ────────────────────────────────── */}
          <div className="recap-two">
            <div className="dr-card">
              <div className="dr-card-head">
                <div>
                  <div className="dr-card-title">Gastos que sorprendieron</div>
                  <div className="dr-card-sub">Las 5 transacciones más grandes del año</div>
                </div>
              </div>
              {recap.bigExpenses.length === 0 ? (
                <div className="recap-empty-inline">Sin gastos registrados.</div>
              ) : (
                <ol className="recap-list">
                  {recap.bigExpenses.map((b, i) => (
                    <li key={b.id}>
                      <span className="recap-list-rank">{i + 1}</span>
                      <span className="recap-list-name">
                        <span style={{ marginRight: 6 }}>{b.categoryIcon}</span>
                        {b.description}
                      </span>
                      <span className="recap-list-meta">
                        {parseDateOnly(b.date).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })} · {b.categoryName}
                      </span>
                      <span className="recap-list-amt">−{fmt(b.amount)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="dr-card">
              <div className="dr-card-head">
                <div>
                  <div className="dr-card-title">Metas {recap.year}</div>
                  <div className="dr-card-sub">
                    {recap.goals.completed} de {recap.goals.total} completadas · promedio {recap.goals.avgPct.toFixed(0)}%
                  </div>
                </div>
                {recap.goals.completed === recap.goals.total && recap.goals.total > 0 && (
                  <span className="delta-pill up">¡Pleno!</span>
                )}
              </div>
              {recap.goals.items.length === 0 ? (
                <div className="recap-empty-inline">Sin metas definidas.</div>
              ) : (
                <div className="alloc-list">
                  {recap.goals.items.map(g => (
                    <div key={g.id} className="alloc-row">
                      <span className="alloc-name">
                        <span style={{ marginRight: 6 }}>{g.icon}</span>{g.name}
                      </span>
                      <span className="alloc-amt">
                        {fmt(g.current)} <span className="target">/ {fmt(g.target)}</span>
                      </span>
                      <div className="alloc-bar">
                        <span
                          className="alloc-fill"
                          style={{
                            width: `${g.pct}%`,
                            background: g.completed ? 'var(--accent-green)' : 'var(--accent-blue)',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ─── Compartido vs individual (anual + por categoría) ──── */}
          <div className="dr-card">
            <div className="dr-card-head">
              <div>
                <div className="dr-card-title">Compartido vs individual</div>
                <div className="dr-card-sub">
                  Quién pagó qué durante todo {recap.year} — insumo Slide 4 / Slide 8
                </div>
              </div>
            </div>

            {(() => {
              const o = recap.ownership.byOwner;
              const totalE = recap.totalExpense || 1;
              const sharedPct  = (o.shared.expense  / totalE) * 100;
              const mePct      = (o.me.expense      / totalE) * 100;
              const partnerPct = (o.partner.expense / totalE) * 100;
              return (
                <div className="split-card">
                  <div className="split-bar" aria-hidden="true">
                    <span className="seg-shared"  style={{ width: `${sharedPct}%` }} />
                    <span className="seg-me"      style={{ width: `${mePct}%` }} />
                    <span className="seg-partner" style={{ width: `${partnerPct}%` }} />
                  </div>
                  <div className="split-rows">
                    {(['shared', 'me', 'partner'] as Owner[]).map(ow => (
                      <div key={ow} className="split-row">
                        <span className="split-row-label">
                          <span className={`owner-badge owner-${ow}`}>
                            {ownerLabels[ow].charAt(0).toUpperCase()}
                          </span>
                          {ownerLabels[ow]}
                        </span>
                        <span className="split-row-meta">
                          {o[ow].pct.toFixed(0)}% · {o[ow].count} cargos
                        </span>
                        <span className="split-row-amt">{fmt(o[ow].expense)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {recap.ownership.byCategory.length > 0 && (
              <>
                <div style={{
                  marginTop: 22,
                  fontSize: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)',
                  fontWeight: 500,
                }}>
                  Top categorías · split por owner
                </div>
                <div className="recap-owner-cat-list">
                  {recap.ownership.byCategory.map(c => {
                    const sPct = (c.byOwner.shared  / c.total) * 100;
                    const mPct = (c.byOwner.me      / c.total) * 100;
                    const pPct = (c.byOwner.partner / c.total) * 100;
                    return (
                      <div key={c.categoryId} className="recap-owner-cat-row">
                        <span className="recap-owner-cat-name">
                          <span style={{ marginRight: 6 }}>{c.categoryIcon}</span>{c.categoryName}
                        </span>
                        <span className="recap-owner-cat-amt">{fmt(c.total)}</span>
                        <div className="split-bar">
                          <span className="seg-shared"  style={{ width: `${sPct}%` }} />
                          <span className="seg-me"      style={{ width: `${mPct}%` }} />
                          <span className="seg-partner" style={{ width: `${pPct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* ─── Footer note: "para el PowerPoint Night" ──────────────── */}
          <div className="recap-cta-note">
            💡 Esta vista resume tu año en cifras. Úsala como insumo para tu reunión
            <strong> Finanzas en Pareja {recap.year + 1}</strong> — son las preguntas
            del Slide 2: ¿qué hicimos bien?, ¿qué fue difícil?, ¿qué nos sorprendió?, ¿qué aprendimos?
            Usa el botón <strong>Imprimir / PDF</strong> arriba para exportarla y pegarla en el PPT.
          </div>
        </>
      )}
    </div>
  );
}
