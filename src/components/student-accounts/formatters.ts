import { getCurrencySymbol } from '../../lib/currency';

export const BALANCE_COLORS = {
  owing: '#dc2626',
  paid: '#10B981',
  neutral: '#059669',
};

export function getBalanceColor(cents: number): string {
  if (cents > 0) return BALANCE_COLORS.owing;
  if (cents < 0) return BALANCE_COLORS.paid;
  return BALANCE_COLORS.neutral;
}

export function formatCurrencyCents(cents: number): string {
  const prefix = cents === 0 ? '' : cents > 0 ? '-' : '+';
  return `${prefix}${getCurrencySymbol()}${Math.abs(cents / 100).toFixed(2)}`;
}
