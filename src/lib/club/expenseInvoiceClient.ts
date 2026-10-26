'use client';

import { getAuthHeaders, withSelectedClubId } from '@/lib/club/servicePurchasesClient';
import type { ExpenseInvoiceImage } from '@/lib/procedures/types';

async function sendInvoiceRequest(
  recordId: string,
  method: 'POST' | 'DELETE',
  body?: FormData
): Promise<{ invoice: ExpenseInvoiceImage | null }> {
  const headers = new Headers(getAuthHeaders());
  headers.delete('Content-Type');

  const response = await fetch(
    withSelectedClubId(
      `/api/club/procedures/expense/records/${encodeURIComponent(recordId)}/invoice`
    ),
    { method, headers, ...(body ? { body } : {}) }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data.error === 'string' ? data.error : `Invoice request failed (${response.status})`
    );
  }
  return { invoice: data.invoice ?? null };
}

export function uploadExpenseInvoice(
  recordId: string,
  file: File
): Promise<{ invoice: ExpenseInvoiceImage | null }> {
  const body = new FormData();
  body.append('file', file);
  return sendInvoiceRequest(recordId, 'POST', body);
}

export function removeExpenseInvoice(
  recordId: string
): Promise<{ invoice: ExpenseInvoiceImage | null }> {
  return sendInvoiceRequest(recordId, 'DELETE');
}

export async function fetchExpenseInvoicePreview(recordId: string): Promise<string> {
  const headers = new Headers(getAuthHeaders());
  headers.delete('Content-Type');
  const response = await fetch(
    withSelectedClubId(
      `/api/club/procedures/expense/records/${encodeURIComponent(recordId)}/invoice`
    ),
    { headers }
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      typeof data.error === 'string' ? data.error : `Invoice preview failed (${response.status})`
    );
  }
  return URL.createObjectURL(await response.blob());
}
