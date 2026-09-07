export function TransactionSkeleton() {
  return (
    <div className="txn-skeleton-container">
      {[0, 1, 2].map((i) => (
        <div key={i} className="txn-skeleton-row">
          <div className="txn-skeleton-cell txn-skeleton-check" />
          <div className="txn-skeleton-cell txn-skeleton-category" />
          <div className="txn-skeleton-cell txn-skeleton-description" />
          <div className="txn-skeleton-cell txn-skeleton-account" />
          <div className="txn-skeleton-cell txn-skeleton-date" />
          <div className="txn-skeleton-cell txn-skeleton-amount" />
          <div className="txn-skeleton-cell txn-skeleton-actions" />
        </div>
      ))}
    </div>
  );
}
