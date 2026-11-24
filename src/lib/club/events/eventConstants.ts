/** Club / team internal events (subscribe / pay). Client-safe constants. */
import { formatClubMoney } from '@/lib/club/clubCurrency';

export const CLUB_EVENT_TYPES = [
  'Show',
  'Tournament',
  'Competition',
  'Event',
  'Summer Camp',
  'Festival',
] as const;

export type ClubEventType = (typeof CLUB_EVENT_TYPES)[number];

export const CLUB_EVENT_SUBSCRIBER_TYPES = ['Singles', 'Groups', 'Teams'] as const;
export type ClubEventSubscriberType = (typeof CLUB_EVENT_SUBSCRIBER_TYPES)[number];

export type ClubEventWorkspace = { kind: 'club' | 'team'; id: string };

export type ClubEventExtraText = {
  id: string;
  label: string;
  mandatory: boolean;
  enabled: boolean;
  sortOrder: number;
  /** Subscriber must attach a file for this text (see EVENT_TEXT_FILE_EXTENSIONS). */
  fileUploadEnabled: boolean;
  fileUploadLabel: string;
};

/** Formats accepted for files attached to an additional text. */
export const EVENT_TEXT_FILE_EXTENSIONS = ['txt', 'doc', 'docx', 'xls', 'xlsx', 'pdf', 'jpg', 'jpeg', 'png'] as const;
export const EVENT_TEXT_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const EVENT_TEXT_FILE_ACCEPT = EVENT_TEXT_FILE_EXTENSIONS.map((e) => `.${e}`).join(',');

export type ClubEventService = {
  id: string;
  name: string;
  price: number;
  sortOrder: number;
};

export type ClubEventSubevent = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  cost: number;
  seats: number;
  registered: number;
  /** When true, can be selected together with the whole main event. */
  externalToMain: boolean;
  sortOrder: number;
  /** Key of EVENT_SUBEVENT_TEXT_COLORS ('' = default). */
  textColor: string;
};

/** Colors for a sub-event name in the subscription form. */
export const EVENT_SUBEVENT_TEXT_COLORS: Array<{ key: string; label: string; hex: string }> = [
  { key: 'red', label: 'Red', hex: '#dc2626' },
  { key: 'orange', label: 'Orange', hex: '#ea580c' },
  { key: 'green', label: 'Green', hex: '#15803d' },
  { key: 'blue', label: 'Blue', hex: '#1d4ed8' },
  { key: 'purple', label: 'Purple', hex: '#7e22ce' },
  { key: 'pink', label: 'Pink', hex: '#db2777' },
  { key: 'grey', label: 'Grey', hex: '#4b5563' },
];

export function subeventTextColorHex(key: string | null | undefined): string | undefined {
  return EVENT_SUBEVENT_TEXT_COLORS.find((c) => c.key === key)?.hex;
}

/** Event attachments (Privacy & attachments): formats and size. */
export const EVENT_ATTACHMENT_EXTENSIONS = [
  'doc',
  'docx',
  'jpg',
  'jpeg',
  'png',
  'pdf',
  'txt',
  'rtf',
  'xls',
  'xlsx',
  'mp4',
] as const;
export const EVENT_ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024;
export const EVENT_ATTACHMENT_ACCEPT = EVENT_ATTACHMENT_EXTENSIONS.map((e) => `.${e}`).join(',');

/** Days after the end date before "Remove expired after 15 days" removes an event. */
export const EVENT_AUTO_REMOVE_DAYS = 15;

export type ClubEventSiblingDiscount = {
  enabled: boolean;
  percent: number;
  /** When false, only members can claim the relative discount. */
  applyToNonMembers: boolean;
};

/** How subscribers pay the event (D by default). */
export const EVENT_PAYMENT_MODALITIES = [
  { value: 'A', label: 'A — No payment' },
  { value: 'B', label: 'B — Payment only at the club' },
  { value: 'C', label: 'C — Payment only online' },
  { value: 'D', label: 'D — Payment at the club or online' },
  { value: 'E', label: 'E — Subscribe online and pay now or later' },
] as const;
export type EventPaymentModality = (typeof EVENT_PAYMENT_MODALITIES)[number]['value'];
export const DEFAULT_EVENT_PAYMENT_MODALITY: EventPaymentModality = 'D';

export function normalizePaymentModality(value: unknown): EventPaymentModality {
  const v = String(value ?? '').trim().toUpperCase();
  return (EVENT_PAYMENT_MODALITIES.some((m) => m.value === v) ? v : DEFAULT_EVENT_PAYMENT_MODALITY) as EventPaymentModality;
}

/** online = pay now online, club = pay at the club, later = pay online later with the emailed link. */
export type EventPayChoice = 'online' | 'club' | 'later';

export const EVENT_PAY_CHOICE_LABELS: Record<EventPayChoice, string> = {
  online: 'Pay online now',
  club: 'Pay at the club',
  later: 'Pay online later (we email you the payment link)',
};

export function payChoicesFor(modality: EventPaymentModality): EventPayChoice[] {
  switch (modality) {
    case 'A':
      return [];
    case 'B':
      return ['club'];
    case 'C':
      return ['online'];
    case 'E':
      return ['online', 'later'];
    default:
      return ['online', 'club'];
  }
}

export type ClubEventProfile = {
  name: string;
  eventType: ClubEventType;
  startDate: string;
  endDate: string;
  /** Last day users can subscribe (defaults to endDate). */
  subscriptionCloseDate: string;
  cost: number;
  seats: number;
  /** 0 = unlimited */
  allowSubevents: boolean;
  hideFromShare: boolean;
  allowMultiSubeventSelect: boolean;
  subscriberType: ClubEventSubscriberType;
  membersOnly: boolean;
  openToNonMembers: boolean;
  confirmationText: string;
  city: string;
  zip: string;
  address: string;
  province: string;
  description: string;
  bannerUrl: string;
  coverUrl: string | null;
  sponsorId: string;
  privacyText: string;
  photoVideoText: string;
  attachment1Name: string;
  attachment1Url: string | null;
  attachment2Name: string;
  attachment2Url: string | null;
  fileUploadEnabled: boolean;
  fileUploadLabel: string;
  siblingDiscount: ClubEventSiblingDiscount;
  paymentModality: EventPaymentModality;
};

export type ClubEventListItem = {
  id: string;
  name: string;
  location: string;
  startDate: string;
  endDate: string;
  subscriptionCloseDate: string;
  eventType: string;
  subeventCount: number;
  cost: number;
  seats: number;
  registered: number;
  coverUrl: string | null;
  publicToken: string;
  /** Club / team currency (owner country), EUR by default. */
  currency?: string;
};

/** Public “View all events” card (includes frame / discover-more fields). */
export type ClubEventPublicCard = ClubEventListItem & {
  description: string;
  bannerUrl: string;
  subevents: Array<{ id: string; name: string; startDate: string; endDate: string; cost: number }>;
};

export type EventAvailability = {
  /** Seats left (null = unlimited). */
  seatsLeft: number | null;
  full: boolean;
  expired: boolean;
  closed: boolean;
  /** Red bold message shown when subscriptions are not possible ('' = open). */
  blockMessage: string;
};

/** Seats / end date / closing date status (end date expired when it is before today). */
export function eventAvailability(
  e: Pick<ClubEventListItem, 'seats' | 'registered' | 'endDate' | 'subscriptionCloseDate'>,
  today = todayYmd(),
): EventAvailability {
  const seatsLeft = e.seats > 0 ? Math.max(0, e.seats - e.registered) : null;
  const full = seatsLeft === 0;
  const expired = Boolean(e.endDate) && e.endDate < today;
  const closed = !expired && Boolean(e.subscriptionCloseDate) && e.subscriptionCloseDate < today;
  const blockMessage = expired
    ? 'Date end expired'
    : full
      ? 'Seats not more available'
      : closed
        ? 'Subscriptions closed'
        : '';
  return { seatsLeft, full, expired, closed, blockMessage };
}

/** Less than 48 hours left before the end of the closing day. */
export function closingSoon(subscriptionCloseDate: string, now = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(subscriptionCloseDate)) return false;
  const [y, m, d] = subscriptionCloseDate.split('-').map(Number);
  const end = new Date(y, m - 1, d, 23, 59, 59);
  const left = end.getTime() - now.getTime();
  return left > 0 && left < 48 * 3600 * 1000;
}

export type ClubEvent = ClubEventProfile &
  ClubEventListItem & {
    workspaceKind: string;
    workspaceId: string;
    services: ClubEventService[];
    texts: ClubEventExtraText[];
    subevents: ClubEventSubevent[];
    createdAt: string;
    updatedAt: string;
  };

export type ClubEventSettings = {
  disableSubscriptionEmails: boolean;
  /** Remove events EVENT_AUTO_REMOVE_DAYS after their end date. */
  autoRemoveExpired: boolean;
  /** Subscribers must click the link in the email to confirm (status Confirmed). */
  requireConfirmation: boolean;
};

export type ClubEventDiscountRule = {
  id: string;
  minSubevents: number;
  discountPercent: number;
};

export type ClubEventRegistration = {
  id: string;
  eventId: string;
  createdAt: string;
  fullName: string;
  firstName: string;
  lastName: string;
  /** 'M' | 'F' | '' */
  sex: string;
  birthCountry: string;
  birthLocality: string;
  /** Identification code used instead of the fiscal code (foreigners). */
  foreignIdCode: string;
  email: string;
  phone: string;
  fiscalCode: string;
  birthdate: string;
  address: string;
  city: string;
  province: string;
  zip: string;
  isMinor: boolean;
  parentName: string;
  parentFiscalCode: string;
  notes: string;
  groupOrTeamName: string;
  memberUserId: string | null;
  isMember: boolean;
  /** Member profile page, only when memberUserId is currently in this club / team. */
  profilePath?: string;
  relativeName: string;
  relativeFiscalCode: string;
  selectedMainEvent: boolean;
  selectedSubeventIds: string[];
  selectedServiceIds: string[];
  textAnswers: Record<string, boolean | string>;
  fileUrl: string | null;
  /** Files attached per additional text id. */
  textFiles: Record<string, { name: string; url: string }>;
  amountGross: number;
  discountPercent: number;
  /** Total due after discounts. */
  amountDue: number;
  /** Paid so far (from the Archive of Deadlines payments). */
  amountPaid: number;
  /** Still to pay. */
  balance: number;
  currency: string;
  payMode: string;
  /** 'pending' = waiting for the email confirmation click. */
  status: 'pending' | 'confirmed' | 'cancelled';
  confirmedAt: string | null;
  receiptNumber: string | null;
  procedureRecordId: string | null;
  /** Due date of the deadline in the Archive of Deadlines. */
  deadlineDate: string | null;
  /** Latest receipt numbers of the deadline payments. */
  invoiceNumbers: string;
};

export function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatEventEuro(value: number, currency: string | null | undefined = 'EUR'): string {
  return formatClubMoney(value, currency);
}

/** "Paid" (black) when nothing is left to pay, else "In pending" (red) with the amount still due. */
export function registrationPaymentLabel(r: Pick<ClubEventRegistration, 'amountDue' | 'balance' | 'currency'>): {
  paid: boolean;
  text: string;
} {
  if (r.amountDue <= 0 || r.balance <= 0) return { paid: true, text: r.amountDue <= 0 ? 'Free' : 'Paid' };
  return { paid: false, text: `In pending ${formatEventEuro(r.balance, r.currency)}` };
}

export function locationOf(e: Pick<ClubEventProfile, 'city' | 'address' | 'province' | 'zip'>): string {
  return [e.address, e.zip, e.city, e.province].map((s) => s.trim()).filter(Boolean).join(', ');
}

export function emptyEventProfile(): ClubEventProfile {
  const today = todayYmd();
  return {
    name: '',
    eventType: 'Event',
    startDate: today,
    endDate: today,
    subscriptionCloseDate: today,
    cost: 0,
    seats: 0,
    allowSubevents: false,
    hideFromShare: false,
    allowMultiSubeventSelect: false,
    subscriberType: 'Singles',
    membersOnly: false,
    openToNonMembers: true,
    confirmationText:
      'Registration request received. You will get a confirmation email shortly.',
    city: '',
    zip: '',
    address: '',
    province: '',
    description: '',
    bannerUrl: '',
    coverUrl: null,
    sponsorId: '',
    privacyText: '',
    photoVideoText: '',
    attachment1Name: '',
    attachment1Url: null,
    attachment2Name: '',
    attachment2Url: null,
    fileUploadEnabled: false,
    fileUploadLabel: 'Medical certificate or other document',
    siblingDiscount: { enabled: false, percent: 0, applyToNonMembers: false },
    paymentModality: DEFAULT_EVENT_PAYMENT_MODALITY,
  };
}
