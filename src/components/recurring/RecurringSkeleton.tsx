import { memo } from 'react';

export const RecurringSkeleton = memo(() => (
  <div className="rec-skeleton">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="rec-skeleton-row">
        <div className="rec-skeleton-check" />
        <div className="rec-skeleton-icon" />
        <div className="rec-skeleton-text">
          <div className="rec-skeleton-line rec-skeleton-line--name" />
          <div className="rec-skeleton-line rec-skeleton-line--cat" />
        </div>
        <div className="rec-skeleton-badge" />
        <div className="rec-skeleton-line rec-skeleton-line--date" />
        <div className="rec-skeleton-line rec-skeleton-line--amount" />
        <div className="rec-skeleton-toggle" />
      </div>
    ))}
  </div>
));

RecurringSkeleton.displayName = 'RecurringSkeleton';
