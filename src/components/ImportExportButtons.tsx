import { useRef, useState } from 'react';
import { Transaction } from '../types';
import { exportToCSV, importFromCSV, downloadCSVTemplate } from '../utils/csvUtils';
import { importBcpYapeCSV } from '../utils/bcpYapeConverter';
import { storageAPI } from '../utils/storageAPI';

interface ImportExportButtonsProps {
  transactions: Transaction[];
  onImport: (transactions: Transaction[]) => void;
  onOpenSmartImport?: () => void;
}

export const ImportExportButtons = ({ transactions, onImport, onOpenSmartImport }: ImportExportButtonsProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showMenu, setShowMenu] = useState(false);

  const handleExport = () => {
    if (transactions.length === 0) {
      alert('No hay transacciones para exportar');
      return;
    }
    exportToCSV(transactions);
    setShowMenu(false);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
    setShowMenu(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let importedTransactions: Transaction[] = [];

      // Intentar primero con formato BCP/Yape
      try {
        importedTransactions = await importBcpYapeCSV(file);
        console.log('Detectado formato BCP/Yape');
      } catch (bcpError) {
        // Si falla, intentar con formato genérico
        console.log('Intentando formato genérico...');
        importedTransactions = await importFromCSV(file);
      }

      if (importedTransactions.length === 0) {
        alert('No se encontraron transacciones válidas en el archivo');
        return;
      }

      const confirmMessage = `Se importarán ${importedTransactions.length} transacciones. ¿Deseas continuar?`;

      if (window.confirm(confirmMessage)) {
        onImport(importedTransactions);
        alert(`✅ ${importedTransactions.length} transacciones importadas exitosamente`);
      }
    } catch (error) {
      alert(`❌ Error al importar: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }

    // Limpiar el input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    downloadCSVTemplate();
    setShowMenu(false);
  };

  const handleSmartImport = () => {
    setShowMenu(false);
    onOpenSmartImport?.();
  };

  const handleDownloadBackup = async () => {
    setShowMenu(false);
    try {
      await storageAPI.downloadBackup();
    } catch (error) {
      alert(`❌ No se pudo descargar el backup: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  return (
    <div className="import-export-container">
      <button
        className="import-export-btn"
        onClick={() => setShowMenu(!showMenu)}
      >
        📊 Datos
      </button>

      {showMenu && (
        <>
          <div className="menu-overlay" onClick={() => setShowMenu(false)} />
          <div className="import-export-menu">
            <button onClick={handleSmartImport} className="menu-item" style={{ fontWeight: 600 }}>
              📂 Importar Excel/CSV inteligente
            </button>
            <div style={{ height: 1, background: 'var(--border-color)', margin: '0.25rem 0' }} />
            <button onClick={handleExport} className="menu-item">
              📥 Exportar a CSV
            </button>
            <button onClick={handleImportClick} className="menu-item">
              📤 Importar desde CSV (simple)
            </button>
            <button onClick={handleDownloadTemplate} className="menu-item">
              📄 Descargar Plantilla
            </button>
            <div style={{ height: 1, background: 'var(--border-color)', margin: '0.25rem 0' }} />
            <button onClick={handleDownloadBackup} className="menu-item">
              💾 Descargar backup completo
            </button>
          </div>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
};
