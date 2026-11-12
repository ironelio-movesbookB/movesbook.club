import { listPaymentModeLabel, rowPaymentMode } from '@/lib/admin/listPaymentFilters';

/** Columns of the admin payments list that can be sorted (header "V" markers). */
export const LIST_SORT_KEYS = [
  'fullName',
  'country',
  'location',
  'dateStart',
  'dateEnd',
  'versionType',
  'version',
  'paymentFor',
  'payMode',
  'username',
  'companyName',
] as const;

export type ListSortKey = (typeof LIST_SORT_KEYS)[number];
export type ListSortDir = 'asc' | 'desc';

export function parseListSortKey(raw: string | null): ListSortKey | null {
  return raw && (LIST_SORT_KEYS as readonly string[]).includes(raw) ? (raw as ListSortKey) : null;
}

export function parseListSortDir(raw: string | null): ListSortDir {
  return raw === 'desc' ? 'desc' : 'asc';
}

type SortableListRow = {
  displayName?: string;
  country?: string | null;
  location?: string | null;
  dateStart?: string | null;
  dateEnd?: string | null;
  versionType?: string | null;
  version?: string | null;
  username?: string;
  companyName?: string | null;
  paymentMethod?: string;
  amountEur?: number;
};

function sortValue(row: SortableListRow, key: ListSortKey): string {
  switch (key) {
    case 'fullName':
      return row.displayName ?? '';
    case 'country':
      return row.country ?? '';
    case 'location':
      return row.location ?? '';
    case 'dateStart':
      return row.dateStart ?? '';
    case 'dateEnd':
      return row.dateEnd ?? '';
    case 'versionType':
      return row.versionType ?? '';
    case 'version':
      return row.version ?? '';
    case 'paymentFor':
      // Every recorded payment is currently a Subscription Desk membership.
      return 'Subscription Desk';
    case 'payMode':
      return rowPaymentMode(row) ? listPaymentModeLabel(rowPaymentMode(row)) : '';
    case 'username':
      return row.username ?? '';
    case 'companyName':
      return row.companyName ?? '';
  }
}

/**
 * Sorts the whole filtered list (before paging). Text is compared alphabetically, ISO dates
 * ("YYYY-MM-DD") chronologically; empty values always go last.
 */
export function sortListRows<T extends SortableListRow>(rows: T[], key: ListSortKey, dir: ListSortDir): T[] {
  const factor = dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const va = sortValue(a, key).trim();
    const vb = sortValue(b, key).trim();
    const emptyA = !va || va === '—';
    const emptyB = !vb || vb === '—';
    if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1;
    return factor * va.localeCompare(vb, undefined, { numeric: true, sensitivity: 'base' });
  });
}
