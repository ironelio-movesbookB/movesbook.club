import { NextRequest, NextResponse } from 'next/server';
import { UserType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { parseClubDescriptionMeta, getClubMyPageDisplayName } from '@/lib/club/clubSidebarLabel';
import {
  parseClubSubscriptionEndDate,
  parseClubSubscriptionStartDate,
} from '@/lib/admin/clubSubscriptionStatus';
import { getUserPersonalWebsiteHref } from '@/lib/userPersonalWebsite';
import {
  buildPcuPanel,
  inferProfileSegment,
  typeBadgeLabel,
} from '@/lib/admin/userPcuPanel';
import { readProfilePanelSettings } from '@/lib/admin/userProfilePanelSettings';
import { readPcuAccessSettings } from '@/lib/admin/userPcuAccessSettings';
import { pickClubForAdminProfile } from '@/lib/admin/pickClubForAdminProfile';
import { readPcuSettingsForScope } from '@/lib/admin/userPcuSettings';
import { loadClubAdminInfoForUser } from '@/lib/user/clubAdminInfoPersistence';
import { buildAdminUserPanelFields } from '@/lib/admin/clubUserPanel';
import { buildProfileSubscriptionRows } from '@/lib/admin/buildProfileSubscriptionRows';
import { resolveMembershipDatesForEntity } from '@/lib/admin/networkSubscriptionHistory';

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
      return String(userType);
  }
}

function sportLabel(s: string): string {
  return s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const userId = params?.id;
  if (!userId) {
    return NextResponse.json({ error: 'User id is required' }, { status: 400 });
  }

  const url = new URL(request.url);
  let segment = url.searchParams.get('segment') || '';
  const searchQuery = (url.searchParams.get('q') || '').trim();
  const clubIdParam = (url.searchParams.get('clubId') || '').trim();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      firstName: true,
      surname: true,
      userType: true,
      country: true,
      gender: true,
      birthdate: true,
      telegramAccount: true,
      image: true,
      createdAt: true,
      mainSports: { select: { sport: true }, orderBy: { order: 'asc' } },
      ownedClubs: {
        select: {
          id: true,
          name: true,
          location: true,
          description: true,
          createdAt: true,
          _count: { select: { members: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
      ownedTeams: {
        select: {
          id: true,
          name: true,
          description: true,
          sport: true,
          createdAt: true,
          _count: { select: { members: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      },
      ownedGroups: {
        select: {
          id: true,
          name: true,
          description: true,
          groupType: true,
          createdAt: true,
          _count: { select: { members: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      },
      ownedCoachingGroups: {
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          _count: { select: { members: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      },
      clubMemberships: {
        select: { club: { select: { name: true, location: true } } },
        orderBy: { joinedAt: 'desc' },
        take: 1,
      },
      settings: { select: { adminSettings: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (!segment || segment === 'all' || !SEGMENT_TYPES[segment]) {
    segment = inferProfileSegment(user.userType);
  }

  const types = SEGMENT_TYPES[segment];
  if (!types?.includes(user.userType)) {
    segment = inferProfileSegment(user.userType);
  }

  const fullName = [user.firstName, user.surname].filter(Boolean).join(' ').trim() || user.name;
  const entityIdParam = clubIdParam;
  const primaryOwned = pickClubForAdminProfile(user.ownedClubs, {
    clubId: entityIdParam || null,
    searchQuery: searchQuery || null,
  });
  const primaryMember = user.clubMemberships[0]?.club;
  const clubMeta = parseClubDescriptionMeta(primaryOwned?.description);
  const primaryTeam =
    (entityIdParam
      ? user.ownedTeams.find((t) => t.id === entityIdParam)
      : user.ownedTeams[0]) ?? null;
  const primaryGroup =
    (entityIdParam
      ? user.ownedGroups.find((g) => g.id === entityIdParam)
      : user.ownedGroups[0]) ?? null;
  const primaryCoaching =
    (entityIdParam
      ? user.ownedCoachingGroups.find((g) => g.id === entityIdParam)
      : user.ownedCoachingGroups[0]) ?? null;

  const officialClubName = primaryOwned
    ? getClubMyPageDisplayName(primaryOwned)
    : primaryTeam?.name?.trim() ||
      primaryGroup?.name?.trim() ||
      primaryCoaching?.name?.trim() ||
      primaryMember?.name?.trim() ||
      '';
  const location =
    primaryOwned?.location?.trim() ||
    primaryMember?.location?.trim() ||
    '';
  const sportLine =
    user.mainSports.length > 0
      ? user.mainSports.map((m) => sportLabel(m.sport)).join(', ')
      : clubMeta.category?.trim() ||
        primaryTeam?.sport?.trim() ||
        primaryGroup?.groupType?.trim() ||
        '';

  const [planCount, loginLogCount] = await Promise.all([
    prisma.workoutPlan.count({ where: { userId: user.id } }),
    prisma.userLoginLog.count({ where: { userId: user.id } }),
  ]);

  type SubscriptionCurrent = {
    id: string;
    dateStart: string;
    dateEnd: string | null;
    version: string;
    username: string;
    companyName: string;
    e: string;
    entityId: string | null;
  };

  let subscriptionCurrent: SubscriptionCurrent = {
    id: `account-${user.id}`,
    dateStart: user.createdAt.toISOString().slice(0, 10),
    dateEnd: null,
    version: versionLabel(user.userType),
    username: user.username,
    companyName: officialClubName,
    e: String(planCount),
    entityId: null,
  };

  if (segment === 'clubs' && primaryOwned) {
    const endDate = parseClubSubscriptionEndDate(
      primaryOwned.description,
      primaryOwned.createdAt,
    );
    const dateStart =
      parseClubSubscriptionStartDate(primaryOwned.description, primaryOwned.createdAt) ||
      primaryOwned.createdAt.toISOString().slice(0, 10);
    subscriptionCurrent = {
      id: `account-${user.id}`,
      dateStart,
      dateEnd: endDate?.toISOString().slice(0, 10) ?? null,
      version:
        clubMeta.category?.trim() && clubMeta.category !== 'Other'
          ? `Club ${clubMeta.category}`
          : versionLabel(user.userType),
      username: clubMeta.username?.trim() || user.username,
      companyName: primaryOwned.name?.trim() || officialClubName,
      e: String(planCount),
      entityId: primaryOwned.id,
    };
  } else if (segment === 'teams' && primaryTeam) {
    const teamMeta = parseClubDescriptionMeta(primaryTeam.description);
    const teamVersion = primaryTeam.sport?.trim()
      ? `Team ${primaryTeam.sport.trim()}`
      : 'Team account';
    const { dateStart, dateEnd } = resolveMembershipDatesForEntity({
      userId: user.id,
      entityId: primaryTeam.id,
      adminSettingsRaw: user.settings?.adminSettings,
      entityDescription: primaryTeam.description,
      entityCreatedAt: primaryTeam.createdAt,
      companyName: primaryTeam.name.trim(),
      username: teamMeta.username?.trim() || user.username,
      version: teamVersion,
    });
    subscriptionCurrent = {
      id: `account-${user.id}`,
      dateStart,
      dateEnd,
      version: teamVersion,
      username: teamMeta.username?.trim() || user.username,
      companyName: primaryTeam.name.trim(),
      e: String(planCount),
      entityId: primaryTeam.id,
    };
  } else if (segment === 'groups' && primaryGroup) {
    const groupMeta = parseClubDescriptionMeta(primaryGroup.description);
    const groupVersion = primaryGroup.groupType?.trim()
      ? `Group ${primaryGroup.groupType.trim()}`
      : 'Group account';
    const { dateStart, dateEnd } = resolveMembershipDatesForEntity({
      userId: user.id,
      entityId: primaryGroup.id,
      adminSettingsRaw: user.settings?.adminSettings,
      entityDescription: primaryGroup.description,
      entityCreatedAt: primaryGroup.createdAt,
      companyName: primaryGroup.name.trim(),
      username: groupMeta.username?.trim() || user.username,
      version: groupVersion,
    });
    subscriptionCurrent = {
      id: `account-${user.id}`,
      dateStart,
      dateEnd,
      version: groupVersion,
      username: groupMeta.username?.trim() || user.username,
      companyName: primaryGroup.name.trim(),
      e: String(planCount),
      entityId: primaryGroup.id,
    };
  } else if (segment === 'coaches' && primaryCoaching) {
    const coachMeta = parseClubDescriptionMeta(primaryCoaching.description);
    const { dateStart, dateEnd } = resolveMembershipDatesForEntity({
      userId: user.id,
      entityId: primaryCoaching.id,
      adminSettingsRaw: user.settings?.adminSettings,
      entityDescription: primaryCoaching.description,
      entityCreatedAt: primaryCoaching.createdAt,
      companyName: primaryCoaching.name.trim(),
      username: coachMeta.username?.trim() || user.username,
      version: 'Coach account',
    });
    subscriptionCurrent = {
      id: `account-${user.id}`,
      dateStart,
      dateEnd,
      version: 'Coach account',
      username: coachMeta.username?.trim() || user.username,
      companyName: primaryCoaching.name.trim(),
      e: String(planCount),
      entityId: primaryCoaching.id,
    };
  } else if (primaryOwned) {
    const endDate = parseClubSubscriptionEndDate(
      primaryOwned.description,
      primaryOwned.createdAt,
    );
    const dateStart =
      parseClubSubscriptionStartDate(primaryOwned.description, primaryOwned.createdAt) ||
      primaryOwned.createdAt.toISOString().slice(0, 10);
    subscriptionCurrent = {
      id: `account-${user.id}`,
      dateStart,
      dateEnd: endDate?.toISOString().slice(0, 10) ?? null,
      version:
        clubMeta.category?.trim() && clubMeta.category !== 'Other'
          ? `Club ${clubMeta.category}`
          : versionLabel(user.userType),
      username: clubMeta.username?.trim() || user.username,
      companyName: primaryOwned.name?.trim() || officialClubName,
      e: String(planCount),
      entityId: primaryOwned.id,
    };
  }

  if (!subscriptionCurrent.entityId) {
    const accountDefaults = {
      accessStartIso: subscriptionCurrent.dateStart,
      accessEndIso: subscriptionCurrent.dateEnd ?? '',
    };
    const accountPcuAccess = readPcuAccessSettings(
      user.settings?.adminSettings,
      accountDefaults,
    );
    if (accountPcuAccess.accessStartIso.trim() && accountPcuAccess.accessEndIso.trim()) {
      subscriptionCurrent = {
        ...subscriptionCurrent,
        dateStart: accountPcuAccess.accessStartIso,
        dateEnd: accountPcuAccess.accessEndIso,
      };
    } else {
      const accountDates = resolveMembershipDatesForEntity({
        userId: user.id,
        entityId: null,
        adminSettingsRaw: user.settings?.adminSettings,
        entityDescription: null,
        entityCreatedAt: user.createdAt,
        companyName: subscriptionCurrent.companyName || officialClubName || user.username,
        username: subscriptionCurrent.username || user.username,
        version: subscriptionCurrent.version,
      });
      subscriptionCurrent = {
        ...subscriptionCurrent,
        dateStart: accountDates.dateStart,
        dateEnd: accountDates.dateEnd,
      };
    }
  }

  const personalWebsiteHref = await getUserPersonalWebsiteHref(user.id);

  const entityPcuAccessWindow = {
    accessStartIso: subscriptionCurrent.dateStart,
    accessEndIso: subscriptionCurrent.dateEnd ?? '',
  };
  const pcuAccessStored = readPcuAccessSettings(
    user.settings?.adminSettings,
    entityPcuAccessWindow,
  );
  const pcuAccess =
    subscriptionCurrent.entityId != null
      ? { ...pcuAccessStored, ...entityPcuAccessWindow }
      : pcuAccessStored;

  const subscriptionRows = buildProfileSubscriptionRows(
    user.settings?.adminSettings,
    { ...subscriptionCurrent, userId: user.id },
    subscriptionCurrent.entityId != null
      ? entityPcuAccessWindow
      : pcuAccessStored.accessStartIso.trim() && pcuAccessStored.accessEndIso.trim()
        ? {
            accessStartIso: pcuAccessStored.accessStartIso,
            accessEndIso: pcuAccessStored.accessEndIso,
          }
        : entityPcuAccessWindow,
  );

  const pcuUser =
    segment === 'clubs' && primaryOwned
      ? {
          ...user,
          ownedClubs: [
            primaryOwned,
            ...user.ownedClubs.filter((c) => c.id !== primaryOwned.id),
          ],
        }
      : segment === 'teams' && primaryTeam
        ? {
            ...user,
            ownedTeams: [
              primaryTeam,
              ...user.ownedTeams.filter((t) => t.id !== primaryTeam.id),
            ],
          }
        : segment === 'groups' && primaryGroup
          ? {
              ...user,
              ownedGroups: [
                primaryGroup,
                ...user.ownedGroups.filter((g) => g.id !== primaryGroup.id),
              ],
            }
          : segment === 'coaches' && primaryCoaching
            ? {
                ...user,
                ownedCoachingGroups: [
                  primaryCoaching,
                  ...user.ownedCoachingGroups.filter((g) => g.id !== primaryCoaching.id),
                ],
              }
            : user;

  const pcuPanel = buildPcuPanel(pcuUser, segment, loginLogCount, planCount, {
    selectedEntityId: entityIdParam || null,
  });

  if (segment === 'clubs' && pcuPanel.entityProfile) {
    const { clubAdminInfo } = await loadClubAdminInfoForUser(user.id);
    const phone = [clubAdminInfo.phonePrefix.trim(), clubAdminInfo.phoneNumber.trim()]
      .filter(Boolean)
      .join(' ');
    const telegram =
      clubAdminInfo.whatsapp.url.trim() ||
      clubMeta.directAccess?.trim() ||
      '';
    pcuPanel.entityProfile = {
      ...pcuPanel.entityProfile,
      phone,
      telegram,
    };
  }

  const profilePanel = readProfilePanelSettings(user.settings?.adminSettings);
  const pcuSettings = readPcuSettingsForScope(
    user.settings?.adminSettings,
    entityIdParam || null,
  );

  return NextResponse.json({
    id: user.id,
    username: user.username,
    email: user.email,
    fullName,
    country: user.country?.trim() || '',
    location,
    officialClubName,
    sportLine,
    typeBadge: typeBadgeLabel(user.userType),
    userType: user.userType,
    imageUrl: user.image?.trim() || null,
    subscriptionRows,
    segment,
    pcuPanel,
    profilePanel,
    pcuAccess,
    pcuSettings,
    userPanel: buildAdminUserPanelFields(user, segment, {
      planCount,
      websiteUrl: personalWebsiteHref,
      cityLocality: location,
      adminSettingsRaw: user.settings?.adminSettings,
      club: primaryOwned ?? undefined,
      team: primaryTeam ?? undefined,
      group: primaryGroup ?? undefined,
      coachingGroup: primaryCoaching ?? undefined,
    }),
  });
}
