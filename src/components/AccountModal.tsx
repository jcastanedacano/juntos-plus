import { useState, useEffect, FormEvent } from 'react';
import { Account, AccountType } from '../types';
import { X } from 'lucide-react';

interface AccountModalProps {
  onClose: () => void;
  onSave: (account: Account) => void;
  editingAccount?: Account | null;
}

const ICONS = ['💳', '🏦', '💰', '🏧', '💵', '🪙', '📱', '🔒'];
const COLORS = ['#00D1B2', '#6C8EEF', '#F59E0B', '#FF6B81', '#A78BFA', '#EC4899', '#14B8A6', '#8B5CF6'];

export const AccountModal = ({ onClose, onSave, editingAccount }: AccountModalProps) => {
  const [name, setName] = useState('');
  const [bank, setBank] = useState('');
  const [lastFour, setLastFour] = useState('');
  const [type, setType] = useState<AccountType>('debit');
  const [balance, setBalance] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [closeDay, setCloseDay] = useState('');
  const [payDay, setPayDay] = useState('');
  const [icon, setIcon] = useState('💳');
  const [color, setColor] = useState('#00D1B2');

  useEffect(() => {
    if (editingAccount) {
      setName(editingAccount.name);
      setBank(editingAccount.bank || '');
      setLastFour(editingAccount.lastFourDigits || '');
      setType(editingAccount.type || 'debit');
      setBalance(editingAccount.balance.toString());
      setCreditLimit(editingAccount.creditLimit?.toString() || '');
      setCloseDay(editingAccount.statementCloseDay?.toString() || '');
      setPayDay(editingAccount.paymentDueDay?.toString() || '');
      setIcon(editingAccount.icon);
      setColor(editingAccount.color);
    }
  }, [editingAccount]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const account: Account = {
      id: editingAccount?.id || '',
      name,
      bank: bank || undefined,
      lastFourDigits: lastFour || undefined,
      type,
      balance: parseFloat(balance) || 0,
      creditLimit: type === 'credit' ? (parseFloat(creditLimit) || 0) : undefined,
      statementCloseDay: type === 'credit' && closeDay ? parseInt(closeDay) : undefined,
      paymentDueDay: type === 'credit' && payDay ? parseInt(payDay) : undefined,
      icon,
      color,
    };
    onSave(account);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h3 className="modal-title">{editingAccount ? 'Editar Cuenta' : 'Nueva Cuenta'}</h3>
          <button className="close-btn" onClick={onClose} title="Cerrar (Esc)" aria-label="Cerrar"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Type */}
          <div className="form-group">
            <label className="form-label" id="acct-type-label">Tipo de cuenta</label>
            <div role="group" aria-labelledby="acct-type-label" style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className={`acct-type-btn ${type === 'debit' ? 'acct-type-btn--active' : ''}`}
                aria-pressed={type === 'debit'}
                onClick={() => setType('debit')}>
                🏦 Débito / Ahorros
              </button>
              <button type="button" className={`acct-type-btn ${type === 'credit' ? 'acct-type-btn--active' : ''}`}
                aria-pressed={type === 'credit'}
                onClick={() => setType('credit')}>
                💳 Crédito
              </button>
            </div>
          </div>

          {/* Name + Bank */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="acct-name">Nombre</label>
              <input id="acct-name" className="form-input" type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder={type === 'debit' ? 'Cuenta Ahorros' : 'Visa Platinum'} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="acct-bank">Banco</label>
              <input id="acct-bank" className="form-input" type="text" value={bank} onChange={e => setBank(e.target.value)}
                placeholder="BCP, Interbank..." />
            </div>
          </div>

          {/* Last 4 + Balance */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="acct-last4">Últimos 4 dígitos</label>
              <input id="acct-last4" className="form-input" type="text" inputMode="numeric" value={lastFour} onChange={e => setLastFour(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="4521" maxLength={4} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="acct-balance">{type === 'credit' ? 'Saldo usado' : 'Saldo actual'}</label>
              <input id="acct-balance" className="form-input" type="number" inputMode="decimal" step="0.01" value={balance} onChange={e => setBalance(e.target.value)}
                placeholder="0.00" required />
            </div>
          </div>

          {/* Credit-specific fields */}
          {type === 'credit' && (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="acct-credit-limit">Línea de crédito</label>
                <input id="acct-credit-limit" className="form-input" type="number" inputMode="decimal" step="0.01" value={creditLimit} onChange={e => setCreditLimit(e.target.value)}
                  placeholder="10000.00" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="acct-close-day">Día de corte</label>
                  <input id="acct-close-day" className="form-input" type="number" inputMode="numeric" min="1" max="31" value={closeDay} onChange={e => setCloseDay(e.target.value)}
                    placeholder="15" />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="acct-pay-day">Día de pago</label>
                  <input id="acct-pay-day" className="form-input" type="number" inputMode="numeric" min="1" max="31" value={payDay} onChange={e => setPayDay(e.target.value)}
                    placeholder="5" />
                </div>
              </div>
            </>
          )}

          {/* Icon + Color */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label" id="acct-icon-label">Icono</label>
              <div role="group" aria-labelledby="acct-icon-label" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {ICONS.map(i => (
                  <button key={i} type="button"
                    aria-label={`Icono ${i}`}
                    aria-pressed={icon === i}
                    style={{ fontSize: '1.25rem', padding: '6px', border: icon === i ? '2px solid var(--accent-green)' : '2px solid transparent', borderRadius: '8px', background: 'var(--bg-elevated)', cursor: 'pointer', transition: 'transform 160ms cubic-bezier(0.23,1,0.32,1)' }}
                    onClick={() => setIcon(i)}>{i}</button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" id="acct-color-label">Color</label>
              <div role="group" aria-labelledby="acct-color-label" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {COLORS.map(c => (
                  <button key={c} type="button"
                    aria-label={`Color ${c}`}
                    aria-pressed={color === c}
                    style={{ width: '28px', height: '28px', borderRadius: '50%', background: c, border: color === c ? '3px solid white' : '3px solid transparent', cursor: 'pointer', transition: 'transform 160ms cubic-bezier(0.23,1,0.32,1)' }}
                    onClick={() => setColor(c)} />
                ))}
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={!name}>
              {editingAccount ? 'Guardar' : 'Crear Cuenta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
