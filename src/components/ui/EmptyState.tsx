import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon | string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  suggestions?: {
    icon: string;
    label: string;
    onClick: () => void;
  }[];
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  suggestions
}: EmptyStateProps) {
  const renderIcon = () => {
    if (typeof Icon === 'string') {
      return <span style={{ fontSize: '3rem' }}>{Icon}</span>;
    }
    return <Icon size={48} strokeWidth={1.5} />;
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '3rem 2rem',
      textAlign: 'center',
      background: 'var(--bg-card)',
      borderRadius: '14px',
      border: '1px solid var(--border-color)'
    }}>
      <div style={{
        color: 'var(--text-muted)',
        marginBottom: '1.5rem',
        opacity: 0.7
      }}>
        {renderIcon()}
      </div>

      <h3 style={{
        fontSize: '1.25rem',
        fontWeight: 600,
        color: 'var(--text-primary)',
        margin: '0 0 0.5rem 0'
      }}>
        {title}
      </h3>

      <p style={{
        fontSize: '0.9375rem',
        color: 'var(--text-secondary)',
        margin: '0 0 1.5rem 0',
        maxWidth: '400px',
        lineHeight: 1.5
      }}>
        {description}
      </p>

      {action && (
        <button
          onClick={action.onClick}
          style={{
            background: 'var(--accent-green)',
            color: 'var(--bg-primary)',
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: '10px',
            fontSize: '0.9375rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          {action.label}
        </button>
      )}

      {suggestions && suggestions.length > 0 && (
        <div style={{
          marginTop: '2rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid var(--border-color)',
          width: '100%',
          maxWidth: '400px'
        }}>
          <p style={{
            fontSize: '0.8125rem',
            color: 'var(--text-muted)',
            marginBottom: '1rem'
          }}>
            Plantillas sugeridas:
          </p>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            justifyContent: 'center'
          }}>
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={suggestion.onClick}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.5rem 0.875rem',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-secondary)',
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <span>{suggestion.icon}</span>
                <span>{suggestion.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
