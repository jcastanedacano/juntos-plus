import { FileText, FilterX } from 'lucide-react';

interface TransactionEmptyStateProps {
  variant: 'no-data' | 'no-results';
  onAction: () => void;
}

export function TransactionEmptyState({ variant, onAction }: TransactionEmptyStateProps) {
  const isNoData = variant === 'no-data';

  return (
    <div className="txn-empty">
      <div className="txn-empty-icon">
        {isNoData ? <FileText size={48} /> : <FilterX size={48} />}
      </div>
      <h3 className="txn-empty-title">
        {isNoData ? 'Sin transacciones' : 'Sin resultados'}
      </h3>
      <p className="txn-empty-text">
        {isNoData
          ? 'Aún no has registrado ninguna transacción. Comienza agregando tu primera.'
          : 'Ninguna transacción coincide con los filtros actuales.'}
      </p>
      <button className="txn-empty-cta" onClick={onAction}>
        {isNoData ? 'Registrar transacción' : 'Restablecer filtros'}
      </button>
    </div>
  );
}
