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

/** Persist value written to ClubMember.role / TeamMember.role. */
export function roleValueForMemberArchiveStatus(status: MemberArchiveStatus): string {
  return status;
}
