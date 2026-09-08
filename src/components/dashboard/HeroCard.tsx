import { useMemo } from 'react';
import { DisponibleRealBreakdown, MonthEndForecast, formatCurrency } from '../../utils/calculations';
import { Statistics, Budget, Transaction } from '../../types';
import { getCurrencyBreakdown } from '../../utils/currencyBreakdown';
import { useFxRates } from '../../utils/fx';
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { parseDateOnly } from '../../utils/stableDate';
import { localeActual } from '../../utils/fxTasas';

interface HeroCardProps {
  disponibleReal: DisponibleRealBreakdown;
  monthEndForecast: MonthEndForecast;
  stats: Statistics;
  previousStats: Statistics;
  budgets: Budget[];
  currency: string;
  selectedMonth?: Date;
  /**
   * Full unfiltered transaction list — used only to compute the
   * "+ $X.XX en USD" secondary-currency chip. The rest of the hero numbers
   * are pre-filtered to the dominant currency by the parent.
   */
  allTransactions?: Transaction[];
}

const splitAmount = (amount: number): { integer: string; cents: string; sign: string } => {
  const sign = amount < 0 ? '−' : '';
  const abs = Math.abs(amount);
  const fixed = abs.toFixed(2);
  const [intPart, centsPart] = fixed.split('.');
  const intFormatted = parseInt(intPart, 10).toLocaleString(localeActual());
  return { integer: intFormatted, cents: `.${centsPart}`, sign };
};

const currencySymbol = (currency: string): string => {
  if (currency === 'PEN') return 'S/';
  if (currency === 'USD') return '$';
  return '€';
};

const monthName = (date: Date): string =>
  date.toLocaleDateString('es-PE', { month: 'long' });

export function HeroCard({
  disponibleReal,
  monthEndForecast,
  stats,
  previousStats,
  budgets,
  currency,
  selectedMonth,
  allTransactions = [],
}: HeroCardProps) {
  const ref = selectedMonth || new Date();
  const fxRates = useFxRates();

  // Secondary-currency chip — sums non-base currency activity for this
  // month so the user can see what's been converted into the headline.
  const secondaryBuckets = useMemo(() => {
    const start = startOfMonth(ref);
    const end = endOfMonth(ref);
    const monthTx = allTransactions.filter(t => {
      const d = parseDateOnly(t.date);
      return !isNaN(d.getTime()) && isWithinInterval(d, { start, end });
    });
    return getCurrencyBreakdown(monthTx).filter(b => b.currency !== currency);
  }, [allTransactions, ref, currency]);
  const sym = currencySymbol(currency);
  /** Una tasa tambien es un numero de la casa: 0,86 en euros, 0.86 en soles. */
  const tasa = (n: number) =>
    n.toLocaleString(localeActual(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // Use disponibleAjustado (= disponibleReal − variableEjecutado) so the
  // hero number reacts when the user records an expense. The label
  // "Disponible real · queda este mes" is more truthful with this value
  // because it represents *actual* remaining cash for the month, not the
  // pre-spending budget.
  const headlineAmount = disponibleReal.disponibleAjustado;
  const { integer, cents, sign } = splitAmount(headlineAmount);
  const isNeg = headlineAmount < 0;

  const eom = monthEndForecast.projectedMonthEndBalance;
  const eomFormatted = `${eom >= 0 ? '+' : '−'}${formatCurrency(Math.abs(eom), currency)}`;

  const spent = Math.max(monthEndForecast.expensesToDate, 0);
  const committedRemaining = Math.max(
    disponibleReal.comprometido + disponibleReal.ahorroMetas - spent,
    0
  );
  const free = Math.max(headlineAmount, 0);
  // When disponibleAjustado goes negative, "free" clamps to 0 and the bar
  // fills entirely with the amber "spent" segment — reading visually as
  // "100% complete / on track" when it actually means overspend. Track the
  // overrun separately so the bar can flag it instead of hiding it.
  const overspend = isNeg ? Math.abs(headlineAmount) : 0;
  const totalBar = spent + committedRemaining + free || 1;
  const pctSpent = (spent / totalBar) * 100;
  const pctCommitted = (committedRemaining / totalBar) * 100;
  const pctFree = (free / totalBar) * 100;

  const incomeDelta = previousStats.totalIncome > 0
    ? ((stats.totalIncome - previousStats.totalIncome) / previousStats.totalIncome) * 100
    : 0;

  const totalBudget = budgets.reduce((sum, b) => sum + (b.amount || 0), 0);
  const expensePct = totalBudget > 0 ? (stats.totalExpenses / totalBudget) * 100 : 0;

  const savingsRate = stats.totalIncome > 0
    ? ((stats.totalIncome - stats.totalExpenses) / stats.totalIncome) * 100
    : 0;
  const prevSavingsRate = previousStats.totalIncome > 0
    ? ((previousStats.totalIncome - previousStats.totalExpenses) / previousStats.totalIncome) * 100
    : 0;
  const savingsDelta = savingsRate - prevSavingsRate;

  const daysRemaining = Math.max(monthEndForecast.daysRemaining, 1);
  const daily = headlineAmount / daysRemaining;

  const fmtPct = (n: number, digits = 1) => `${n >= 0 ? '▲' : '▼'} ${Math.abs(n).toFixed(digits)}%`;
  const fmtPts = (n: number) => `${n >= 0 ? '▲' : '▼'} ${Math.abs(n).toFixed(1)} pts`;

  return (
    <section className="hero">
      <div className="hero-left">
        <div className="hero-eyebrow">
          <span className="pulse" />
          <span>Disponible real · queda este mes</span>
        </div>
        <div className={`hero-amount ${isNeg ? 'negative' : ''}`}>
          <span className="currency">{sign}{sym}</span>
          <span>{integer}</span>
          <span className="cents">{cents}</span>
        </div>
        <p className="hero-meaning">
          Después de pagar lo <strong>comprometido</strong> y reservar tus <strong>metas</strong>,
          tienes esto para el resto de <strong>{monthName(ref)}</strong>. A tu ritmo actual,
          terminarás con <strong className={eom >= 0 ? 'eom-pos' : 'eom-neg'}>{eomFormatted}</strong>.
        </p>

        {secondaryBuckets.length > 0 && (
          <div className="hero-secondary-currency" title={`Ya convertido a ${currencySymbol(currency)} al tipo de cambio configurado`}>
            <span className="hero-secondary-label">Convertido a TC</span>
            {secondaryBuckets.map(b => {
              const rate = b.currency === 'USD' ? fxRates.USD : b.currency === 'EUR' ? fxRates.EUR : 1;
              return (
                <span key={b.currency} className="hero-secondary-pill">
                  {formatCurrency(b.expense, b.currency)} gasto
                  {b.income > 0 && (
                    <>
                      {' · '}
                      {formatCurrency(b.income, b.currency)} ingreso
                    </>
                  )}
                  {' '}<span style={{ opacity: 0.6 }}>· TC {tasa(rate)}</span>
                </span>
              );
            })}
          </div>
        )}

        <div className="hero-progress">
          <div className={`progress-bar ${isNeg ? 'progress-bar--over' : ''}`} aria-hidden="true">
            <span className={isNeg ? 'seg-spent seg-spent--over' : 'seg-spent'} style={{ width: `${pctSpent}%` }} />
            <span className="seg-committed" style={{ width: `${pctCommitted}%` }} />
            <span className="seg-free" style={{ width: `${pctFree}%` }} />
          </div>
          <div className="progress-legend">
            <div className="legend-item">
              <span className="legend-swatch" style={{ background: isNeg ? 'var(--accent-red)' : 'var(--accent-amber)' }} />
              Gastado <span className="num">{formatCurrency(spent, currency)}</span>
            </div>
            <div className="legend-item">
              <span className="legend-swatch" style={{ background: 'var(--accent-blue)' }} />
              Comprometido <span className="num">{formatCurrency(committedRemaining, currency)}</span>
            </div>
            {isNeg ? (
              <div className="legend-item legend-item--danger">
                <span className="legend-swatch" style={{ background: 'var(--accent-red)' }} />
                Sobregasto <span className="num num--danger">{formatCurrency(overspend, currency)}</span>
              </div>
            ) : (
              <div className="legend-item">
                <span className="legend-swatch" style={{ background: 'var(--accent-green)' }} />
                Libre <span className="num">{formatCurrency(free, currency)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <aside className="hero-right">
        <div className="hero-right-head">
          <h3>Ritmo del mes</h3>
          <span
            className="hero-fx-chip"
            title={`Tipo de cambio · USD ${tasa(fxRates.USD)} · EUR ${tasa(fxRates.EUR)} (editable en Pareja)`}
          >
            {/* El simbolo sale de la moneda del hogar, no fijo: con la tasa ya
                convertida, un «S/» aqui contaba euros llamandolos soles. */}
            TC <strong>{currencySymbol(currency)} {tasa(fxRates.USD)}</strong> / USD
          </span>
        </div>
        <div>
          <div className="pace-row">
            <span className="pace-label">Ingresos del mes</span>
            <span className="pace-value">
              <span className="num">{formatCurrency(stats.totalIncome, currency)}</span>
              {previousStats.totalIncome > 0 && (
                <span className={`delta-pill ${incomeDelta > 0 ? 'up' : incomeDelta < 0 ? 'down' : 'flat'}`}>
                  {fmtPct(incomeDelta)}
                </span>
              )}
            </span>
          </div>
          <div className="pace-row">
            <span className="pace-label">Gastos vs. presupuesto</span>
            <span className="pace-value">
              <span className="num">
                {formatCurrency(stats.totalExpenses, currency)}
                {totalBudget > 0 && ` / ${formatCurrency(totalBudget, currency)}`}
              </span>
              {totalBudget > 0 && (
                <span className={`delta-pill ${expensePct > 100 ? 'down' : expensePct > 90 ? 'flat' : 'up'}`}>
                  {expensePct.toFixed(0)}%
                </span>
              )}
            </span>
          </div>
          <div className={`pace-row`}>
            <span className="pace-label">Tasa de ahorro</span>
            <span className={`pace-value ${savingsRate >= 20 ? 'up' : savingsRate < 0 ? 'down' : ''}`}>
              <span className="num">{savingsRate.toFixed(1)}%</span>
              {previousStats.totalIncome > 0 && (
                <span className={`delta-pill ${savingsDelta > 0 ? 'up' : savingsDelta < 0 ? 'down' : 'flat'}`}>
                  {fmtPts(savingsDelta)}
                </span>
              )}
            </span>
          </div>
          <div className="pace-row">
            <span className="pace-label">Día gastable</span>
            <span className="pace-value">
              <span className="num">{formatCurrency(daily, currency)} / día</span>
              <span className="delta-pill flat">{daysRemaining} {daysRemaining === 1 ? 'día' : 'días'}</span>
            </span>
          </div>
        </div>
      </aside>
    </section>
  );
}
