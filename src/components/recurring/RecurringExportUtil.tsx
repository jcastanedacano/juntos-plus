import { RecurringTransaction } from '../../types';
import { getCategoryInfo } from '../../data/categories';
import { toMonthlyAmount } from '../../utils/recurringCalculations';

const frequencyLabels: Record<string, string> = {
  daily: 'Diario',
  weekly: 'Semanal',
  monthly: 'Mensual',
  yearly: 'Anual',
};

export function exportRecurringToCSV(items: RecurringTransaction[], currency: string): void {
  const headers = [
    'Descripción',
    'Tipo',
    'Monto',
    'Monto Mensual',
    'Moneda',
    'Categoría',
    'Frecuencia',
    'Próximo Cobro',
    'Estado',
    'Etiquetas',
    'Notas',
  ];

  const rows = items.map(r => {
    const cat = getCategoryInfo(r.category);
    return [
      `"${r.description}"`,
      r.type === 'income' ? 'Ingreso' : 'Gasto',
      r.amount.toFixed(2),
      toMonthlyAmount(r).toFixed(2),
      r.currency || currency,
      cat?.name || r.category,
      frequencyLabels[r.frequency] || r.frequency,
      r.nextDate,
      r.isActive ? 'Activo' : 'Pausado',
      `"${(r.tags || []).join(', ')}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ];
  });

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `recurrentes_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
