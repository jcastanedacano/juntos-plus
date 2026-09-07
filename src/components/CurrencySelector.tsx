interface CurrencySelectorProps {
  currency: string;
  onCurrencyChange: (currency: string) => void;
}

export const CurrencySelector = ({ currency, onCurrencyChange }: CurrencySelectorProps) => {
  const currencies = [
    { code: 'PEN', label: 'S/', name: 'Soles' },
    { code: 'USD', label: '$', name: 'Dólares' },
    { code: 'EUR', label: '€', name: 'Euros' },
  ];

  return (
    <div className="currency-selector">
      <select
        value={currency}
        onChange={(e) => onCurrencyChange(e.target.value)}
        className="currency-select"
      >
        {currencies.map((curr) => (
          <option key={curr.code} value={curr.code}>
            {curr.label} {curr.name}
          </option>
        ))}
      </select>
    </div>
  );
};
