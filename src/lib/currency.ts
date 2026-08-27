import { db } from './db-client';

const currencies = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'ZMW', symbol: 'K', name: 'Zambian Kwacha' },
  { code: 'ZIG', symbol: 'Z', name: 'Zig' },
  { code: 'BWP', symbol: 'P', name: 'Pula' },
  { code: 'MZN', symbol: 'M', name: 'Meticash' },
  { code: 'SZL', symbol: 'E', name: 'Elangini' },
  { code: 'LSL', symbol: 'L', name: 'Lesotho Loti' },
];

let cachedCurrency: string = 'USD';
let currencyPromise: Promise<string> | null = null;

export function getCurrencySymbol(): string {
  const currency = currencies.find(c => c.code === cachedCurrency);
  return currency?.symbol || '$';
}

export function formatCurrency(cents: number): string {
  const symbol = getCurrencySymbol();
  return `${symbol}${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getCurrencyCode(): string {
  return cachedCurrency || 'USD';
}

export function getCurrencies() {
  return currencies;
}

export async function loadCurrency(): Promise<string> {
  if (cachedCurrency && cachedCurrency !== 'USD') return cachedCurrency;
  if (currencyPromise) return currencyPromise;

  currencyPromise = (async (): Promise<string> => {
    try {
      const setting = await db.get("SELECT value FROM app_settings WHERE key = 'school_currency'");
      cachedCurrency = setting?.value || 'USD';
      return cachedCurrency;
    } catch {
      cachedCurrency = 'USD';
      return 'USD';
    }
  })();

  return currencyPromise;
}

export async function setCurrency(code: string): Promise<void> {
  cachedCurrency = code;
  await db.run(
    "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('school_currency', ?)",
    [code]
  );
}
