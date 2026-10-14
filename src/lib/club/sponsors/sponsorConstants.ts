/** Shared by the club/team Sponsor pages, APIs and the public pages (client-safe). */

export const SPONSOR_SECTIONS = [
  { key: 'online_registrations', label: 'Online registrations' },
  { key: 'medical_visit', label: 'Medical visit booking' },
  { key: 'shared_calendar', label: 'Shared calendar' },
  { key: 'online_payments', label: 'Online payments' },
  { key: 'events_page', label: 'Events page' },
  { key: 'fee_payments', label: 'Fee payments' },
  { key: 'members_app', label: 'Members app' },
  { key: 'online_shop', label: 'Online shop' },
  { key: 'email_medical_expiry', label: 'Email: medical certificate expiry' },
  { key: 'email_payment_reminder', label: 'Email: payment reminders' },
  { key: 'email_membership_reminder', label: 'Email: membership reminder' },
] as const;

export type SponsorSectionKey = (typeof SPONSOR_SECTIONS)[number]['key'];
export type SponsorMediaKind = 'logo' | 'banner';
export type SponsorPlacements = Partial<Record<SponsorSectionKey, SponsorMediaKind>>;

export type SponsorContractStatus = 'active' | 'expiring' | 'expired' | 'future' | 'none';
export type SponsorPaymentsStatus = 'paid' | 'pending' | 'overdue' | 'none';

export const SPONSOR_EXPIRING_DAYS = 60;
export const SPONSOR_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const SPONSOR_MAX_PDF_BYTES = 15 * 1024 * 1024;
export const SPONSOR_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'] as const;

export type SponsorContract = {
  id: string;
  startDate: string;
  endDate: string;
  value: number;
  reminderDays: number;
  notes: string;
  pdfName: string | null;
  pdfUrl: string | null;
  createdAt: string;
};

export type SponsorPayment = {
  id: string;
  amount: number;
  dueDate: string;
  reminderDays: number;
  note: string;
  paidAt: string | null;
  createdAt: string;
};

export type SponsorProfile = {
  name: string;
  visible: boolean;
  landingUrl: string;
  businessName: string;
  vatCode: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
};

export type Sponsor = SponsorProfile & {
  id: string;
  bannerUrl: string | null;
  logoUrl: string | null;
  placements: SponsorPlacements;
  contracts: SponsorContract[];
  payments: SponsorPayment[];
  contractStatus: SponsorContractStatus;
  paymentsStatus: SponsorPaymentsStatus;
  currentContract: SponsorContract | null;
  createdAt: string;
  updatedAt: string;
};

export type SponsorListItem = {
  id: string;
  name: string;
  visible: boolean;
  logoUrl: string | null;
  businessName: string;
  currentContract: SponsorContract | null;
  contractStatus: SponsorContractStatus;
  paymentsStatus: SponsorPaymentsStatus;
  activeSections: SponsorSectionKey[];
  paidTotal: number;
  dueTotal: number;
};

export type SponsorListSummary = {
  contractsValue: number;
  collected: number;
  expiringSoon: number;
};

export type SponsorStats = {
  from: string;
  to: string;
  views: number;
  clicks: number;
  ctr: number;
  activeSources: number;
  bySection: Array<{ section: string; views: number; clicks: number }>;
};

export const CONTRACT_STATUS_LABELS: Record<SponsorContractStatus, string> = {
  active: 'Active',
  expiring: 'Expiring',
  expired: 'Expired',
  future: 'Starts later',
  none: 'No contract',
};

export const PAYMENTS_STATUS_LABELS: Record<SponsorPaymentsStatus, string> = {
  paid: 'All paid',
  pending: 'Pending',
  overdue: 'Overdue',
  none: 'No payments',
};

export function isSponsorSectionKey(value: unknown): value is SponsorSectionKey {
  return SPONSOR_SECTIONS.some((s) => s.key === value);
}

export function formatSponsorEuro(value: number): string {
  return `€ ${value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function todayYmd(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  return todayYmd(dt);
}

/** Status of the current (latest-starting) contract. */
export function contractStatusOf(contract: SponsorContract | null, today = todayYmd()): SponsorContractStatus {
  if (!contract) return 'none';
  if (contract.startDate > today) return 'future';
  if (contract.endDate < today) return 'expired';
  if (contract.endDate <= addDaysYmd(today, SPONSOR_EXPIRING_DAYS)) return 'expiring';
  return 'active';
}

export function paymentsStatusOf(payments: SponsorPayment[], today = todayYmd()): SponsorPaymentsStatus {
  if (payments.length === 0) return 'none';
  const unpaid = payments.filter((p) => !p.paidAt);
  if (unpaid.length === 0) return 'paid';
  return unpaid.some((p) => p.dueDate < today) ? 'overdue' : 'pending';
}

/** Contract in force today, else the next one, else the most recent. */
export function pickCurrentContract(contracts: SponsorContract[], today = todayYmd()): SponsorContract | null {
  if (contracts.length === 0) return null;
  const sorted = [...contracts].sort((a, b) => b.startDate.localeCompare(a.startDate));
  return (
    sorted.find((c) => c.startDate <= today && c.endDate >= today) ??
    [...sorted].reverse().find((c) => c.startDate > today) ??
    sorted[0]
  );
}
