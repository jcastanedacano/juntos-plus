import { useState, useMemo, FormEvent, useEffect, useRef, useCallback } from 'react';
import { Camera, Upload, X, Sparkles, Loader2, CheckCircle2, AlertCircle, Settings2, Mic, MicOff } from 'lucide-react';
import { Transaction, TransactionType, CurrencyType, Owner } from '../types';
import { OWNER_OPTIONS } from '../utils/ownership';
import { useOwnerLabels } from '../utils/ownerLabels';
import { getMyOwnerRole } from '../utils/userIdentity';
import { getMonedaBase } from '../utils/fx';
import { getCategoriesByType, getCategoryById } from '../utils/categoryHelpers';
import { normalizeDescription } from '../utils/descriptionNormalizer';
import { extractReceiptData, ReceiptExtraction } from '../utils/receiptOCR';
import { CategoryManager } from './settings/CategoryManager';
import { isSpeechSupported, listenOnce, type Listener } from '../utils/speechRecognition';
import { parseVoiceTransaction } from '../utils/voiceParser';

interface TransactionModalProps {
  onClose: () => void;
  onSave: (transaction: Omit<Transaction, 'id'>) => void;
  editingTransaction?: Transaction | null;
  /** If set, immediately open the receipt/camera section */
  openReceiptMode?: boolean;
}

type OcrState = 'idle' | 'processing' | 'done' | 'error';

export const TransactionModal = ({
  onClose,
  onSave,
  editingTransaction,
  openReceiptMode = false,
}: TransactionModalProps) => {
  const [type, setType]           = useState<TransactionType>(editingTransaction?.type || 'expense');
  const [amount, setAmount]       = useState(editingTransaction?.amount.toString() || '');
  const [category, setCategory]   = useState(editingTransaction?.category || '');
  const [description, setDescription] = useState(editingTransaction?.description || '');
  const [date, setDate]           = useState(editingTransaction?.date || new Date().toISOString().split('T')[0]);
  const [currency, setCurrency]   = useState<CurrencyType>(editingTransaction?.currency || getMonedaBase() as CurrencyType);
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | undefined>(editingTransaction?.receiptImageUrl);
  const [owner, setOwner]         = useState<Owner>(editingTransaction?.owner || getMyOwnerRole());
  const ownerLabels               = useOwnerLabels();

  // OCR state
  const [ocrState, setOcrState]       = useState<OcrState>('idle');
  const [ocrProgress, setOcrProgress] = useState('');
  const [ocrResult, setOcrResult]     = useState<ReceiptExtraction | null>(null);
  const [showReceiptSection, setShowReceiptSection] = useState(openReceiptMode);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [catVersion, setCatVersion] = useState(0);

  // ── Dictado por voz ──────────────────────────────────────────────────────
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const listenerRef = useRef<Listener | null>(null);
  const voiceSupported = isSpeechSupported();

  const applyVoice = (text: string) => {
    const parsed = parseVoiceTransaction(text);
    setHeard(text);
    // Solo se pisan los campos que el dictado logro extraer: si dijo el monto
    // pero no la fecha, la fecha que ya estaba puesta se respeta.
    if (parsed.amount !== null) setAmount(String(parsed.amount));
    if (parsed.description) setDescription(parsed.description);
    if (parsed.categoryId) setCategory(parsed.categoryId);
    if (parsed.date) setDate(parsed.date);
    setType(parsed.type);
    setCurrency(parsed.currency);
    if (parsed.amount === null) {
      setVoiceError('No entendí el monto. Revisá el formulario antes de guardar.');
    }
  };

  const toggleListening = () => {
    if (listening) {
      listenerRef.current?.stop();
      return;
    }
    setVoiceError('');
    setHeard('');
    const listener = listenOnce({
      onPartial: setHeard,
      onResult: applyVoice,
      onError: msg => { setVoiceError(msg); setListening(false); },
      onEnd: () => { setListening(false); listenerRef.current = null; },
    });
    listenerRef.current = listener;
    if (listener) setListening(true);
  };

  // Cortar el microfono si el modal se cierra mientras escucha.
  useEffect(() => () => listenerRef.current?.stop(), []);

  // Auto-category suggestion from description
  const [suggestedCategory, setSuggestedCategory] = useState<string | null>(null);

  const amountRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus amount on open
  useEffect(() => {
    if (!openReceiptMode) {
      setTimeout(() => amountRef.current?.focus(), 50);
    }
  }, [openReceiptMode]);

  // Sync fields when editing
  useEffect(() => {
    if (editingTransaction) {
      setType(editingTransaction.type);
      setAmount(editingTransaction.amount.toString());
      setCategory(editingTransaction.category);
      setDescription(editingTransaction.description);
      setDate(editingTransaction.date);
      setCurrency(editingTransaction.currency || getMonedaBase() as CurrencyType);
      setReceiptImageUrl(editingTransaction.receiptImageUrl);
      setOwner(editingTransaction.owner || getMyOwnerRole());
    }
  }, [editingTransaction]);

  // Auto-suggest category from description
  const handleDescriptionChange = useCallback((value: string) => {
    setDescription(value);
    if (value.length >= 3) {
      const normalized = normalizeDescription(value);
      if (normalized.suggestedCategory) {
        setSuggestedCategory(normalized.suggestedCategory);
        // Auto-select if not yet chosen
        if (!category) setCategory(normalized.suggestedCategory);
      } else {
        setSuggestedCategory(null);
      }
    } else {
      setSuggestedCategory(null);
    }
  }, [category]);

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    setCategory('');
    setSuggestedCategory(null);
  };

  // ── Receipt handling ────────────────────────────────────────────────────

  const processImageFile = useCallback(async (file: File) => {
    // Validate type
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen (JPG, PNG, HEIC, WEBP)');
      return;
    }

    // Read and store base64 (compress if >1MB)
    const dataUrl = await readAndCompressImage(file);
    setReceiptImageUrl(dataUrl);
    setShowReceiptSection(true);

    // Run OCR
    setOcrState('processing');
    setOcrResult(null);
    try {
      const extraction = await extractReceiptData(dataUrl, (msg, pct) => {
        setOcrProgress(`${msg} (${pct.toFixed(0)}%)`);
      });

      setOcrResult(extraction);
      setOcrState('done');

      // Auto-apply if confidence ≥ 50%
      if (extraction.confidence >= 50) {
        applyExtraction(extraction);
      }
    } catch (err) {
      console.error('OCR error', err);
      setOcrState('error');
    }
  }, []);

  const applyExtraction = (extraction: ReceiptExtraction) => {
    if (extraction.amount !== undefined) {
      setAmount(extraction.amount.toFixed(2));
    }
    if (extraction.date) {
      setDate(extraction.date);
    }
    if (extraction.merchant) {
      handleDescriptionChange(extraction.merchant);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
    e.target.value = '';
  };

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) processImageFile(file);
        break;
      }
    }
  }, [processImageFile]);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!amount || !category) return;

    onSave({
      type,
      amount: parseFloat(amount),
      category,
      description,
      date,
      // Al editar hay que CONSERVAR la cuenta y el vínculo con el
      // recurrente. Estaba fijo en 'default' y sourceRecurringId ni se
      // enviaba, así que editar cualquier campo movía la transacción a
      // "Cuenta Principal" y le rompía el enlace con su recurrente, en
      // silencio. Solo una transacción nueva cae en 'default'.
      accountId: editingTransaction?.accountId || 'default',
      ...(editingTransaction?.sourceRecurringId
        ? { sourceRecurringId: editingTransaction.sourceRecurringId }
        : {}),
      currency,
      receiptImageUrl,
      owner,
    });
    onClose();
  };

  // ── Keyboard: Enter on amount field triggers submit if category set ──────
  const handleAmountKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && category) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const categories = useMemo(() => getCategoriesByType(type), [type, catVersion]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal tm-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">
            {editingTransaction ? 'Editar transacción' : 'Nueva transacción'}
          </h2>
          <button className="close-btn" onClick={onClose} title="Cerrar (Esc)"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit}>

          {/* Type toggle */}
          <div className="type-toggle">
            <button type="button" className={`type-btn ${type === 'income' ? 'active income' : ''}`}
              onClick={() => handleTypeChange('income')}>
              💰 Ingreso
            </button>
            <button type="button" className={`type-btn ${type === 'expense' ? 'active expense' : ''}`}
              onClick={() => handleTypeChange('expense')}>
              💸 Gasto
            </button>
          </div>

          {voiceSupported && !editingTransaction && (
            <div className="tm-voice">
              <button
                type="button"
                className={`tm-voice-btn ${listening ? 'listening' : ''}`}
                onClick={toggleListening}
                aria-pressed={listening}
                aria-label={listening ? 'Detener dictado' : 'Dictar movimiento'}
              >
                {listening ? <MicOff size={16} /> : <Mic size={16} />}
                {listening ? 'Escuchando…' : 'Dictar'}
              </button>
              <span className="tm-voice-hint">
                {heard
                  ? `“${heard}”`
                  : voiceError || 'Probá: “gasté 50 soles en almuerzo ayer”'}
              </span>
            </div>
          )}

          {/* Amount + Currency row */}
          <div className="tm-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Monto *</label>
              <input
                ref={amountRef}
                type="number"
                step="0.01"
                min="0"
                className="form-input tm-amount"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                onKeyDown={handleAmountKeyDown}
                required
              />
            </div>
            <div className="form-group" style={{ width: 110, flexShrink: 0 }}>
              <label className="form-label">Moneda</label>
              <select className="form-input" value={currency} onChange={e => setCurrency(e.target.value as CurrencyType)}>
                <option value="PEN">S/ Soles</option>
                <option value="USD">$ USD</option>
                <option value="EUR">€ EUR</option>
              </select>
            </div>
          </div>

          {/* Owner (compartido / yo / pareja) */}
          <div className="form-group">
            <label className="form-label">Pagado por</label>
            <div className="owner-segmented" role="radiogroup" aria-label="Pagado por">
              {OWNER_OPTIONS.map(o => (
                <button
                  key={o}
                  type="button"
                  role="radio"
                  aria-checked={owner === o}
                  className={`owner-segmented-btn owner-${o} ${owner === o ? 'active' : ''}`}
                  onClick={() => setOwner(o)}
                >
                  {ownerLabels[o]}
                </button>
              ))}
            </div>
          </div>

          {/* Description (BEFORE category — enables auto-suggest) */}
          <div className="form-group">
            <label className="form-label">
              Descripción / Comercio
              {suggestedCategory && (
                <span className="tm-suggestion">
                  <Sparkles size={10} />
                  Sugerido: {getCategoryById(suggestedCategory)?.name}
                </span>
              )}
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej: Plaza Vea, Uber, Netflix…"
              value={description}
              onChange={e => handleDescriptionChange(e.target.value)}
              autoComplete="off"
            />
          </div>

          {/* Category */}
          <div className="form-group">
            <label className="form-label">
              Categoría *
              <button
                type="button"
                className="catmgr-link"
                onClick={() => setShowCategoryManager(true)}
                title="Gestionar categorías"
              >
                <Settings2 size={13} />
              </button>
            </label>
            <div className="category-grid">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  className={`category-btn ${category === cat.id ? 'active' : ''} ${suggestedCategory === cat.id && category !== cat.id ? 'suggested' : ''}`}
                  style={{ borderColor: category === cat.id ? cat.color : undefined }}
                  onClick={() => setCategory(cat.id)}
                >
                  <span className="category-icon">{cat.icon}</span>
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {showCategoryManager && (
            <CategoryManager
              onClose={() => setShowCategoryManager(false)}
              onChange={() => setCatVersion(v => v + 1)}
            />
          )}

          {/* Date */}
          <div className="form-group">
            <label className="form-label">Fecha</label>
            <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} required />
          </div>

          {/* ── Receipt section ────────────────────────────────────────── */}
          <div className="tm-receipt-section">
            <button
              type="button"
              className="tm-receipt-toggle"
              onClick={() => setShowReceiptSection(v => !v)}
            >
              <Camera size={14} />
              {receiptImageUrl ? 'Recibo adjunto ✓' : 'Adjuntar recibo'}
              {receiptImageUrl && <span className="tm-receipt-dot" />}
            </button>

            {showReceiptSection && (
              <div className="tm-receipt-body">
                {/* Upload buttons */}
                {!receiptImageUrl && (
                  <div className="tm-receipt-actions">
                    <div className="tm-receipt-buttons">
                      {/* Camera (mobile) */}
                      <button
                        type="button"
                        className="tm-receipt-btn"
                        onClick={() => cameraInputRef.current?.click()}
                      >
                        <Camera size={18} />
                        <span>Cámara</span>
                      </button>
                      {/* File upload */}
                      <button
                        type="button"
                        className="tm-receipt-btn"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload size={18} />
                        <span>Galería</span>
                      </button>
                    </div>
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: 'none' }}
                      onChange={handleFileChange}
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleFileChange}
                    />
                    <p className="tm-receipt-hint">También puedes pegar (Ctrl+V) una imagen</p>
                  </div>
                )}

                {/* Preview */}
                {receiptImageUrl && (
                  <div className="tm-receipt-preview">
                    <img src={receiptImageUrl} alt="Recibo" className="tm-receipt-img" />
                    <button
                      type="button"
                      className="tm-receipt-remove"
                      onClick={() => { setReceiptImageUrl(undefined); setOcrResult(null); setOcrState('idle'); }}
                      title="Quitar recibo"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* OCR status */}
                {ocrState === 'processing' && (
                  <div className="tm-ocr-status processing">
                    <Loader2 size={14} className="tm-spin" />
                    <span>{ocrProgress || 'Extrayendo datos…'}</span>
                  </div>
                )}

                {ocrState === 'error' && (
                  <div className="tm-ocr-status error">
                    <AlertCircle size={14} />
                    <span>No se pudo extraer datos. Completa los campos manualmente.</span>
                  </div>
                )}

                {ocrState === 'done' && ocrResult && (
                  <div className="tm-ocr-result">
                    <div className="tm-ocr-result-header">
                      <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                      <span>Datos extraídos, confianza {ocrResult.confidence}%</span>
                      {ocrResult.confidence < 50 && (
                        <button
                          type="button"
                          className="tm-ocr-apply-btn"
                          onClick={() => applyExtraction(ocrResult)}
                        >
                          Aplicar
                        </button>
                      )}
                    </div>
                    <div className="tm-ocr-fields">
                      {ocrResult.amount !== undefined && (
                        <span className="tm-ocr-field">
                          💰 {ocrResult.amount.toFixed(2)}
                        </span>
                      )}
                      {ocrResult.date && (
                        <span className="tm-ocr-field">
                          📅 {new Date(ocrResult.date).toLocaleDateString('es-PE')}
                        </span>
                      )}
                      {ocrResult.merchant && (
                        <span className="tm-ocr-field">
                          🏪 {ocrResult.merchant}
                        </span>
                      )}
                      {ocrResult.fieldsFound.length === 0 && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          No se detectaron campos automáticamente
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            className={`submit-btn ${type}`}
            disabled={!amount || !category}
          >
            {editingTransaction ? 'Guardar cambios' : 'Guardar transacción'}
            {amount && category && (
              <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', opacity: 0.7 }}>
                Enter ↵
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

// ─── Image compression helper ────────────────────────────────────────────────

async function readAndCompressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      // Compress if >500KB
      if (file.size <= 500 * 1024) {
        resolve(dataUrl);
        return;
      }

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 1024; // max dimension
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else       { w = Math.round(w * MAX / h); h = MAX; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = reject;
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
