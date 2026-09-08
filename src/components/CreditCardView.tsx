import { useMemo, useState } from 'react';
import {
  CreditCard as CreditCardIcon,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Calendar,
  ArrowRight,
  CheckCircle2,
  Info,
  AlertCircle,
  Target,
  Activity,
  Layers,
  Edit3,
  X,
  Check,
  RotateCcw,
  Calculator,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  DollarSign,
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import { Account, CreditStatement, CreditStatementHistoryEntry, RecurringTransaction, Transaction } from '../types';
import { computeCreditSnapshot, simulatePayment, teaToMonthly } from '../utils/creditCardAnalytics';
import { buildCreditAdvice, rankInstallments, CreditAdvice, AdviceSeverity } from '../utils/creditAdvice';
import { formatCurrency } from '../utils/calculations';
import { useFxRates } from '../utils/fx';
import { parseDateOnly } from '../utils/stableDate';
import { localeActual } from '../utils/fxTasas';
import { simboloDe, getMonedaBase } from '../utils/fxTasas';

interface CreditCardViewProps {
  accounts: Account[];
  transactions: Transaction[];
  recurring: RecurringTransaction[];
  currency: string;
  /** Persist a manual edit of the credit account's statement snapshot. */
  onUpdateStatement?: (accountId: string, statement: CreditStatement) => void;
}

const fmtPct = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`;

const severityIcon: Record<AdviceSeverity, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertCircle,
  danger: AlertTriangle,
};

function AdviceCard({ advice }: { advice: CreditAdvice }) {
  const Icon = severityIcon[advice.severity];
  return (
    <div className={`credit-advice credit-advice--${advice.severity}`}>
      <div className="credit-advice-icon"><Icon size={18} /></div>
      <div className="credit-advice-body">
        <div className="credit-advice-head">
          <span className="credit-advice-title">{advice.title}</span>
          {advice.highlight && (
            <span className="credit-advice-highlight">{advice.highlight}</span>
          )}
        </div>
        <div className="credit-advice-text">{advice.body}</div>
        {advice.action && (
          <div className="credit-advice-action">{advice.action}</div>
        )}
      </div>
    </div>
  );
}

export function CreditCardView({ accounts, transactions, recurring, currency, onUpdateStatement }: CreditCardViewProps) {
  // Inline manual-edit form for the cycle snapshot (saldo, pago mínimo, TEA,
  // fecha límite). Lets the user mirror what their BCP app shows without
  // waiting for a PDF import. Values are persisted onto the credit
  // account's latestStatement so all downstream KPIs / advice use them.
  const [editing, setEditing] = useState(false);
  const fxRates = useFxRates();
  // Pick the first credit account. Multi-card support is a follow-up.
  const creditAccount = useMemo(
    () => accounts.find((a) => a.type === 'credit'),
    [accounts]
  );

  const snapshot = useMemo(
    () => creditAccount ? computeCreditSnapshot(creditAccount, transactions, recurring) : null,
    [creditAccount, transactions, recurring]
  );

  // Slider state: payment amount between minimum and total.
  const [payment, setPayment] = useState<number>(snapshot?.pagoMinimoPEN || 0);
  // Reset slider when snapshot's bounds change.
  useMemo(() => {
    if (snapshot) {
      // Default the slider to ~30% above the minimum (encourages paying more).
      const start = Math.min(
        snapshot.pagoMinimoPEN * 1.3,
        snapshot.pagoTotalPEN
      );
      setPayment(Math.round(start));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot?.pagoMinimoPEN, snapshot?.pagoTotalPEN]);

  const simulation = useMemo(
    () => snapshot ? simulatePayment(snapshot, payment) : null,
    [snapshot, payment]
  );

  const advice = useMemo(
    () => snapshot ? buildCreditAdvice(snapshot, transactions) : [],
    [snapshot, transactions]
  );

  const installmentRanking = useMemo(
    () => snapshot ? rankInstallments(snapshot) : [],
    [snapshot]
  );

  const utilizationAdvice = useMemo(() => advice.filter(a => a.group === 'utilization'), [advice]);
  const installmentAdvice = useMemo(() => advice.filter(a => a.group === 'installments'), [advice]);
  const forecastAdvice = useMemo(() => advice.filter(a => a.group === 'forecast'), [advice]);

  if (!creditAccount) {
    return (
      <div className="dr-card">
        <div className="dr-card-head">
          <div>
            <div className="dr-card-title">Crédito</div>
            <div className="dr-card-sub">Sin tarjeta de crédito configurada</div>
          </div>
        </div>
        <p style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          Crea una cuenta de tipo "Crédito" en Mis Cuentas para ver tu salud crediticia,
          simulador de pagos y consejos personalizados.
        </p>
      </div>
    );
  }

  if (!snapshot) return null;

  const dueText = snapshot.daysUntilDue !== undefined
    ? snapshot.daysUntilDue >= 0
      ? `en ${snapshot.daysUntilDue}d`
      : `vencido hace ${Math.abs(snapshot.daysUntilDue)}d`
    : '—';
  const dueColor = snapshot.daysUntilDue !== undefined && snapshot.daysUntilDue <= 5
    ? 'var(--accent-red)' : snapshot.daysUntilDue !== undefined && snapshot.daysUntilDue <= 10
    ? 'var(--accent-amber)' : 'var(--text-primary)';

  const utilColor = snapshot.utilization > 0.7 ? 'var(--accent-red)'
    : snapshot.utilization > 0.4 ? 'var(--accent-amber)'
    : 'var(--accent-green)';

  // Format cycle window if known: e.g. "26 mar — 26 abr"
  const stmt = creditAccount.latestStatement;
  const fmtShort = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) : '';
  const cycleText = (stmt?.cycleStart && stmt?.cycleEnd)
    ? `${fmtShort(stmt.cycleStart)} al ${fmtShort(stmt.cycleEnd)}`
    : null;
  const closeDate = stmt?.cycleEnd ? fmtShort(stmt.cycleEnd) : null;

  // Salary context for the simulator — show what % of salary the payment is.
  const paymentVsSalaryPct = snapshot.monthlySalary
    ? Math.min(payment / snapshot.monthlySalary, 1)
    : 0;

  return (
    <div className="credit-view">
      {/* KPI Strip */}
      <div className="credit-kpis">
        <div className="credit-kpi">
          <div className="credit-kpi-label">Saldo PEN</div>
          <div className="credit-kpi-value" style={{ color: 'var(--accent-red)' }}>
            {formatCurrency(snapshot.saldoPEN, 'PEN')}
          </div>
          <div className="credit-kpi-meta">
            Mín {formatCurrency(snapshot.pagoMinimoPEN, 'PEN')} · Total {formatCurrency(snapshot.pagoTotalPEN, 'PEN')}
          </div>
        </div>

        {snapshot.saldoUSD > 0 && (
          <div className="credit-kpi">
            <div className="credit-kpi-label">Saldo USD</div>
            <div className="credit-kpi-value" style={{ color: 'var(--accent-red)' }}>
              {formatCurrency(snapshot.saldoUSD, 'USD')}
            </div>
            <div className="credit-kpi-meta">
              Mín {formatCurrency(snapshot.pagoMinimoUSD, 'USD')} · Total {formatCurrency(snapshot.pagoTotalUSD, 'USD')}
            </div>
          </div>
        )}

        <div className="credit-kpi">
          <div className="credit-kpi-label">Utilización</div>
          <div className="credit-kpi-value" style={{ color: utilColor }}>
            {fmtPct(snapshot.utilization)}
          </div>
          <div className="credit-kpi-meta">
            de {formatCurrency(snapshot.creditLimit, 'PEN')}
          </div>
          <div className="credit-util-bar">
            <span style={{ width: `${Math.min(snapshot.utilization * 100, 100)}%`, background: utilColor }} />
          </div>
        </div>

        <div className="credit-kpi">
          <div className="credit-kpi-label">Fecha límite</div>
          <div className="credit-kpi-value" style={{ color: dueColor, fontSize: 18 }}>
            {snapshot.paymentDueDate
              ? new Date(snapshot.paymentDueDate).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
              : '—'}
          </div>
          <div className="credit-kpi-meta">{dueText}</div>
        </div>

        <div className="credit-kpi">
          <div className="credit-kpi-label">Ciclo</div>
          <div className="credit-kpi-value" style={{ fontSize: 16 }}>
            {cycleText || '—'}
          </div>
          <div className="credit-kpi-meta">
            {closeDate ? `Cierre ${closeDate}` : 'Sin datos del ciclo'}
          </div>
        </div>

        <div className="credit-kpi">
          <div className="credit-kpi-label">TEA</div>
          <div className="credit-kpi-value" style={{ fontSize: 18 }}>
            {fmtPct(snapshot.teaPEN)}
          </div>
          <div className="credit-kpi-meta">USD {fmtPct(snapshot.teaUSD)}</div>
        </div>
      </div>

      {/* Manual edit: lets the user enter the BCP app numbers directly,
          overriding the transaction-sum heuristic when there's no fresh PDF. */}
      {onUpdateStatement && (
        <StatementEditor
          account={creditAccount}
          editing={editing}
          onToggle={() => setEditing(!editing)}
          onSave={(stmt) => {
            onUpdateStatement(creditAccount.id, stmt);
            setEditing(false);
          }}
        />
      )}

      {/* F2 · Consejos accionables — utilización + fechas */}
      {utilizationAdvice.length > 0 && (
        <div className="dr-card">
          <div className="dr-card-head">
            <div>
              <div className="dr-card-title">
                <Target size={16} style={{ marginRight: 6, verticalAlign: -2 }} />
                Consejos para este ciclo
              </div>
              <div className="dr-card-sub">Llegá al cierre con utilización &lt; 30%</div>
            </div>
          </div>

          <UtilizationGoalBar snapshot={snapshot} />

          <div className="credit-advice-list">
            {utilizationAdvice.map(a => <AdviceCard key={a.id} advice={a} />)}
          </div>
        </div>
      )}

      {/* F5 · Historial de utilización + intereses vs capital */}
      {(creditAccount.statementHistory?.length ?? 0) >= 1 && (
        <TrendsCard
          history={creditAccount.statementHistory || []}
          current={creditAccount.latestStatement}
          creditLimit={creditAccount.creditLimit || 0}
          currentUtilization={snapshot.utilization}
        />
      )}

      {/* F6 · Gastos del ciclo actual por categoría */}
      <CycleSpendingCard
        account={creditAccount}
        transactions={transactions}
        fxRateUSD={fxRates.USD}
      />

      {/* Cost of paying minimum — separate cards for PEN and USD when both exist. */}
      {snapshot.saldoPEN > 0 && (
        <div className="credit-warning">
          <AlertTriangle size={20} />
          <div>
            <div className="credit-warning-title">
              Si solo pagas el mínimo PEN ({formatCurrency(snapshot.pagoMinimoPEN, 'PEN')})…
            </div>
            <div className="credit-warning-detail">
              Pagas <strong>{formatCurrency(snapshot.interestIfMinimumPEN, 'PEN')}</strong> de
              intereses este ciclo. A ese ritmo, la deuda revolvente tardaría más de 5 años en
              liquidarse.
            </div>
          </div>
        </div>
      )}

      {snapshot.saldoUSD > 0 && (
        <div className="credit-warning">
          <AlertTriangle size={20} />
          <div>
            <div className="credit-warning-title">
              Si solo pagas el mínimo USD ({formatCurrency(snapshot.pagoMinimoUSD, 'USD')})…
            </div>
            <div className="credit-warning-detail">
              Pagas <strong>{formatCurrency(snapshot.interestIfMinimumUSD, 'USD')}</strong> de
              intereses este ciclo (TEA USD {fmtPct(snapshot.teaUSD)}). Conviene priorizar
              liquidar la deuda en dólares: la TEA en USD también es alta.
            </div>
          </div>
        </div>
      )}

      {/* Simulador */}
      <div className="dr-card">
        <div className="dr-card-head">
          <div>
            <div className="dr-card-title">Simulador de pago (soles)</div>
            <div className="dr-card-sub">
              ¿Cuánto vas a pagar el {snapshot.paymentDueDate
                ? new Date(snapshot.paymentDueDate).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
                : 'próximo cobro'}?
            </div>
          </div>
        </div>

        <div className="credit-slider-wrap">
          <input
            type="range"
            min={Math.round(snapshot.pagoMinimoPEN)}
            max={Math.max(Math.round(snapshot.pagoTotalPEN), Math.round(snapshot.pagoMinimoPEN + 1))}
            value={Math.round(payment)}
            step={50}
            onChange={(e) => setPayment(Number(e.target.value))}
            className="credit-slider"
          />
          <div className="credit-slider-labels">
            <span>Mín {formatCurrency(snapshot.pagoMinimoPEN, 'PEN')}</span>
            <span>Total {formatCurrency(snapshot.pagoTotalPEN, 'PEN')}</span>
          </div>
        </div>

        <div className="credit-slider-output">
          <div className="credit-pill">
            <Calendar size={14} />
            <span>{simulation?.monthsToPayoff === 120
              ? 'No alcanzas a liquidar'
              : `Liquidas en ${simulation?.monthsToPayoff} mes${simulation?.monthsToPayoff === 1 ? '' : 'es'}`}</span>
          </div>
          <div className="credit-pill credit-pill--save">
            <TrendingDown size={14} />
            <span>Ahorras {formatCurrency(simulation?.interestSavedVsMinimum || 0, 'PEN')} en intereses</span>
          </div>
        </div>

        <div className="credit-payment-headline">
          <span className="credit-payment-label">Pago elegido</span>
          <span className="credit-payment-amount">{formatCurrency(payment, 'PEN')}</span>
          {snapshot.monthlySalary && (
            <span className="credit-payment-salary">
              ({fmtPct(paymentVsSalaryPct, 0)} de tu sueldo · {formatCurrency(snapshot.monthlySalary, 'PEN')})
            </span>
          )}
        </div>

        <div className="credit-payment-breakdown">
          <div>
            <div className="credit-bd-label">Capital cubierto</div>
            <div className="credit-bd-value">
              {formatCurrency(Math.min(payment, snapshot.saldoPEN), 'PEN')}
            </div>
          </div>
          <div>
            <div className="credit-bd-label">Saldo después del pago</div>
            <div className="credit-bd-value">
              {formatCurrency(simulation?.remainingAfterPayment || 0, 'PEN')}
            </div>
          </div>
          <div>
            <div className="credit-bd-label">Intereses totales hasta liquidar</div>
            <div className="credit-bd-value">
              {formatCurrency(simulation?.totalInterest || 0, 'PEN')}
            </div>
          </div>
        </div>

        {/* Payoff timeline — visual progress bar with destination date */}
        {simulation && simulation.monthsToPayoff > 0 && simulation.monthsToPayoff < 120 && (
          <PayoffTimeline months={simulation.monthsToPayoff} />
        )}

        {/* FX alert when USD balance exists and rate is meaningfully off
            from the rate at the moment the USD saldo was first captured. */}
        {snapshot.saldoUSD > 0 && (
          <FxDriftAlert
            saldoUSD={snapshot.saldoUSD}
            history={creditAccount.statementHistory || []}
            currentRate={fxRates.USD}
          />
        )}

        {/* USD analysis — when there's a dollar balance to consider. */}
        {snapshot.saldoUSD > 0 && (
          <div className="credit-usd-section">
            <div className="credit-usd-head">Saldo en dólares</div>
            <div className="credit-usd-grid">
              <div>
                <div className="credit-bd-label">Saldo USD</div>
                <div className="credit-bd-value">{formatCurrency(snapshot.saldoUSD, 'USD')}</div>
              </div>
              <div>
                <div className="credit-bd-label">Pago mínimo USD</div>
                <div className="credit-bd-value">{formatCurrency(snapshot.pagoMinimoUSD, 'USD')}</div>
              </div>
              <div>
                <div className="credit-bd-label">Pago total USD</div>
                <div className="credit-bd-value">{formatCurrency(snapshot.pagoTotalUSD, 'USD')}</div>
              </div>
              <div>
                <div className="credit-bd-label">Interés mensual si revolvés</div>
                <div className="credit-bd-value">{formatCurrency(snapshot.interestIfMinimumUSD, 'USD')}</div>
              </div>
            </div>
            <div className="credit-usd-note">
              💡 La TEA en USD ({fmtPct(snapshot.teaUSD)}) suele ser menor que la PEN ({fmtPct(snapshot.teaPEN)}),
              pero igual conviene liquidar pronto, porque el tipo de cambio puede subir y volverla más cara en soles.
            </div>
          </div>
        )}
      </div>

      {/* F3 · Estrategia de cuotas activas */}
      {installmentRanking.length > 0 && (
        <div className="dr-card">
          <div className="dr-card-head">
            <div>
              <div className="dr-card-title">
                <Layers size={16} style={{ marginRight: 6, verticalAlign: -2 }} />
                Estrategia · Cuotas activas
              </div>
              <div className="dr-card-sub">
                {installmentRanking.length} plan{installmentRanking.length === 1 ? '' : 'es'} · ordenados por interés a ahorrar
              </div>
            </div>
          </div>

          {installmentAdvice.length > 0 && (
            <div className="credit-advice-list">
              {installmentAdvice.map(a => <AdviceCard key={a.id} advice={a} />)}
            </div>
          )}

          <div className="credit-installments">
            {installmentRanking.map((r) => {
              const inst = creditAccount.latestStatement!.installments!.find(i => i.id === r.installmentId)!;
              return (
                <div key={r.installmentId} className={`credit-inst-row credit-inst-row--prio-${Math.min(r.priority, 3)}`}>
                  <div className="credit-inst-rank">#{r.priority}</div>
                  <div className="credit-inst-main">
                    <div className="credit-inst-desc">{r.description}</div>
                    <div className="credit-inst-meta">
                      Cuota {inst.paidInstallments}/{inst.totalInstallments} · TEA {fmtPct(r.tea)} · {r.reason}
                    </div>
                    <div className="credit-inst-meta">
                      Restan {r.remainingInstallments} cuotas · capital pendiente ~{formatCurrency(r.remainingPrincipal, inst.currency)}
                    </div>
                  </div>
                  <div className="credit-inst-amounts">
                    <div className="credit-inst-amount">
                      {formatCurrency(inst.monthlyTotal, inst.currency)}/mes
                    </div>
                    <div className="credit-inst-breakdown">
                      Cancelando ahorrás ~<strong>{formatCurrency(r.estimatedSavings, inst.currency)}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="credit-installments-note">
            💡 Pedí el <strong>saldo de prepago</strong> a tu banco antes de pagar: descuentan el interés no-devengado y suele haber una comisión chica.
          </div>
        </div>
      )}

      {/* F4 · Forecast — proyección de saldo al cierre */}
      {forecastAdvice.length > 0 && (
        <div className="dr-card">
          <div className="dr-card-head">
            <div>
              <div className="dr-card-title">
                <Activity size={16} style={{ marginRight: 6, verticalAlign: -2 }} />
                Proyección · Cierre del ciclo
              </div>
              <div className="dr-card-sub">Basado en tu ritmo actual de gasto</div>
            </div>
          </div>
          <div className="credit-advice-list">
            {forecastAdvice.map(a => <AdviceCard key={a.id} advice={a} />)}
          </div>
        </div>
      )}

      {/* No statement imported yet — nudge */}
      {!creditAccount.latestStatement && (
        <div className="dr-card">
          <div className="dr-card-head">
            <div>
              <div className="dr-card-title">Importa tu Estado de Cuenta</div>
              <div className="dr-card-sub">Para datos exactos de pago mínimo, TEA y cuotas</div>
            </div>
          </div>
          <p style={{ padding: '12px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
            Sidebar → <strong>Importar PDF BCP</strong> → selecciona tu Estado de Cuenta Visa. Los
            números arriba están basados en tus transacciones registradas, sin los gastos de
            cuotas ni intereses reales del banco.
          </p>
        </div>
      )}

      {/* Footnote */}
      <div className="credit-footnote">
        <CreditCardIcon size={12} />
        <span>
          Cálculos basados en TEA {fmtPct(snapshot.teaPEN)} (BCP Visa).{' '}
          {currency !== 'PEN' && <span>Moneda app: {currency}.</span>}
        </span>
        <ArrowRight size={12} style={{ marginLeft: 'auto', opacity: 0.6 }} />
      </div>
    </div>
  );
}

// ─── Inline editor: write what you see in the BCP app ──────────────

interface StatementEditorProps {
  account: Account;
  editing: boolean;
  onToggle: () => void;
  onSave: (stmt: CreditStatement) => void;
}

function StatementEditor({ account, editing, onToggle, onSave }: StatementEditorProps) {
  const s = account.latestStatement;

  // Local form state — initialized from the current snapshot.
  const [saldoPEN, setSaldoPEN] = useState<string>(String(s?.saldoTotalPEN ?? ''));
  const [saldoUSD, setSaldoUSD] = useState<string>(String(s?.saldoTotalUSD ?? ''));
  const [pagoMinPEN, setPagoMinPEN] = useState<string>(String(s?.pagoMinimoPEN ?? ''));
  const [pagoMinUSD, setPagoMinUSD] = useState<string>(String(s?.pagoMinimoUSD ?? ''));
  const [pagoTotPEN, setPagoTotPEN] = useState<string>(String(s?.pagoTotalPEN ?? ''));
  const [pagoTotUSD, setPagoTotUSD] = useState<string>(String(s?.pagoTotalUSD ?? ''));
  const [dueDate, setDueDate] = useState<string>(s?.paymentDueDate ?? '');
  const [cycleStart, setCycleStart] = useState<string>(s?.cycleStart ?? '');
  const [cycleEnd, setCycleEnd] = useState<string>(s?.cycleEnd ?? '');
  const [teaPEN, setTeaPEN] = useState<string>(s?.teaPEN !== undefined ? String((s.teaPEN * 100).toFixed(2)) : '');
  const [teaUSD, setTeaUSD] = useState<string>(s?.teaUSD !== undefined ? String((s.teaUSD * 100).toFixed(2)) : '');

  // Smart number parser — handles both English (1,234.56) and Spanish
  // (1.234,56 / 229,62) decimal conventions. Critical so users typing
  // values from the BCP app (which uses Spanish locale) don't get x100
  // off because of comma-as-decimal.
  const num = (v: string): number | undefined => {
    if (!v) return undefined;
    const trimmed = v.trim();
    if (!trimmed) return undefined;

    const hasDot = trimmed.includes('.');
    const hasComma = trimmed.includes(',');

    let cleaned: string;
    if (hasDot && hasComma) {
      // Both present — the LAST one is the decimal separator.
      const lastDot = trimmed.lastIndexOf('.');
      const lastComma = trimmed.lastIndexOf(',');
      cleaned = lastComma > lastDot
        ? trimmed.replace(/\./g, '').replace(',', '.')   // "1.234,56" → "1234.56"
        : trimmed.replace(/,/g, '');                      // "1,234.56" → "1234.56"
    } else if (hasComma) {
      // Only comma. If pattern is "<digits>,<1-2 digits>" treat as decimal.
      // Otherwise treat as thousands separator.
      const parts = trimmed.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        cleaned = trimmed.replace(',', '.');              // "229,62" → "229.62"
      } else {
        cleaned = trimmed.replace(/,/g, '');              // "1,234,567" → "1234567"
      }
    } else {
      cleaned = trimmed;
    }

    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : undefined;
  };

  const handleSave = () => {
    const teaPenDec = num(teaPEN);
    const teaUsdDec = num(teaUSD);
    const next: CreditStatement = {
      ...(s || {}),
      saldoTotalPEN: num(saldoPEN),
      saldoTotalUSD: num(saldoUSD),
      pagoMinimoPEN: num(pagoMinPEN),
      pagoMinimoUSD: num(pagoMinUSD),
      pagoTotalPEN: num(pagoTotPEN),
      pagoTotalUSD: num(pagoTotUSD),
      paymentDueDate: dueDate || undefined,
      cycleStart: cycleStart || undefined,
      cycleEnd: cycleEnd || undefined,
      // TEA inputs are typed as % (e.g. 95.89) — convert to decimal for storage.
      teaPEN: teaPenDec !== undefined ? teaPenDec / 100 : s?.teaPEN,
      teaUSD: teaUsdDec !== undefined ? teaUsdDec / 100 : s?.teaUSD,
      importedAt: new Date().toISOString(),
    };
    onSave(next);
  };

  // "Auto 10%" — typical BCP pago mínimo is ~10% of saldo. Useful when the
  // user has the saldo from the BCP app but not the exact pago mínimo.
  const autoMin = () => {
    const sp = num(saldoPEN);
    const su = num(saldoUSD);
    if (sp !== undefined && !pagoMinPEN) setPagoMinPEN((sp * 0.10).toFixed(2));
    if (su !== undefined && !pagoMinUSD) setPagoMinUSD((su * 0.10).toFixed(2));
  };

  // Reset form to whatever's persisted (last PDF import or last manual save).
  // Useful if the user types something wrong and wants to revert.
  const resetFromStored = () => {
    setSaldoPEN(String(s?.saldoTotalPEN ?? ''));
    setSaldoUSD(String(s?.saldoTotalUSD ?? ''));
    setPagoMinPEN(String(s?.pagoMinimoPEN ?? ''));
    setPagoMinUSD(String(s?.pagoMinimoUSD ?? ''));
    setPagoTotPEN(String(s?.pagoTotalPEN ?? ''));
    setPagoTotUSD(String(s?.pagoTotalUSD ?? ''));
    setDueDate(s?.paymentDueDate ?? '');
    setCycleStart(s?.cycleStart ?? '');
    setCycleEnd(s?.cycleEnd ?? '');
    setTeaPEN(s?.teaPEN !== undefined ? String((s.teaPEN * 100).toFixed(2)) : '');
    setTeaUSD(s?.teaUSD !== undefined ? String((s.teaUSD * 100).toFixed(2)) : '');
  };

  if (!editing) {
    const hasManualData = s !== undefined;
    return (
      <button
        type="button"
        className="credit-edit-toggle"
        onClick={onToggle}
        title="Editar saldo, pago mínimo y fecha límite manualmente"
      >
        <Edit3 size={14} />
        <span>{hasManualData ? 'Editar datos del ciclo' : 'Ingresar datos del ciclo manualmente'}</span>
      </button>
    );
  }

  return (
    <div className="dr-card credit-edit-card">
      <div className="dr-card-head">
        <div>
          <div className="dr-card-title">
            <Edit3 size={16} style={{ marginRight: 6, verticalAlign: -2 }} />
            Editar datos del ciclo
          </div>
          <div className="dr-card-sub">
            Copia exactamente lo que muestra tu app BCP. Acepta números con coma o punto decimal (ej. <code>229,62</code> o <code>229.62</code>).
          </div>
        </div>
        <button className="dr-card-action" onClick={onToggle}>
          <X size={16} />
        </button>
      </div>

      <div className="credit-edit-grid">
        <label>
          <span>Saldo / consumido en soles</span>
          <input
            inputMode="decimal"
            placeholder="21908.42"
            value={saldoPEN}
            onChange={(e) => setSaldoPEN(e.target.value)}
          />
        </label>
        <label>
          <span>Saldo / consumido en dólares</span>
          <input
            inputMode="decimal"
            placeholder="229.62"
            value={saldoUSD}
            onChange={(e) => setSaldoUSD(e.target.value)}
          />
        </label>

        <label>
          <span>
            Pago mínimo en soles
            <button
              type="button"
              className="credit-edit-mini"
              onClick={autoMin}
              title="Estimar como 10% del saldo (regla aproximada BCP)"
            >
              <Calculator size={11} /> Auto 10%
            </button>
          </span>
          <input
            inputMode="decimal"
            placeholder="1946.10"
            value={pagoMinPEN}
            onChange={(e) => setPagoMinPEN(e.target.value)}
          />
        </label>
        <label>
          <span>Pago mínimo en dólares</span>
          <input
            inputMode="decimal"
            placeholder="10.00"
            value={pagoMinUSD}
            onChange={(e) => setPagoMinUSD(e.target.value)}
          />
        </label>

        <label>
          <span>Pago total en soles</span>
          <input
            inputMode="decimal"
            placeholder="3992.46"
            value={pagoTotPEN}
            onChange={(e) => setPagoTotPEN(e.target.value)}
          />
        </label>
        <label>
          <span>Pago total en dólares</span>
          <input
            inputMode="decimal"
            placeholder="98.12"
            value={pagoTotUSD}
            onChange={(e) => setPagoTotUSD(e.target.value)}
          />
        </label>

        <label>
          <span>Inicio del ciclo</span>
          <input
            type="date"
            value={cycleStart}
            onChange={(e) => setCycleStart(e.target.value)}
          />
        </label>
        <label>
          <span>Cierre del ciclo</span>
          <input
            type="date"
            value={cycleEnd}
            onChange={(e) => setCycleEnd(e.target.value)}
          />
        </label>

        <label>
          <span>Fecha límite de pago</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </label>

        <label>
          <span>TEA en soles (%)</span>
          <input
            inputMode="decimal"
            placeholder="95.89"
            value={teaPEN}
            onChange={(e) => setTeaPEN(e.target.value)}
          />
        </label>
        <label>
          <span>TEA en dólares (%)</span>
          <input
            inputMode="decimal"
            placeholder="76.90"
            value={teaUSD}
            onChange={(e) => setTeaUSD(e.target.value)}
          />
        </label>
      </div>

      <div className="credit-edit-actions">
        {s && (
          <button
            className="credit-edit-reset"
            onClick={resetFromStored}
            title="Restaurar los valores guardados (último PDF importado o último guardado manual)"
          >
            <RotateCcw size={13} />
            Cargar valores del último PDF
          </button>
        )}
        <div className="credit-edit-actions-right">
          <button className="credit-edit-cancel" onClick={onToggle}>Cancelar</button>
          <button className="credit-edit-save" onClick={handleSave}>
            <Check size={14} />
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── F6 · Meta de utilización con progreso visual ─────────────────

function UtilizationGoalBar({ snapshot }: { snapshot: ReturnType<typeof computeCreditSnapshot> }) {
  if (!snapshot || snapshot.creditLimit <= 0) return null;
  const TARGET = 0.30;
  const currentPct = snapshot.utilization * 100;
  const targetBalance = snapshot.creditLimit * TARGET;
  const toGoal = Math.max(snapshot.saldoPEN - targetBalance, 0);
  // Progreso hacia la meta: 100% = en o debajo de la meta; 0% = utilización 100%.
  const progress = Math.max(0, Math.min(100, ((1 - snapshot.utilization) / (1 - TARGET)) * 100));
  const reached = snapshot.utilization <= TARGET;
  const barColor = reached
    ? 'var(--accent-green)'
    : snapshot.utilization > 0.7
      ? 'var(--accent-red)'
      : 'var(--accent-amber)';
  return (
    <div className="credit-goal-bar">
      <div className="credit-goal-bar-head">
        <span className="credit-goal-bar-label">Progreso hacia la meta (&lt; 30%)</span>
        <span className="credit-goal-bar-stat">
          {currentPct.toFixed(1)}%
          {reached ? ' · ¡meta alcanzada!' : ` · faltan ${simboloDe(getMonedaBase())} ${Math.round(toGoal).toLocaleString(localeActual())}`}
        </span>
      </div>
      <div className="credit-goal-bar-track">
        <div className="credit-goal-bar-fill" style={{ width: `${progress}%`, background: barColor }} />
        <div className="credit-goal-bar-target" />
      </div>
    </div>
  );
}

// ─── Tendencias · utilización histórica + intereses vs capital ────

interface TrendsCardProps {
  history: CreditStatementHistoryEntry[];
  current?: CreditStatement;
  creditLimit: number;
  currentUtilization: number;
}

function TrendsCard({ history, current, creditLimit, currentUtilization }: TrendsCardProps) {
  const series = useMemo(() => {
    const rows = history.map(h => ({
      label: new Date(h.cycleEnd).toLocaleDateString('es-PE', { month: 'short', year: '2-digit' }),
      util: h.utilization !== undefined ? +(h.utilization * 100).toFixed(1) : 0,
      cycleEnd: h.cycleEnd,
      saldoPEN: h.saldoTotalPEN || 0,
      pagoTotalPEN: h.pagoTotalPEN || 0,
      teaPEN: h.teaPEN || 0.9589,
    }));
    if (current?.cycleEnd) {
      rows.push({
        label: new Date(current.cycleEnd).toLocaleDateString('es-PE', { month: 'short', year: '2-digit' }) + ' · hoy',
        util: +(currentUtilization * 100).toFixed(1),
        cycleEnd: current.cycleEnd,
        saldoPEN: current.saldoTotalPEN || 0,
        pagoTotalPEN: current.pagoTotalPEN || 0,
        teaPEN: current.teaPEN || 0.9589,
      });
    }
    return rows;
  }, [history, current, currentUtilization]);

  // Intereses vs capital — estimación por ciclo. Aproximación: la parte que
  // no se pagó del ciclo previo acumula interés mensual a TEA → ese monto
  // es el interés del próximo pago; el resto del pago es capital.
  const breakdown = useMemo(() => {
    const out: { cycle: string; interest: number; principal: number }[] = [];
    for (let i = 1; i < series.length; i++) {
      const prev = series[i - 1];
      const cur = series[i];
      const monthlyRate = teaToMonthly(prev.teaPEN);
      const revolving = Math.max(prev.saldoPEN - prev.pagoTotalPEN, 0);
      const interestPaid = revolving * monthlyRate;
      const paid = cur.pagoTotalPEN > 0 ? cur.pagoTotalPEN : prev.pagoTotalPEN;
      const principalPaid = Math.max(paid - interestPaid, 0);
      out.push({ cycle: cur.label, interest: interestPaid, principal: principalPaid });
    }
    return out.slice(-3);
  }, [series]);

  const trendDelta = series.length >= 2
    ? series[series.length - 1].util - series[series.length - 2].util
    : 0;

  return (
    <div className="dr-card">
      <div className="dr-card-head">
        <div>
          <div className="dr-card-title">
            <LineChartIcon size={16} style={{ marginRight: 6, verticalAlign: -2 }} />
            Tendencias del crédito
          </div>
          <div className="dr-card-sub">
            Utilización de los últimos {series.length} ciclo{series.length === 1 ? '' : 's'}
            {trendDelta !== 0 && (
              <>
                {' · '}
                <span style={{ color: trendDelta > 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                  {trendDelta > 0 ? <TrendingUp size={11} style={{ verticalAlign: -1 }} /> : <TrendingDown size={11} style={{ verticalAlign: -1 }} />}
                  {' '}{Math.abs(trendDelta).toFixed(1)} pts vs ciclo previo
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="credit-trend-chart">
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={series} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              domain={[0, (dataMax: number) => Math.max(100, Math.ceil(dataMax / 20) * 20)]}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12 }}
              formatter={(v: number) => [`${v}%`, 'Utilización']}
              labelStyle={{ color: 'var(--text-muted)' }}
            />
            <ReferenceLine y={30} stroke="var(--accent-green)" strokeDasharray="3 3" />
            <ReferenceLine y={70} stroke="var(--accent-red)" strokeDasharray="3 3" />
            <Line type="monotone" dataKey="util" stroke="var(--accent-green)" strokeWidth={2.2} dot={{ r: 3, fill: 'var(--accent-green)' }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {breakdown.length > 0 && creditLimit > 0 && (
        <div className="credit-breakdown-section">
          <div className="credit-breakdown-head">Intereses vs capital · últimos {breakdown.length} ciclo{breakdown.length === 1 ? '' : 's'}</div>
          <div className="credit-breakdown-list">
            {breakdown.map(b => {
              const total = b.interest + b.principal;
              const interestPct = total > 0 ? (b.interest / total) * 100 : 0;
              const principalPct = 100 - interestPct;
              return (
                <div key={b.cycle} className="credit-breakdown-row">
                  <div className="credit-breakdown-row-label">
                    <span>{b.cycle}</span>
                    <span className="credit-breakdown-row-amounts">
                      Interés <strong>{formatCurrency(b.interest, 'PEN')}</strong>
                      {' · '}
                      Capital <strong>{formatCurrency(b.principal, 'PEN')}</strong>
                    </span>
                  </div>
                  <div className="credit-breakdown-bar">
                    <div className="credit-breakdown-bar-interest" style={{ width: `${interestPct}%` }} title={`${interestPct.toFixed(0)}% interés`} />
                    <div className="credit-breakdown-bar-principal" style={{ width: `${principalPct}%` }} title={`${principalPct.toFixed(0)}% capital`} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="credit-breakdown-note">
            💡 Con TEA alta gran parte de cada pago se va a intereses. Pagar más del mínimo es lo único que hace bajar el capital realmente.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Gastos del ciclo por categoría ────────────────────────────────

interface CycleSpendingCardProps {
  account: Account;
  transactions: Transaction[];
  fxRateUSD: number;
}

function CycleSpendingCard({ account, transactions, fxRateUSD }: CycleSpendingCardProps) {
  const stmt = account.latestStatement;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { start, end } = useMemo(() => {
    if (stmt?.cycleStart && stmt?.cycleEnd) {
      return { start: new Date(stmt.cycleStart), end: new Date(stmt.cycleEnd) };
    }
    if (account.statementCloseDay) {
      const closeDay = account.statementCloseDay;
      const curDay = today.getDate();
      const s = curDay > closeDay
        ? new Date(today.getFullYear(), today.getMonth(), closeDay + 1)
        : new Date(today.getFullYear(), today.getMonth() - 1, closeDay + 1);
      return { start: s, end: today };
    }
    const s = new Date(today);
    s.setDate(s.getDate() - 30);
    return { start: s, end: today };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stmt?.cycleStart, stmt?.cycleEnd, account.statementCloseDay]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions) {
      if (t.accountId !== account.id) continue;
      if (t.type !== 'expense') continue;
      const d = parseDateOnly(t.date);
      if (d < start || d > end) continue;
      const penAmt = t.currency === 'USD' ? t.amount * fxRateUSD : t.amount;
      map.set(t.category, (map.get(t.category) || 0) + penAmt);
    }
    return [...map.entries()]
      .map(([cat, total]) => ({ cat, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [transactions, account.id, start, end, fxRateUSD]);

  const totalCycle = byCategory.reduce((s, b) => s + b.total, 0);

  if (byCategory.length === 0) {
    return (
      <div className="dr-card">
        <div className="dr-card-head">
          <div>
            <div className="dr-card-title">
              <PieChartIcon size={16} style={{ marginRight: 6, verticalAlign: -2 }} />
              Gastos del ciclo
            </div>
            <div className="dr-card-sub">Sin transacciones del ciclo actual registradas en esta cuenta</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dr-card">
      <div className="dr-card-head">
        <div>
          <div className="dr-card-title">
            <PieChartIcon size={16} style={{ marginRight: 6, verticalAlign: -2 }} />
            Gastos del ciclo · top categorías
          </div>
          <div className="dr-card-sub">
            {byCategory.length} categoría{byCategory.length === 1 ? '' : 's'} · {formatCurrency(totalCycle, 'PEN')} acumulado
          </div>
        </div>
      </div>
      <div className="credit-spending-list">
        {byCategory.map(b => {
          const pct = totalCycle > 0 ? (b.total / totalCycle) * 100 : 0;
          return (
            <div key={b.cat} className="credit-spending-row">
              <div className="credit-spending-label">
                <span>{b.cat}</span>
                <span><strong>{formatCurrency(b.total, 'PEN')}</strong> · {pct.toFixed(0)}%</span>
              </div>
              <div className="credit-spending-bar">
                <div className="credit-spending-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Payoff timeline ───────────────────────────────────────────────

function PayoffTimeline({ months }: { months: number }) {
  const target = new Date();
  target.setMonth(target.getMonth() + months);
  const fmtDate = target.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  const human = years > 0
    ? `${years} año${years > 1 ? 's' : ''}${remMonths > 0 ? ` y ${remMonths} mes${remMonths > 1 ? 'es' : ''}` : ''}`
    : `${months} mes${months > 1 ? 'es' : ''}`;
  return (
    <div className="credit-timeline">
      <div className="credit-timeline-head">
        <span>Línea de tiempo · libre de deuda</span>
        <span className="credit-timeline-date">{fmtDate}</span>
      </div>
      <div className="credit-timeline-track">
        <div className="credit-timeline-now">
          <span className="credit-timeline-dot" />
          <span className="credit-timeline-label">Hoy</span>
        </div>
        <div className="credit-timeline-line">
          <div className="credit-timeline-progress" />
        </div>
        <div className="credit-timeline-target">
          <span className="credit-timeline-dot credit-timeline-dot--green" />
          <span className="credit-timeline-label">Libre</span>
        </div>
      </div>
      <div className="credit-timeline-meta">
        Llegás en <strong>{human}</strong> con el pago elegido.
      </div>
    </div>
  );
}

// ─── FX drift alert ────────────────────────────────────────────────

interface FxDriftAlertProps {
  saldoUSD: number;
  history: CreditStatementHistoryEntry[];
  currentRate: number;
}

function FxDriftAlert({ saldoUSD, history, currentRate }: FxDriftAlertProps) {
  const baseline = useMemo(() => {
    for (let i = history.length - 1; i >= 0; i--) {
      const r = history[i].fxRateUSD;
      if (r && r > 0) return r;
    }
    return null;
  }, [history]);

  if (!baseline) return null;
  const drift = currentRate - baseline;
  const driftPct = (drift / baseline) * 100;
  const equivalentNow = saldoUSD * currentRate;
  const equivalentBefore = saldoUSD * baseline;
  const delta = equivalentNow - equivalentBefore;

  if (Math.abs(driftPct) < 1) return null;

  const isWorse = drift > 0;
  return (
    <div className={`credit-fx-alert ${isWorse ? 'credit-fx-alert--bad' : 'credit-fx-alert--good'}`}>
      <DollarSign size={18} />
      <div>
        <div className="credit-fx-alert-title">
          {isWorse ? 'El dólar subió' : 'El dólar bajó'} {Math.abs(driftPct).toFixed(1)}% desde el ciclo anterior
        </div>
        <div className="credit-fx-alert-text">
          Tu saldo USD ({formatCurrency(saldoUSD, 'USD')}) equivale ahora a
          {' '}<strong>{formatCurrency(equivalentNow, 'PEN')}</strong>
          {', '}
          <strong style={{ color: isWorse ? 'var(--accent-red)' : 'var(--accent-green)' }}>
            {isWorse ? '+' : ''}{formatCurrency(delta, 'PEN')}
          </strong>
          {isWorse ? ' más caros que antes (TC ' : ' menos que antes (TC '}
          {baseline.toFixed(2)} → {currentRate.toFixed(2)}).
          {isWorse && ' Conviene priorizar liquidar la deuda USD pronto.'}
        </div>
      </div>
    </div>
  );
}
