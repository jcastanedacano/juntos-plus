import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, X, ChevronRight, ChevronLeft, Check, FileSpreadsheet, FileText, Loader } from 'lucide-react';
import { Transaction, ColumnMapping } from '../../types';
import { readFileData, autoDetectColumns, isAutoDetectionComplete, parseTransactions, saveMappingForBank } from '../../utils/smartImporter';
import { detectBank } from '../../utils/parserRegistry';
import { logImportEvent } from '../../utils/privacyManager';
import { ColumnMapper } from './ColumnMapper';
import { ImportPreview } from './ImportPreview';
import { ImportPrivacyNotice } from './ImportPrivacyNotice';
import { ReportProblem } from './ReportProblem';

interface ImportWizardProps {
  onImport: (transactions: Transaction[]) => void;
  onClose: () => void;
  currency: string;
  /** When provided, the wizard auto-runs its file pipeline on mount. */
  initialFile?: File;
}

type Step = 'upload' | 'mapping' | 'preview';

export function ImportWizard({ onImport, onClose, currency, initialFile }: ImportWizardProps) {
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    dateColumn: null, amountColumn: null, descriptionColumn: null,
    typeColumn: null, categoryColumn: null,
  });
  const [parsedTransactions, setParsedTransactions] = useState<Omit<Transaction, 'id'>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [detectedBank, setDetectedBank] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPdfProcessing, setIsPdfProcessing] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ message: string; percent: number } | null>(null);
  const [isOcrUsed, setIsOcrUsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setError(null);
    setFileName(file.name);
    setIsOcrUsed(false);
    setPdfProgress(null);

    const isPdf = file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      setIsPdfProcessing(true);
    }

    try {
      let h: string[];
      let r: string[][];

      if (isPdf) {
        const { readPdfFile } = await import('../../utils/pdfImporter');
        const result = await readPdfFile(file, (message, percent) => {
          setPdfProgress({ message, percent: percent ?? 0 });
        });
        h = result.headers;
        r = result.rows;
        setIsOcrUsed(result.isOcr);
      } else {
        const data = await readFileData(file);
        h = data.headers;
        r = data.rows;
      }

      setHeaders(h);
      setRows(r);
      setIsPdfProcessing(false);
      setPdfProgress(null);

      // Try bank-specific parser first
      const bankParser = detectBank(h, r);
      if (bankParser) {
        setDetectedBank(bankParser.bankName);
        const parsed = bankParser.parse(h, r);
        if (parsed.length > 0) {
          setParsedTransactions(parsed);
          setStep('preview');
          return;
        }
      }

      // Auto-detect columns
      const autoMapping = autoDetectColumns(h);
      setMapping(autoMapping);

      if (isAutoDetectionComplete(autoMapping)) {
        try {
          const parsed = parseTransactions(h, r, autoMapping);
          if (parsed.length > 0) {
            setParsedTransactions(parsed);
            setStep('preview');
            return;
          }
        } catch { /* fall through to mapping */ }
      }

      setStep('mapping');
    } catch (err) {
      setIsPdfProcessing(false);
      setPdfProgress(null);
      setError(err instanceof Error ? err.message : 'Error al leer el archivo');
    }
  }, []);

  // Auto-process file passed from the unified "Importar" entry point.
  useEffect(() => {
    if (initialFile) {
      void processFile(initialFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await processFile(file);
  };

  const handleParseFromMapping = () => {
    try {
      const parsed = parseTransactions(headers, rows, mapping);
      if (parsed.length === 0) {
        setError('No se encontraron transacciones válidas con este mapeo');
        return;
      }
      setParsedTransactions(parsed);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al parsear');
    }
  };

  const handleConfirmImport = () => {
    const withIds: Transaction[] = parsedTransactions.map((tx, i) => ({
      ...tx,
      id: `imp_${Date.now()}_${i}`,
    }));
    onImport(withIds);
    logImportEvent(fileName, withIds.length);

    // Save mapping for reuse
    if (detectedBank) {
      saveMappingForBank(detectedBank, mapping);
    }

    onClose();
  };

  const handleEditCategory = (idx: number, category: string) => {
    const updated = [...parsedTransactions];
    updated[idx] = { ...updated[idx], category };
    setParsedTransactions(updated);
  };

  const handleEditType = (idx: number, type: 'income' | 'expense') => {
    const updated = [...parsedTransactions];
    updated[idx] = { ...updated[idx], type };
    setParsedTransactions(updated);
  };

  const handleRemove = (idx: number) => {
    setParsedTransactions(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Backdrop */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      }} onClick={onClose} />

      {/* Modal */}
      <div style={{
        position: 'relative',
        width: '90%', maxWidth: '800px', maxHeight: '90vh',
        background: 'var(--bg-card)', borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {fileName?.toLowerCase().endsWith('.pdf')
              ? <FileText size={22} style={{ color: 'var(--accent-blue)' }} />
              : <FileSpreadsheet size={22} style={{ color: 'var(--accent-blue)' }} />
            }
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                Importar Excel / CSV / PDF
              </h2>
              {fileName && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {fileName}
                  {detectedBank && `, formato: ${detectedBank}`}
                  {isOcrUsed && ', OCR aplicado'}
                </div>
              )}
            </div>
          </div>

          {/* Steps indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {(['upload', 'mapping', 'preview'] as Step[]).map((s, i) => (
              <div key={s} style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem',
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: step === s ? 'var(--accent-blue)' :
                    (['upload', 'mapping', 'preview'].indexOf(step) > i ? 'var(--success)' : 'var(--border-color)'),
                }} />
                {i < 2 && <div style={{ width: 20, height: 1, background: 'var(--border-color)' }} />}
              </div>
            ))}
          </div>

          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 4,
          }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>
          <ImportPrivacyNotice />

          <div style={{ marginTop: '1rem' }}>
            {/* Upload Step */}
            {step === 'upload' && (
              <>
                {/* PDF processing progress */}
                {isPdfProcessing && pdfProgress && (
                  <div style={{
                    padding: '1.5rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(59, 130, 246, 0.04)',
                    marginBottom: '1rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                      <Loader size={16} style={{ color: 'var(--accent-blue)', animation: 'spin 1s linear infinite' }} />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        {pdfProgress.message}
                      </span>
                    </div>
                    <div style={{
                      height: 6, borderRadius: 3,
                      background: 'var(--border-color)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${pdfProgress.percent}%`,
                        background: 'var(--accent-blue)',
                        borderRadius: 3,
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                  </div>
                )}

                <div
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => !isPdfProcessing && fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${isDragging ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                    borderRadius: '12px',
                    padding: '3rem 2rem',
                    textAlign: 'center',
                    cursor: isPdfProcessing ? 'not-allowed' : 'pointer',
                    background: isDragging ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                    opacity: isPdfProcessing ? 0.5 : 1,
                    transition: 'all 0.2s',
                  }}
                >
                  <Upload size={40} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                  <div style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                    Arrastra tu archivo aquí o haz clic para seleccionar
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    Formatos soportados: .xlsx, .xls, .csv, .pdf
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Los PDF de estado de cuenta se procesan con extracción de texto y OCR
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls,.txt,.pdf"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                </div>
              </>
            )}

            {/* Mapping Step */}
            {step === 'mapping' && (
              <ColumnMapper
                headers={headers}
                mapping={mapping}
                sampleRows={rows.slice(0, 5)}
                onMappingChange={setMapping}
              />
            )}

            {/* Preview Step */}
            {step === 'preview' && (
              <ImportPreview
                transactions={parsedTransactions}
                currency={currency}
                onEditCategory={handleEditCategory}
                onEditType={handleEditType}
                onRemove={handleRemove}
              />
            )}
          </div>

          {/* Error */}
          {error && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{
                padding: '0.75rem 1rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '10px',
                color: 'var(--danger)',
                fontSize: '0.85rem',
                marginBottom: '0.75rem',
              }}>
                {error}
              </div>
              {headers.length > 0 && (
                <ReportProblem
                  fileName={fileName}
                  headers={headers}
                  rowCount={rows.length}
                  errorMessage={error}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border-color)',
        }}>
          <button
            onClick={() => {
              if (step === 'preview') setStep('mapping');
              else if (step === 'mapping') setStep('upload');
              else onClose();
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.6rem 1.25rem', borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'transparent', color: 'var(--text-secondary)',
              cursor: 'pointer', fontSize: '0.85rem',
            }}
          >
            <ChevronLeft size={16} />
            {step === 'upload' ? 'Cancelar' : 'Atrás'}
          </button>

          {step === 'mapping' && (
            <button
              onClick={handleParseFromMapping}
              disabled={!mapping.dateColumn || !mapping.amountColumn}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.6rem 1.25rem', borderRadius: '8px',
                border: 'none',
                background: mapping.dateColumn && mapping.amountColumn ? 'var(--accent-blue)' : 'var(--border-color)',
                color: '#fff', cursor: mapping.dateColumn && mapping.amountColumn ? 'pointer' : 'not-allowed',
                fontSize: '0.85rem', fontWeight: 500,
              }}
            >
              Siguiente
              <ChevronRight size={16} />
            </button>
          )}

          {step === 'preview' && (
            <button
              onClick={handleConfirmImport}
              disabled={parsedTransactions.length === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.6rem 1.25rem', borderRadius: '8px',
                border: 'none',
                background: 'var(--success)',
                color: '#fff', cursor: 'pointer',
                fontSize: '0.85rem', fontWeight: 500,
              }}
            >
              <Check size={16} />
              Importar {parsedTransactions.length} transacciones
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
