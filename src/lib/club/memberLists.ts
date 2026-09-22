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
    };
    profile?: { profileJson: string | null } | null;
  }[],
  ownerSportByUser: Map<string, string> = new Map()
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
      memberType: text(row.membershipType) || 'Standard',
      localCity: text(row.member.country) || '-',
      Localcity: text(row.member.country) || '-',
      phone: '-',
      insertDate: row.joinedAt.toISOString().slice(0, 10),
      insertDateDisplay: formatArchiveDate(row.joinedAt),
      operator: titleCaseRole(row.role),
      typology: titleCaseRole(row.role),
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

  const items = mapClubMemberRows(rows, ownerSportByUser);
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
  if (ctx.workspaceKind === 'team') {
    throw new Error('Member groups are not available for team workspaces yet.');
  }
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Group name is required');
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
  const groups = await prisma.clubMemberGroup.findMany({
    where: { clubId: ctx.club.id },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { members: true } },
    },
  });

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    memberCount: g._count.members,
    createdAt: g.createdAt.toISOString(),
  }));
}

export async function getClubMemberGroup(ctx: ClubAuthContext, groupId: string) {
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

export async function deleteClubMemberGroup(ctx: ClubAuthContext, groupId: string) {
  const existing = await prisma.clubMemberGroup.findFirst({
    where: { id: groupId, clubId: ctx.club.id },
    select: { id: true },
  });
  if (!existing) return false;
  await prisma.clubMemberGroup.delete({ where: { id: groupId } });
  return true;
}

export async function addClubMemberFavourites(ctx: ClubAuthContext, memberIds: string[]) {
  if (ctx.workspaceKind === 'team') {
    throw new Error('Favourites are not available for team workspaces yet.');
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

export async function listClubMemberFavouriteIds(ctx: ClubAuthContext): Promise<string[]> {
  return listClubMemberFavouriteIdsForClub(ctx.club.id);
}

export async function listClubMemberFavouriteIdsForClub(clubId: string): Promise<string[]> {
  const rows = await prisma.clubMemberFavorite.findMany({
    where: { clubId },
    select: { memberId: true },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => r.memberId);
}

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
  if (!group) return [];
  return group.members.map((m) => m.memberId);
}

export async function countClubMemberGroupMembers(clubId: string, groupId: string): Promise<number> {
  return prisma.clubMemberGroupMember.count({
    where: { groupId, group: { clubId } },
  });
}

export async function countClubMemberFavourites(clubId: string): Promise<number> {
  return prisma.clubMemberFavorite.count({ where: { clubId } });
}

export async function listClubMemberFavourites(
  ctx: ClubAuthContext,
  params: ArchiveQueryParams = {}
): Promise<PaginatedArchive<Record<string, unknown>>> {
  const memberIds = await listClubMemberFavouriteIds(ctx);
  return listClubMemberArchiveRows(ctx, params, memberIds);
}
