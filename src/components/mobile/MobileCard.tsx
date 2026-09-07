interface MobileCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  variant?: 'default' | 'kpi' | 'accent';
  accentColor?: string;
}

export function MobileCard({
  children,
  className = '',
  onClick,
  variant = 'default',
  accentColor
}: MobileCardProps) {
  const style = accentColor
    ? { borderLeft: `3px solid ${accentColor}` } as React.CSSProperties
    : undefined;

  return (
    <div
      className={`mobile-card mobile-card-${variant} ${className}`}
      onClick={onClick}
      style={style}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}
