import { NextRequest, NextResponse } from 'next/server';
import { Prisma, SportType, UserType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import {
  aggregateClubAdminSubscriptionStatus,
  inferMembershipEndDateYmd,
  membershipStatusToneFromLabel,
  parseClubSubscriptionEndDate,
  parseClubSubscriptionStartDate,
  type ClubSubscriptionStatusTone,
} from '@/lib/admin/clubSubscriptionStatus';
import { sortClubsByCreatedAtAsc } from '@/lib/club/clubSidebarLabel';
import {
  expandRegisteredUserListRows,
  isClubUserType,
  type RegisteredUserListRow,
} from '@/lib/admin/expandRegisteredUserListRows';
import {
  buildMembershipListRows,
  filterListRowsBySubscriptionDateRange,
  getDefaultMembershipSortOrder,
  parseMembershipViewMode,
  parseSubscriptionDateField,
  periodStatusFromDates,
  readDeletedSubscriptionPeriods,
  readNetworkSubscriptionHistory,
  type NetworkSubscriptionPeriod,
  type PcuAccessWindow,
  type SubscriptionPeriodDeletion,
} from '@/lib/admin/networkSubscriptionHistory';
import { readPcuAccessSettings } from '@/lib/admin/userPcuAccessSettings';
import {
  buildMovesbookUserTextSearchOr,
  filterListRowsByTextSearch,
  segmentShouldMatchOwnedClubs,
} from '@/lib/admin/movesbookUserTextSearch';
import { resolvePublicImageUrl } from '@/lib/profileImageUrl';
import { resolveStatsBarUserIds } from '@/lib/admin/buildStatistics';
import {
  parseStatsKindParam,
  parseStatsVersionParam,
} from '@/lib/admin/statsBarListHref';
import {
  listSpecialOfferRegistrations,
  type SpecialOfferUserRegistration,
} from '@/lib/subscriptions/specialOffers';

export const dynamic = 'force-dynamic';

const ALL_REGISTERED_TYPES: UserType[] = [
  UserType.ATHLETE,
  UserType.COACH,
  UserType.GROUP,
  UserType.GROUP_ADMIN,
  UserType.TEAM,
  UserType.TEAM_MANAGER,
  UserType.CLUB,
  UserType.CLUB_TRAINER,
];

const SEGMENT_TYPES: Record<string, UserType[]> = {
  all: ALL_REGISTERED_TYPES,
  'single-user': [UserType.ATHLETE],
  coaches: [UserType.COACH],
  groups: [UserType.GROUP, UserType.GROUP_ADMIN],
  teams: [UserType.TEAM, UserType.TEAM_MANAGER],
  clubs: [UserType.CLUB, UserType.CLUB_TRAINER],
};

const USER_TYPE_CATEGORY_TYPES: Record<string, UserType[]> = {
  'single-user': [UserType.ATHLETE],
  coaches: [UserType.COACH],
  groups: [UserType.GROUP, UserType.GROUP_ADMIN],
  teams: [UserType.TEAM, UserType.TEAM_MANAGER],
  clubs: [UserType.CLUB, UserType.CLUB_TRAINER],
};

function versionLabel(userType: UserType): string {
  switch (userType) {
    case UserType.ATHLETE:
      return 'User — base version';
    case UserType.COACH:
      return 'Coach — base';
    case UserType.TEAM:
    case UserType.TEAM_MANAGER:
      return 'Team account';
    case UserType.CLUB:
    case UserType.CLUB_TRAINER:
      return 'Club account';
    case UserType.GROUP:
    case UserType.GROUP_ADMIN:
      return 'Group account';
    default:
      return userType;
  }
}

function parseOrder(
  raw: string | null,
): Prisma.UserOrderByWithRelationInput | Prisma.UserOrderByWithRelationInput[] {
  switch (raw) {
    case 'username':
      return { username: 'asc' };
    case 'fullname':
      return [{ surname: 'asc' }, { firstName: 'asc' }, { name: 'asc' }];
    case 'date':
      return { createdAt: 'desc' };
    case 'date_end':
      return { updatedAt: 'desc' };
    default:
      return { createdAt: 'desc' };
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const segment = url.searchParams.get('segment') || 'single-user';
  const types = SEGMENT_TYPES[segment];
  if (!types) {
    return NextResponse.json({ error: 'Invalid segment' }, { status: 400 });
  }

  const search = (url.searchParams.get('q') || '').trim();
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '25', 10) || 25));
  const orderParam = url.searchParams.get('order') || '';
  const country = (url.searchParams.get('country') || '').trim();
  const sportRaw = (url.searchParams.get('sport') || '').trim();
  const version = (url.searchParams.get('version') || '').trim();
  const login = (url.searchParams.get('login') || 'all').trim();
  const subDateField = (url.searchParams.get('subDateField') || 'dateStart').trim();
  const subRangeFrom = (url.searchParams.get('subRangeFrom') || '').trim();
  const subRangeTo = (url.searchParams.get('subRangeTo') || '').trim();
  const hasSubDateRange = Boolean(subRangeFrom || subRangeTo);
  const needsRowLevelSearchFilter = Boolean(
    search &&
      (segment === 'all' ||
        segment === 'clubs' ||
        segment === 'teams' ||
        segment === 'groups' ||
        segment === 'coaches'),
  );
  const specialOfferVersionRaw = Number(url.searchParams.get('specialOfferVersionId') || '0');
  const specialOfferVersionId =
    Number.isInteger(specialOfferVersionRaw) && specialOfferVersionRaw > 0
      ? specialOfferVersionRaw
      : null;
  const specialOfferOnly =
    url.searchParams.get('specialOffer') === '1' || specialOfferVersionId !== null;
  const fetchAllMatchingUsers = hasSubDateRange || needsRowLevelSearchFilter || specialOfferOnly;
  const userTypeCategory = (url.searchParams.get('userTypeCategory') || '').trim();
  const membershipMode = parseMembershipViewMode(url.searchParams.get('membership'));
  const membershipSort =
    (url.searchParams.get('order') || '').trim() ||
    getDefaultMembershipSortOrder(membershipMode);
  const statsBar = url.searchParams.get('statsBar') === '1';
  const statsKind = parseStatsKindParam(url.searchParams.get('statsKind'));
  const subscriptionVersion = parseStatsVersionParam(
    url.searchParams.get('subscriptionVersion'),
  );

  let finalTypes = types;
  if (userTypeCategory && USER_TYPE_CATEGORY_TYPES[userTypeCategory]) {
    finalTypes = types.filter((t) => USER_TYPE_CATEGORY_TYPES[userTypeCategory].includes(t));
  }
  // Stats-bar lists already constrain by statsKind via user ids — skip account-type "version" filter
  // unless this is a normal (non-stats) list request.
  if (version && !statsBar) {
    finalTypes = finalTypes.filter((t) => versionLabel(t) === version);
  }
  if (finalTypes.length === 0) {
    return NextResponse.json({
      total: 0,
      page,
      pageSize,
      users: [],
    });
  }

  const andClauses: Prisma.UserWhereInput[] = [{ userType: { in: finalTypes } }];

  if (statsBar) {
    const ids = await resolveStatsBarUserIds({
      country: country || null,
      kind: statsKind ?? 'all',
      version: subscriptionVersion,
    });
    andClauses.push({ id: { in: ids.length > 0 ? ids : ['__no_stats_bar_match__'] } });
  }

  const offerFilterRegistrations: SpecialOfferUserRegistration[] = specialOfferOnly
    ? await listSpecialOfferRegistrations({ versionId: specialOfferVersionId })
    : [];
  if (specialOfferOnly) {
    const ids = [...new Set(offerFilterRegistrations.map((r) => r.userId))];
    andClauses.push({ id: { in: ids.length > 0 ? ids : ['__no_special_offer_match__'] } });
  }

  if (search) {
    andClauses.push(
      buildMovesbookUserTextSearchOr(search, {
        matchOwnedClubs: segmentShouldMatchOwnedClubs(segment),
      }),
    );
  }

  // When statsBar=1, country is applied inside resolveStatsBarUserIds (incl. "Unknown").
  if (country && !statsBar) {
    andClauses.push({ country });
  }

  if (sportRaw && Object.values(SportType).includes(sportRaw as SportType)) {
    andClauses.push({
      mainSports: { some: { sport: sportRaw as SportType } },
    });
  }

  if (login === 'never') {
    andClauses.push({ lastSeenAt: null });
  } else if (login === 'active7') {
    andClauses.push({
      lastSeenAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    });
  } else if (login === 'active24h') {
    andClauses.push({
      lastSeenAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
  }

  const where: Prisma.UserWhereInput = { AND: andClauses };
  const orderBy = parseOrder(orderParam);

  const userSelect = {
    id: true,
    username: true,
    email: true,
    name: true,
    firstName: true,
    surname: true,
    userType: true,
    country: true,
    image: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  const [dbTotal, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: userSelect,
      orderBy,
      ...(fetchAllMatchingUsers
        ? {}
        : { skip: (page - 1) * pageSize, take: pageSize }),
    }),
  ]);

  const isClubsSegment = segment === 'clubs';
  const isTeamsSegment = segment === 'teams';
  const isGroupsSegment = segment === 'groups';
  const isCoachesSegment = segment === 'coaches';
  const isAllSegment = segment === 'all';
  const shouldExpandEntityRows =
    (isClubsSegment ||
      isAllSegment ||
      isTeamsSegment ||
      isGroupsSegment ||
      isCoachesSegment) &&
    membershipMode !== 'lastPerUser';
  const userIds = rows.map((u) => u.id);

  const clubsByAdmin = new Map<
    string,
    { id: string; name: string; description: string | null; createdAt: Date; location: string | null }[]
  >();
  const clubUserIds = isAllSegment
    ? rows.filter((u) => isClubUserType(u.userType)).map((u) => u.id)
    : userIds;
  if ((isClubsSegment || isAllSegment) && clubUserIds.length > 0) {
    const ownedClubs = await prisma.club.findMany({
      where: { adminId: { in: clubUserIds } },
      select: { adminId: true, id: true, name: true, description: true, createdAt: true, location: true },
    });
    for (const club of ownedClubs) {
      const list = clubsByAdmin.get(club.adminId) ?? [];
      list.push({
        id: club.id,
        name: club.name,
        description: club.description,
        createdAt: club.createdAt,
        location: club.location,
      });
      clubsByAdmin.set(club.adminId, list);
    }
  }

  const locationByUserId = new Map<string, string>();
  const nonClubLocationIds = isAllSegment
    ? rows.filter((u) => !isClubUserType(u.userType)).map((u) => u.id)
    : isClubsSegment
      ? []
      : userIds;
  if (nonClubLocationIds.length > 0) {
    const memberships = await prisma.clubMember.findMany({
      where: { memberId: { in: nonClubLocationIds } },
      select: {
        memberId: true,
        club: { select: { location: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });
    for (const m of memberships) {
      const loc = m.club.location?.trim();
      if (loc && !locationByUserId.has(m.memberId)) {
        locationByUserId.set(m.memberId, loc);
      }
    }
  }

  const teamsByAdmin = new Map<
    string,
    { id: string; name: string; description: string | null; sport: string | null; createdAt: Date }[]
  >();
  const groupsByAdmin = new Map<
    string,
    {
      id: string;
      name: string;
      description: string | null;
      groupType: string | null;
      createdAt: Date;
    }[]
  >();
  const coachingGroupsByCoach = new Map<
    string,
    { id: string; name: string; description: string | null; createdAt: Date }[]
  >();

  if ((isAllSegment || isTeamsSegment || isGroupsSegment || isCoachesSegment) && userIds.length > 0) {
    const teamAdminIds = isTeamsSegment
      ? userIds
      : rows
          .filter((u) => u.userType === UserType.TEAM || u.userType === UserType.TEAM_MANAGER)
          .map((u) => u.id);
    const groupAdminIds = isGroupsSegment
      ? userIds
      : rows
          .filter((u) => u.userType === UserType.GROUP || u.userType === UserType.GROUP_ADMIN)
          .map((u) => u.id);
    const coachIds = isCoachesSegment
      ? userIds
      : rows.filter((u) => u.userType === UserType.COACH).map((u) => u.id);

    const [ownedTeams, ownedGroups, ownedCoaching] = await Promise.all([
      teamAdminIds.length > 0
        ? prisma.team.findMany({
            where: { adminId: { in: teamAdminIds } },
            select: {
              adminId: true,
              id: true,
              name: true,
              description: true,
              sport: true,
              createdAt: true,
            },
          })
        : [],
      groupAdminIds.length > 0
        ? prisma.group.findMany({
            where: { adminId: { in: groupAdminIds } },
            select: {
              adminId: true,
              id: true,
              name: true,
              description: true,
              groupType: true,
              createdAt: true,
            },
          })
        : [],
      coachIds.length > 0
        ? prisma.coachingGroup.findMany({
            where: { coachId: { in: coachIds } },
            select: {
              coachId: true,
              id: true,
              name: true,
              description: true,
              createdAt: true,
            },
          })
        : [],
    ]);

    for (const team of ownedTeams) {
      const list = teamsByAdmin.get(team.adminId) ?? [];
      list.push({
        id: team.id,
        name: team.name,
        description: team.description,
        sport: team.sport,
        createdAt: team.createdAt,
      });
      teamsByAdmin.set(team.adminId, list);
    }
    for (const group of ownedGroups) {
      const list = groupsByAdmin.get(group.adminId) ?? [];
      list.push({
        id: group.id,
        name: group.name,
        description: group.description,
        groupType: group.groupType,
        createdAt: group.createdAt,
      });
      groupsByAdmin.set(group.adminId, list);
    }
    for (const cg of ownedCoaching) {
      const list = coachingGroupsByCoach.get(cg.coachId) ?? [];
      list.push({
        id: cg.id,
        name: cg.name,
        description: cg.description,
        createdAt: cg.createdAt,
      });
      coachingGroupsByCoach.set(cg.coachId, list);
    }
  }

  const baseRows: RegisteredUserListRow[] = rows.map((u: (typeof rows)[number]) => {
    const displayName = [u.firstName, u.surname].filter(Boolean).join(' ').trim() || u.name;

    let clubsOwnedCount: number | undefined;
    let companyName: string | undefined;
    let status = 'Active';
    let statusTone: ClubSubscriptionStatusTone | undefined;

    let location = '';
    let primaryClubId: string | null = null;
    const userIsClubAdmin = isClubUserType(u.userType);
    const userIsTeamAdmin =
      u.userType === UserType.TEAM || u.userType === UserType.TEAM_MANAGER;
    const userIsGroupAdmin =
      u.userType === UserType.GROUP || u.userType === UserType.GROUP_ADMIN;
    const userIsCoach = u.userType === UserType.COACH;

    if (isClubsSegment || (isAllSegment && userIsClubAdmin)) {
      const adminClubs = clubsByAdmin.get(u.id) ?? [];
      clubsOwnedCount = adminClubs.length;
      if (adminClubs.length > 0) {
        const first = sortClubsByCreatedAtAsc(adminClubs)[0]!;
        primaryClubId = first.id;
        companyName = first.name?.trim() || '';
        location = first.location?.trim() || '';
      }
      const endDates = adminClubs.map((c) =>
        parseClubSubscriptionEndDate(c.description, c.createdAt),
      );
      const aggregated = aggregateClubAdminSubscriptionStatus(endDates);
      status = aggregated.label;
      statusTone = aggregated.tone;
    } else if (isTeamsSegment || (isAllSegment && userIsTeamAdmin)) {
      const adminTeams = teamsByAdmin.get(u.id) ?? [];
      if (adminTeams.length > 0) {
        const first = [...adminTeams].sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
        )[0]!;
        primaryClubId = first.id;
        companyName = first.name?.trim() || '';
        location = first.sport?.trim() || '';
      }
    } else if (isGroupsSegment || (isAllSegment && userIsGroupAdmin)) {
      const adminGroups = groupsByAdmin.get(u.id) ?? [];
      if (adminGroups.length > 0) {
        const first = [...adminGroups].sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
        )[0]!;
        primaryClubId = first.id;
        companyName = first.name?.trim() || '';
        location = first.groupType?.trim() || '';
      }
    } else if (isCoachesSegment || (isAllSegment && userIsCoach)) {
      const coachGroups = coachingGroupsByCoach.get(u.id) ?? [];
      if (coachGroups.length > 0) {
        const first = [...coachGroups].sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
        )[0]!;
        primaryClubId = first.id;
        companyName = first.name?.trim() || '';
      }
    } else {
      location = locationByUserId.get(u.id) ?? '';
      if (isAllSegment && u.userType === UserType.ATHLETE) {
        companyName = '';
      }
    }

    let dateStart = u.createdAt.toISOString().slice(0, 10);
    let dateEnd: string | null = inferMembershipEndDateYmd(dateStart, null);

    if (isClubsSegment || (isAllSegment && userIsClubAdmin)) {
      const adminClubs = clubsByAdmin.get(u.id) ?? [];
      if (adminClubs.length > 0) {
        const first = sortClubsByCreatedAtAsc(adminClubs)[0]!;
        dateStart =
          parseClubSubscriptionStartDate(first.description, first.createdAt) ||
          first.createdAt.toISOString().slice(0, 10);
        const parsedEnd = parseClubSubscriptionEndDate(first.description, first.createdAt);
        dateEnd = inferMembershipEndDateYmd(
          dateStart,
          parsedEnd?.toISOString().slice(0, 10) ?? null,
        );
      }
    }

    const usesClubAggregate =
      (isClubsSegment || (isAllSegment && userIsClubAdmin)) &&
      (clubsByAdmin.get(u.id)?.length ?? 0) > 0;
    if (!usesClubAggregate) {
      status = periodStatusFromDates({ dateStart, dateEnd });
      statusTone = membershipStatusToneFromLabel(status);
    }

    return {
      rowKey: u.id,
      id: u.id,
      username: u.username,
      accountUsername: u.username,
      email: u.email,
      displayName,
      userType: u.userType,
      country: u.country,
      imageUrl: resolvePublicImageUrl(u.image),
      location,
      dateStart,
      dateEnd,
      version: versionLabel(u.userType),
      amount: '—',
      status,
      statusTone,
      ...((isClubsSegment || isAllSegment) && clubsOwnedCount !== undefined
        ? {
            clubsOwnedCount,
            companyName,
            primaryClubId: isClubsSegment || userIsClubAdmin ? primaryClubId : null,
          }
        : isTeamsSegment || isGroupsSegment || isCoachesSegment || isAllSegment
          ? {
              companyName,
              primaryClubId,
            }
          : {}),
    };
  });

  const entityMaps = {
    clubsByAdmin,
    teamsByAdmin,
    groupsByAdmin,
    coachingGroupsByCoach,
  };

  const historyByUserId = new Map<string, NetworkSubscriptionPeriod[]>();
  const deletedByUserId = new Map<string, SubscriptionPeriodDeletion[]>();
  const pcuAccessByUserId = new Map<string, PcuAccessWindow>();
  if (userIds.length > 0) {
    const settingsRows = await prisma.userSettings.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, adminSettings: true },
    });
    for (const s of settingsRows) {
      historyByUserId.set(s.userId, readNetworkSubscriptionHistory(s.adminSettings));
      deletedByUserId.set(s.userId, readDeletedSubscriptionPeriods(s.adminSettings));
      const pcu = readPcuAccessSettings(s.adminSettings, {
        accessStartIso: '',
        accessEndIso: '',
      });
      if (pcu.accessStartIso.trim()) {
        pcuAccessByUserId.set(s.userId, {
          accessStartIso: pcu.accessStartIso,
          accessEndIso: pcu.accessEndIso,
        });
      }
    }
  }

  let users: RegisteredUserListRow[];
  if (membershipMode === 'lastPerUser') {
    const allEntities = expandRegisteredUserListRows(baseRows, entityMaps, {
      expandEntities:
        isClubsSegment ||
        isAllSegment ||
        isTeamsSegment ||
        isGroupsSegment ||
        isCoachesSegment,
    });
    users = buildMembershipListRows(
      allEntities,
      historyByUserId,
      'lastPerUser',
      membershipSort,
      deletedByUserId,
      pcuAccessByUserId,
    );
  } else {
    const entityExpanded = expandRegisteredUserListRows(baseRows, entityMaps, {
      expandEntities: shouldExpandEntityRows,
    });
    users = buildMembershipListRows(
      entityExpanded,
      historyByUserId,
      membershipMode,
      membershipSort,
      deletedByUserId,
      pcuAccessByUserId,
    );
  }

  if (userIds.length > 0) {
    const offerRegs: SpecialOfferUserRegistration[] = specialOfferOnly
      ? offerFilterRegistrations
      : await listSpecialOfferRegistrations({ userIds });
    if (offerRegs.length > 0) {
      const regsByUser = new Map<string, SpecialOfferUserRegistration[]>();
      for (const reg of offerRegs) {
        const list = regsByUser.get(reg.userId) ?? [];
        list.push(reg);
        regsByUser.set(reg.userId, list);
      }
      users = users.map((row) => {
        if (row.entityId && row.entityId !== row.primaryClubId) return row;
        const rowStartMs = Date.parse(`${row.dateStart}T00:00:00Z`);
        const reg = regsByUser
          .get(row.id)
          ?.find(
            (r) =>
              Math.abs(Date.parse(`${r.dateStart}T00:00:00Z`) - rowStartMs) <= 24 * 60 * 60 * 1000,
          );
        if (!reg) return row;
        return {
          ...row,
          version: reg.versionName,
          amount: row.amount && row.amount !== '—' ? row.amount : `€ ${reg.costEuro}`,
          specialOffer: true,
          specialOfferTitle: reg.offerTitle,
        };
      });
    }
    if (specialOfferOnly) {
      users = users.filter((row) => row.specialOffer);
    }
  }

  if (needsRowLevelSearchFilter) {
    users = filterListRowsByTextSearch(users, search);
  }

  if (hasSubDateRange) {
    users = filterListRowsBySubscriptionDateRange(
      users,
      parseSubscriptionDateField(subDateField),
      subRangeFrom,
      subRangeTo,
    );
  }

  if (fetchAllMatchingUsers) {
    const totalFiltered = users.length;
    users = users.slice((page - 1) * pageSize, page * pageSize);
    return NextResponse.json({
      total: totalFiltered,
      page,
      pageSize,
      users,
      membership: membershipMode,
      membershipSort,
      expandedRowCount: users.length,
    });
  }

  return NextResponse.json({
    total: dbTotal,
    page,
    pageSize,
    users,
    membership: membershipMode,
    membershipSort,
    expandedRowCount: users.length,
  });
}
