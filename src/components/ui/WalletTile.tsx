import { Account, CurrencyType } from '../../types';
import { localeActual } from '../../utils/fxTasas';

interface WalletTileProps {
  account: Account;
  currency?: CurrencyType;
  onClick?: () => void;
  isActive?: boolean;
}

const currencyFlags: Record<string, string> = {
  PEN: '🇵🇪',
  USD: '🇺🇸',
  EUR: '🇪🇺'
};

const currencySymbols: Record<string, string> = {
  PEN: 'S/',
  USD: '$',
  EUR: '€'
};

export function WalletTile({ account, currency = 'PEN', onClick, isActive }: WalletTileProps) {
  const formatBalance = (balance: number) => {
    const symbol = currencySymbols[currency] || 'S/';
    return `${symbol} ${balance.toLocaleString(localeActual(), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  return (
    <div
      className={`wallet-tile ${isActive ? 'active' : ''}`}
      onClick={onClick}
      style={{ borderColor: isActive ? account.color : undefined }}
    >
      <div className="wallet-tile-header">
        <span className="wallet-tile-icon">{account.icon}</span>
        <span className="wallet-tile-name">{account.name}</span>
      </div>
      <div className="wallet-tile-balance">
        {formatBalance(account.balance)}
      </div>
    </div>
  );
}
