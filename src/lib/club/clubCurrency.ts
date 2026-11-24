/** Club / team money formatting (client + server safe). */

export const DEFAULT_CLUB_CURRENCY = 'EUR';

export function normalizeCurrencyCode(code: string | null | undefined): string {
  const value = String(code ?? '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(value)) return DEFAULT_CLUB_CURRENCY;
  try {
    new Intl.NumberFormat('en', { style: 'currency', currency: value });
    return value;
  } catch {
    return DEFAULT_CLUB_CURRENCY;
  }
}

/** e.g. 30,00 € / 30,00 US$ (Italian number format, like the rest of the club pages). */
export function formatClubMoney(value: number, currency: string | null | undefined = DEFAULT_CLUB_CURRENCY): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: normalizeCurrencyCode(currency) }).format(
    Number(value) || 0,
  );
}
