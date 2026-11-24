export type SummaryTileId =
  | 'total-members'
  | 'active-members'
  | 'next-appointments'
  | 'payment-overdue'
  | 'present-today'
  | 'name-days'
  | 'birthdays'
  | 'unread-messages';

export type ArchiveSectionId =
  | 'memberships'
  | 'new-members'
  | 'services'
  | 'subscriptions'
  | 'credits'
  | 'deadlines'
  | 'accesses'
  | 'payments'
  | 'sellings'
  | 'audio-messages'
  | 'reservations'
  | 'subscription-stats';

export type SummaryTileDef = {
  id: SummaryTileId;
  label: string;
  color: string;
};

export type ArchiveSectionDef = {
  id: ArchiveSectionId;
  label: string;
  /** Full archive. Opens in place of the dashboard. */
  readAllPath: string;
  chartTitle: string;
  /** Preview list is limited to today. The chart still covers the past 11 months. */
  todayOnly?: boolean;
};

export const SUMMARY_TILES: SummaryTileDef[] = [
  { id: 'total-members', label: 'Total Members', color: '#2f7ed8' },
  { id: 'active-members', label: 'Active Members', color: '#3aaa35' },
  { id: 'next-appointments', label: 'Next appointments', color: '#5aa0d6' },
  { id: 'payment-overdue', label: 'Payment Overdue', color: '#e3534a' },
  { id: 'present-today', label: 'Present Today', color: '#f0a03a' },
  { id: 'name-days', label: 'Day Names', color: '#f39a1a' },
  { id: 'birthdays', label: 'Birth Days', color: '#9b4dca' },
  { id: 'unread-messages', label: 'Messages not read', color: '#8e1d3a' },
];

export const ARCHIVE_SECTIONS: ArchiveSectionDef[] = [
  {
    id: 'memberships',
    label: 'Last memberships',
    readAllPath: '/clubs/memberships/archive',
    chartTitle: 'Memberships of past 11 months',
  },
  {
    id: 'new-members',
    label: 'New members',
    readAllPath: '/clubMembers/memberList?section=athletes&nav=archive',
    chartTitle: 'New members of past 11 months',
  },
  {
    id: 'services',
    label: 'Last services purchased',
    readAllPath: '/clubs/archive_service_list',
    chartTitle: 'Services of past 11 months',
  },
  {
    id: 'subscriptions',
    label: 'Last subscriptions',
    readAllPath: '/clubs/courses/archive',
    chartTitle: 'Subscription of past 11 months',
  },
  {
    id: 'credits',
    label: 'Last addings of credit',
    readAllPath: '/clubMembers/member_credit_list',
    chartTitle: 'Credits of past 11 months',
  },
  {
    id: 'deadlines',
    label: 'Recent deadlines',
    readAllPath: '/clubs/archive_deadlines',
    chartTitle: 'Deadlines of past 11 months',
  },
  {
    id: 'accesses',
    label: 'Accesses of today',
    readAllPath: '/clubs/access_list',
    chartTitle: 'Accesses of past 11 months',
    todayOnly: true,
  },
  {
    id: 'payments',
    label: 'Last payments',
    readAllPath: '/clubs/archive_payments',
    chartTitle: 'Payments of past 11 months',
  },
  {
    id: 'sellings',
    label: 'Last Sellings',
    readAllPath: '/ArchiveSeles/product_sale_list',
    chartTitle: 'Sellings of past 11 months',
  },
  {
    id: 'audio-messages',
    label: 'Audio Messages Posted',
    readAllPath: '/clubs/messages',
    chartTitle: 'Messages of past 11 months',
  },
  {
    id: 'reservations',
    label: 'Reservation of today',
    readAllPath: '/clubs/archive_reservations',
    chartTitle: 'Reservations of past 11 months',
    todayOnly: true,
  },
  {
    id: 'subscription-stats',
    label: 'Monthly subscription statistics',
    readAllPath: '/clubs/courses/archive',
    chartTitle: 'Subscription of past 11 months',
  },
];

export const ARCHIVE_SECTION_IDS = ARCHIVE_SECTIONS.map((section) => section.id);

export const SUMMARY_TILE_IDS = SUMMARY_TILES.map((tile) => tile.id);

export const ROW_COUNT_OPTIONS = [5, 10, 15, 20, 25, 50, 100] as const;

export const DEFAULT_VISIBLE_ROWS = 5;

export const PREVIEW_LIMIT = 100;

export const ALT_ROW_COLORS = [
  '#f3f4f6',
  '#dbeafe',
  '#fef3c7',
  '#dcfce7',
  '#fce7f3',
  '#ffedd5',
  '#fed7aa',
  '#e9d5ff',
  '#ddd6fe',
];

export const DEFAULT_ALT_COLOR = '#f3e6c0';

export function archiveSectionById(id: string): ArchiveSectionDef | undefined {
  return ARCHIVE_SECTIONS.find((section) => section.id === id);
}

export function summaryTileById(id: string): SummaryTileDef | undefined {
  return SUMMARY_TILES.find((tile) => tile.id === id);
}

export function isArchiveSectionId(id: string): id is ArchiveSectionId {
  return (ARCHIVE_SECTION_IDS as string[]).includes(id);
}

export function isSummaryTileId(id: string): id is SummaryTileId {
  return (SUMMARY_TILE_IDS as string[]).includes(id);
}
