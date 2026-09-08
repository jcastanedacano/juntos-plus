import { Transaction } from '../../types';
import { getCategoryById, getCategoriesByType } from '../../utils/categoryHelpers';
import { formatCurrency } from '../../utils/calculations';

interface ImportPreviewProps {
  transactions: Omit<Transaction, 'id'>[];
  currency: string;
  onEditCategory: (index: number, category: string) => void;
  onEditType: (index: number, type: 'income' | 'expense') => void;
  onRemove: (index: number) => void;
}

export function ImportPreview({ transactions, currency, onEditCategory, onEditType, onRemove }: ImportPreviewProps) {
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const getCatInfo = (id: string) => getCategoryById(id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1rem' }}>
        Vista previa: {transactions.length} transacciones
      </h3>

      {/* Summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '0.75rem',
      }}>
        <div style={{
          padding: '0.75rem',
          background: 'var(--bg-elevated)',
          borderRadius: '10px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ingresos</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--success)' }}>
            {formatCurrency(totalIncome, currency)}
          </div>
        </div>
        <div style={{
          padding: '0.75rem',
          background: 'var(--bg-elevated)',
          borderRadius: '10px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Gastos</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--danger)' }}>
            {formatCurrency(totalExpenses, currency)}
          </div>
        </div>
        <div style={{
          padding: '0.75rem',
          background: 'var(--bg-elevated)',
          borderRadius: '10px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Balance</div>
          <div style={{
            fontSize: '1.1rem',
            fontWeight: 600,
            color: totalIncome - totalExpenses >= 0 ? 'var(--success)' : 'var(--danger)',
          }}>
            {formatCurrency(totalIncome - totalExpenses, currency)}
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{
        maxHeight: '400px',
        overflow: 'auto',
        borderRadius: '10px',
        border: '1px solid var(--border-color)',
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.8rem',
        }}>
          <thead>
            <tr style={{ background: 'var(--bg-elevated)', position: 'sticky', top: 0, zIndex: 1 }}>
              <th style={thStyle}>Fecha</th>
              <th style={thStyle}>Descripción</th>
              <th style={thStyle}>Tipo</th>
              <th style={thStyle}>Categoría</th>
              <th style={thStyle}>Monto</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx, i) => {
              const cat = getCatInfo(tx.category);
              return (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={tdStyle}>{tx.date}</td>
                  <td style={{ ...tdStyle, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {tx.description}
                  </td>
                  <td style={tdStyle}>
                    <select
                      value={tx.type}
                      onChange={e => onEditType(i, e.target.value as 'income' | 'expense')}
                      style={selectStyle}
                    >
                      <option value="income">Ingreso</option>
                      <option value="expense">Gasto</option>
                    </select>
                  </td>
                  <td style={tdStyle}>
                    <select
                      value={tx.category}
                      onChange={e => onEditCategory(i, e.target.value)}
                      style={selectStyle}
                    >
                      {getCategoriesByType(tx.type)
                        .map(c => (
                          <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                        ))}
                    </select>
                  </td>
                  <td style={{
                    ...tdStyle,
                    fontWeight: 600,
                    color: tx.type === 'income' ? 'var(--success)' : 'var(--danger)',
                    textAlign: 'right',
                  }}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, currency)}
                  </td>
                  <td style={tdStyle}>
                    <button
                      onClick={() => onRemove(i)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                      }}
                      title="Quitar"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '0.6rem 0.75rem',
  textAlign: 'left',
  color: 'var(--text-secondary)',
  fontWeight: 600,
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const tdStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  color: 'var(--text-primary)',
  whiteSpace: 'nowrap',
};

const selectStyle: React.CSSProperties = {
  padding: '0.25rem 0.4rem',
  borderRadius: '6px',
  border: '1px solid var(--border-color)',
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  fontSize: '0.75rem',
  cursor: 'pointer',
};
