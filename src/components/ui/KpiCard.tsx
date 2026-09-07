import { LucideIcon, ChevronUp, ChevronDown, Minus } from 'lucide-react';
import { Sparkline } from './Sparkline';

interface KpiCardProps {
  icon: LucideIcon;
  title: string;
  value: number;
  delta?: number;
  trendColor?: 'green' | 'red' | 'neutral';
  sparklineData?: number[];
  currency?: string;
  formatAsCurrency?: boolean;
  valueColor?: 'income' | 'expense' | 'neutral';
  iconColor?: 'green' | 'red' | 'blue' | 'amber';
}

const sparklineColors: Record<string, { stroke: string; fill: string }> = {
  green: { stroke: '#00D1B2', fill: 'rgba(0,209,178,.15)' },
  red:   { stroke: '#FF6B81', fill: 'rgba(255,107,129,.15)' },
  blue:  { stroke: '#6C8EEF', fill: 'rgba(108,142,239,.15)' },
  amber: { stroke: '#F59E0B', fill: 'rgba(245,158,11,.15)' },
};

export function KpiCard({
  icon: Icon,
  title,
  value,
  delta,
  trendColor = 'neutral',
  sparklineData,
  currency = 'PEN',
  formatAsCurrency = true,
  valueColor = 'neutral',
  iconColor = 'blue'
}: KpiCardProps) {
  const currencySymbol = currency === 'PEN' ? 'S/' : currency === 'USD' ? '$' : '€';

  const formatValue = (val: number) => {
    if (!formatAsCurrency) {
      return <>{val.toFixed(1)}<span className="kpi-currency">%</span></>;
    }
    const formatted = val.toLocaleString('es-PE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return <><span className="kpi-currency">{currencySymbol} </span>{formatted}</>;
  };

  const getDeltaIcon = () => {
    if (!delta || delta === 0) return <Minus size={10} />;
    return delta > 0 ? <ChevronUp size={10} /> : <ChevronDown size={10} />;
  };

  const getDeltaClass = () => {
    if (!delta || delta === 0) return 'neutral';
    if (trendColor === 'green') return delta > 0 ? 'positive' : 'negative';
    if (trendColor === 'red') return delta > 0 ? 'negative' : 'positive';
    return delta > 0 ? 'positive' : 'negative';
  };

  const colors = sparklineColors[iconColor] || sparklineColors.blue;

  return (
    <div className="kpi-card">
      <div className="kpi-header">
        <div className={`kpi-icon-wrapper ${iconColor}`}>
          <Icon size={20} />
        </div>

        {delta !== undefined && (
          <div className={`kpi-delta ${getDeltaClass()}`}>
            {getDeltaIcon()}
            <span>{Math.abs(delta).toFixed(1)}%</span>
          </div>
        )}
      </div>

      <div className="kpi-content">
        <div className="kpi-title">{title}</div>
        <div className={`kpi-value ${valueColor}`}>
          {formatValue(value)}
        </div>
      </div>

      {sparklineData && sparklineData.length > 1 && (
        <div className="kpi-sparkline">
          <Sparkline
            data={sparklineData}
            color={colors.stroke}
            width={200}
            height={27}
            fillOpacity={0.15}
          />
        </div>
      )}
    </div>
  );
}
