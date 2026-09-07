import { useState } from 'react';
import { HeatmapDay } from '../utils/calculations';
import { format, getDay, startOfWeek, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseDateOnly } from '../utils/stableDate';

interface CalendarHeatmapProps {
  data: HeatmapDay[];
  currency: string;
}

const intensityColors = [
  'var(--border)',               // 0: no activity
  'rgba(33, 212, 163, 0.2)',    // 1
  'rgba(33, 212, 163, 0.4)',    // 2
  'rgba(33, 212, 163, 0.65)',   // 3
  'rgba(33, 212, 163, 0.9)',    // 4
];

const currencySymbol = (c: string) => c === 'PEN' ? 'S/' : c === 'USD' ? '$' : '\u20AC';

export function CalendarHeatmap({ data, currency }: CalendarHeatmapProps) {
  const [hoveredDay, setHoveredDay] = useState<HeatmapDay | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  if (data.length === 0) return null;

  const sym = currencySymbol(currency);
  const cellSize = 14;
  const gap = 3;

  // Organize data into weeks (columns)
  const firstDate = parseDateOnly(data[0].date);
  const weekStart = startOfWeek(firstDate, { weekStartsOn: 1 }); // Monday start

  // Create a map for quick lookup
  const dayMap = new Map(data.map(d => [d.date, d]));

  // Generate grid: from weekStart to last date, organized by week columns
  const lastDate = parseDateOnly(data[data.length - 1].date);
  const weeks: (HeatmapDay | null)[][] = [];
  let currentDate = weekStart;

  while (currentDate <= lastDate) {
    const week: (HeatmapDay | null)[] = [];
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const dayData = dayMap.get(dateStr) || null;
      week.push(dayData);
      currentDate = addDays(currentDate, 1);
    }
    weeks.push(week);
  }

  const svgWidth = weeks.length * (cellSize + gap) + gap;
  const svgHeight = 7 * (cellSize + gap) + gap + 20; // +20 for month labels

  // Month labels
  const monthLabels: { text: string; x: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    // Find first valid day in the week
    const firstValidDay = week.find(d => d !== null);
    if (firstValidDay) {
      const d = parseDateOnly(firstValidDay.date);
      const month = d.getMonth();
      if (month !== lastMonth) {
        monthLabels.push({
          text: format(d, 'MMM', { locale: es }),
          x: wi * (cellSize + gap) + gap,
        });
        lastMonth = month;
      }
    }
  });

  const dayLabels = ['L', '', 'M', '', 'V', '', ''];

  const handleMouseEnter = (day: HeatmapDay, e: React.MouseEvent) => {
    setHoveredDay(day);
    const rect = (e.target as SVGElement).getBoundingClientRect();
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
  };

  return (
    <div className="heatmap-card">
      <div className="heatmap-header">
        <h3 className="heatmap-title">Actividad</h3>
        <div className="heatmap-legend">
          <span className="heatmap-legend-label">Menos</span>
          {intensityColors.map((color, i) => (
            <div
              key={i}
              className="heatmap-legend-cell"
              style={{ background: color, width: cellSize - 2, height: cellSize - 2 }}
            />
          ))}
          <span className="heatmap-legend-label">Más</span>
        </div>
      </div>

      <div className="heatmap-scroll">
        <div style={{ display: 'flex', gap: '2px' }}>
          {/* Day labels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: gap + 'px', paddingTop: '20px', marginRight: '4px' }}>
            {dayLabels.map((label, i) => (
              <div key={i} style={{
                width: '16px',
                height: cellSize + 'px',
                fontSize: '10px',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}>
                {label}
              </div>
            ))}
          </div>

          <svg width={svgWidth} height={svgHeight} style={{ overflow: 'visible' }}>
            {/* Month labels */}
            {monthLabels.map((ml, i) => (
              <text
                key={i}
                x={ml.x}
                y={12}
                fill="var(--text-muted)"
                fontSize={10}
                textAnchor="start"
              >
                {ml.text}
              </text>
            ))}

            {/* Cells */}
            {weeks.map((week, wi) =>
              week.map((day, di) => {
                if (!day) return null;
                const x = wi * (cellSize + gap) + gap;
                const y = di * (cellSize + gap) + 20;
                const color = day.net > 0
                  ? intensityColors[day.intensity]
                  : day.net < 0
                    ? `rgba(255, 94, 115, ${0.15 + day.intensity * 0.18})`
                    : intensityColors[day.intensity];

                return (
                  <rect
                    key={day.date}
                    x={x}
                    y={y}
                    width={cellSize}
                    height={cellSize}
                    rx={3}
                    fill={color}
                    style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                    onMouseEnter={(e) => handleMouseEnter(day, e)}
                    onMouseLeave={() => setHoveredDay(null)}
                  />
                );
              })
            )}
          </svg>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredDay && (
        <div
          className="heatmap-tooltip"
          style={{
            position: 'fixed',
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="heatmap-tooltip-date">
            {format(parseDateOnly(hoveredDay.date), 'd MMM yyyy', { locale: es })}
          </div>
          <div className="heatmap-tooltip-count">
            {hoveredDay.count} transaccion{hoveredDay.count !== 1 ? 'es' : ''}
          </div>
          {hoveredDay.net !== 0 && (
            <div
              className="heatmap-tooltip-net"
              style={{ color: hoveredDay.net >= 0 ? 'var(--success)' : 'var(--danger)' }}
            >
              {hoveredDay.net >= 0 ? '+' : ''}{sym} {Math.abs(hoveredDay.net).toFixed(2)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
