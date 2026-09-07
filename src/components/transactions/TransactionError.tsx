import { AlertTriangle } from 'lucide-react';

interface TransactionErrorProps {
  message?: string;
  onRetry: () => void;
}

export function TransactionError({ message, onRetry }: TransactionErrorProps) {
  return (
    <div className="txn-error">
      <AlertTriangle size={40} className="txn-error-icon" />
      <h3 className="txn-error-title">Error al cargar</h3>
      <p className="txn-error-text">{message || 'Ocurrió un error al cargar las transacciones.'}</p>
      <button className="txn-error-retry" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  );
}
