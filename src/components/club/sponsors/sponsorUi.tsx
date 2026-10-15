'use client';

import {
  CONTRACT_STATUS_LABELS,
  PAYMENTS_STATUS_LABELS,
  type SponsorContractStatus,
  type SponsorPaymentsStatus,
} from '@/lib/club/sponsors/sponsorConstants';

const CONTRACT_TONES: Record<SponsorContractStatus, string> = {
  active: 'bg-green-100 text-green-800',
  expiring: 'bg-amber-100 text-amber-800',
  expired: 'bg-red-100 text-red-800',
  future: 'bg-blue-100 text-blue-800',
  none: 'bg-gray-100 text-gray-600',
};

const PAYMENT_TONES: Record<SponsorPaymentsStatus, string> = {
  paid: 'bg-green-100 text-green-800',
  pending: 'bg-blue-100 text-blue-800',
  overdue: 'bg-red-100 text-red-800',
  none: 'bg-gray-100 text-gray-600',
};

export function ContractStatusBadge({ status }: { status: SponsorContractStatus }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${CONTRACT_TONES[status]}`}>
      {CONTRACT_STATUS_LABELS[status]}
    </span>
  );
}

export function PaymentsStatusBadge({ status }: { status: SponsorPaymentsStatus }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${PAYMENT_TONES[status]}`}>
      {PAYMENTS_STATUS_LABELS[status]}
    </span>
  );
}

export function formatYmd(ymd: string | null | undefined): string {
  if (!ymd) return '—';
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

export const inputClass =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

export const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600';

export const primaryButton =
  'rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50';

export const secondaryButton =
  'rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50';

export const dangerButton =
  'rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50';
