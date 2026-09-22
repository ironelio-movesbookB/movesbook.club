import type { ClubAdminInfo } from '@/lib/club/clubAdminInfo';

export const CLUB_STAFF_CHANGED_EVENT = 'club-staff-changed';

export const CLUB_STAFF_TYPES = [
  { value: 'coadmin', label: 'Coadmin' },
  { value: 'operator', label: 'Operator' },
  { value: 'collaborator', label: 'Collaborator' },
] as const;

export type ClubStaffType = (typeof CLUB_STAFF_TYPES)[number]['value'];

/** `users_new.userType` values written for club staff accounts. */
export const CLUB_STAFF_DB_USER_TYPES = [
  'CLUB_COADMIN',
  'CLUB_OPERATOR',
  'CLUB_COLLABORATOR',
] as const;

export type ClubStaffDbUserType = (typeof CLUB_STAFF_DB_USER_TYPES)[number];

const STAFF_TYPE_TO_USER_TYPE: Record<ClubStaffType, ClubStaffDbUserType> = {
  coadmin: 'CLUB_COADMIN',
  operator: 'CLUB_OPERATOR',
  collaborator: 'CLUB_COLLABORATOR',
};

export function userTypeForClubStaffType(staffType: ClubStaffType): ClubStaffDbUserType {
  return STAFF_TYPE_TO_USER_TYPE[staffType];
}

export function isClubStaffDbUserType(value: string): value is ClubStaffDbUserType {
  return (CLUB_STAFF_DB_USER_TYPES as readonly string[]).includes(value);
}

export const CLUB_STAFF_ROLES = [
  'Receptionist',
  'Instructor',
  'Personal trainer',
  'Director',
  'Management',
  'Cleaner',
  'Maintenance worker',
  'Sales',
  'Accounting',
  'Parking attendant',
  'Customers Care',
] as const;

export type ClubStaffRole = (typeof CLUB_STAFF_ROLES)[number];

export const CLUB_STAFF_USER_LEVELS = [
  { value: 'management', label: 'Management Functions' },
  { value: 'payment', label: 'Payment functions' },
  { value: 'reading_payments_stats', label: 'Reading payments & stats' },
  { value: 'training', label: 'Training Functions' },
  { value: 'social', label: 'Social Functions' },
  { value: 'settings', label: 'Settings Functions' },
  { value: 'passwords', label: 'Passwords' },
] as const;

export type ClubStaffUserLevel = (typeof CLUB_STAFF_USER_LEVELS)[number]['value'];

export const CLUB_STAFF_TABS = [
  { id: 'all', label: 'List of the Staff' },
  { id: 'instructors', label: 'Instructors', role: 'Instructor' },
  { id: 'personal-trainers', label: 'Personal Trainers', role: 'Personal trainer' },
  { id: 'customer-care', label: 'Customer Care', role: 'Customers Care' },
] as const;

export type ClubStaffTabId = (typeof CLUB_STAFF_TABS)[number]['id'];

export type ClubStaffListItem = {
  id: string;
  userId: string;
  username: string;
  email: string;
  name: string;
  image: string | null;
  staffType: 'club_admin' | 'team_admin' | ClubStaffType;
  staffTypeLabel: string;
  role: string;
  operativeLevel: string;
  userLevels: ClubStaffUserLevel[];
  isClubAdmin: boolean;
};

export type ClubStaffProfile = ClubStaffListItem & {
  firstName: string | null;
  surname: string | null;
  country: string | null;
  gender: string | null;
  birthdate: string | null;
  telegramAccount: string | null;
  youtubeChannelUrl: string | null;
  preferredLanguage: string;
  mainSports: string[];
  referencesHtml: string;
  referencesLevel: string;
  createdAt: string;
  adminInfo: ClubAdminInfo;
};

export function isClubStaffType(value: string): value is ClubStaffType {
  return CLUB_STAFF_TYPES.some((item) => item.value === value);
}

export function isClubStaffRole(value: string): value is ClubStaffRole {
  return (CLUB_STAFF_ROLES as readonly string[]).includes(value);
}

export function isClubStaffUserLevel(value: string): value is ClubStaffUserLevel {
  return CLUB_STAFF_USER_LEVELS.some((item) => item.value === value);
}

export function staffTypeLabel(type: string): string {
  if (type === 'club_admin') return 'Club Admin';
  if (type === 'team_admin') return 'Team Admin';
  const match = CLUB_STAFF_TYPES.find((item) => item.value === type);
  return match?.label ?? type;
}

export function operativeLevelForStaffType(type: string): string {
  if (type === 'club_admin' || type === 'team_admin' || type === 'coadmin') return 'Supervisor';
  return 'Staff user';
}

/** Row text colors from club_staff.staffType / club_staff.role (legacy Operator List). */
export function staffRowTextClass(item: {
  isClubAdmin?: boolean;
  staffType: string;
  role: string;
}): string {
  if (item.isClubAdmin) return 'font-bold text-gray-900';
  // CoAdmins → dark red (staffType)
  if (item.staffType === 'coadmin') return 'text-[#8B0000]';
  // Personal Trainers → dark green (role / employment area)
  if (item.role === 'Personal trainer') return 'text-[#006400]';
  // Instructors → blue (role / employment area)
  if (item.role === 'Instructor') return 'text-[#0000CD]';
  return 'text-gray-800';
}

export function notifyClubStaffChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CLUB_STAFF_CHANGED_EVENT));
}
