import { prisma } from '@/lib/prisma';
import { findExistingTable, getTableColumns } from '@/lib/outcomeSettingsDb';
import { countryCodeFromName } from '@/lib/admin/countryFlag';
import { formatPromocodeDisplayDate } from './formatPromocodeDate';
import type { LegacyUserSnippet } from './types';

let legacyUserSchemaEnsured = false;
let resolvedLegacyUsersTableName: string | null = null;

const LEGACY_USER_COLUMN_DEFS: [string, string][] = [
  ['role_id', 'INT NOT NULL DEFAULT 1'],
  ['username', "VARCHAR(100) NOT NULL DEFAULT ''"],
  ['password', "VARCHAR(255) NOT NULL DEFAULT ''"],
  ['firstname', "VARCHAR(100) NOT NULL DEFAULT ''"],
  ['lastname', "VARCHAR(100) NOT NULL DEFAULT ''"],
  ['email', "VARCHAR(100) NOT NULL DEFAULT ''"],
  ['country_id', 'INT NOT NULL DEFAULT 0'],
  ['image', "VARCHAR(250) NOT NULL DEFAULT ''"],
  ['subscription_setting_id', 'INT NULL'],
  ['subscription_start_date', 'DATE NULL'],
  ['subscription_end_date', 'VARCHAR(100) NULL'],
  ['credits', 'DECIMAL(10,2) NOT NULL DEFAULT 0'],
  ['delete_status', "ENUM('Y','N') NOT NULL DEFAULT 'N'"],
  ['created', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP'],
  ['modified', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'],
];

async function tableExists(tableName: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ TABLE_NAME: string }[]>(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
    tableName
  );
  return rows.length > 0;
}

async function ensureColumn(
  tableName: string,
  columnName: string,
  columnDefinition: string
): Promise<void> {
  const columns = await getTableColumns(tableName);
  if (columns.has(columnName)) return;
  await prisma.$executeRawUnsafe(
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnDefinition}`
  );
}

async function createLegacyUsersTable(tableName: string): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE \`${tableName}\` (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      role_id INT NOT NULL DEFAULT 1,
      username VARCHAR(100) NOT NULL DEFAULT '',
      password VARCHAR(255) NOT NULL DEFAULT '',
      firstname VARCHAR(100) NOT NULL DEFAULT '',
      lastname VARCHAR(100) NOT NULL DEFAULT '',
      email VARCHAR(100) NOT NULL DEFAULT '',
      country_id INT NOT NULL DEFAULT 0,
      image VARCHAR(250) NOT NULL DEFAULT '',
      subscription_setting_id INT NULL,
      subscription_start_date DATE NULL,
      subscription_end_date VARCHAR(100) NULL,
      credits DECIMAL(10,2) NOT NULL DEFAULT 0,
      delete_status ENUM('Y','N') NOT NULL DEFAULT 'N',
      created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      modified DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function ensureLegacyUsersColumns(tableName: string): Promise<void> {
  for (const [columnName, columnDefinition] of LEGACY_USER_COLUMN_DEFS) {
    await ensureColumn(tableName, columnName, columnDefinition);
  }
}

async function seedDefaultLegacyUser(tableName: string): Promise<void> {
  const existing = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
    `SELECT id FROM \`${tableName}\` WHERE id = 1 LIMIT 1`
  );
  if (existing.length > 0) return;

  await prisma.$executeRawUnsafe(
    `INSERT INTO \`${tableName}\` (
       id, role_id, username, password, firstname, lastname, email,
       country_id, image, subscription_setting_id, delete_status, created, modified
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'N', NOW(), NOW())`,
    1,
    1,
    'admin',
    '',
    'Admin',
    'User',
    'admin@movesbook.com',
    1,
      '',
    1
  );
}

/** PHP uses `users`; local dev may have a modern auth table with the same name. */
async function resolveLegacyUsersTableName(): Promise<string> {
  if (resolvedLegacyUsersTableName) return resolvedLegacyUsersTableName;

  if (await tableExists('users')) {
    const usersColumns = await getTableColumns('users');
    if (usersColumns.has('country_id')) {
      resolvedLegacyUsersTableName = 'users';
      return 'users';
    }
  }

  resolvedLegacyUsersTableName = 'legacy_users';
  return 'legacy_users';
}

/** Legacy PHP users table — required for promocode creator lookup (same columns as movesbook-new). */
async function ensureLegacyUsersTable(): Promise<void> {
  const tableName = await resolveLegacyUsersTableName();

  if (!(await tableExists(tableName))) {
    await createLegacyUsersTable(tableName);
  } else {
    await ensureLegacyUsersColumns(tableName);
  }

  await seedDefaultLegacyUser(tableName);
}

async function ensureLegacyCountryFlagTables(): Promise<void> {
  if (!(await tableExists('flags'))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE flags (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        flag_img VARCHAR(255) NOT NULL DEFAULT '',
        name VARCHAR(255) NOT NULL DEFAULT '',
        created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        modified DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await prisma.$executeRawUnsafe(
      `INSERT INTO flags (id, flag_img, name, created, modified)
       VALUES (1, 'flag1.png', 'Default Flag', NOW(), NOW())`
    );
  }

  if (!(await tableExists('countries'))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE countries (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        code CHAR(2) NOT NULL DEFAULT '',
        name VARCHAR(45) NOT NULL DEFAULT '',
        flag_id INT NOT NULL DEFAULT 0,
        created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        modified DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await prisma.$executeRawUnsafe(
      `INSERT INTO countries (id, code, name, flag_id, created, modified)
       VALUES (1, 'US', 'United States', 1, NOW(), NOW())`
    );
  } else {
    await ensureColumn('countries', 'code', "CHAR(2) NOT NULL DEFAULT ''");
    await ensureColumn('countries', 'name', "VARCHAR(45) NOT NULL DEFAULT ''");
    await ensureColumn('countries', 'flag_id', 'INT NOT NULL DEFAULT 0');
  }
}

/** Ensures legacy users/countries/flags schema used by promocode creator lookups. */
export async function ensureLegacyPromocodeUserTables(): Promise<void> {
  if (legacyUserSchemaEnsured) return;
  await ensureLegacyUsersTable();
  await ensureLegacyCountryFlagTables();
  legacyUserSchemaEnsured = true;
}

const SETTINGS_TABLE_CANDIDATES = ['promocode_settings', 'promocode_setting'];
const APPLIES_TABLE_CANDIDATES = ['promocode_applies', 'promocode_apply'];
const SUBSCRIPTION_TABLE_CANDIDATES = ['subscription_settings'];
const COUNTRIES_TABLE_CANDIDATES = ['countries', 'country'];
const FLAGS_TABLE_CANDIDATES = ['flags', 'flag'];
const HELP_PAGES_TABLE_CANDIDATES = ['help_html_pages'];
const LANGUAGE_TABLE_CANDIDATES = ['language_values'];

const LEGACY_USER_SELECT = `id, username, email, country_id, image, subscription_start_date, subscription_end_date, subscription_setting_id, firstname`;

const LEGACY_USER_SELECT_CANDIDATES = [
  'id',
  'username',
  'email',
  'created',
  'country_id',
  'image',
  'subscription_start_date',
  'subscription_end_date',
  'subscription_setting_id',
  'firstname',
  'credits',
  'role_id',
];

async function legacyUserSelectClause(tableName: string): Promise<string> {
  const columns = await getTableColumns(tableName);
  const selected = LEGACY_USER_SELECT_CANDIDATES.filter((column) => columns.has(column));
  if (selected.length === 0) return 'id';
  if (!selected.includes('id')) selected.unshift('id');
  return selected.map((column) => `\`${column}\``).join(', ');
}

let cachedTables: Partial<Record<string, string | null>> = {};

export function clearPromocodeTableCache(): void {
  cachedTables = {};
  resolvedLegacyUsersTableName = null;
  legacyUserSchemaEnsured = false;
}

async function table(candidates: string[], key: string): Promise<string | null> {
  if (cachedTables[key] !== undefined) return cachedTables[key] ?? null;
  cachedTables[key] = await findExistingTable(candidates);
  return cachedTables[key] ?? null;
}

export async function getPromocodeSettingsTable(): Promise<string | null> {
  return table(SETTINGS_TABLE_CANDIDATES, 'settings');
}

export async function getPromocodeAppliesTable(): Promise<string | null> {
  return table(APPLIES_TABLE_CANDIDATES, 'applies');
}

export async function getLegacyUsersTable(): Promise<string | null> {
  await ensureLegacyPromocodeUserTables();
  const tableName = await resolveLegacyUsersTableName();
  return (await tableExists(tableName)) ? tableName : null;
}

export async function getSubscriptionSettingsTable(): Promise<string | null> {
  return table(SUBSCRIPTION_TABLE_CANDIDATES, 'subscriptions');
}

export async function getCountriesTable(): Promise<string | null> {
  return table(COUNTRIES_TABLE_CANDIDATES, 'countries');
}

export async function getFlagsTable(): Promise<string | null> {
  return table(FLAGS_TABLE_CANDIDATES, 'flags');
}

export async function getHelpHtmlPagesTable(): Promise<string | null> {
  return table(HELP_PAGES_TABLE_CANDIDATES, 'helpPages');
}

export async function getLanguageValuesTable(): Promise<string | null> {
  return table(LANGUAGE_TABLE_CANDIDATES, 'languages');
}

function rowVal(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) return row[key];
  }
  return null;
}

export function mapLegacyUser(row: Record<string, unknown> | null | undefined): LegacyUserSnippet | null {
  if (!row) return null;
  const id = Number(rowVal(row, 'id', 'ID'));
  if (!Number.isFinite(id)) return null;
  return {
    id,
    username: rowVal(row, 'username', 'Username') != null ? String(rowVal(row, 'username', 'Username')) : null,
    email: rowVal(row, 'email', 'Email') != null ? String(rowVal(row, 'email', 'Email')) : null,
    created:
      rowVal(row, 'created', 'Created') != null ? String(rowVal(row, 'created', 'Created')) : null,
    countryId:
      rowVal(row, 'country_id', 'countryId') != null
        ? Number(rowVal(row, 'country_id', 'countryId'))
        : null,
    image: rowVal(row, 'image', 'Image') != null ? String(rowVal(row, 'image', 'Image')) : null,
    subscriptionStartDate:
      rowVal(row, 'subscription_start_date', 'subscriptionStartDate') != null
        ? formatPromocodeDisplayDate(rowVal(row, 'subscription_start_date', 'subscriptionStartDate'))
        : null,
    subscriptionEndDate:
      rowVal(row, 'subscription_end_date', 'subscriptionEndDate') != null
        ? formatPromocodeDisplayDate(rowVal(row, 'subscription_end_date', 'subscriptionEndDate'))
        : null,
    subscriptionSettingId:
      rowVal(row, 'subscription_setting_id', 'subscriptionSettingId') != null
        ? Number(rowVal(row, 'subscription_setting_id', 'subscriptionSettingId'))
        : null,
    firstname:
      rowVal(row, 'firstname', 'firstName', 'first_name') != null
        ? String(rowVal(row, 'firstname', 'firstName', 'first_name'))
        : null,
    credits:
      rowVal(row, 'credits', 'Credits') != null
        ? Number(rowVal(row, 'credits', 'Credits')) || 0
        : null,
    roleId:
      rowVal(row, 'role_id', 'roleId') != null
        ? Number(rowVal(row, 'role_id', 'roleId'))
        : null,
  };
}

export async function fetchLegacyUsersByIds(ids: number[]): Promise<Map<number, LegacyUserSnippet>> {
  await ensureLegacyPromocodeUserTables();

  const map = new Map<number, LegacyUserSnippet>();
  const unique = Array.from(new Set(ids.filter((id) => Number.isFinite(id) && id > 0)));
  if (unique.length === 0) return map;

  const usersTable = await getLegacyUsersTable();
  if (!usersTable) return map;

  const selectClause = await legacyUserSelectClause(usersTable);
  const placeholders = unique.map(() => '?').join(',');
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT ${selectClause}
     FROM \`${usersTable}\`
     WHERE id IN (${placeholders})`,
    ...unique
  ).catch((err) => {
    console.warn('fetchLegacyUsersByIds query failed:', err);
    return [] as Record<string, unknown>[];
  });

  for (const row of rows) {
    const user = mapLegacyUser(row);
    if (user) map.set(user.id, user);
  }
  return map;
}

export async function fetchLegacyUserByUsername(username: string): Promise<LegacyUserSnippet | null> {
  await ensureLegacyPromocodeUserTables();

  const usersTable = await getLegacyUsersTable();
  if (!usersTable || !username.trim()) return null;

  const selectClause = await legacyUserSelectClause(usersTable);
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT ${selectClause}
     FROM \`${usersTable}\`
     WHERE LOWER(username) = ? AND delete_status = 'N'
     LIMIT 1`,
    username.trim().toLowerCase()
  ).catch(() => [] as Record<string, unknown>[]);
  return mapLegacyUser(rows[0]);
}

export async function fetchLegacyUserByEmail(email: string): Promise<LegacyUserSnippet | null> {
  await ensureLegacyPromocodeUserTables();

  const usersTable = await getLegacyUsersTable();
  if (!usersTable || !email.trim()) return null;

  const selectClause = await legacyUserSelectClause(usersTable);
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT ${selectClause}
     FROM \`${usersTable}\`
     WHERE LOWER(email) = ? AND delete_status = 'N'
     LIMIT 1`,
    email.trim().toLowerCase()
  ).catch(() => [] as Record<string, unknown>[]);
  return mapLegacyUser(rows[0]);
}

export async function findLegacyUsersByKeyword(keyword: string): Promise<number[]> {
  await ensureLegacyPromocodeUserTables();

  const usersTable = await getLegacyUsersTable();
  if (!usersTable || !keyword.trim()) return [];
  const like = `%${keyword.trim()}%`;
  const rows = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
    `SELECT id FROM \`${usersTable}\`
     WHERE username LIKE ? OR email LIKE ? OR firstname LIKE ?
     LIMIT 500`,
    like,
    like,
    like
  );
  return rows.map((r) => Number(r.id)).filter((id) => Number.isFinite(id));
}

/** PHP promoList search matches username/firstname only (not email). */
export async function findLegacyUsersByUsernameOrFirstname(keyword: string): Promise<number[]> {
  await ensureLegacyPromocodeUserTables();

  const usersTable = await getLegacyUsersTable();
  if (!usersTable || !keyword.trim()) return [];

  const columns = await getTableColumns(usersTable);
  const orParts: string[] = [];
  const params: unknown[] = [];
  const like = `%${keyword.trim()}%`;

  if (columns.has('username')) {
    orParts.push('username LIKE ?');
    params.push(like);
  }
  if (columns.has('firstname')) {
    orParts.push('firstname LIKE ?');
    params.push(like);
  }
  if (orParts.length === 0) return [];

  const rows = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
    `SELECT id FROM \`${usersTable}\`
     WHERE (${orParts.join(' OR ')})
     LIMIT 500`,
    ...params
  );
  return rows.map((r) => Number(r.id)).filter((id) => Number.isFinite(id));
}

/** PHP promoList: restrict user search to ids that appear on promocode applies. */
export async function filterLegacyUsersByUsernameOrFirstname(
  userIds: number[],
  keyword: string
): Promise<number[]> {
  const ids = Array.from(new Set(userIds.filter((id) => Number.isFinite(id) && id > 0)));
  if (ids.length === 0 || !keyword.trim()) return [];

  await ensureLegacyPromocodeUserTables();
  const usersTable = await getLegacyUsersTable();
  if (!usersTable) return [];

  const columns = await getTableColumns(usersTable);
  const orParts: string[] = [];
  const params: unknown[] = [...ids];
  const like = `%${keyword.trim()}%`;
  const idPlaceholders = ids.map(() => '?').join(',');

  if (columns.has('username')) {
    orParts.push('username LIKE ?');
    params.push(like);
  }
  if (columns.has('firstname')) {
    orParts.push('firstname LIKE ?');
    params.push(like);
  }
  if (orParts.length === 0) return [];

  const rows = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
    `SELECT id FROM \`${usersTable}\`
     WHERE id IN (${idPlaceholders})
       AND (${orParts.join(' OR ')})
     LIMIT 500`,
    ...params
  );
  return rows.map((r) => Number(r.id)).filter((id) => Number.isFinite(id));
}

export async function legacyUserExistsByEmail(email: string): Promise<boolean> {
  await ensureLegacyPromocodeUserTables();

  const usersTable = await getLegacyUsersTable();
  if (!usersTable || !email.trim()) return false;
  const rows = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
    `SELECT id FROM \`${usersTable}\` WHERE email = ? LIMIT 1`,
    email.trim()
  );
  return rows.length > 0;
}

export async function fetchFlagImageByCountryId(countryId: number | null): Promise<string | null> {
  if (!countryId) return null;
  await ensureLegacyPromocodeUserTables();

  const countriesTable = await getCountriesTable();
  const flagsTable = await getFlagsTable();
  if (!countriesTable) return null;

  const countryColumns = await getTableColumns(countriesTable);
  const countrySelect = [
    countryColumns.has('flag_id') ? 'flag_id' : null,
    countryColumns.has('country_pic') ? 'country_pic' : null,
  ].filter(Boolean).join(', ');
  if (!countrySelect) return null;

  const countryRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT ${countrySelect} FROM \`${countriesTable}\` WHERE id = ? LIMIT 1`,
    countryId
  );
  const countryPic = countryRows[0]?.country_pic ?? countryRows[0]?.countryPic;
  if (countryPic != null && String(countryPic).trim()) {
    return String(countryPic);
  }

  if (!flagsTable) return null;
  const flagId = countryRows[0]?.flag_id ?? countryRows[0]?.flagId;
  if (flagId == null) return null;

  const flagRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT flag_img FROM \`${flagsTable}\` WHERE id = ? LIMIT 1`,
    Number(flagId)
  );
  const img = flagRows[0]?.flag_img ?? flagRows[0]?.flagImg;
  return img != null ? String(img) : null;
}

export async function fetchCountryCodeById(countryId: number | null): Promise<string | null> {
  if (!countryId) return null;
  await ensureLegacyPromocodeUserTables();

  const countriesTable = await getCountriesTable();
  if (!countriesTable) return null;
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT code, name FROM \`${countriesTable}\` WHERE id = ? LIMIT 1`,
    countryId
  );
  const code = rows[0]?.code != null ? String(rows[0].code).trim() : '';
  if (code) return code;

  // Legacy rows created without an ISO code: derive it from the country name.
  const name = rows[0]?.name != null ? String(rows[0].name).trim() : '';
  const derived = name ? countryCodeFromName(name) : '';
  return derived || null;
}

export async function getSettingsColumns(): Promise<Set<string>> {
  const tableName = await getPromocodeSettingsTable();
  if (!tableName) return new Set();
  return getTableColumns(tableName);
}

export async function getAppliesColumns(): Promise<Set<string>> {
  const tableName = await getPromocodeAppliesTable();
  if (!tableName) return new Set();
  return getTableColumns(tableName);
}

function modernUserTypeToLegacyRoleId(userType: string | undefined): number {
  const map: Record<string, number> = {
    ADMIN: 2,
    ATHLETE: 5,
    COACH: 6,
    TEAM: 7,
    TEAM_MANAGER: 7,
    CLUB: 8,
    CLUB_TRAINER: 8,
    GROUP: 9,
    GROUP_ADMIN: 9,
  };
  return map[(userType ?? '').toUpperCase()] || 5;
}

async function lookupLegacyIdMapping(modernUserId: string): Promise<number | null> {
  const mappingTable = await findExistingTable(['legacy_id_mappings']);
  if (!mappingTable) return null;

  const rows = await prisma.$queryRawUnsafe<{ legacy_id: number | bigint | null }[]>(
    `SELECT legacy_id FROM \`${mappingTable}\`
     WHERE new_id = ? AND legacy_table = 'users'
     ORDER BY legacy_id DESC LIMIT 1`,
    modernUserId
  );
  const legacyId = rows[0]?.legacy_id != null ? Number(rows[0].legacy_id) : 0;
  return legacyId > 0 ? legacyId : null;
}

async function upsertLegacyIdMapping(modernUserId: string, legacyUserId: number): Promise<void> {
  const mappingTable = await findExistingTable(['legacy_id_mappings']);
  if (!mappingTable) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS legacy_id_mappings (
        id VARCHAR(255) PRIMARY KEY,
        legacy_table VARCHAR(255),
        legacy_id INTEGER,
        new_id VARCHAR(255)
      )
    `);
  }

  const table = mappingTable ?? 'legacy_id_mappings';
  await prisma.$executeRawUnsafe(
    `INSERT INTO \`${table}\` (id, legacy_table, legacy_id, new_id)
     VALUES (?, 'users', ?, ?)
     ON DUPLICATE KEY UPDATE legacy_table = VALUES(legacy_table), legacy_id = VALUES(legacy_id), new_id = VALUES(new_id)`,
    `${modernUserId}_map`,
    legacyUserId,
    modernUserId
  );
}

function legacyEmailsMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Only accept a legacy user id when the row email matches the session email. */
async function legacyUserIdIfEmailMatches(
  legacyUserId: number,
  email: string
): Promise<number> {
  if (legacyUserId <= 0) return 0;
  const user = (await fetchLegacyUsersByIds([legacyUserId])).get(legacyUserId);
  if (!user?.email) return 0;
  return legacyEmailsMatch(user.email, email) ? legacyUserId : 0;
}

async function fetchLegacyRoleId(userId: number): Promise<number | null> {
  const usersTable = await getLegacyUsersTable();
  if (!usersTable || userId <= 0) return null;
  const rows = await prisma.$queryRawUnsafe<{ role_id: number | null }[]>(
    `SELECT role_id FROM \`${usersTable}\` WHERE id = ? LIMIT 1`,
    userId
  );
  return rows[0]?.role_id != null ? Number(rows[0].role_id) : null;
}

/** Create or link a legacy users row for a Next.js account (users_new). */
export async function ensureLegacyUserForModernAccount(params: {
  modernUserId: string;
  email: string;
  username: string;
  userType?: string;
  name?: string;
}): Promise<{ legacyUserId: number; roleId: number | null } | null> {
  await ensureLegacyPromocodeUserTables();
  const usersTable = await getLegacyUsersTable();
  if (!usersTable) return null;

  const email = params.email.trim().toLowerCase();
  const username = params.username.trim();
  const roleId = modernUserTypeToLegacyRoleId(params.userType);
  const nameParts = (params.name ?? '').trim().split(/\s+/).filter(Boolean);
  const firstname = nameParts[0] ?? username;
  const lastname = nameParts.slice(1).join(' ');
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const existingByEmail = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
    `SELECT id FROM \`${usersTable}\`
     WHERE LOWER(email) = ? AND delete_status = 'N' LIMIT 1`,
    email
  );
  if (existingByEmail[0]?.id) {
    const legacyUserId = Number(existingByEmail[0].id);
    await upsertLegacyIdMapping(params.modernUserId, legacyUserId);
    return { legacyUserId, roleId: await fetchLegacyRoleId(legacyUserId) };
  }

  if (username) {
    const byUsernameUser = await fetchLegacyUserByUsername(username);
    if (byUsernameUser?.id && legacyEmailsMatch(byUsernameUser.email, email)) {
      await upsertLegacyIdMapping(params.modernUserId, byUsernameUser.id);
      return {
        legacyUserId: byUsernameUser.id,
        roleId: await fetchLegacyRoleId(byUsernameUser.id),
      };
    }
  }

  const columns = await getTableColumns(usersTable);
  const fields: string[] = [];
  const values: unknown[] = [];
  const add = (col: string, val: unknown) => {
    if (columns.has(col)) {
      fields.push(`\`${col}\``);
      values.push(val);
    }
  };

  add('role_id', roleId);
  add('username', username || `user_${Date.now()}`);
  add('password', '');
  add('firstname', firstname);
  add('lastname', lastname);
  add('email', email);
  add('country_id', 1);
  add('image', '');
  add('delete_status', 'N');
  add('created', now);
  add('modified', now);

  if (fields.length === 0) return null;

  await prisma.$queryRawUnsafe(
    `INSERT INTO \`${usersTable}\` (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`,
    ...values
  );

  const inserted = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
    `SELECT id FROM \`${usersTable}\` WHERE LOWER(email) = ? ORDER BY id DESC LIMIT 1`,
    email
  );
  const legacyUserId = inserted[0]?.id != null ? Number(inserted[0].id) : 0;
  if (legacyUserId <= 0) return null;

  await upsertLegacyIdMapping(params.modernUserId, legacyUserId);
  return { legacyUserId, roleId: await fetchLegacyRoleId(legacyUserId) ?? roleId };
}

/** Resolve JWT session to legacy users.id for promocode features. */
export async function resolveLegacyUserForPromocodeSession(params: {
  modernUserId?: string;
  email: string;
  username?: string;
  userType?: string;
  name?: string;
}): Promise<{ legacyUserId: number; roleId: number | null; username: string; email: string } | null> {
  await ensureLegacyPromocodeUserTables();

  const email = params.email.trim().toLowerCase();
  let legacyUserId = 0;
  let resolvedUsername = params.username?.trim() ?? '';

  const legacyByEmail = await fetchLegacyUserByEmail(email);
  if (legacyByEmail?.id) {
    legacyUserId = legacyByEmail.id;
    resolvedUsername = resolvedUsername || legacyByEmail.username || '';
  }

  if (legacyUserId === 0 && params.modernUserId) {
    const fromPrefix = params.modernUserId.match(/^legacy_(\d+)(?:_|$)/);
    if (fromPrefix?.[1]) {
      legacyUserId = Number(fromPrefix[1]);
    }
  }

  if (legacyUserId === 0 && params.modernUserId) {
    const mapped = await lookupLegacyIdMapping(params.modernUserId);
    if (mapped) {
      legacyUserId = await legacyUserIdIfEmailMatches(mapped, email);
    }
  }

  if (legacyUserId === 0 && resolvedUsername) {
    const byUsernameUser = await fetchLegacyUserByUsername(resolvedUsername);
    if (byUsernameUser?.id && legacyEmailsMatch(byUsernameUser.email, email)) {
      legacyUserId = byUsernameUser.id;
    }
  }

  if (legacyUserId === 0) {
    const appliesTable = await getPromocodeAppliesTable();
    if (appliesTable) {
      const applyRows = await prisma.$queryRawUnsafe<{ receiver_id: number | null }[]>(
        `SELECT receiver_id FROM \`${appliesTable}\`
         WHERE LOWER(receiver_email) = ? AND delete_status = 2 AND receiver_id > 0
         ORDER BY id DESC LIMIT 1`,
        email
      );
      const receiverId = applyRows[0]?.receiver_id != null ? Number(applyRows[0].receiver_id) : 0;
      if (receiverId > 0) {
        legacyUserId = await legacyUserIdIfEmailMatches(receiverId, email);
      }
    }
  }

  if (legacyUserId === 0 && params.modernUserId) {
    const ensured = await ensureLegacyUserForModernAccount({
      modernUserId: params.modernUserId,
      email,
      username: resolvedUsername || email.split('@')[0] || 'user',
      userType: params.userType,
      name: params.name,
    });
    if (ensured) {
      legacyUserId = ensured.legacyUserId;
    }
  }

  if (legacyUserId <= 0) return null;

  const roleId = await fetchLegacyRoleId(legacyUserId);
  if (!resolvedUsername) {
    const userMap = await fetchLegacyUsersByIds([legacyUserId]);
    resolvedUsername = userMap.get(legacyUserId)?.username ?? '';
  }

  if (params.modernUserId) {
    await upsertLegacyIdMapping(params.modernUserId, legacyUserId).catch(() => undefined);
  }

  return {
    legacyUserId,
    roleId,
    username: resolvedUsername,
    email,
  };
}

