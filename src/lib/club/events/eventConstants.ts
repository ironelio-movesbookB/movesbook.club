/** Club / team internal events (subscribe / pay). Client-safe constants. */

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
};

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
};

export type ClubEventSiblingDiscount = {
  enabled: boolean;
  parentName: string;
  fiscalCode: string;
  percent: number;
};

export type ClubEventProfile = {
  name: string;
  eventType: ClubEventType;
  startDate: string;
  endDate: string;
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
};

export type ClubEventListItem = {
  id: string;
  name: string;
  location: string;
  startDate: string;
  endDate: string;
  eventType: string;
  subeventCount: number;
  cost: number;
  seats: number;
  registered: number;
  coverUrl: string | null;
  publicToken: string;
};

/** Public “View all events” card (includes frame / discover-more fields). */
export type ClubEventPublicCard = ClubEventListItem & {
  description: string;
  bannerUrl: string;
  subevents: Array<{ id: string; name: string; startDate: string; endDate: string; cost: number }>;
};

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
  selectedMainEvent: boolean;
  selectedSubeventIds: string[];
  selectedServiceIds: string[];
  textAnswers: Record<string, boolean | string>;
  fileUrl: string | null;
  amountGross: number;
  discountPercent: number;
  amountPaid: number;
  payMode: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  receiptNumber: string | null;
};

export function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatEventEuro(value: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(value) || 0);
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
    siblingDiscount: { enabled: false, parentName: '', fiscalCode: '', percent: 0 },
  };
}
