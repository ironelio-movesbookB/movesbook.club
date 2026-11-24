'use client';

import { clubApiFetch } from '@/lib/club/servicePurchasesClient';

const PREFIX_MAP: Array<{ prefix: string; procedureType: string }> = [
  { prefix: 'mdin-', procedureType: 'member_debt' },
  { prefix: 'pin-', procedureType: 'product_sale' },
  { prefix: 'out-', procedureType: 'expense' },
  { prefix: 'in-', procedureType: 'service_sale' },
];

export function parseCashMovementId(prefixedId: string): { procedureType: string; paymentId: string } | null {
  const entry = PREFIX_MAP.find(({ prefix }) => prefixedId.startsWith(prefix));
  if (!entry) return null;
  return { procedureType: entry.procedureType, paymentId: prefixedId.slice(entry.prefix.length) };
}

export async function updateCashMovement(
  prefixedId: string,
  input: { paymentDate?: string; notes?: string; operatorId?: string }
): Promise<void> {
  const parsed = parseCashMovementId(prefixedId);
  if (!parsed) throw new Error('Invalid cash movement ID');
  await clubApiFetch(`/api/club/procedures/${parsed.procedureType}/payments/${parsed.paymentId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteCashMovement(prefixedId: string): Promise<void> {
  const parsed = parseCashMovementId(prefixedId);
  if (!parsed) throw new Error('Invalid cash movement ID');
  await clubApiFetch(`/api/club/procedures/${parsed.procedureType}/payments/${parsed.paymentId}`, {
    method: 'DELETE',
  });
}
