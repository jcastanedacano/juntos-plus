import { Statistics } from '../types';
import { getCategoryById } from '../utils/categoryHelpers';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseDateOnly } from '../utils/stableDate';
import { localeActual } from '../utils/fxTasas';
import { simboloDe, getMonedaBase } from '../utils/fxTasas';

interface ChartsProps {
  stats: Statistics;
  compact?: boolean;
}

export const Charts = ({ stats, compact = false }: ChartsProps) => {
  const categoryData = Object.entries(stats.byCategory).map(([categoryId, amount]) => {
    const category = getCategoryById(categoryId);
    return {
      name: category?.name || categoryId,
      value: amount,
      color: category?.color || '#6B7280',
    };
  });

  const trendData = stats.trend
    .filter((day) => day.income > 0 || day.expense > 0)
    .map((day) => ({
      date: format(parseDateOnly(day.date), 'd MMM', { locale: es }),
      fullDate: day.date,
      ingresos: day.income,
      gastos: day.expense,
      balance: day.income - day.expense,
    }));

  // Dark theme tooltip with card-like styling and separator
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            background: 'rgba(15, 21, 40, 0.96)',
            backdropFilter: 'blur(12px)',
            padding: '14px 18px',
            border: '1px solid rgba(96, 165, 250, 0.2)',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            minWidth: '160px',
          }}
        >
          <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px', fontSize: '0.8125rem' }}>
            {label}
          </p>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px' }}>
            {payload.map((entry: any, index: number) => (
              <p key={index} style={{
                margin: '5px 0',
                color: entry.color,
                fontSize: '0.875rem',
                fontWeight: 600,
                display: 'flex',
                justifyContent: 'space-between',
                gap: '1rem',
                fontFeatureSettings: "'tnum' on, 'lnum' on",
              }}>
                <span style={{ fontWeight: 500 }}>{entry.name}</span>
                <span>{simboloDe(getMonedaBase())} {entry.value.toLocaleString(localeActual(), { minimumFractionDigits: 2 })}</span>
              </p>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  // Pie chart tooltip
  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            background: 'rgba(15, 21, 40, 0.96)',
            backdropFilter: 'blur(12px)',
            padding: '14px 18px',
            border: '1px solid rgba(96, 165, 250, 0.2)',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
          }}
        >
          <p style={{ margin: 0, fontWeight: 600, color: payload[0].payload.color }}>
            {payload[0].name}
          </p>
          <p style={{
            margin: '4px 0 0',
            color: 'var(--text-secondary)',
            fontSize: '0.875rem',
            fontFeatureSettings: "'tnum' on, 'lnum' on",
          }}>
            {simboloDe(getMonedaBase())} {payload[0].value.toLocaleString(localeActual(), { minimumFractionDigits: 2 })}
          </p>
        </div>
      );
    }
    return null;
  };

  // Compact mode - only show bar chart
  if (compact) {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={trendData} barGap={4}>
          <CartesianGrid strokeDasharray="none" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="var(--text-muted)"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
          />
          <YAxis
            stroke="var(--text-muted)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar
            dataKey="ingresos"
            name="Ingresos"
            fill="#00D1B2"
            radius={[6, 6, 0, 0]}
            maxBarSize={28}
          />
          <Bar
            dataKey="gastos"
            name="Gastos"
            fill="#FF6B81"
            radius={[6, 6, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <div className="charts-grid">
      {categoryData.length > 0 && (
        <div className="chart-card" style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
        }}>
          <h3 className="chart-title" style={{ color: 'var(--text-primary)' }}>
            Gastos por Categoría
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ percent }) =>
                  percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''
                }
                outerRadius={80}
                innerRadius={40}
                fill="#8884d8"
                dataKey="value"
                paddingAngle={2}
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="var(--bg-card)" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
              <Legend
                wrapperStyle={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}
                formatter={(value) => <span style={{ color: 'var(--text-secondary)' }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {trendData.length > 0 && (
        <div className="chart-card" style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
        }}>
          <h3 className="chart-title" style={{ color: 'var(--text-primary)' }}>
            Tendencia del Mes
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={trendData} barGap={4}>
              <CartesianGrid strokeDasharray="none" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="var(--text-muted)"
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              />
              <YAxis
                stroke="var(--text-muted)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${simboloDe(getMonedaBase())}${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
                formatter={(value) => <span style={{ color: 'var(--text-secondary)' }}>{value}</span>}
              />
              <Bar
                dataKey="ingresos"
                name="Ingresos"
                fill="#00D1B2"
                radius={[6, 6, 0, 0]}
                maxBarSize={32}
              />
              <Bar
                dataKey="gastos"
                name="Gastos"
                fill="#FF6B81"
                radius={[6, 6, 0, 0]}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
