import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts';
import { CashflowDataPoint, formatCurrencyCompact } from '../utils/calculations';
import { Transaction } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseDateOnly } from '../utils/stableDate';

const currencySymbol = (c: string) => c === 'PEN' ? 'S/' : c === 'USD' ? '$' : '€';

interface CashflowForecastProps {
  data: CashflowDataPoint[];
  currency: string;
  /** Used only to label the sharpest single-day drop with what caused it
   *  (top expense that day) \u2014 the line itself never explains a cliff. */
  transactions?: Transaction[];
}

export function CashflowForecast({ data, currency, transactions = [] }: CashflowForecastProps) {
  if (data.length === 0) {
    return (
      <div className="cashflow-card">
        <div className="cashflow-header">
          <h3 className="cashflow-title">Cashflow & Forecast</h3>
        </div>
        <div className="cashflow-empty">Sin datos suficientes para proyectar</div>
      </div>
    );
  }

  // Find today's index for reference line
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayIndex = data.findIndex(d => d.date === todayStr);

  // Projected balance at end
  const lastForecast = data.filter(d => d.isForecast).slice(-1)[0];
  const currentBalance = data.filter(d => !d.isForecast).slice(-1)[0];

  const projectedChange = lastForecast && currentBalance
    ? lastForecast.cumulative - currentBalance.cumulative
    : 0;

  // Format tick values
  const formatTick = (dateStr: string) => {
    try {
      return format(parseDateOnly(dateStr), 'd MMM', { locale: es });
    } catch {
      return dateStr;
    }
  };

  const formatValue = (val: number) => formatCurrencyCompact(val, currency);

  // \u2500\u2500 Annotate the sharpest single-day drop \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // A cliff in the line with no explanation reads as a chart bug. Find the
  // historical day (never a forecast day \u2014 those are averages, not events)
  // with the most negative dayNet, and label it with whatever expense drove
  // it. Only annotate when the drop is actually notable relative to the
  // period, so a normal, calm month doesn't get a random marker.
  const historical = data.filter(d => !d.isForecast);
  const avgAbsNet = historical.length > 0
    ? historical.reduce((sum, d) => sum + Math.abs(d.dayNet), 0) / historical.length
    : 0;
  const worstDay = historical.reduce<CashflowDataPoint | null>((worst, d) => {
    if (d.dayNet >= 0) return worst;
    if (!worst || d.dayNet < worst.dayNet) return d;
    return worst;
  }, null);
  const isNotableDrop = worstDay && avgAbsNet > 0 && Math.abs(worstDay.dayNet) > avgAbsNet * 2.5;

  const dropAnnotation = isNotableDrop && worstDay
    ? (() => {
        const dayTx = transactions
          .filter(t => t.date === worstDay.date && t.type === 'expense')
          .sort((a, b) => b.amount - a.amount);
        const topTx = dayTx[0];
        const label = topTx
          ? `${topTx.description || 'Gasto grande'} \u00B7 ${formatCurrencyCompact(topTx.amount, currency)}`
          : `Gasto grande \u00B7 ${formatCurrencyCompact(Math.abs(worstDay.dayNet), currency)}`;
        return { date: worstDay.date, cumulative: worstDay.cumulative, label };
      })()
    : null;

  // Show ~6 ticks
  const tickInterval = Math.max(1, Math.floor(data.length / 6));

  return (
    <div className="cashflow-card">
      <div className="cashflow-header">
        <div>
          <h3 className="cashflow-title">Cashflow & Forecast</h3>
          <p className="cashflow-subtitle">30 días + 60 días proyección</p>
        </div>
        {lastForecast && (
          <div className="cashflow-projection">
            <span className="cashflow-proj-label">Proyección 60d</span>
            <span
              className="cashflow-proj-value"
              style={{ color: projectedChange >= 0 ? 'var(--success)' : 'var(--danger)' }}
            >
              {projectedChange >= 0 ? '+' : ''}{formatValue(projectedChange)}
            </span>
          </div>
        )}
      </div>

      <div className="cashflow-chart">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="cashflowActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent-green)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="var(--accent-green)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="cashflowForecast" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent-blue)" stopOpacity={0.12} />
                <stop offset="95%" stopColor="var(--accent-blue)" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />

            <XAxis
              dataKey="date"
              tickFormatter={formatTick}
              interval={tickInterval}
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => `${currencySymbol(currency)}${(v / 1000).toFixed(0)}k`}
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={54}
            />

            <Tooltip
              contentStyle={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                boxShadow: 'var(--shadow-md)',
                padding: '10px 14px',
              }}
              labelFormatter={(label) => {
                try { return format(new Date(label as string), 'd MMMM yyyy', { locale: es }); }
                catch { return label as string; }
              }}
              formatter={(value: number, name: string) => {
                const labelMap: Record<string, string> = { actual: 'Real', forecast: 'Proyección' };
                return value != null ? [formatValue(value), labelMap[name] || name] : ['-', name];
              }}
            />

            {todayIndex >= 0 && (
              <ReferenceLine
                x={data[todayIndex]?.date}
                stroke="var(--text-muted)"
                strokeDasharray="4 4"
                label={{
                  value: 'Hoy',
                  fill: 'var(--text-secondary)',
                  fontSize: 11,
                  position: 'insideTopRight',
                  offset: 8,
                }}
              />
            )}

            {dropAnnotation && (
              <ReferenceDot
                x={dropAnnotation.date}
                y={dropAnnotation.cumulative}
                r={5}
                fill="var(--accent-red)"
                stroke="var(--bg-card)"
                strokeWidth={2}
                label={{
                  value: `⬇ ${dropAnnotation.label}`,
                  fill: 'var(--accent-red)',
                  fontSize: 11,
                  fontWeight: 600,
                  position: 'top',
                  offset: 10,
                }}
              />
            )}

            {/* Actual balance line */}
            <Area
              type="monotone"
              dataKey="actual"
              stroke="#00D1B2"
              strokeWidth={2}
              fill="url(#cashflowActual)"
              connectNulls={false}
              dot={false}
              activeDot={{ r: 4, fill: '#00D1B2' }}
            />

            {/* Forecast line (dashed) */}
            <Area
              type="monotone"
              dataKey="forecast"
              stroke="#6C8EEF"
              strokeWidth={2}
              strokeDasharray="6 3"
              fill="url(#cashflowForecast)"
              connectNulls={false}
              dot={false}
              activeDot={{ r: 4, fill: '#6C8EEF' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
