export const CLUB_COACH_ROLES = [
  'Head coach',
  'Assistant coach',
  'Technical director',
  'Athletic trainer',
  'Goalkeeper coach',
  'Youth coach',
  'Other',
] as const;

export const CLUB_COACH_STATUSES = ['active', 'pending', 'archived'] as const;
export type ClubCoachStatus = (typeof CLUB_COACH_STATUSES)[number];

export type ClubCoachSource = 'manual' | 'duplicate' | 'invite';

export type ClubCoachInput = {
  surname: string;
  firstName: string;
  taxCode: string;
  email: string;
  phone: string;
  /** yyyy-mm-dd */
  birthDate: string;
  membershipNumber: string;
  iban: string;
  address: string;
  city: string;
  province: string;
  zip: string;
  birthCountry: string;
  birthCity: string;
  birthProvince: string;
  role: string;
  groupId: string;
  notes: string;
};

export type ClubCoach = ClubCoachInput & {
  id: string;
  status: ClubCoachStatus;
  source: ClubCoachSource;
  userId: string | null;
  groupName: string;
  image: string | null;
  createdAt: string;
};

export type ClubCoachGroupOption = { id: string; name: string };

export type ClubCoachProfileMatch = {
  userId: string;
  username: string;
  firstName: string;
  surname: string;
  email: string;
  birthDate: string;
  country: string;
  relation: string;
};

export const EMPTY_CLUB_COACH_INPUT: ClubCoachInput = {
  surname: '',
  firstName: '',
  taxCode: '',
  email: '',
  phone: '',
  birthDate: '',
  membershipNumber: '',
  iban: '',
  address: '',
  city: '',
  province: '',
  zip: '',
  birthCountry: 'Italy',
  birthCity: '',
  birthProvince: '',
  role: '',
  groupId: '',
  notes: '',
};

export const CLUB_COACHES_CHANGED_EVENT = 'club-coaches-changed';

export function notifyClubCoachesChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CLUB_COACHES_CHANGED_EVENT));
}

export function coachFullName(coach: Pick<ClubCoach, 'surname' | 'firstName'>): string {
  return [coach.surname, coach.firstName].filter(Boolean).join(' ').toUpperCase();
}

/** yyyy-mm-dd → dd/mm/yyyy */
export function formatCoachDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

export function coachInviteUrl(origin: string, societyId: string): string {
  return `${origin.replace(/\/$/, '')}/coachregistering?society=${encodeURIComponent(societyId)}`;
}

const EXPORT_COLUMNS: [string, (c: ClubCoach) => string][] = [
  ['Surname', (c) => c.surname],
  ['Name', (c) => c.firstName],
  ['Tax code', (c) => c.taxCode],
  ['Email', (c) => c.email],
  ['Phone', (c) => c.phone],
  ['Date of birth', (c) => formatCoachDate(c.birthDate)],
  ['Membership number', (c) => c.membershipNumber],
  ['IBAN', (c) => c.iban],
  ['Address', (c) => c.address],
  ['City', (c) => c.city],
  ['Province', (c) => c.province],
  ['ZIP code', (c) => c.zip],
  ['Birth country', (c) => c.birthCountry],
  ['Birth city', (c) => c.birthCity],
  ['Birth province', (c) => c.birthProvince],
  ['Role', (c) => c.role],
  ['Group', (c) => c.groupName],
  ['Status', (c) => ({ active: 'Active', pending: 'Pending', archived: 'Archived' })[c.status]],
  ['Notes', (c) => c.notes],
];

/** Header row + one row per coach; every value stays a string so tax codes, phones and IBANs keep their exact text. */
export function clubCoachesExportTable(
  coaches: ClubCoach[],
  translate: (text: string) => string = (text) => text,
): string[][] {
  return [
    EXPORT_COLUMNS.map(([label]) => translate(label)),
    ...coaches.map((coach) =>
      EXPORT_COLUMNS.map(([label, get]) => {
        const value = get(coach) ?? '';
        return value && (label === 'Role' || label === 'Status') ? translate(value) : value;
      }),
    ),
  ];
}
