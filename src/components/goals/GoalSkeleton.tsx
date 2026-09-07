import { memo } from 'react';

export const GoalSkeleton = memo(() => (
  <div className="gl-skeleton-grid">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="gl-skeleton-card">
        <div className="gl-skeleton-header">
          <div className="gl-skel gl-skel--icon" />
          <div className="gl-skel-text">
            <div className="gl-skel gl-skel--name" />
            <div className="gl-skel gl-skel--status" />
          </div>
        </div>
        <div className="gl-skel gl-skel--bar" />
        <div className="gl-skel gl-skel--amounts" />
        <div className="gl-skel gl-skel--footer" />
      </div>
    ))}
  </div>
));

GoalSkeleton.displayName = 'GoalSkeleton';
