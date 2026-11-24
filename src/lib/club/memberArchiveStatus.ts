import type { CSSProperties } from 'react';

/** Archive of Users — Athletes\\Members / pending / not-members / Members Archived. */

export const MEMBER_ARCHIVE_STATUSES = [
  'member',
  'pending',
  'not_member',
  'archived',
] as const;

export type MemberArchiveStatus = (typeof MEMBER_ARCHIVE_STATUSES)[number];

/** Statuses offered when adding a new member (not archived). */
export const ADDABLE_MEMBER_ARCHIVE_STATUSES = [
  'member',
  'pending',
  'not_member',
] as const;

export type AddableMemberArchiveStatus = (typeof ADDABLE_MEMBER_ARCHIVE_STATUSES)[number];

export function normalizeMemberArchiveStatus(
  role: string | null | undefined,
): MemberArchiveStatus {
  const raw = String(role ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (raw === 'pending') return 'pending';
  if (raw === 'not_member' || raw === 'notmember') return 'not_member';
  if (raw === 'archived' || raw === 'archive') return 'archived';
  return 'member';
}

export function isMemberArchiveStatus(value: string): value is MemberArchiveStatus {
  return (MEMBER_ARCHIVE_STATUSES as readonly string[]).includes(value);
}

export function isAddableMemberArchiveStatus(
  value: string,
): value is AddableMemberArchiveStatus {
  return (ADDABLE_MEMBER_ARCHIVE_STATUSES as readonly string[]).includes(value);
}

/** Row text color for All the users profiles. */
export function memberArchiveStatusTextClass(status: MemberArchiveStatus): string {
  switch (status) {
    case 'pending':
      return 'text-red-600';
    case 'not_member':
      return 'text-blue-600';
    case 'archived':
      return 'text-gray-500';
    default:
      return 'text-black';
  }
}

/** Circle button beside the avatar. */
export function memberArchiveStatusDotClass(status: MemberArchiveStatus): string {
  switch (status) {
    case 'pending':
      return 'bg-red-500 hover:bg-red-600';
    case 'not_member':
      return 'bg-blue-500 hover:bg-blue-600';
    case 'archived':
      return 'bg-gray-400 hover:bg-gray-500';
    default:
      return 'bg-green-500 hover:bg-green-600';
  }
}

export function memberArchiveStatusLabel(status: MemberArchiveStatus): string {
  switch (status) {
    case 'pending':
      return 'Member in pending';
    case 'not_member':
      return 'Athlete not member';
    case 'archived':
      return 'Members Archived';
    default:
      return 'Athlete / Member';
  }
}

/** Short status shown in the Type of User column. */
export function memberArchiveStatusShortLabel(status: MemberArchiveStatus): string {
  switch (status) {
    case 'pending':
      return 'In pending';
    case 'not_member':
      return 'Not member';
    case 'archived':
      return 'Archived';
    default:
      return 'Member';
  }
}

/**
 * Single Users (ID5) and Coaches (ID6) are added directly.
 * Team (ID7) / Club (ID8) / Group (ID9) admins can also be members — including of a
 * structure they own — after confirming “Do you want insert the user the same?”.
 */
export const PRIMARY_ADDABLE_MEMBER_USER_TYPES = ['ATHLETE', 'COACH'] as const;

export const ADMIN_ADDABLE_MEMBER_USER_TYPES = [
  'TEAM',
  'TEAM_MANAGER',
  'CLUB',
  'CLUB_TRAINER',
  'GROUP',
  'GROUP_ADMIN',
] as const;

export const ADDABLE_MEMBER_USER_TYPES = [
  ...PRIMARY_ADDABLE_MEMBER_USER_TYPES,
  ...ADMIN_ADDABLE_MEMBER_USER_TYPES,
] as const;

export function isAddableMemberUserType(userType: string | null | undefined): boolean {
  return (ADDABLE_MEMBER_USER_TYPES as readonly string[]).includes(String(userType ?? ''));
}

export function isPrimaryAddableMemberUserType(
  userType: string | null | undefined,
): boolean {
  return (PRIMARY_ADDABLE_MEMBER_USER_TYPES as readonly string[]).includes(
    String(userType ?? ''),
  );
}

export function isAdminAddableMemberUserType(
  userType: string | null | undefined,
): boolean {
  return (ADMIN_ADDABLE_MEMBER_USER_TYPES as readonly string[]).includes(
    String(userType ?? ''),
  );
}

/** Shown in Add member UI (and as the first line when an admin needs confirm). */
export const ADDABLE_MEMBER_HINT =
  'Only Single Users (ID5) and Coaches (ID6) can be added as members.';

export const ADMIN_AS_MEMBER_CONFIRM_QUESTION = 'Do you want insert the user the same?';

export const ADMIN_AS_MEMBER_CONFIRM_CODE = 'ADMIN_AS_MEMBER_CONFIRM';

/** @deprecated use ADDABLE_MEMBER_HINT — kept for older callers */
export const NOT_ADDABLE_MEMBER_USER_TYPE_ERROR = ADDABLE_MEMBER_HINT;

/** Thrown by add-member clients when an ID7/8/9 admin needs the confirm step. */
export class AdminAsMemberConfirmError extends Error {
  readonly code = ADMIN_AS_MEMBER_CONFIRM_CODE;
  readonly question: string;

  constructor(
    message: string = ADDABLE_MEMBER_HINT,
    question: string = ADMIN_AS_MEMBER_CONFIRM_QUESTION,
  ) {
    super(message);
    this.name = 'AdminAsMemberConfirmError';
    this.question = question;
  }
}

export function adminAsMemberConfirmResponse() {
  return {
    error: ADDABLE_MEMBER_HINT,
    code: ADMIN_AS_MEMBER_CONFIRM_CODE,
    question: ADMIN_AS_MEMBER_CONFIRM_QUESTION,
  };
}

/** Coaches show the status circle half filled. */
export function memberArchiveStatusDotStyle(isCoach: boolean): CSSProperties | undefined {
  return isCoach
    ? { backgroundImage: 'linear-gradient(90deg, transparent 50%, #ffffff 50%)' }
    : undefined;
}

/** Border in the status color so the empty half of a coach circle stays visible. */
export function memberArchiveStatusBorderClass(status: MemberArchiveStatus): string {
  switch (status) {
    case 'pending':
      return 'border-red-500';
    case 'not_member':
      return 'border-blue-500';
    case 'archived':
      return 'border-gray-400';
    default:
      return 'border-green-500';
  }
}

/** Persist value written to ClubMember.role / TeamMember.role. */
export function roleValueForMemberArchiveStatus(status: MemberArchiveStatus): string {
  return status;
}

/** Club\Gym Athlete status labels (Other Club data) ↔ archive buckets. */
export type ClubAthleteStatusLabel =
  | 'Member'
  | 'Old Members'
  | 'On probation'
  | 'Non-member Associate';

/** Normalize stored / legacy athlete status labels. */
export function normalizeClubAthleteStatus(
  value: string | null | undefined,
): ClubAthleteStatusLabel {
  const raw = String(value ?? '').trim();
  if (raw === 'Old Members' || raw === 'Not a member') return 'Old Members';
  if (raw === 'On probation') return 'On probation';
  if (raw === 'Non-member Associate') return 'Non-member Associate';
  return 'Member';
}

/**
 * Member → Members
 * Old Members (ex "Not a member") → Members Archived
 * On probation → Members in pending
 * Non-member Associate → Not members
 */
export function athleteStatusToArchiveStatus(
  value: string | null | undefined,
): MemberArchiveStatus {
  switch (normalizeClubAthleteStatus(value)) {
    case 'Old Members':
      return 'archived';
    case 'On probation':
      return 'pending';
    case 'Non-member Associate':
      return 'not_member';
    default:
      return 'member';
  }
}

export function archiveStatusToAthleteStatus(
  status: MemberArchiveStatus,
): ClubAthleteStatusLabel {
  switch (status) {
    case 'archived':
      return 'Old Members';
    case 'pending':
      return 'On probation';
    case 'not_member':
      return 'Non-member Associate';
    default:
      return 'Member';
  }
}
