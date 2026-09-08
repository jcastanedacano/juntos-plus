import { ReactNode } from 'react';
import { localeActual } from '../../utils/fxTasas';

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => ReactNode;
  width?: string;
}

interface TableCompactProps<T> {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  maxRows?: number;
  emptyMessage?: string;
}

export function TableCompact<T extends { id: string }>({
  columns,
  rows,
  onRowClick,
  maxRows = 5,
  emptyMessage = 'No hay datos'
}: TableCompactProps<T>) {
  const displayRows = maxRows ? rows.slice(0, maxRows) : rows;

  if (rows.length === 0) {
    return (
      <div className="table-compact-empty" style={{
        textAlign: 'center',
        padding: '2rem',
        color: 'var(--text-secondary)'
      }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="table-compact">
      {displayRows.map((row) => (
        <div
          key={row.id}
          className="table-compact-row"
          onClick={() => onRowClick?.(row)}
          style={{ cursor: onRowClick ? 'pointer' : 'default' }}
        >
          {columns.map((col) => (
            <div
              key={String(col.key)}
              style={{ width: col.width, flex: col.width ? undefined : 1 }}
            >
              {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key as string] ?? '')}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// Pre-built transaction row component
interface TransactionRowProps {
  icon: string;
  iconBg?: string;
  title: string;
  subtitle: string;
  amount: number;
  type: 'income' | 'expense';
  currency?: string;
  onClick?: () => void;
}

export function TransactionRow({
  icon,
  iconBg,
  title,
  subtitle,
  amount,
  type,
  currency = 'PEN',
  onClick
}: TransactionRowProps) {
  const symbol = currency === 'PEN' ? 'S/' : currency === 'USD' ? '$' : '€';
  const formattedAmount = `${type === 'income' ? '+' : '-'}${symbol} ${Math.abs(amount).toLocaleString(localeActual(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

  return (
    <div
      className="table-compact-row"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div
        className="table-compact-icon"
        style={{ background: iconBg || 'var(--bg-hover)' }}
      >
        {icon}
      </div>
      <div className="table-compact-content">
        <div className="table-compact-title">{title}</div>
        <div className="table-compact-subtitle">{subtitle}</div>
      </div>
      <div className={`table-compact-amount ${type}`}>
        {formattedAmount}
      </div>
    </div>
  );
}
