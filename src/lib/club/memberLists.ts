import { prisma } from '@/lib/prisma';
import type { ClubAuthContext } from '@/lib/procedures/types';
import {
  applyFilters,
  formatName,
  paginate,
  text,
  type ArchiveQueryParams,
  type PaginatedArchive,
} from '@/lib/club/archives/legacyArchiveQueries';
import { loadClubMemberTypeNames, memberTypeIdFromProfileJson } from '@/lib/club/clubMemberTypes';
import { normalizeMemberArchiveStatus } from '@/lib/club/memberArchiveStatus';
import {
  listCoachAthletesArchive,
  listTeamMembersArchive,
} from '@/lib/club/archives/clubArchiveService';
import {
  addCoachFavourites,
  createCoachGroup,
  deleteCoachGroup,
  getCoachGroup,
  listCoachFavouriteIds,
  listCoachGroupMemberIds,
  listCoachGroups,
  removeCoachFavourites,
  renameCoachGroup,
  validateCoachAthleteIds,
} from '@/lib/club/coachMemberLists';
import {
  addTeamMemberFavourites,
  createTeamMemberGroup,
  deleteTeamMemberGroup,
  getTeamMemberGroup,
  listTeamMemberFavouriteIds,
  listTeamMemberGroupMemberIds,
  listTeamMemberGroups,
  removeTeamMemberFavourites,
  renameTeamMemberGroup,
  validateTeamMemberIds,
} from '@/lib/club/teamMemberLists';

const isTeam = (ctx: ClubAuthContext) => ctx.workspaceKind === 'team';
const isCoach = (ctx: ClubAuthContext) => ctx.workspaceKind === 'coach';

function formatArchiveDate(value: Date | null | undefined): string {
  if (!value || Number.isNaN(value.getTime())) return '-';
  const dd = String(value.getDate()).padStart(2, '0');
  const mm = String(value.getMonth() + 1).padStart(2, '0');
  const yyyy = value.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function titleCaseRole(role: string | null | undefined): string {
  const raw = String(role ?? '').trim();
  if (!raw) return 'Member';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function mapClubMemberRows(
  rows: {
    role: string | null;
    membershipType: string | null;
    joinedAt: Date;
    member: {
      id: string;
      firstName: string | null;
      surname: string | null;
      name: string;
      username: string;
      image: string | null;
      gender: string | null;
      birthdate: Date | null;
      country: string | null;
      userType?: string | null;
    };
    profile?: { profileJson: string | null } | null;
  }[],
  ownerSportByUser: Map<string, string> = new Map(),
  memberTypeNames: Map<string, string> = new Map()
): Record<string, unknown>[] {
  return rows.map((row, i) => {
    const firstName =
      text(row.member.firstName) ||
      text(row.member.name).split(/\s+/)[0] ||
      text(row.member.username) ||
      '-';
    const surname =
      text(row.member.surname) ||
      (() => {
        const parts = text(row.member.name).split(/\s+/).filter(Boolean);
        return parts.length > 1 ? parts.slice(1).join(' ') : '';
      })();

    let scopedSafe: {
      otherDetails?: { groupTrainedId?: string };
      settings?: { football?: { teamNames?: string; category?: string }; teamSport?: string };
    } = {};
    try {
      scopedSafe = row.profile?.profileJson
        ? (JSON.parse(row.profile.profileJson) as typeof scopedSafe)
        : {};
    } catch {
      scopedSafe = {};
    }
    const sport =
      ownerSportByUser.get(row.member.id) ||
      text(scopedSafe.settings?.football?.category) ||
      text(scopedSafe.settings?.teamSport) ||
      '-';
    const groupTrainedId = text(scopedSafe.otherDetails?.groupTrainedId);
    const groupTrained =
      text(scopedSafe.settings?.football?.teamNames) || groupTrainedId || '-';

    return {
      id: row.member.id,
      memberId: row.member.id,
      number: i + 1,
      name: firstName,
      surname: surname || '-',
      fullName: formatName(row.member.firstName, row.member.surname, row.member.name),
      image: row.member.image,
      gender: text(row.member.gender) || '-',
      dateOfBirth: formatArchiveDate(row.member.birthdate),
      memberType:
        memberTypeNames.get(memberTypeIdFromProfileJson(row.profile?.profileJson)) || '-',
      localCity: text(row.member.country) || '-',
      Localcity: text(row.member.country) || '-',
      phone: '-',
      insertDate: row.joinedAt.toISOString().slice(0, 10),
      insertDateDisplay: formatArchiveDate(row.joinedAt),
      operator: titleCaseRole(row.role),
      typology: titleCaseRole(row.role),
      membershipStatus: normalizeMemberArchiveStatus(row.role),
      isCoach: row.member.userType === 'COACH',
      sport,
      groupTrained,
      groupTrainedId: groupTrainedId || '',
    };
  });
}

async function fetchClubMemberRows(clubId: string, memberIds?: string[]) {
  return prisma.clubMember.findMany({
    where: {
      clubId,
      ...(memberIds?.length ? { memberId: { in: memberIds } } : {}),
    },
    include: {
      member: {
        select: {
          id: true,
          firstName: true,
          surname: true,
          name: true,
          username: true,
          image: true,
          gender: true,
          birthdate: true,
          country: true,
          userType: true,
          createdAt: true,
        },
      },
      profile: { select: { profileJson: true } },
    },
    orderBy: { joinedAt: 'desc' },
  });
}

export async function listClubMemberArchiveRows(
  ctx: ClubAuthContext,
  params: ArchiveQueryParams = {},
  memberIds?: string[]
): Promise<PaginatedArchive<Record<string, unknown>>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  // An explicit empty list (no favourites / empty group) means no rows, not "all members".
  if (memberIds && memberIds.length === 0) {
    return { items: [], total: 0, page, pageSize };
  }
  if (isTeam(ctx) || isCoach(ctx)) {
    const allowed = memberIds && params.memberIdsIn
      ? memberIds.filter((id) => params.memberIdsIn!.includes(id))
      : memberIds ?? params.memberIdsIn;
    return isCoach(ctx)
      ? listCoachAthletesArchive(ctx, { ...params, memberIdsIn: allowed })
      : listTeamMembersArchive(ctx, { ...params, memberIdsIn: allowed });
  }
  const rows = await fetchClubMemberRows(ctx.club.id, memberIds);

  const userIds = rows.map((r) => r.memberId);
  const ownerSportByUser = new Map<string, string>();
  if (userIds.length > 0) {
    try {
      const extrasRows = await prisma.userProfileExtras.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, ownerJson: true },
      });
      for (const ex of extrasRows) {
        try {
          const owner = JSON.parse(ex.ownerJson || '{}') as {
            personal?: { mainSport?: string };
          };
          const sport = text(owner.personal?.mainSport);
          if (sport) ownerSportByUser.set(ex.userId, sport);
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* extras table may be missing */
    }
  }

  const memberTypeNames = await loadClubMemberTypeNames(ctx.club.id);
  const items = mapClubMemberRows(rows, ownerSportByUser, memberTypeNames);
  return paginate(applyFilters(items, params), page, pageSize);
}

async function validateMemberIds(clubId: string, memberIds: string[]): Promise<string[]> {
  const unique = [...new Set(memberIds.filter(Boolean))];
  if (unique.length === 0) return [];

  const existing = await prisma.clubMember.findMany({
    where: { clubId, memberId: { in: unique } },
    select: { memberId: true },
  });
  return existing.map((r) => r.memberId);
}

export async function createClubMemberGroup(
  ctx: ClubAuthContext,
  name: string,
  memberIds: string[]
) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Group name is required');
  }

  if (isCoach(ctx)) {
    const athleteIds = await validateCoachAthleteIds(ctx.club.id, memberIds);
    if (athleteIds.length === 0) throw new Error('Select at least one athlete trained');
    const group = await createCoachGroup(ctx.club.id, trimmed, athleteIds);
    return {
      id: group.id,
      name: group.name,
      createdAt: group.createdAt,
      _count: { members: group.memberCount },
    };
  }

  if (isTeam(ctx)) {
    const teamIds = await validateTeamMemberIds(ctx.club.id, memberIds);
    if (teamIds.length === 0) throw new Error('Select at least one team member');
    const group = await createTeamMemberGroup(ctx.club.id, trimmed, teamIds);
    return {
      id: group.id,
      name: group.name,
      createdAt: group.createdAt,
      _count: { members: group.memberCount },
    };
  }

  const validIds = await validateMemberIds(ctx.club.id, memberIds);
  if (validIds.length === 0) {
    throw new Error('Select at least one club member');
  }

  return prisma.clubMemberGroup.create({
    data: {
      clubId: ctx.club.id,
      name: trimmed,
      members: {
        create: validIds.map((memberId) => ({ memberId })),
      },
    },
    include: {
      _count: { select: { members: true } },
    },
  });
}

export async function listClubMemberGroups(ctx: ClubAuthContext) {
  if (isCoach(ctx)) return listCoachGroups(ctx.club.id);
  if (isTeam(ctx)) return listTeamMemberGroups(ctx.club.id);
  const [groups, clubMembers] = await Promise.all([
    prisma.clubMemberGroup.findMany({
      where: { clubId: ctx.club.id },
      orderBy: { createdAt: 'desc' },
      include: { members: { select: { memberId: true } } },
    }),
    prisma.clubMember.findMany({ where: { clubId: ctx.club.id }, select: { memberId: true } }),
  ]);
  // Count only people still in the club, matching what opening the group lists.
  const inClub = new Set(clubMembers.map((m) => m.memberId));

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    memberCount: g.members.filter((m) => inClub.has(m.memberId)).length,
    createdAt: g.createdAt.toISOString(),
  }));
}

export async function getClubMemberGroup(ctx: ClubAuthContext, groupId: string) {
  if (isCoach(ctx)) return getCoachGroup(ctx.club.id, groupId);
  if (isTeam(ctx)) return getTeamMemberGroup(ctx.club.id, groupId);
  const group = await prisma.clubMemberGroup.findFirst({
    where: { id: groupId, clubId: ctx.club.id },
    include: {
      members: { select: { memberId: true } },
    },
  });

  if (!group) return null;

  return {
    id: group.id,
    name: group.name,
    memberIds: group.members.map((m) => m.memberId),
    createdAt: group.createdAt.toISOString(),
  };
}

export async function listClubMemberGroupMembers(
  ctx: ClubAuthContext,
  groupId: string,
  params: ArchiveQueryParams = {}
): Promise<PaginatedArchive<Record<string, unknown>> | null> {
  const group = await getClubMemberGroup(ctx, groupId);
  if (!group) return null;
  return listClubMemberArchiveRows(ctx, params, group.memberIds);
}

export async function renameClubMemberGroup(
  ctx: ClubAuthContext,
  groupId: string,
  name: string
) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Group name is required');
  }
  if (isCoach(ctx)) return renameCoachGroup(ctx.club.id, groupId, trimmed);
  if (isTeam(ctx)) return renameTeamMemberGroup(ctx.club.id, groupId, trimmed);
  const existing = await prisma.clubMemberGroup.findFirst({
    where: { id: groupId, clubId: ctx.club.id },
    select: { id: true },
  });
  if (!existing) return null;
  const updated = await prisma.clubMemberGroup.update({
    where: { id: groupId },
    data: { name: trimmed },
    select: { id: true, name: true },
  });
  return updated;
}

export async function deleteClubMemberGroup(ctx: ClubAuthContext, groupId: string) {
  if (isCoach(ctx)) return deleteCoachGroup(ctx.club.id, groupId);
  if (isTeam(ctx)) return deleteTeamMemberGroup(ctx.club.id, groupId);
  const existing = await prisma.clubMemberGroup.findFirst({
    where: { id: groupId, clubId: ctx.club.id },
    select: { id: true },
  });
  if (!existing) return false;
  await prisma.clubMemberGroup.delete({ where: { id: groupId } });
  return true;
}

export async function addClubMemberFavourites(ctx: ClubAuthContext, memberIds: string[]) {
  if (isCoach(ctx)) {
    const athleteIds = await validateCoachAthleteIds(ctx.club.id, memberIds);
    if (athleteIds.length === 0) throw new Error('Select at least one athlete trained');
    await addCoachFavourites(ctx.club.id, athleteIds);
    return athleteIds.length;
  }
  if (isTeam(ctx)) {
    const teamIds = await validateTeamMemberIds(ctx.club.id, memberIds);
    if (teamIds.length === 0) throw new Error('Select at least one team member');
    await addTeamMemberFavourites(ctx.club.id, teamIds);
    return teamIds.length;
  }
  const validIds = await validateMemberIds(ctx.club.id, memberIds);
  if (validIds.length === 0) {
    throw new Error('Select at least one club member');
  }

  await prisma.clubMemberFavorite.createMany({
    data: validIds.map((memberId) => ({
      clubId: ctx.club.id,
      memberId,
    })),
    skipDuplicates: true,
  });

  return validIds.length;
}

/** Removes members from Favourites only — club membership is untouched. */
export async function removeClubMemberFavourites(ctx: ClubAuthContext, memberIds: string[]) {
  const unique = [...new Set(memberIds.filter(Boolean))];
  if (unique.length === 0) {
    throw new Error('Select at least one member');
  }
  if (isCoach(ctx)) return removeCoachFavourites(ctx.club.id, unique);
  if (isTeam(ctx)) return removeTeamMemberFavourites(ctx.club.id, unique);
  const result = await prisma.clubMemberFavorite.deleteMany({
    where: { clubId: ctx.club.id, memberId: { in: unique } },
  });
  return result.count;
}

export async function listClubMemberFavouriteIds(ctx: ClubAuthContext): Promise<string[]> {
  if (isCoach(ctx)) return listCoachFavouriteIds(ctx.club.id);
  if (isTeam(ctx)) return listTeamMemberFavouriteIds(ctx.club.id);
  return listClubMemberFavouriteIdsForClub(ctx.club.id);
}

/** Favourites of a club or team workspace id (ids are unique across clubs and teams). */
export async function listClubMemberFavouriteIdsForClub(clubId: string): Promise<string[]> {
  const rows = await prisma.clubMemberFavorite.findMany({
    where: { clubId },
    select: { memberId: true },
    orderBy: { createdAt: 'desc' },
  });
  if (rows.length > 0) return rows.map((r) => r.memberId);
  const teamIds = await listTeamMemberFavouriteIds(clubId);
  if (teamIds.length > 0) return teamIds;
  return listCoachFavouriteIds(clubId);
}

/** Members of a saved group of a club or team workspace id. */
export async function listClubMemberGroupMemberIds(
  clubId: string,
  groupId: string
): Promise<string[]> {
  const group = await prisma.clubMemberGroup.findFirst({
    where: { id: groupId, clubId },
    select: {
      members: { select: { memberId: true } },
    },
  });
  if (group) return group.members.map((m) => m.memberId);
  const teamIds = await listTeamMemberGroupMemberIds(clubId, groupId);
  if (teamIds.length > 0) return teamIds;
  return listCoachGroupMemberIds(clubId, groupId);
}

/** Turns `memberGroupId` (Group of training filter) into a member id allow-list. */
export async function resolveMemberGroupFilter<T extends ArchiveQueryParams>(
  clubId: string,
  params: T
): Promise<T> {
  const groupId = params.memberGroupId?.trim();
  if (!groupId || groupId === 'all') return params;
  return { ...params, memberIdsIn: await listClubMemberGroupMemberIds(clubId, groupId) };
}

export async function countClubMemberGroupMembers(clubId: string, groupId: string): Promise<number> {
  return (await listClubMemberGroupMemberIds(clubId, groupId)).length;
}

export async function countClubMemberFavourites(clubId: string): Promise<number> {
  return (await listClubMemberFavouriteIdsForClub(clubId)).length;
}

export async function listClubMemberFavourites(
  ctx: ClubAuthContext,
  params: ArchiveQueryParams = {}
): Promise<PaginatedArchive<Record<string, unknown>>> {
  const memberIds = await listClubMemberFavouriteIds(ctx);
  return listClubMemberArchiveRows(ctx, params, memberIds);
}
