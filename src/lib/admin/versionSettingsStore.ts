import { prisma } from '@/lib/prisma';
import {
  applySubscriptionEditDataList,
  getSubscriptionById,
  getSubscriptionEditData,
  getSubscriptionListRows,
  getSubscriptionRowsByUserType,
} from '@/lib/admin/subscriptionSettingsMock';
import { resolveLegacySubscriptionForUser } from '@/lib/registration/memberRegistrationInfoService';
import type {
  SubscriptionEditData,
  SubscriptionUserType,
} from '@/types/adminSubscriptionSettings';

const VERSIONS = 'subscription_version_settings';
const USER_VERSIONS = 'user_version_settings';

let tablesReady = false;

async function ensureTables() {
  if (tablesReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`${VERSIONS}\` (
      version_id INT NOT NULL,
      user_type VARCHAR(20) NOT NULL,
      data LONGTEXT NOT NULL,
      updated_by VARCHAR(191) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (version_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`${USER_VERSIONS}\` (
      user_id VARCHAR(191) NOT NULL,
      version_id INT NULL,
      user_type VARCHAR(20) NOT NULL,
      data LONGTEXT NOT NULL,
      updated_by VARCHAR(191) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (user_id),
      KEY user_version_settings_version_idx (version_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tablesReady = true;
}

function parseEditData(raw: unknown): SubscriptionEditData | null {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const parsed = JSON.parse(raw) as SubscriptionEditData;
    return parsed && typeof parsed === 'object' && parsed.settings ? parsed : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Version settings (/subscriptions/... edit pages)                    */
/* ------------------------------------------------------------------ */

const CACHE_TTL_MS = 30_000;
let cacheLoadedAt = 0;

export async function listSavedVersionEditData(): Promise<SubscriptionEditData[]> {
  await ensureTables();
  const rows = await prisma.$queryRawUnsafe<{ data: string }[]>(
    `SELECT data FROM \`${VERSIONS}\` ORDER BY version_id`,
  );
  return rows.map((r) => parseEditData(r.data)).filter((d): d is SubscriptionEditData => d != null);
}

export async function listSeededVersionIds(): Promise<number[]> {
  await ensureTables();
  const rows = await prisma.$queryRawUnsafe<{ version_id: number }[]>(
    `SELECT version_id FROM \`${VERSIONS}\` WHERE updated_by = ?`,
    SEED_MARKER,
  );
  return rows.map((r) => Number(r.version_id));
}

/** Load saved version settings into the in-memory version cache (server side). */
export async function hydrateVersionSettingsCache(force = false): Promise<void> {
  if (!force && Date.now() - cacheLoadedAt < CACHE_TTL_MS) return;
  const saved = await listSavedVersionEditData();
  applySubscriptionEditDataList(saved);
  cacheLoadedAt = Date.now();
}

export async function saveVersionEditData(
  data: SubscriptionEditData,
  updatedBy: string | null,
  { onlyIfMissing = false }: { onlyIfMissing?: boolean } = {},
): Promise<boolean> {
  await ensureTables();
  const row = getSubscriptionById(data.id);
  if (!row) return false;
  const payload = JSON.stringify({ ...data, userType: row.userType });
  const sql = onlyIfMissing
    ? `INSERT IGNORE INTO \`${VERSIONS}\` (version_id, user_type, data, updated_by) VALUES (?, ?, ?, ?)`
    : `INSERT INTO \`${VERSIONS}\` (version_id, user_type, data, updated_by) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE user_type = VALUES(user_type), data = VALUES(data),
         updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP(3)`;
  const affected = await prisma.$executeRawUnsafe(sql, data.id, row.userType, payload, updatedBy);
  applySubscriptionEditDataList([{ ...data, userType: row.userType }]);
  return affected > 0;
}

const SEED_MARKER = 'seed';

/** Store every version (current values) in the database — rows that already exist are kept. */
export async function seedVersionSettingsFromDefaults(): Promise<number> {
  await hydrateVersionSettingsCache(true);
  let inserted = 0;
  for (const row of getSubscriptionListRows()) {
    const data = getSubscriptionEditData(row.id, false);
    if (data && (await saveVersionEditData(data, SEED_MARKER, { onlyIfMissing: true }))) inserted += 1;
  }
  return inserted;
}

/**
 * Migrate values saved in a staff browser (old localStorage storage).
 * Overwrites only rows that still hold the seeded defaults.
 */
export async function migrateBrowserVersionEditData(
  list: SubscriptionEditData[],
  updatedBy: string,
): Promise<number> {
  await ensureTables();
  let migrated = 0;
  for (const data of list) {
    if (!data?.id || !data.settings || !getSubscriptionById(data.id)) continue;
    const rows = await prisma.$queryRawUnsafe<{ updated_by: string | null }[]>(
      `SELECT updated_by FROM \`${VERSIONS}\` WHERE version_id = ? LIMIT 1`,
      data.id,
    );
    if (rows[0] && rows[0].updated_by !== SEED_MARKER) continue;
    await saveVersionEditData(data, updatedBy);
    migrated += 1;
  }
  await seedVersionSettingsFromDefaults();
  return migrated;
}

/* ------------------------------------------------------------------ */
/* Per-user copy (PCU → Version settings)                              */
/* ------------------------------------------------------------------ */

export function subscriptionUserTypeForUser(userType: string): SubscriptionUserType {
  if (userType === 'COACH') return 'coach';
  if (userType === 'TEAM' || userType === 'TEAM_MANAGER') return 'team';
  if (userType === 'GROUP' || userType === 'GROUP_ADMIN') return 'group';
  if (userType === 'CLUB' || userType === 'CLUB_TRAINER') return 'club';
  return 'athlete';
}

export type UserVersionSettings = {
  userId: string;
  versionId: number | null;
  userType: SubscriptionUserType;
  data: SubscriptionEditData;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type UserVersionRow = {
  user_id: string;
  version_id: number | null;
  user_type: string;
  data: string;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

function mapUserVersionRow(row: UserVersionRow): UserVersionSettings | null {
  const data = parseEditData(row.data);
  if (!data) return null;
  return {
    userId: row.user_id,
    versionId: row.version_id == null ? null : Number(row.version_id),
    userType: row.user_type as SubscriptionUserType,
    data,
    updatedBy: row.updated_by,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

async function readUserVersionRow(userId: string): Promise<UserVersionSettings | null> {
  await ensureTables();
  const rows = await prisma.$queryRawUnsafe<UserVersionRow[]>(
    `SELECT * FROM \`${USER_VERSIONS}\` WHERE user_id = ? LIMIT 1`,
    userId,
  );
  return rows[0] ? mapUserVersionRow(rows[0]) : null;
}

async function latestRegistrationVersionId(userId: string): Promise<number | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ version_id: number | null }[]>(
      `SELECT version_id FROM registration_payments WHERE user_id = ? AND version_id IS NOT NULL
       ORDER BY created_at DESC LIMIT 1`,
      userId,
    );
    const id = rows[0]?.version_id;
    return id == null ? null : Number(id);
  } catch {
    return null;
  }
}

function defaultVersionIdForType(userType: SubscriptionUserType): number | null {
  const rows = getSubscriptionRowsByUserType(userType).filter((r) => !r.isTemplate);
  return (rows.find((r) => r.isDefault) ?? rows[0])?.id ?? null;
}

/** Version purchased by the user: legacy subscription → registration payment → default of the type. */
async function resolvePurchasedVersionId(
  userId: string,
  subscriptionType: SubscriptionUserType,
): Promise<number | null> {
  const matchesType = (id: number | null | undefined) =>
    id != null && getSubscriptionById(id)?.userType === subscriptionType ? id : null;

  const legacy = await resolveLegacySubscriptionForUser(userId).catch(() => null);
  const fromLegacy = matchesType(legacy?.subscriptionSettingId);
  if (fromLegacy != null) return fromLegacy;

  const fromRegistration = matchesType(await latestRegistrationVersionId(userId));
  if (fromRegistration != null) return fromRegistration;

  return defaultVersionIdForType(subscriptionType);
}

/** Copy the version settings into the user's PCU (overwrites an existing copy). */
export async function copyVersionSettingsToUser(
  userId: string,
  versionId: number | null,
  userType: string,
  updatedBy: string | null = null,
): Promise<UserVersionSettings | null> {
  await ensureTables();
  await hydrateVersionSettingsCache();
  const subscriptionType = subscriptionUserTypeForUser(userType);
  const effectiveVersionId =
    versionId != null && getSubscriptionById(versionId)?.userType === subscriptionType
      ? versionId
      : await resolvePurchasedVersionId(userId, subscriptionType);
  const data = effectiveVersionId != null ? getSubscriptionEditData(effectiveVersionId, false) : null;
  if (!data) return null;

  await prisma.$executeRawUnsafe(
    `INSERT INTO \`${USER_VERSIONS}\` (user_id, version_id, user_type, data, updated_by)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE version_id = VALUES(version_id), user_type = VALUES(user_type),
       data = VALUES(data), updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP(3)`,
    userId,
    effectiveVersionId,
    subscriptionType,
    JSON.stringify(data),
    updatedBy,
  );
  return readUserVersionRow(userId);
}

/** PCU copy of the user's version settings; existing users get a copy of their purchased version. */
export async function getUserVersionSettings(userId: string): Promise<UserVersionSettings | null> {
  const existing = await readUserVersionRow(userId);
  if (existing) return existing;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { userType: true } });
  if (!user || user.userType === 'ADMIN') return null;
  return copyVersionSettingsToUser(userId, null, user.userType);
}

export async function saveUserVersionSettings(
  userId: string,
  data: SubscriptionEditData,
  updatedBy: string | null,
): Promise<UserVersionSettings | null> {
  const current = await getUserVersionSettings(userId);
  if (!current) return null;
  const merged: SubscriptionEditData = {
    ...current.data,
    general: { ...current.data.general, ...(data.general ?? {}) },
    settings: { ...current.data.settings, ...(data.settings ?? {}) },
  };
  await prisma.$executeRawUnsafe(
    `UPDATE \`${USER_VERSIONS}\` SET data = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP(3)
     WHERE user_id = ?`,
    JSON.stringify(merged),
    updatedBy,
    userId,
  );
  return readUserVersionRow(userId);
}

/** Create the PCU copy for every user that does not have one yet. */
export async function backfillUserVersionSettings(): Promise<number> {
  await ensureTables();
  await hydrateVersionSettingsCache(true);
  const missing = await prisma.$queryRawUnsafe<{ id: string; userType: string }[]>(
    `SELECT u.id, u.userType FROM users_new u
     LEFT JOIN \`${USER_VERSIONS}\` v ON v.user_id = u.id
     WHERE v.user_id IS NULL AND u.userType <> 'ADMIN'`,
  );
  let created = 0;
  for (const user of missing) {
    if (await copyVersionSettingsToUser(user.id, null, user.userType)) created += 1;
  }
  return created;
}
