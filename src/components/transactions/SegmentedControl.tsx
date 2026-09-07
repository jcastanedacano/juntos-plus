import { useMemo } from 'react';
import { Transaction } from '../../types';

type TabValue = 'all' | 'income' | 'expense';

interface SegmentedControlProps {
  value: TabValue;
  onChange: (value: TabValue) => void;
  transactions: Transaction[];
}

const tabs: { value: TabValue; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'income', label: 'Ingresos' },
  { value: 'expense', label: 'Gastos' },
];

export function SegmentedControl({ value, onChange, transactions }: SegmentedControlProps) {
  const counts = useMemo(() => ({
    all: transactions.length,
    income: transactions.filter((t) => t.type === 'income').length,
    expense: transactions.filter((t) => t.type === 'expense').length,
  }), [transactions]);

  const activeIndex = tabs.findIndex((t) => t.value === value);

  return (
    <div className="txn-segmented" role="tablist" aria-label="Filtrar por tipo">
      <div
        className="txn-segmented-indicator"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={value === tab.value}
          className={`txn-segmented-tab ${value === tab.value ? 'txn-segmented-tab--active' : ''}`}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
          <span className="txn-segmented-count">{counts[tab.value]}</span>
        </button>
      ))}
    </div>
  );
}
