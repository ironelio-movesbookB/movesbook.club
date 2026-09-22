import { SportType, UserType } from '@prisma/client';
import { ensureStaffPrismaModels, prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { ensureUserSettingsColumns } from '@/lib/userSettingsDb';
import { normalizeTelegramAccount, isValidSportType } from '@/lib/profileSports';
import {
  mergeProfilePanelIntoAdminSettings,
  readAdminReferences,
} from '@/lib/admin/userProfilePanelSettings';
import {
  mergeClubAdminInfoIntoSocialSettings,
  parseClubAdminInfo,
  readClubAdminInfoFromSocialSettings,
  type ClubAdminInfo,
} from '@/lib/club/clubAdminInfo';
import {
  CLUB_STAFF_DB_USER_TYPES,
  CLUB_STAFF_USER_LEVELS,
  isClubStaffRole,
  isClubStaffType,
  isClubStaffUserLevel,
  operativeLevelForStaffType,
  staffTypeLabel,
  userTypeForClubStaffType,
  type ClubStaffListItem,
  type ClubStaffProfile,
  type ClubStaffRole,
  type ClubStaffType,
  type ClubStaffUserLevel,
} from '@/lib/club/clubStaff.constants';
import type { ClubAuthContext } from '@/lib/procedures/types';

export type { ClubStaffListItem, ClubStaffProfile };

/** Staff user rows that may be deleted with a club_staff membership. */
const DELETABLE_STAFF_USER_TYPES = [
  UserType.CLUB_TRAINER,
  ...CLUB_STAFF_DB_USER_TYPES,
] as UserType[];

export type ClubStaffWriteInput = {
  name: string;
  firstName?: string | null;
  surname?: string | null;
  username?: string;
  email?: string;
  password?: string;
  country?: string | null;
  gender?: string | null;
  birthdate?: string | null;
  preferredLanguage?: string;
  telegramAccount?: string | null;
  youtubeChannelUrl?: string | null;
  mainSports?: string[];
  staffType: string;
  role: string;
  userLevels?: string[];
  referencesHtml?: string;
  referencesLevel?: string;
  image?: string | null;
  adminInfo?: unknown;
};

function formatDisplayName(user: {
  firstName: string | null;
  surname: string | null;
  name: string;
  username: string;
}): string {
  return [user.firstName, user.surname].filter(Boolean).join(' ').trim() || user.name || user.username;
}

function parseUserLevels(raw: string | null | undefined): ClubStaffUserLevel[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is ClubStaffUserLevel => typeof value === 'string' && isClubStaffUserLevel(value));
  } catch {
    return [];
  }
}

function normalizeUserLevels(values: unknown): ClubStaffUserLevel[] {
  if (!Array.isArray(values)) return [];
  const allowed = new Set(CLUB_STAFF_USER_LEVELS.map((item) => item.value));
  const unique: ClubStaffUserLevel[] = [];
  for (const value of values) {
    const key = String(value ?? '').trim();
    if (!allowed.has(key as ClubStaffUserLevel)) continue;
    if (!unique.includes(key as ClubStaffUserLevel)) unique.push(key as ClubStaffUserLevel);
  }
  return unique;
}

function normalizeStaffType(value: unknown): ClubStaffType {
  const raw = String(value ?? '').trim().toLowerCase();
  if (isClubStaffType(raw)) return raw;
  throw new Error('Select a type of staff.');
}

function normalizeRole(value: unknown): ClubStaffRole {
  const raw = String(value ?? '').trim();
  if (isClubStaffRole(raw)) return raw;
  throw new Error('Select a role.');
}

function normalizeSports(values: unknown): SportType[] {
  if (!Array.isArray(values)) return [];
  const sports: SportType[] = [];
  for (const value of values) {
    const key = String(value ?? '').trim();
    if (isValidSportType(key) && !sports.includes(key)) sports.push(key);
  }
  return sports;
}

const userSelect = {
  id: true,
  username: true,
  email: true,
  name: true,
  firstName: true,
  surname: true,
  image: true,
  country: true,
  gender: true,
  birthdate: true,
  telegramAccount: true,
  youtubeChannelUrl: true,
  createdAt: true,
  settings: { select: { language: true, adminSettings: true, socialSettings: true } },
  mainSports: { select: { sport: true, order: true }, orderBy: { order: 'asc' as const } },
};

function toListItem(row: {
  id: string;
  staffType: string;
  role: string;
  userLevels: string;
  user: {
    id: string;
    username: string;
    email: string;
    name: string;
    firstName: string | null;
    surname: string | null;
    image: string | null;
  };
}): ClubStaffListItem {
  const staffType = isClubStaffType(row.staffType) ? row.staffType : 'operator';
  return {
    id: row.id,
    userId: row.user.id,
    username: row.user.username,
    email: row.user.email,
    name: formatDisplayName(row.user),
    image: row.user.image,
    staffType,
    staffTypeLabel: staffTypeLabel(staffType),
    role: row.role,
    operativeLevel: operativeLevelForStaffType(staffType),
    userLevels: parseUserLevels(row.userLevels),
    isClubAdmin: false,
  };
}

function parseSocialSettingsJson(raw: string | null | undefined): Record<string, unknown> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function socialSettingsForAdminInfo(
  existingJson: string | null | undefined,
  rawAdminInfo: unknown,
): string {
  const existing = parseSocialSettingsJson(existingJson);
  const adminInfo = parseClubAdminInfo(rawAdminInfo);
  return JSON.stringify(mergeClubAdminInfoIntoSocialSettings(existing, adminInfo));
}

function youtubeUrlFromAdminInfo(adminInfo: ClubAdminInfo, fallback?: string | null): string | null {
  const fromInfo = adminInfo.youtube.url.trim();
  if (fromInfo) return fromInfo;
  const fromFallback = String(fallback ?? '').trim();
  return fromFallback || null;
}

function toProfile(item: ClubStaffListItem, user: {
  firstName: string | null;
  surname: string | null;
  country: string | null;
  gender: string | null;
  birthdate: Date | null;
  telegramAccount: string | null;
  youtubeChannelUrl: string | null;
  createdAt: Date;
  settings: { language: string; adminSettings: string; socialSettings?: string | null } | null;
  mainSports: { sport: string }[];
}): ClubStaffProfile {
  const refs = readAdminReferences(user.settings?.adminSettings);
  const adminInfo = readClubAdminInfoFromSocialSettings(
    parseSocialSettingsJson(user.settings?.socialSettings),
  );
  return {
    ...item,
    firstName: user.firstName,
    surname: user.surname,
    country: user.country,
    gender: user.gender,
    birthdate: user.birthdate ? user.birthdate.toISOString().slice(0, 10) : null,
    telegramAccount: user.telegramAccount,
    youtubeChannelUrl: user.youtubeChannelUrl,
    preferredLanguage: user.settings?.language || 'en',
    mainSports: user.mainSports.map((s) => s.sport),
    referencesHtml: refs.referencesHtml,
    referencesLevel: refs.referencesLevel,
    createdAt: user.createdAt.toISOString(),
    adminInfo,
  };
}

export async function listClubStaff(ctx: ClubAuthContext): Promise<ClubStaffListItem[]> {
  await ensureStaffPrismaModels();
  const isTeam = ctx.workspaceKind === 'team';

  const adminOwner = isTeam
    ? await prisma.team.findUnique({
        where: { id: ctx.club.id },
        select: {
          admin: {
            select: {
              id: true,
              username: true,
              email: true,
              name: true,
              firstName: true,
              surname: true,
              image: true,
            },
          },
        },
      })
    : await prisma.club.findUnique({
        where: { id: ctx.club.id },
        select: {
          admin: {
            select: {
              id: true,
              username: true,
              email: true,
              name: true,
              firstName: true,
              surname: true,
              image: true,
            },
          },
        },
      });

  const staffRows = isTeam
    ? await prisma.teamStaff.findMany({
        where: { teamId: ctx.club.id },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              name: true,
              firstName: true,
              surname: true,
              image: true,
            },
          },
        },
      })
    : await prisma.clubStaff.findMany({
        where: { clubId: ctx.club.id },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              name: true,
              firstName: true,
              surname: true,
              image: true,
            },
          },
        },
      });

  const items = staffRows.map(toListItem);
  items.sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: 'base' }));

  if (adminOwner?.admin) {
    items.unshift({
      id: `admin:${adminOwner.admin.id}`,
      userId: adminOwner.admin.id,
      username: adminOwner.admin.username,
      email: adminOwner.admin.email,
      name: formatDisplayName(adminOwner.admin),
      image: adminOwner.admin.image,
      staffType: isTeam ? 'team_admin' : 'club_admin',
      staffTypeLabel: isTeam ? 'Team Admin' : 'Club Admin',
      role: 'Director',
      operativeLevel: 'Supervisor',
      userLevels: [],
      isClubAdmin: true,
    });
  }

  return items;
}

export async function getClubStaffById(
  ctx: ClubAuthContext,
  staffId: string,
): Promise<ClubStaffProfile | null> {
  await ensureStaffPrismaModels();
  if (ctx.workspaceKind === 'team') {
    const row = await prisma.teamStaff.findFirst({
      where: { id: staffId, teamId: ctx.club.id },
      include: { user: { select: userSelect } },
    });
    if (!row) return null;
    return toProfile(toListItem(row), row.user);
  }
  const row = await prisma.clubStaff.findFirst({
    where: { id: staffId, clubId: ctx.club.id },
    include: { user: { select: userSelect } },
  });
  if (!row) return null;
  return toProfile(toListItem(row), row.user);
}

async function assertUniqueCredentials(username: string, email: string, excludeUserId?: string) {
  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { email }],
      ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
    },
    select: { id: true, username: true, email: true },
  });
  if (!existing) return;
  if (existing.username === username) throw new Error('Username already exists');
  throw new Error('Email already exists');
}

export async function createClubStaff(ctx: ClubAuthContext, input: ClubStaffWriteInput) {
  await ensureStaffPrismaModels();
  const staffType = normalizeStaffType(input.staffType);
  const role = normalizeRole(input.role);
  const userLevels = normalizeUserLevels(input.userLevels);
  const username = String(input.username ?? '').trim();
  const email = String(input.email ?? '').trim().toLowerCase();
  const password = String(input.password ?? '');
  const firstName = String(input.firstName ?? '').trim();
  const surname = String(input.surname ?? '').trim();
  const name =
    String(input.name ?? '').trim() ||
    [firstName, surname].filter(Boolean).join(' ').trim();
  const language = String(input.preferredLanguage ?? 'en').trim().toLowerCase() || 'en';

  if (!name) throw new Error('Display name is required.');
  if (!username) throw new Error('Username is required.');
  if (!email) throw new Error('Email is required.');
  if (password.length < 6) throw new Error('Password must be at least 6 characters.');

  await assertUniqueCredentials(username, email);

  const hashedPassword = await hashPassword(password);
  const sports = normalizeSports(input.mainSports);
  const telegramAccount = input.telegramAccount
    ? normalizeTelegramAccount(String(input.telegramAccount))
    : null;
  const youtubeChannelUrl = youtubeUrlFromAdminInfo(
    parseClubAdminInfo(input.adminInfo),
    input.youtubeChannelUrl,
  );
  const birthdate = input.birthdate ? new Date(String(input.birthdate)) : null;
  const adminSettings = mergeProfilePanelIntoAdminSettings('{}', {
    referencesHtml: String(input.referencesHtml ?? ''),
    referencesLevel: String(input.referencesLevel ?? '1').trim() || '1',
  });
  const socialSettings = socialSettingsForAdminInfo('{}', input.adminInfo);

  await ensureUserSettingsColumns();

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        firstName: firstName || null,
        surname: surname || null,
        username,
        email,
        password: hashedPassword,
        userType: userTypeForClubStaffType(staffType) as UserType,
        gender: String(input.gender ?? '').trim() || null,
        birthdate: birthdate && !Number.isNaN(birthdate.getTime()) ? birthdate : null,
        country: String(input.country ?? '').trim() || null,
        telegramAccount,
        youtubeChannelUrl,
        image: input.image ?? null,
      },
    });

    await tx.userSettings.create({
      data: {
        userId: user.id,
        language,
        colorSettings: '{}',
        toolsSettings: '{}',
        favouritesSettings: '{}',
        myBestSettings: '{}',
        adminSettings,
        workoutPreferences: '{}',
        socialSettings,
        notificationSettings: '{}',
        widgetArrangement: '[]',
      },
    });

    if (sports.length > 0) {
      await tx.userMainSport.createMany({
        data: sports.map((sport, order) => ({ userId: user.id, sport, order })),
      });
    }

    const staff =
      ctx.workspaceKind === 'team'
        ? await tx.teamStaff.create({
            data: {
              teamId: ctx.club.id,
              userId: user.id,
              staffType,
              role,
              userLevels: JSON.stringify(userLevels),
            },
            include: { user: { select: userSelect } },
          })
        : await tx.clubStaff.create({
            data: {
              clubId: ctx.club.id,
              userId: user.id,
              staffType,
              role,
              userLevels: JSON.stringify(userLevels),
            },
            include: { user: { select: userSelect } },
          });

    return staff;
  });

  return toProfile(toListItem(created), created.user);
}

export async function updateClubStaff(
  ctx: ClubAuthContext,
  staffId: string,
  input: ClubStaffWriteInput,
) {
  await ensureStaffPrismaModels();
  const isTeam = ctx.workspaceKind === 'team';
  const existing = isTeam
    ? await prisma.teamStaff.findFirst({
        where: { id: staffId, teamId: ctx.club.id },
        include: {
          user: { select: { id: true, settings: { select: { adminSettings: true, socialSettings: true } } } },
        },
      })
    : await prisma.clubStaff.findFirst({
        where: { id: staffId, clubId: ctx.club.id },
        include: {
          user: { select: { id: true, settings: { select: { adminSettings: true, socialSettings: true } } } },
        },
      });
  if (!existing) throw new Error('Staff member not found.');

  const staffType = normalizeStaffType(input.staffType);
  const role = normalizeRole(input.role);
  const userLevels = normalizeUserLevels(input.userLevels);
  const firstName = String(input.firstName ?? '').trim();
  const surname = String(input.surname ?? '').trim();
  const name =
    String(input.name ?? '').trim() ||
    [firstName, surname].filter(Boolean).join(' ').trim();
  if (!name) throw new Error('Display name is required.');

  const language = String(input.preferredLanguage ?? 'en').trim().toLowerCase() || 'en';
  const sports = normalizeSports(input.mainSports);
  const telegramAccount = input.telegramAccount
    ? normalizeTelegramAccount(String(input.telegramAccount))
    : null;
  const youtubeChannelUrl = youtubeUrlFromAdminInfo(
    parseClubAdminInfo(input.adminInfo),
    input.youtubeChannelUrl,
  );
  const birthdate = input.birthdate ? new Date(String(input.birthdate)) : null;
  const adminSettings = mergeProfilePanelIntoAdminSettings(existing.user.settings?.adminSettings, {
    referencesHtml: String(input.referencesHtml ?? ''),
    referencesLevel: String(input.referencesLevel ?? '1').trim() || '1',
  });
  const socialSettings = socialSettingsForAdminInfo(
    existing.user.settings?.socialSettings,
    input.adminInfo,
  );

  const password = String(input.password ?? '').trim();
  const hashedPassword = password.length >= 6 ? await hashPassword(password) : undefined;
  if (password && password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: existing.userId },
      data: {
        name,
        firstName: firstName || null,
        surname: surname || null,
        gender: String(input.gender ?? '').trim() || null,
        birthdate: birthdate && !Number.isNaN(birthdate.getTime()) ? birthdate : null,
        country: String(input.country ?? '').trim() || null,
        telegramAccount,
        youtubeChannelUrl,
        userType: userTypeForClubStaffType(staffType) as UserType,
        ...(hashedPassword ? { password: hashedPassword } : {}),
        ...(input.image !== undefined ? { image: input.image } : {}),
      },
    });

    await tx.userSettings.upsert({
      where: { userId: existing.userId },
      update: { language, adminSettings, socialSettings },
      create: {
        userId: existing.userId,
        language,
        colorSettings: '{}',
        toolsSettings: '{}',
        favouritesSettings: '{}',
        myBestSettings: '{}',
        adminSettings,
        workoutPreferences: '{}',
        socialSettings,
        notificationSettings: '{}',
        widgetArrangement: '[]',
      },
    });

    await tx.userMainSport.deleteMany({ where: { userId: existing.userId } });
    if (sports.length > 0) {
      await tx.userMainSport.createMany({
        data: sports.map((sport, order) => ({ userId: existing.userId, sport, order })),
      });
    }

    return isTeam
      ? tx.teamStaff.update({
          where: { id: existing.id },
          data: {
            staffType,
            role,
            userLevels: JSON.stringify(userLevels),
          },
          include: { user: { select: userSelect } },
        })
      : tx.clubStaff.update({
          where: { id: existing.id },
          data: {
            staffType,
            role,
            userLevels: JSON.stringify(userLevels),
          },
          include: { user: { select: userSelect } },
        });
  });

  return toProfile(toListItem(updated), updated.user);
}

export async function deleteClubStaff(ctx: ClubAuthContext, staffIds: string[]) {
  await ensureStaffPrismaModels();
  const ids = [...new Set(staffIds.map((id) => String(id ?? '').trim()).filter(Boolean))];
  if (ids.length === 0) throw new Error('Select at least one staff member.');

  const isTeam = ctx.workspaceKind === 'team';
  const rows = isTeam
    ? await prisma.teamStaff.findMany({
        where: { teamId: ctx.club.id, id: { in: ids } },
        select: { id: true, userId: true },
      })
    : await prisma.clubStaff.findMany({
        where: { clubId: ctx.club.id, id: { in: ids } },
        select: { id: true, userId: true },
      });
  if (rows.length === 0) throw new Error('Staff member not found.');

  const userIds = rows.map((row) => row.userId);
  await prisma.$transaction(async (tx) => {
    if (isTeam) {
      await tx.teamStaff.deleteMany({
        where: { teamId: ctx.club.id, id: { in: rows.map((row) => row.id) } },
      });
    } else {
      await tx.clubStaff.deleteMany({
        where: { clubId: ctx.club.id, id: { in: rows.map((row) => row.id) } },
      });
    }
    await tx.user.deleteMany({
      where: {
        id: { in: userIds },
        userType: { in: DELETABLE_STAFF_USER_TYPES },
      },
    });
  });

  return { deleted: rows.length };
}

export async function setClubStaffImage(
  ctx: ClubAuthContext,
  staffId: string,
  imagePath: string | null,
) {
  await ensureStaffPrismaModels();
  const row =
    ctx.workspaceKind === 'team'
      ? await prisma.teamStaff.findFirst({
          where: { id: staffId, teamId: ctx.club.id },
          select: { userId: true },
        })
      : await prisma.clubStaff.findFirst({
          where: { id: staffId, clubId: ctx.club.id },
          select: { userId: true },
        });
  if (!row) throw new Error('Staff member not found.');
  await prisma.user.update({
    where: { id: row.userId },
    data: { image: imagePath },
  });
  return { image: imagePath };
}

/** Change login password for a club staff User account (used to sign in as staff). */
export async function changeClubStaffPassword(
  ctx: ClubAuthContext,
  staffId: string,
  input: { oldPassword: string; newPassword: string },
) {
  await ensureStaffPrismaModels();
  const oldPassword = String(input.oldPassword ?? '');
  const newPassword = String(input.newPassword ?? '');

  if (!oldPassword || !newPassword) {
    throw new Error('Old password and new password are required.');
  }
  if (newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const row = await prisma.clubStaff.findFirst({
    where: { id: staffId, clubId: ctx.club.id },
    select: {
      user: { select: { id: true, password: true } },
    },
  });
  if (!row) throw new Error('Staff member not found.');

  const ok = await verifyPassword(oldPassword, row.user.password);
  if (!ok) throw new Error('Old password is incorrect.');

  const hashed = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: row.user.id },
    data: { password: hashed },
  });

  return { success: true as const };
}
