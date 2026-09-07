import { Transaction } from '../types';
import { getCategoryById, getAllCategoriesRaw } from './categoryHelpers';

export const exportToCSV = (transactions: Transaction[]): void => {
  // Crear encabezados CSV
  const headers = ['ID', 'Tipo', 'Cantidad', 'Categoría', 'Descripción', 'Fecha', 'Cuenta'];

  // Convertir transacciones a filas CSV
  const rows = transactions.map(t => {
    const category = getCategoryById(t.category);
    return [
      t.id,
      t.type === 'income' ? 'Ingreso' : 'Gasto',
      t.amount.toString(),
      category?.name || t.category,
      t.description || '',
      t.date,
      t.accountId,
    ];
  });

  // Combinar encabezados y filas
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  // Crear y descargar archivo
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  const date = new Date().toISOString().split('T')[0];
  link.setAttribute('href', url);
  link.setAttribute('download', `transacciones_${date}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const importFromCSV = (file: File): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
          reject(new Error('El archivo CSV está vacío'));
          return;
        }

        // Omitir la primera línea (encabezados)
        const dataLines = lines.slice(1);

        const transactions: Transaction[] = dataLines.map((line, index) => {
          // Parsear CSV teniendo en cuenta comillas
          const values: string[] = [];
          let currentValue = '';
          let insideQuotes = false;

          for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
              insideQuotes = !insideQuotes;
            } else if (char === ',' && !insideQuotes) {
              values.push(currentValue.trim());
              currentValue = '';
            } else {
              currentValue += char;
            }
          }
          values.push(currentValue.trim());

          if (values.length < 6) {
            throw new Error(`Línea ${index + 2}: formato inválido`);
          }

          // Buscar la categoría por nombre
          const categoryName = values[3];
          const category = getAllCategoriesRaw().find(
            c => c.name.toLowerCase() === categoryName.toLowerCase()
          );

          return {
            id: values[0] || Date.now().toString() + index,
            type: values[1].toLowerCase().includes('ingreso') ? 'income' : 'expense',
            amount: parseFloat(values[2]) || 0,
            category: category?.id || 'other-expense',
            description: values[4] || '',
            date: values[5] || new Date().toISOString().split('T')[0],
            accountId: values[6] || 'default',
          } as Transaction;
        });

        resolve(transactions);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Error al leer el archivo'));
    };

    reader.readAsText(file, 'UTF-8');
  });
};

export const downloadCSVTemplate = (): void => {
  const headers = ['ID', 'Tipo', 'Cantidad', 'Categoría', 'Descripción', 'Fecha', 'Cuenta'];
  const exampleRow = [
    Date.now().toString(),
    'Gasto',
    '50.00',
    'Alimentación',
    'Compra de supermercado',
    new Date().toISOString().split('T')[0],
    'default',
  ];

  const csvContent = [
    headers.join(','),
    exampleRow.map(cell => `"${cell}"`).join(','),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', 'plantilla_transacciones.csv');
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
