import { X } from 'lucide-react';

interface FilterChipProps {
  label: string;
  onRemove: () => void;
}

export function FilterChip({ label, onRemove }: FilterChipProps) {
  return (
    <span className="txn-filter-chip">
      <span className="txn-filter-chip-label">{label}</span>
      <button
        className="txn-filter-chip-remove"
        onClick={onRemove}
        aria-label={`Quitar filtro: ${label}`}
      >
        <X size={14} />
      </button>
    </span>
  );
}
