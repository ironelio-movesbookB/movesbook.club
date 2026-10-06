import type { Notification, UserType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getLogoUrlFromEntityDescription } from '@/lib/entity/entityLogo';
import {
  expandStaffAudienceRoles,
  hasMeaningfulNotificationHtml,
  isClubAudienceKind,
  isNotificationSource,
  isOrgNotificationSource,
  isStaffAudienceRole,
  normalizeProfileLanguage,
  parseJsonStringArray,
  parseJsonStringRecord,
  parseUsernameInput,
  resolveNotificationHtmlForLanguage,
  staffLanguagesMatchUser,
  toJsonStringArray,
  toJsonStringRecord,
  type ClubAudienceKind,
  type NotificationSource,
  type StaffAudienceRole,
} from '@/lib/notifications/audience';

/** Public Movesbook mark used on staff-sent notification cards. */
export const MOVESBOOK_STAFF_LOGO_URL = '/img/logo.png';

export type NotificationDto = {
  id: string;
  source: NotificationSource;
  title: string;
  description: string;
  path: string | null;
  untilDate: string;
  langId: string | null;
  prioritary: boolean;
  isShow: boolean;
  audienceRoles: string[];
  audienceUsernames: string[];
  audienceUserIds: string[];
  clubIds: string[];
  audienceKind: ClubAudienceKind;
  audienceLanguages: string[];
  contentsByLang: Record<string, string>;
  titlesByLang: Record<string, string>;
  submittedByUserId: string | null;
  submittedByAdminId: string | null;
  submittedByName: string | null;
  submittedByUsername: string | null;
  submittedByImage: string | null;
  /** Inbox logo: Movesbook brand or club/team/user avatar */
  senderLogoUrl: string | null;
  /** Official name shown beside logo */
  senderOfficialName: string | null;
  /** Every recipient club/team/group (logo + name) for org notifications */
  recipientClubs: NotificationRecipientEntity[];
  createdAt: string;
  visited: boolean;
};

export type NotificationRecipientEntity = {
  id: string;
  name: string;
  logoUrl: string | null;
};

function startOfTodayUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function daysAgoUtc(days: number): Date {
  const d = startOfTodayUtc();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function toDateOnly(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!m) throw new Error('Invalid untilDate');
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function formatDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function hasMeaningfulHtml(html: string): boolean {
  return hasMeaningfulNotificationHtml(html);
}

function mapRow(
  row: Notification & {
    submittedByUser?: {
      id: string;
      name: string;
      username: string;
      image: string | null;
    } | null;
  },
  visitedIds?: Set<string>,
  profileLang?: string,
): NotificationDto {
  const contentsByLang = parseJsonStringRecord(row.contentsByLangJson);
  const titlesByLang = parseJsonStringRecord(
    (row as Notification & { titlesByLangJson?: string | null }).titlesByLangJson,
  );
  const audienceLanguages = parseJsonStringArray(row.audienceLanguagesJson);
  const resolvedDescription =
    profileLang != null
      ? resolveNotificationHtmlForLanguage(contentsByLang, profileLang, row.description)
      : row.description;
  const resolvedTitle =
    profileLang != null
      ? resolveNotificationHtmlForLanguage(titlesByLang, profileLang, row.title)
      : row.title;

  const isMovesbook = row.source === 'movesbook_staff';
  const senderOfficialName =
    row.submittedByUser?.name || row.submittedByUser?.username || (isMovesbook ? 'Movesbook Staff' : null);
  const senderLogoUrl = isMovesbook
    ? MOVESBOOK_STAFF_LOGO_URL
    : row.submittedByUser?.image || null;

  return {
    id: row.id,
    source: (isNotificationSource(row.source) ? row.source : 'movesbook_staff') as NotificationSource,
    title: resolvedTitle,
    description: resolvedDescription,
    path: row.path,
    untilDate: formatDateOnly(row.untilDate),
    langId: row.langId,
    prioritary: row.prioritary,
    isShow: row.isShow,
    audienceRoles: parseJsonStringArray(row.audienceRolesJson),
    audienceUsernames: parseJsonStringArray(row.audienceUsernamesJson),
    audienceUserIds: parseJsonStringArray(row.audienceUserIdsJson),
    clubIds: parseJsonStringArray(row.clubIdsJson),
    audienceKind: isClubAudienceKind(row.audienceKind) ? row.audienceKind : 'members',
    audienceLanguages,
    contentsByLang,
    titlesByLang,
    submittedByUserId: row.submittedByUserId,
    submittedByAdminId: row.submittedByAdminId,
    submittedByName: row.submittedByUser?.name ?? null,
    submittedByUsername: row.submittedByUser?.username ?? null,
    submittedByImage: row.submittedByUser?.image ?? null,
    senderLogoUrl,
    senderOfficialName,
    recipientClubs: [],
    createdAt: row.createdAt.toISOString(),
    visited: visitedIds ? visitedIds.has(row.id) : false,
  };
}

/**
 * Resolve club/team/group logo + official name for org-sourced cards.
 * `focusEntityId` limits recipients to one club (Club Admin MY CLUB view).
 */
async function enrichOrgSenderDisplay(
  items: NotificationDto[],
  focusEntityId?: string | null,
): Promise<NotificationDto[]> {
  const orgItems = items.filter((i) => i.source !== 'movesbook_staff' && i.clubIds.length > 0);
  if (orgItems.length === 0) return items;

  const clubIds = Array.from(new Set(orgItems.flatMap((i) => i.clubIds)));
  const teamIds = Array.from(
    new Set(orgItems.filter((i) => i.source === 'team_admin').flatMap((i) => i.clubIds)),
  );
  const groupIds = Array.from(
    new Set(orgItems.filter((i) => i.source === 'group_admin').flatMap((i) => i.clubIds)),
  );
  const coachGroupIds = Array.from(
    new Set(orgItems.filter((i) => i.source === 'coach').flatMap((i) => i.clubIds)),
  );

  const [clubs, teams, groups, coachingGroups] = await Promise.all([
    clubIds.length
      ? prisma.club.findMany({
          where: { id: { in: clubIds } },
          select: { id: true, name: true, description: true },
        })
      : Promise.resolve([]),
    teamIds.length
      ? prisma.team.findMany({
          where: { id: { in: teamIds } },
          select: { id: true, name: true, description: true },
        })
      : Promise.resolve([]),
    groupIds.length
      ? prisma.group.findMany({
          where: { id: { in: groupIds } },
          select: { id: true, name: true, description: true },
        })
      : Promise.resolve([]),
    coachGroupIds.length
      ? prisma.coachingGroup.findMany({
          where: { id: { in: coachGroupIds } },
          select: { id: true, name: true, description: true },
        })
      : Promise.resolve([]),
  ]);

  const clubMap = new Map(clubs.map((c) => [c.id, c]));
  const teamMap = new Map(teams.map((c) => [c.id, c]));
  const groupMap = new Map(groups.map((c) => [c.id, c]));
  const coachMap = new Map(coachingGroups.map((c) => [c.id, c]));

  return items.map((item) => {
    if (item.source === 'movesbook_staff') {
      return {
        ...item,
        senderLogoUrl: MOVESBOOK_STAFF_LOGO_URL,
        senderOfficialName: item.senderOfficialName || 'Movesbook Staff',
      };
    }
    const entityMap =
      item.source === 'club_admin'
        ? clubMap
        : item.source === 'team_admin'
          ? teamMap
          : item.source === 'group_admin'
            ? groupMap
            : item.source === 'coach'
              ? coachMap
              : null;

    const scopedIds =
      focusEntityId && item.clubIds.includes(focusEntityId) ? [focusEntityId] : item.clubIds;
    const recipientClubs: NotificationRecipientEntity[] = [];
    for (const id of scopedIds) {
      const entity = entityMap?.get(id);
      if (!entity) continue;
      recipientClubs.push({
        id,
        name: entity.name,
        logoUrl: getLogoUrlFromEntityDescription(entity.description),
      });
    }

    const first = recipientClubs[0];
    if (!first) {
      return {
        ...item,
        recipientClubs,
        senderLogoUrl: item.submittedByImage || item.senderLogoUrl,
        senderOfficialName:
          item.submittedByName || item.submittedByUsername || item.senderOfficialName,
      };
    }
    return {
      ...item,
      recipientClubs,
      senderLogoUrl: first.logoUrl || item.submittedByImage || item.senderLogoUrl,
      senderOfficialName: first.name,
    };
  });
}

async function resolveUsernamesToIds(usernames: string[]): Promise<{ userIds: string[]; missing: string[] }> {
  if (usernames.length === 0) return { userIds: [], missing: [] };
  const users = await prisma.user.findMany({
    where: { username: { in: usernames } },
    select: { id: true, username: true },
  });
  const found = new Map(users.map((u) => [u.username.toLowerCase(), u.id]));
  const userIds: string[] = [];
  const missing: string[] = [];
  for (const name of usernames) {
    const id = found.get(name.toLowerCase());
    if (id) userIds.push(id);
    else missing.push(name);
  }
  return { userIds, missing };
}

function buildStaffBodyFields(input: {
  title: string;
  description?: string;
  contentsByLang?: Record<string, string>;
  titlesByLang?: Record<string, string>;
  audienceLanguages?: string[];
}) {
  const contentsByLang = { ...(input.contentsByLang ?? {}) };
  const titlesByLang = { ...(input.titlesByLang ?? {}) };
  const description =
    (typeof input.description === 'string' && input.description.trim()
      ? input.description
      : contentsByLang.en) ||
    Object.values(contentsByLang).find((v) => hasMeaningfulHtml(v)) ||
    '';

  if (!hasMeaningfulHtml(description) && !Object.values(contentsByLang).some(hasMeaningfulHtml)) {
    throw new Error('Message is required');
  }

  if (!contentsByLang.en && description) {
    contentsByLang.en = description;
  }

  const title =
    (typeof input.title === 'string' && input.title.trim() ? input.title.trim() : '') ||
    (titlesByLang.en || '').trim() ||
    Object.values(titlesByLang).find((v) => String(v ?? '').trim())?.trim() ||
    '';

  if (!titlesByLang.en && title) {
    titlesByLang.en = title;
  }

  const audienceLanguages = (input.audienceLanguages ?? [])
    .map((l) => normalizeProfileLanguage(l))
    .filter(Boolean);

  return {
    title,
    description,
    contentsByLangJson: toJsonStringRecord(contentsByLang),
    titlesByLangJson: toJsonStringRecord(titlesByLang),
    audienceLanguagesJson: toJsonStringArray(audienceLanguages),
    langId: audienceLanguages.length === 0 ? '0' : audienceLanguages.join(','),
  };
}

export type CreateStaffNotificationInput = {
  title: string;
  description?: string;
  contentsByLang?: Record<string, string>;
  titlesByLang?: Record<string, string>;
  audienceLanguages?: string[];
  path?: string;
  untilDate: string;
  langId?: string | null;
  prioritary?: boolean;
  audienceRoles?: string[];
  usernamesRaw?: string;
  submittedByAdminId: string;
  submittedByUserId?: string | null;
  editId?: string;
};

export async function createOrUpdateStaffNotification(input: CreateStaffNotificationInput) {
  const roles = (input.audienceRoles ?? []).filter(isStaffAudienceRole) as StaffAudienceRole[];
  const usernames = parseUsernameInput(input.usernamesRaw ?? '');
  if (roles.length === 0 && usernames.length === 0) {
    throw new Error('Select recipient roles and/or type at least one username');
  }

  const { userIds, missing } = await resolveUsernamesToIds(usernames);
  if (missing.length > 0) {
    throw new Error(`Unknown username(s): ${missing.join(', ')}`);
  }

  const bodyFields = buildStaffBodyFields(input);
  if (!bodyFields.title) throw new Error('Object (title) is required');

  const data = {
    source: 'movesbook_staff' as const,
    title: bodyFields.title,
    description: bodyFields.description,
    path: input.path?.trim() || null,
    untilDate: toDateOnly(input.untilDate),
    langId: bodyFields.langId,
    prioritary: Boolean(input.prioritary),
    isShow: true,
    submittedByAdminId: input.submittedByAdminId,
    submittedByUserId: input.submittedByUserId ?? null,
    audienceRolesJson: toJsonStringArray(roles),
    audienceUsernamesJson: toJsonStringArray(usernames),
    audienceUserIdsJson: toJsonStringArray(userIds),
    clubIdsJson: '[]',
    audienceKind: 'members',
    audienceLanguagesJson: bodyFields.audienceLanguagesJson,
    contentsByLangJson: bodyFields.contentsByLangJson,
    titlesByLangJson: bodyFields.titlesByLangJson,
  };

  if (input.editId) {
    const existing = await prisma.notification.findFirst({
      where: { id: input.editId, source: 'movesbook_staff' },
    });
    if (!existing) throw new Error('Notification not found');
    return prisma.notification.update({ where: { id: input.editId }, data });
  }

  return prisma.notification.create({ data });
}

export type CreateClubNotificationInput = {
  title: string;
  description: string;
  path?: string;
  untilDate: string;
  prioritary?: boolean;
  audienceKind?: ClubAudienceKind;
  clubIds: string[];
  submittedByUserId: string;
  editId?: string;
};

export async function createOrUpdateClubNotification(input: CreateClubNotificationInput) {
  const title = input.title.trim();
  const description = input.description.trim();
  if (!title) throw new Error('Object (title) is required');
  if (!hasMeaningfulHtml(description)) throw new Error('Message is required');

  const clubIds = Array.from(new Set(input.clubIds.map((id) => id.trim()).filter(Boolean)));
  if (clubIds.length === 0) throw new Error('Select at least one club');

  const owned = await prisma.club.findMany({
    where: { id: { in: clubIds }, adminId: input.submittedByUserId },
    select: { id: true },
  });
  if (owned.length !== clubIds.length) {
    throw new Error('You can only notify members of clubs you own');
  }

  const audienceKind: ClubAudienceKind = isClubAudienceKind(input.audienceKind)
    ? input.audienceKind
    : 'members';

  const data = {
    source: 'club_admin' as const,
    title,
    description,
    path: input.path?.trim() || null,
    untilDate: toDateOnly(input.untilDate),
    langId: '0',
    prioritary: Boolean(input.prioritary),
    isShow: true,
    submittedByUserId: input.submittedByUserId,
    submittedByAdminId: null,
    audienceRolesJson: '[]',
    audienceUsernamesJson: '[]',
    audienceUserIdsJson: '[]',
    clubIdsJson: toJsonStringArray(clubIds),
    audienceKind,
    audienceLanguagesJson: '[]',
    contentsByLangJson: toJsonStringRecord({ en: description }),
  };

  if (input.editId) {
    const existing = await prisma.notification.findFirst({
      where: { id: input.editId, source: 'club_admin', submittedByUserId: input.submittedByUserId },
    });
    if (!existing) throw new Error('Notification not found');
    return prisma.notification.update({ where: { id: input.editId }, data });
  }

  return prisma.notification.create({ data });
}

export type OrgEntityKind = 'coach' | 'team' | 'group';

export type CreateOrgNotificationInput = {
  kind: OrgEntityKind;
  title: string;
  description: string;
  path?: string;
  untilDate: string;
  prioritary?: boolean;
  /** Empty = all owned entities / all trained athletes for coach. */
  entityIds: string[];
  submittedByUserId: string;
  editId?: string;
};

function sourceForOrgKind(kind: OrgEntityKind): NotificationSource {
  if (kind === 'coach') return 'coach';
  if (kind === 'team') return 'team_admin';
  return 'group_admin';
}

export async function createOrUpdateOrgNotification(input: CreateOrgNotificationInput) {
  const title = input.title.trim();
  const description = input.description.trim();
  if (!title) throw new Error('Object (title) is required');
  if (!hasMeaningfulHtml(description)) throw new Error('Message is required');

  const source = sourceForOrgKind(input.kind);
  let entityIds = Array.from(new Set(input.entityIds.map((id) => id.trim()).filter(Boolean)));

  if (input.kind === 'coach') {
    // Empty entityIds = all athletes trained by this coach
    if (entityIds.length > 0) {
      const owned = await prisma.coachingGroup.findMany({
        where: { id: { in: entityIds }, coachId: input.submittedByUserId },
        select: { id: true },
      });
      if (owned.length !== entityIds.length) {
        throw new Error('You can only notify your own coaching groups');
      }
    }
  } else if (input.kind === 'team') {
    if (entityIds.length === 0) {
      const owned = await prisma.team.findMany({
        where: { adminId: input.submittedByUserId },
        select: { id: true },
      });
      entityIds = owned.map((t) => t.id);
    } else {
      const owned = await prisma.team.findMany({
        where: { id: { in: entityIds }, adminId: input.submittedByUserId },
        select: { id: true },
      });
      if (owned.length !== entityIds.length) {
        throw new Error('You can only notify teams you own');
      }
    }
    if (entityIds.length === 0) throw new Error('Select at least one team');
  } else {
    if (entityIds.length === 0) {
      const owned = await prisma.group.findMany({
        where: { adminId: input.submittedByUserId },
        select: { id: true },
      });
      entityIds = owned.map((g) => g.id);
    } else {
      const owned = await prisma.group.findMany({
        where: { id: { in: entityIds }, adminId: input.submittedByUserId },
        select: { id: true },
      });
      if (owned.length !== entityIds.length) {
        throw new Error('You can only notify groups you own');
      }
    }
    if (entityIds.length === 0) throw new Error('Select at least one group');
  }

  const data = {
    source,
    title,
    description,
    path: input.path?.trim() || null,
    untilDate: toDateOnly(input.untilDate),
    langId: '0',
    prioritary: Boolean(input.prioritary),
    isShow: true,
    submittedByUserId: input.submittedByUserId,
    submittedByAdminId: null,
    audienceRolesJson: '[]',
    audienceUsernamesJson: '[]',
    audienceUserIdsJson: '[]',
    clubIdsJson: toJsonStringArray(entityIds),
    audienceKind: 'members',
    audienceLanguagesJson: '[]',
    contentsByLangJson: toJsonStringRecord({ en: description }),
  };

  if (input.editId) {
    const existing = await prisma.notification.findFirst({
      where: { id: input.editId, source, submittedByUserId: input.submittedByUserId },
    });
    if (!existing) throw new Error('Notification not found');
    return prisma.notification.update({ where: { id: input.editId }, data });
  }

  return prisma.notification.create({ data });
}

export async function listStaffNotifications(params: {
  search?: string;
  roleFilter?: string;
  recentOnly?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, params.pageSize ?? 10));
  const where: Record<string, unknown> = { source: 'movesbook_staff' };

  if (params.search?.trim()) {
    where.title = { contains: params.search.trim() };
  }
  if (params.roleFilter && isStaffAudienceRole(params.roleFilter)) {
    where.audienceRolesJson = { contains: `"${params.roleFilter}"` };
  }
  if (params.recentOnly) {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    where.createdAt = { gte: threeMonthsAgo };
  }

  const [total, rows] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      orderBy: [{ prioritary: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        submittedByUser: { select: { id: true, name: true, username: true, image: true } },
      },
    }),
  ]);

  return {
    items: rows.map((r) => mapRow(r)),
    total,
    page,
    pageSize,
  };
}

export type SentNotificationStatusFilter = 'all' | 'active' | 'expired';

export async function listOrgSentNotifications(params: {
  userId: string;
  source: NotificationSource;
  entityId?: string | null;
  search?: string;
  /** all = everything; active = visible & untilDate >= today; expired = untilDate < today */
  status?: SentNotificationStatusFilter;
  /** Recipient type filter (club notifications) */
  audienceKind?: ClubAudienceKind | null;
  /** Club/team filter chosen in MY PAGE (does not narrow the recipients shown) */
  filterEntityId?: string | null;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, params.pageSize ?? 10));
  const today = startOfTodayUtc();
  const where: Record<string, unknown> = {
    source: params.source,
    submittedByUserId: params.userId,
  };
  if (params.search?.trim()) {
    where.title = { contains: params.search.trim() };
  }
  const entityFilter = params.entityId?.trim() || params.filterEntityId?.trim();
  if (entityFilter) {
    where.clubIdsJson = { contains: `"${entityFilter}"` };
  }
  if (params.audienceKind === 'staff' || params.audienceKind === 'members') {
    where.audienceKind = params.audienceKind;
  }
  if (params.status === 'active') {
    where.isShow = true;
    where.untilDate = { gte: today };
  } else if (params.status === 'expired') {
    where.untilDate = { lt: today };
  }

  const [total, rows] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      orderBy: [{ prioritary: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        submittedByUser: { select: { id: true, name: true, username: true, image: true } },
      },
    }),
  ]);

  return {
    items: await enrichOrgSenderDisplay(
      rows.map((r) => mapRow(r)),
      params.entityId?.trim() || null,
    ),
    total,
    page,
    pageSize,
  };
}

export async function listClubAdminSentNotifications(params: {
  userId: string;
  clubId?: string | null;
  search?: string;
  status?: SentNotificationStatusFilter;
  audienceKind?: ClubAudienceKind | null;
  filterClubId?: string | null;
  page?: number;
  pageSize?: number;
}) {
  return listOrgSentNotifications({
    userId: params.userId,
    source: 'club_admin',
    entityId: params.clubId,
    search: params.search,
    status: params.status,
    audienceKind: params.audienceKind,
    filterEntityId: params.filterClubId,
    page: params.page,
    pageSize: params.pageSize,
  });
}

function staffMatchesUser(
  row: Notification,
  user: { id: string; username: string; userType: UserType; language: string },
): boolean {
  const audienceLanguages = parseJsonStringArray(row.audienceLanguagesJson);
  // Legacy: langId may be "0" or a single code/id — treat non-0 without languages as all
  if (!staffLanguagesMatchUser(audienceLanguages, user.language)) {
    return false;
  }

  const userIds = parseJsonStringArray(row.audienceUserIdsJson);
  if (userIds.includes(user.id)) return true;

  const usernames = parseJsonStringArray(row.audienceUsernamesJson).map((u) => u.toLowerCase());
  if (usernames.includes(user.username.toLowerCase())) return true;

  const roles = parseJsonStringArray(row.audienceRolesJson);
  const expanded = expandStaffAudienceRoles(roles);
  return expanded.includes(user.userType);
}

async function userMatchesOrgNotification(
  row: Notification,
  userId: string,
): Promise<boolean> {
  const entityIds = parseJsonStringArray(row.clubIdsJson);
  const source = row.source;

  if (source === 'club_admin') {
    if (entityIds.length === 0) return false;
    const kind = isClubAudienceKind(row.audienceKind) ? row.audienceKind : 'members';
    if (kind === 'staff') {
      const staff = await prisma.clubStaff.findFirst({
        where: { userId, clubId: { in: entityIds } },
        select: { id: true },
      });
      return Boolean(staff);
    }
    const member = await prisma.clubMember.findFirst({
      where: { memberId: userId, clubId: { in: entityIds } },
      select: { id: true },
    });
    return Boolean(member);
  }

  if (source === 'coach') {
    if (!row.submittedByUserId) return false;
    if (entityIds.length === 0) {
      const link = await prisma.coachAthlete.findFirst({
        where: { coachId: row.submittedByUserId, athleteId: userId },
        select: { id: true },
      });
      return Boolean(link);
    }
    const inGroup = await prisma.coachingGroupMember.findFirst({
      where: {
        athleteId: userId,
        coachingGroupId: { in: entityIds },
        coachingGroup: { coachId: row.submittedByUserId },
      },
      select: { id: true },
    });
    return Boolean(inGroup);
  }

  if (source === 'team_admin') {
    if (entityIds.length === 0) return false;
    const member = await prisma.teamMember.findFirst({
      where: { athleteId: userId, teamId: { in: entityIds } },
      select: { id: true },
    });
    return Boolean(member);
  }

  if (source === 'group_admin') {
    if (entityIds.length === 0) return false;
    const member = await prisma.groupMember.findFirst({
      where: { userId, groupId: { in: entityIds } },
      select: { id: true },
    });
    return Boolean(member);
  }

  return false;
}

export async function listInboxForUser(params: {
  userId: string;
  source: 'movesbook' | 'clubs';
  search?: string;
  page?: number;
  pageSize?: number;
  activeOnly?: boolean;
  /** MY CLUB / Club\Team filter: only notifications sent to this club */
  clubId?: string | null;
  /** Type of recipient filter for club notifications */
  audienceKind?: ClubAudienceKind | null;
}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, params.pageSize ?? 10));
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: {
      id: true,
      username: true,
      userType: true,
      settings: { select: { language: true } },
    },
  });
  if (!user) throw new Error('User not found');

  const profileLang = normalizeProfileLanguage(user.settings?.language);
  const today = startOfTodayUtc();
  const activeOnly = params.activeOnly !== false;

  if (params.source === 'movesbook') {
    const where: Record<string, unknown> = {
      source: 'movesbook_staff',
      ...(activeOnly ? { isShow: true, untilDate: { gte: today } } : {}),
    };
    if (params.search?.trim()) where.title = { contains: params.search.trim() };

    const candidates = await prisma.notification.findMany({
      where,
      orderBy: [{ prioritary: 'desc' }, { createdAt: 'desc' }],
      include: {
        submittedByUser: { select: { id: true, name: true, username: true, image: true } },
      },
      take: 500,
    });

    const roleMatched = candidates.filter((row) =>
      staffMatchesUser(row, {
        id: user.id,
        username: user.username,
        userType: user.userType,
        language: profileLang,
      }),
    );
    const visitedAll = await loadVisitedSet(
      user.id,
      roleMatched.map((r) => r.id),
    );
    const cutoff = daysAgoUtc(3);
    // Clear section: visited items older than 3 days stay hidden
    const matched = roleMatched.filter((row) => {
      if (visitedAll.has(row.id) && row.createdAt < cutoff) return false;
      return true;
    });
    const slice = matched.slice((page - 1) * pageSize, page * pageSize);
    const visited = await loadVisitedSet(
      user.id,
      slice.map((r) => r.id),
    );

    return {
      items: await enrichOrgSenderDisplay(slice.map((r) => mapRow(r, visited, profileLang))),
      total: matched.length,
      page,
      pageSize,
    };
  }

  const where: Record<string, unknown> = {
    source: { in: ['club_admin', 'coach', 'team_admin', 'group_admin'] },
    ...(activeOnly ? { isShow: true, untilDate: { gte: today } } : {}),
  };
  if (params.search?.trim()) where.title = { contains: params.search.trim() };
  if (params.clubId?.trim()) where.clubIdsJson = { contains: `"${params.clubId.trim()}"` };
  if (params.audienceKind === 'staff' || params.audienceKind === 'members') {
    where.audienceKind = params.audienceKind;
  }

  const candidates = await prisma.notification.findMany({
    where,
    orderBy: [{ prioritary: 'desc' }, { createdAt: 'desc' }],
    include: {
      submittedByUser: { select: { id: true, name: true, username: true, image: true } },
    },
    take: 500,
  });

  const roleMatched: Notification[] = [];
  for (const row of candidates) {
    if (await userMatchesOrgNotification(row, user.id)) roleMatched.push(row);
  }

  const visitedAll = await loadVisitedSet(
    user.id,
    roleMatched.map((r) => r.id),
  );
  const cutoff = daysAgoUtc(3);
  const matched = roleMatched.filter((row) => {
    if (visitedAll.has(row.id) && row.createdAt < cutoff) return false;
    return true;
  });

  const slice = matched.slice((page - 1) * pageSize, page * pageSize);
  const visited = await loadVisitedSet(
    user.id,
    slice.map((r) => r.id),
  );

  return {
    items: await enrichOrgSenderDisplay(
      slice.map((r) => mapRow(r as Parameters<typeof mapRow>[0], visited, profileLang)),
    ),
    total: matched.length,
    page,
    pageSize,
  };
}

async function loadVisitedSet(userId: string, notificationIds: string[]): Promise<Set<string>> {
  if (notificationIds.length === 0) return new Set();
  const rows = await prisma.notificationVisit.findMany({
    where: { userId, notificationId: { in: notificationIds } },
    select: { notificationId: true },
  });
  return new Set(rows.map((r) => r.notificationId));
}

export async function markNotificationVisited(userId: string, notificationId: string) {
  await prisma.notificationVisit.upsert({
    where: {
      notificationId_userId: { notificationId, userId },
    },
    create: { notificationId, userId },
    update: {},
  });
}

export async function getUnreadCounts(userId: string): Promise<{
  movesbook: number;
  clubs: number;
  total: number;
}> {
  const [movesbook, clubs] = await Promise.all([
    listInboxForUser({ userId, source: 'movesbook', page: 1, pageSize: 500 }),
    listInboxForUser({ userId, source: 'clubs', page: 1, pageSize: 500 }),
  ]);
  const movesbookUnread = movesbook.items.filter((i) => !i.visited).length;
  const clubsUnread = clubs.items.filter((i) => !i.visited).length;
  return {
    movesbook: movesbookUnread,
    clubs: clubsUnread,
    total: movesbookUnread + clubsUnread,
  };
}

export async function toggleNotificationVisibility(id: string, isShow: boolean, source?: NotificationSource) {
  const where: { id: string; source?: string } = { id };
  if (source) where.source = source;
  return prisma.notification.update({ where: { id }, data: { isShow } });
}

export async function deleteNotification(id: string, opts?: { source?: NotificationSource; submittedByUserId?: string }) {
  const where: Record<string, unknown> = { id };
  if (opts?.source) where.source = opts.source;
  if (opts?.submittedByUserId) where.submittedByUserId = opts.submittedByUserId;
  const existing = await prisma.notification.findFirst({ where });
  if (!existing) throw new Error('Not found');
  await prisma.notification.delete({ where: { id } });
}

/** Delete notifications created between fromDate and toDate (inclusive, by createdAt). */
export async function deleteNotificationsInDateRange(opts: {
  source: NotificationSource;
  submittedByUserId?: string | null;
  submittedByAdminId?: string | null;
  fromDate: string;
  toDate: string;
  entityId?: string | null;
}): Promise<number> {
  const from = toDateOnly(opts.fromDate);
  const to = toDateOnly(opts.toDate);
  to.setUTCHours(23, 59, 59, 999);

  const where: Record<string, unknown> = {
    source: opts.source,
    createdAt: { gte: from, lte: to },
  };
  if (opts.submittedByUserId) where.submittedByUserId = opts.submittedByUserId;
  if (opts.submittedByAdminId) where.submittedByAdminId = opts.submittedByAdminId;
  if (opts.entityId?.trim()) {
    where.clubIdsJson = { contains: opts.entityId.trim() };
  }

  const result = await prisma.notification.deleteMany({ where });
  return result.count;
}

/**
 * Member "Clear section": remove visited/old inbox notifications for this user
 * except those created in the last 3 days (those stay for manual dismiss via visit only —
 * we delete NotificationVisit+ hide by deleting? Spec: delete all notifications except last 3 days.
 * For member inbox, they don't own notifications — "clear" means mark older as cleared via visits
 * OR delete visit records? PHP likely deleted from notifications_visited display by removing
 * notifications the user sees... Actually for members, clear section deletes the notifications
 * themselves from staff/club? That would be wrong for shared notifications.
 *
 * Re-read: "Clear section will delete all notifications except those ones of the last 3 days"
 * In PHP member section — typically clears the user's view. We'll delete NotificationVisit for
 * items older than 3 days and also soft-hide by storing clear? Simplest matching PHP-like UX:
 * for movesbook/club inbox of THIS user, remove NotificationVisit and... actually deleting
 * notifications themselves would remove them for everyone.
 *
 * Safer interpretation for member inbox: permanently hide older items for this user by
 * creating visits AND a local "cleared" marker. Without a clear table, we'll delete
 * NotificationVisit rows for old items? That would mark them unread again.
 *
 * Better: add clear by creating visits for all old items so they look read, AND filter
 * inbox to exclude items older than 3 days that were "cleared". Simplest approach used
 * by many ports: delete from inbox by filtering createdAt >= now-3days when "cleared"
 * flag... 
 *
 * Spec says delete notifications except last 3 days. On member view of received notifies,
 * PHP Assistance often deleted the notification records the user could see if they were
 * the only recipient — but for broadcast, Clear section usually removes from user's
 * notifications_visited linkage and hides.
 *
 * I'll implement: for the current user, delete NotificationVisit for items in range and
 * insert a synthetic approach — filter listInbox to exclude items created before (today-3d)
 * when user has called clear... needs a flag.
 *
 * Practical approach matching "delete": soft-delete for this user via NotificationVisit
 * with a special note — too heavy.
 *
 * Implement clearInboxExceptRecentDays as: mark all older than 3 days as visited AND
 * exclude from inbox items older than 3 days that are visited. Wait — that already shows
 * them if active. Spec: delete them so they don't appear. So inbox filter: after clear,
 * hide items with createdAt < today-3days.
 *
 * Store on UserSettings or just: when Clear is clicked, delete NotificationVisit is wrong.
 * Create visits for ALL older notifications (mark read) and change listInboxForUser to
 * accept hideOlderThanDays after clear...
 *
 * Simplest correct UX: `clearInboxExceptRecentDays` deletes NotificationVisit entries
 * and we add filtering: items older than 3 days are not returned in inbox at all after
 * user clears — persist `notificationsClearedAt` on UserSettings.
 *
 * Even simpler for now: physically only affect display for this user by recording
 * clearedAt timestamp in a JSON... UserSettings may not have that field.
 *
 * Final approach: Clear section on member inbox deletes the user's NotificationVisit
 * rows and we filter inbox to `createdAt >= daysAgo(3)` always for the list when
 * `cleared=1` query... Actually re-read again: "delete all notifications except those
 * of the last 3 days (they must be removed manually)". So the notifications themselves
 * (for this user's received list) disappear if older than 3 days. For broadcast messages
 * shared by many users, we cannot delete the Notification row. We hide per-user.
 *
 * Use NotificationVisit: on clear, upsert visit for every matching older notification.
 * Additionally filter inbox: if item.createdAt < daysAgo(3) AND visited, exclude from list
 * when `hideVisitedOlderThan3Days` — but then Clear just marks visited and we always
 * hide visited items older than 3 days.
 *
 * I'll implement inbox filter: never show items older than 3 days that are visited;
 * Clear section marks all older-than-3-days items as visited (so they disappear).
 * Items in last 3 days remain (visited or not) for manual handling.
 */
export async function clearInboxExceptRecentDays(userId: string, source: 'movesbook' | 'clubs') {
  const cutoff = daysAgoUtc(3);
  const inbox = await listInboxForUser({
    userId,
    source,
    page: 1,
    pageSize: 500,
    activeOnly: false,
  });

  const toClear = inbox.items.filter((item) => new Date(item.createdAt) < cutoff);
  for (const item of toClear) {
    await markNotificationVisited(userId, item.id);
  }

  // Soft-hide: store cleared ids via visits only; listInbox filters visited+older than 3 days out
  return { cleared: toClear.length };
}

export async function getNotificationById(id: string, profileLang?: string) {
  const row = await prisma.notification.findUnique({
    where: { id },
    include: {
      submittedByUser: { select: { id: true, name: true, username: true, image: true } },
    },
  });
  return row ? mapRow(row, undefined, profileLang) : null;
}

export { isOrgNotificationSource };
