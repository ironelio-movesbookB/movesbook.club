import type { RegisteredUserListRow } from '@/lib/admin/expandRegisteredUserListRows';

export type ListPaymentStatus = 'paid' | 'unpaid' | 'test';
export type ListPaymentMode = 'stripe' | 'paypal' | 'promocode' | 'manual' | 'free' | 'test' | 'pending';

export const LIST_PAYMENT_STATUS_OPTIONS: { value: ListPaymentStatus; label: string }[] = [
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'test', label: 'Test' },
];

export const LIST_PAYMENT_MODE_OPTIONS: { value: ListPaymentMode; label: string }[] = [
  { value: 'stripe', label: 'Stripe' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'promocode', label: 'Promocode' },
  { value: 'manual', label: 'Manual (admin)' },
  { value: 'free', label: 'Free' },
  { value: 'test', label: 'Test' },
  { value: 'pending', label: 'Pending payment' },
];

export function parseListPaymentStatus(raw: string | null | undefined): ListPaymentStatus | null {
  const v = (raw ?? '').trim();
  return LIST_PAYMENT_STATUS_OPTIONS.some((o) => o.value === v) ? (v as ListPaymentStatus) : null;
}

export function parseListPaymentMode(raw: string | null | undefined): ListPaymentMode | null {
  const v = (raw ?? '').trim();
  return LIST_PAYMENT_MODE_OPTIONS.some((o) => o.value === v) ? (v as ListPaymentMode) : null;
}

/** How the membership of a grid row was paid; null when nothing is recorded. */
export function rowPaymentMode(row: RegisteredUserListRow): ListPaymentMode | null {
  const method = row.paymentMethod?.trim().toLowerCase() ?? '';
  if (method === 'stripe' || method === 'paypal' || method === 'free' || method === 'test' || method === 'pending') {
    return method;
  }
  if (method === 'virtual_card' || method.includes('promo')) return 'promocode';
  return (row.amountEur ?? 0) > 0 ? 'manual' : null;
}

export function rowPaymentStatus(row: RegisteredUserListRow): ListPaymentStatus {
  const mode = rowPaymentMode(row);
  if (mode === 'test') return 'test';
  if (mode === 'free' || mode === 'pending' || !((row.amountEur ?? 0) > 0)) return 'unpaid';
  return 'paid';
}

export function filterListRowsByPayment(
  rows: RegisteredUserListRow[],
  status: ListPaymentStatus | null,
  mode: ListPaymentMode | null,
): RegisteredUserListRow[] {
  if (!status && !mode) return rows;
  return rows.filter(
    (row) => (!status || rowPaymentStatus(row) === status) && (!mode || rowPaymentMode(row) === mode),
  );
}

/** Paid memberships in the grid; a period shown under several entity rows is counted once. */
export function summarizeListPayments(rows: RegisteredUserListRow[]): { count: number; totalEur: number } {
  const seen = new Set<string>();
  let count = 0;
  let totalCents = 0;
  for (const row of rows) {
    if (rowPaymentStatus(row) !== 'paid') continue;
    const periodMarker = row.rowKey.indexOf('-period-');
    const key = periodMarker >= 0 ? `${row.id}::${row.rowKey.slice(periodMarker)}` : row.rowKey;
    if (seen.has(key)) continue;
    seen.add(key);
    count += 1;
    totalCents += Math.round((row.amountEur ?? 0) * 100);
  }
  return { count, totalEur: totalCents / 100 };
}
