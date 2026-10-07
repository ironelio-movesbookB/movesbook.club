/** Staff administration: extra profile data, groups & roles, remunerations, register and meetings. */

/** Company role and role in a group, shared by every component of the Staff section. */
export const STAFF_COMPANY_ROLES = [
  'Referee',
  'Driver',
  'Board member',
  'General Manager',
  'Sporting Director',
  'Team manager/official',
  'Physiotherapist',
  'Sports worker',
  'Masseur',
  'Mental coach',
  'Personal trainer',
  'Athletic trainer',
  'President',
  'Point of contact',
  'Head of medical department',
  'Marketing manager',
  'First aid officer',
  'Head of youth academy',
  'Secretary',
  'Secretary-Treasurer',
  'Vice President',
  'Volunteer',
] as const;

export type StaffCompanyRole = (typeof STAFF_COMPANY_ROLES)[number];

export function isStaffCompanyRole(value: string): value is StaffCompanyRole {
  return (STAFF_COMPANY_ROLES as readonly string[]).includes(value);
}

export type StaffDetails = {
  taxCode: string;
  iban: string;
  address: string;
  city: string;
  province: string;
  zip: string;
  birthCountry: string;
  birthCity: string;
  birthProvince: string;
  notes: string;
  /** yyyy-mm-dd expiry dates */
  blsdExpiry: string;
  fireSafetyExpiry: string;
  firstAidExpiry: string;
  companyRole: string;
  boardMember: boolean;
  activityStart: string;
  activityEnd: string;
  volunteer: boolean;
  isMember: boolean;
  memberNumber: string;
  /** Raise the club/team member counter to this number on save. */
  storeMemberNumber: boolean;
  hireDate: string;
  contractExpiry: string;
  otherSocialSecurity: boolean;
};

export const EMPTY_STAFF_DETAILS: StaffDetails = {
  taxCode: '',
  iban: '',
  address: '',
  city: '',
  province: '',
  zip: '',
  birthCountry: 'Italy',
  birthCity: '',
  birthProvince: '',
  notes: '',
  blsdExpiry: '',
  fireSafetyExpiry: '',
  firstAidExpiry: '',
  companyRole: '',
  boardMember: false,
  activityStart: '',
  activityEnd: '',
  volunteer: false,
  isMember: false,
  memberNumber: '',
  storeMemberNumber: true,
  hireDate: '',
  contractExpiry: '',
  otherSocialSecurity: false,
};

export const STAFF_DETAILS_TEXT_LIMITS: Partial<Record<keyof StaffDetails, number>> = {
  taxCode: 40,
  iban: 60,
  address: 255,
  city: 120,
  province: 60,
  zip: 20,
  birthCountry: 120,
  birthCity: 120,
  birthProvince: 60,
  notes: 5000,
  companyRole: 80,
  memberNumber: 40,
};

export const STAFF_DETAILS_DATE_KEYS = [
  'blsdExpiry',
  'fireSafetyExpiry',
  'firstAidExpiry',
  'activityStart',
  'activityEnd',
  'hireDate',
  'contractExpiry',
] as const satisfies readonly (keyof StaffDetails)[];

export const STAFF_DETAILS_FLAG_KEYS = [
  'boardMember',
  'volunteer',
  'isMember',
  'storeMemberNumber',
  'otherSocialSecurity',
] as const satisfies readonly (keyof StaffDetails)[];

export type StaffGroupLink = {
  id: string;
  staffId: string;
  staffName: string;
  username: string;
  groupId: string;
  groupName: string;
  role: string;
  notes: string;
  /** yyyy-mm-dd */
  assignedAt: string;
};

export type StaffGroupOption = { id: string; name: string };

export const REMUNERATION_KINDS = [
  { value: 'compensation', label: 'Compensation' },
  { value: 'refund', label: 'Refund' },
  { value: 'prize', label: 'Prize' },
] as const;

export type RemunerationKind = (typeof REMUNERATION_KINDS)[number]['value'];

export const REMUNERATION_PAYMENT_TYPES = ['Cash', 'Bank transfer', 'Cheque', 'Card', 'Other'] as const;

export type StaffRemuneration = {
  id: string;
  /** yyyy-mm-dd */
  paidOn: string;
  amount: number;
  kind: RemunerationKind;
  paymentType: string;
  notes: string;
};

export type StaffRemunerationInput = Omit<StaffRemuneration, 'id'>;

export function remunerationTotals(items: StaffRemuneration[]): Record<RemunerationKind, number> {
  const totals: Record<RemunerationKind, number> = { compensation: 0, refund: 0, prize: 0 };
  for (const item of items) totals[item.kind] += item.amount;
  return totals;
}

export function formatEuro(value: number): string {
  return `${value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`;
}

/** yyyy-mm-dd → dd/mm/yyyy */
export function formatYmd(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

// ---------------------------------------------------------------------------
// Register of members and volunteers

export const REGISTER_MEMBER_CATEGORIES = [
  { id: 'boardMembers', label: 'Board members' },
  { id: 'athletes', label: 'Athletes' },
  { id: 'archivedAthletes', label: 'Archived athletes' },
  { id: 'coaches', label: 'Coaches' },
  { id: 'parents', label: 'Parents' },
  { id: 'staff', label: 'Staff' },
] as const;

export const REGISTER_NON_MEMBER_CATEGORIES = [
  { id: 'notMembers', label: 'Non-members' },
  { id: 'volunteers', label: 'Volunteers' },
] as const;

export type RegisterCategoryId =
  | (typeof REGISTER_MEMBER_CATEGORIES)[number]['id']
  | (typeof REGISTER_NON_MEMBER_CATEGORIES)[number]['id'];

export const REGISTER_CATEGORY_IDS: RegisterCategoryId[] = [
  ...REGISTER_MEMBER_CATEGORIES.map((c) => c.id),
  ...REGISTER_NON_MEMBER_CATEGORIES.map((c) => c.id),
];

export function registerCategoryLabel(id: RegisterCategoryId): string {
  return (
    [...REGISTER_MEMBER_CATEGORIES, ...REGISTER_NON_MEMBER_CATEGORIES].find((c) => c.id === id)?.label ?? id
  );
}

export type RegisterPerson = {
  surname: string;
  name: string;
  taxCode: string;
  /** yyyy-mm-dd */
  birthDate: string;
  birthPlace: string;
  /** Role, type of staff or kinship — already in English, translated by the client. */
  role: string;
  memberNumber: string;
  /** yyyy-mm-dd */
  since: string;
};

export type RegisterSection = { id: RegisterCategoryId; people: RegisterPerson[] };

/** Type of staff shown in the register and the Board members tab. */
export const STAFF_REGISTER_TYPES = ['Board member', 'Coach', 'Instructor', 'Personal trainer', 'Operator'] as const;

// ---------------------------------------------------------------------------
// Meetings and minutes

export type ClubMeeting = {
  id: string;
  /** yyyy-mm-dd */
  meetingDate: string;
  subject: string;
  secretary: string;
  documentName: string;
  documentHtml: string;
  fileName: string;
  fileUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type ClubMeetingInput = Pick<ClubMeeting, 'meetingDate' | 'subject' | 'secretary' | 'documentName' | 'documentHtml'>;

export const EMPTY_CLUB_MEETING_INPUT: ClubMeetingInput = {
  meetingDate: '',
  subject: '',
  secretary: '',
  documentName: '',
  documentHtml: '',
};

export const MAX_MEETING_FILE_BYTES = 15 * 1024 * 1024;

export const MEETING_FILE_EXTENSIONS = ['pdf', 'doc', 'docx', 'odt', 'rtf', 'txt', 'xls', 'xlsx', 'jpg', 'jpeg', 'png'] as const;
