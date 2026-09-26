import { FormEvent, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { CurrencyType, Debt } from '../../types';
import { cuotasParaSaldar } from '../../utils/deudas';
import { getMonedaBase } from '../../utils/fx';

interface DebtModalProps {
  editing: Debt | null;
  onClose: () => void;
  onSave: (d: Debt) => void;
}

/**
 * Alta y edicion de una deuda que no es la tarjeta. La TEA se escribe en %
 * --18,5-- y se guarda como fraccion --0.185--, como en el resto de la app.
 */
export function DebtModal({ editing, onClose, onSave }: DebtModalProps) {
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [teaPct, setTeaPct] = useState('');
  const [payment, setPayment] = useState('');
  const [remaining, setRemaining] = useState('');
  const [currency, setCurrency] = useState<CurrencyType>(getMonedaBase());

  useEffect(() => {
    if (!editing) return;
    setName(editing.name);
    setBalance(String(editing.balance));
    setTeaPct(editing.tea > 0 ? String(Math.round(editing.tea * 10000) / 100) : '');
    setPayment(String(editing.monthlyPayment));
    setRemaining(editing.remainingInstallments ? String(editing.remainingInstallments) : '');
    setCurrency(editing.currency || getMonedaBase());
  }, [editing]);

  const saldo = parseFloat(balance);
  const cuota = parseFloat(payment);
  const tea = (parseFloat(teaPct) || 0) / 100;

  // Lo que sale de las tres cifras, en vivo: si la cuota no alcanza para el
  // interes, mejor saberlo ahora que al ver un plan que no termina nunca.
  const cuotas = saldo > 0 && cuota > 0 ? cuotasParaSaldar(saldo, tea, cuota) : null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !(saldo > 0) || !(cuota >= 0)) return;
    const restantes = parseInt(remaining, 10);
    onSave({
      id: editing?.id || Date.now().toString(),
      name: name.trim(),
      balance: saldo,
      tea: tea > 0 ? tea : 0,
      monthlyPayment: cuota,
      ...(restantes >= 1 ? { remainingInstallments: restantes } : {}),
      currency,
      ...(editing?.isActive === false ? { isActive: false } : {}),
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h2 className="modal-title">{editing ? 'Editar deuda' : 'Nueva deuda'}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '0 1.25rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <div>
            <label className="form-label" htmlFor="debt-name">Nombre</label>
            <input
              id="debt-name"
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Préstamo del auto"
              required
              autoFocus
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="form-label" htmlFor="debt-balance">Lo que falta pagar</label>
              <input
                id="debt-balance"
                className="form-input"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                value={balance}
                onChange={e => setBalance(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="form-label" htmlFor="debt-payment">Cuota mensual</label>
              <input
                id="debt-payment"
                className="form-input"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={payment}
                onChange={e => setPayment(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="form-label" htmlFor="debt-tea">TEA (%)</label>
              <input
                id="debt-tea"
                className="form-input"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={teaPct}
                onChange={e => setTeaPct(e.target.value)}
                placeholder="0 si no cobra interés"
              />
            </div>
            <div>
              <label className="form-label" htmlFor="debt-remaining">Cuotas que faltan</label>
              <input
                id="debt-remaining"
                className="form-input"
                type="number"
                inputMode="numeric"
                step="1"
                min="1"
                value={remaining}
                onChange={e => setRemaining(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          {cuotas !== null && (
            <div
              role="status"
              style={{
                fontSize: '0.8rem',
                color: Number.isFinite(cuotas) ? 'var(--text-muted)' : 'var(--rec-danger, #ef4444)',
              }}
            >
              {Number.isFinite(cuotas)
                ? `Con esa cuota se salda en ${cuotas} ${cuotas === 1 ? 'cuota' : 'cuotas'}.`
                : 'La cuota no cubre ni el interés del mes: esta deuda crece en vez de bajar.'}
            </div>
          )}

          <div>
            <label className="form-label" htmlFor="debt-currency">Moneda</label>
            <select
              id="debt-currency"
              className="form-input"
              value={currency}
              onChange={e => setCurrency(e.target.value as CurrencyType)}
            >
              <option value="PEN">S/ Soles</option>
              <option value="USD">$ Dólares</option>
              <option value="EUR">€ Euros</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary">{editing ? 'Guardar' : 'Agregar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
