import { ColumnMapping } from '../../types';

interface ColumnMapperProps {
  headers: string[];
  mapping: ColumnMapping;
  sampleRows: string[][];
  onMappingChange: (mapping: ColumnMapping) => void;
}

const fieldLabels: { key: keyof ColumnMapping; label: string; required: boolean }[] = [
  { key: 'dateColumn', label: 'Fecha', required: true },
  { key: 'amountColumn', label: 'Monto', required: true },
  { key: 'descriptionColumn', label: 'Descripción', required: false },
  { key: 'typeColumn', label: 'Tipo (ingreso/gasto)', required: false },
  { key: 'categoryColumn', label: 'Categoría', required: false },
];

export function ColumnMapper({ headers, mapping, sampleRows, onMappingChange }: ColumnMapperProps) {
  const handleChange = (field: keyof ColumnMapping, value: string) => {
    onMappingChange({ ...mapping, [field]: value || null });
  };

  const getPreviewValues = (column: string | null): string[] => {
    if (!column) return [];
    const idx = headers.indexOf(column);
    if (idx === -1) return [];
    return sampleRows.slice(0, 3).map(row => row[idx] || '—');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1rem' }}>
        Mapear columnas
      </h3>
      <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
        Asigna cada columna de tu archivo a los campos correspondientes.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {fieldLabels.map(field => (
          <div key={field.key} style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 140px) minmax(0, 1fr) minmax(0, 1fr)',
            gap: '0.75rem',
            alignItems: 'center',
          }}>
            <label style={{
              fontSize: '0.85rem',
              color: 'var(--text-primary)',
              fontWeight: 500,
            }}>
              {field.label}
              {field.required && <span style={{ color: 'var(--danger)', marginLeft: 2 }}>*</span>}
            </label>

            <select
              value={mapping[field.key] || ''}
              onChange={e => handleChange(field.key, e.target.value)}
              style={{
                padding: '0.5rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            >
              <option value="">— No asignada —</option>
              {headers.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>

            <div style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {getPreviewValues(mapping[field.key]).map((v, i) => (
                <span key={i}>
                  {i > 0 && ' · '}
                  <span style={{ color: 'var(--text-secondary)' }}>{v}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
