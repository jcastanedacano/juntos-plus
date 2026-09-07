import { useState } from 'react';
import { AlertTriangle, Send, CheckCircle } from 'lucide-react';
import { reportProblem } from '../../utils/parserRegistry';

interface ReportProblemProps {
  fileName: string;
  headers: string[];
  rowCount: number;
  errorMessage: string;
}

export function ReportProblem({ fileName, headers, rowCount, errorMessage }: ReportProblemProps) {
  const [bankName, setBankName] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    reportProblem(fileName, bankName || null, errorMessage, headers, rowCount);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '1rem',
        background: 'rgba(34, 211, 166, 0.08)',
        border: '1px solid rgba(34, 211, 166, 0.2)',
        borderRadius: '10px',
        fontSize: '0.85rem',
        color: 'var(--success)',
      }}>
        <CheckCircle size={18} />
        Reporte guardado. Esto nos ayudará a mejorar la importación.
      </div>
    );
  }

  return (
    <div style={{
      padding: '1rem',
      background: 'rgba(245, 158, 11, 0.08)',
      border: '1px solid rgba(245, 158, 11, 0.2)',
      borderRadius: '10px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '0.75rem',
        color: 'var(--warning)',
        fontSize: '0.9rem',
        fontWeight: 600,
      }}>
        <AlertTriangle size={16} />
        Reportar problema con la importación
      </div>

      <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        Si el archivo no se importó correctamente, guarda un reporte para mejorar los parsers.
        No se guardan datos financieros, solo metadata del formato.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Nombre del banco (opcional)"
          value={bankName}
          onChange={e => setBankName(e.target.value)}
          style={{
            flex: 1,
            padding: '0.5rem 0.75rem',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            fontSize: '0.85rem',
          }}
        />
        <button
          onClick={handleSubmit}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: 'none',
            background: 'var(--warning)',
            color: '#000',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 500,
          }}
        >
          <Send size={14} />
          Reportar
        </button>
      </div>
    </div>
  );
}
