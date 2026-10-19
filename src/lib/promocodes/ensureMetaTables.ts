import mysql from 'mysql2/promise';
import { prisma } from '@/lib/prisma';
import { findExistingTable, getTableColumns } from '@/lib/outcomeSettingsDb';
import { clearPromocodeTableCache, ensureLegacyPromocodeUserTables } from './legacyDb';
import { resetQuickRegisterSubscriptionSeedCache } from '../users/quickRegisterSubscriptionSeed';
import { repairInvalidPromocodeSettingDates } from './promocodeSettingsQuery';
import legacyHelpHtmlPages from './helpHtmlPagesLegacySeed.json';
import {
  DEFAULT_INVITE_PARAGRAPH_IT,
  ensurePromocodeInviteLocalizedContent,
  OTD_HELP_UNIQUE_ID,
} from './promocodeInviteLocale';

export type LegacyDbConfig = {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
};

export function getLegacyDbConfig(): LegacyDbConfig | null {
  const legacyUrl = process.env.LEGACY_DATABASE_URL || process.env.LEGACY_DB_URL;
  if (legacyUrl) {
    try {
      const parsed = new URL(legacyUrl);
      return {
        host: parsed.hostname,
        port: Number(parsed.port) || 3306,
        user: decodeURIComponent(parsed.username || ''),
        password: decodeURIComponent(parsed.password || ''),
        database: parsed.pathname.replace(/^\//, ''),
      };
    } catch {
      return null;
    }
  }

  const prodLegacyUrl = process.env.PROD_DATABASE_URL || process.env.PROD_DB_URL;
  if (prodLegacyUrl) {
    try {
      const parsed = new URL(prodLegacyUrl);
      return {
        host: parsed.hostname,
        port: Number(parsed.port) || 3306,
        user: decodeURIComponent(parsed.username || ''),
        password: decodeURIComponent(parsed.password || ''),
        database: parsed.pathname.replace(/^\//, ''),
      };
    } catch {
      return null;
    }
  }

  const host = process.env.LEGACY_DB_HOST;
  const user = process.env.LEGACY_DB_USER;
  const database = process.env.LEGACY_DB_NAME;
  if (!host || !user || !database) return null;

  return {
    host,
    port: Number(process.env.LEGACY_DB_PORT || 3306),
    user,
    password: process.env.LEGACY_DB_PASSWORD || undefined,
    database,
  };
}

export async function withLegacyConnection<T>(
  fn: (connection: mysql.Connection) => Promise<T>
): Promise<T | null> {
  const config = getLegacyDbConfig();
  if (!config) return null;

  let connection: mysql.Connection | undefined;
  try {
    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
    });
    return await fn(connection);
  } catch (err) {
    console.warn('Legacy DB unavailable for promocodes:', err);
    return null;
  } finally {
    if (connection) {
      await connection.end().catch(() => undefined);
    }
  }
}

let promocodeMetaTablesEnsured = false;

const SUBSCRIPTION_TABLE_CANDIDATES = ['subscription_settings'];
const HELP_PAGES_TABLE_CANDIDATES = ['help_html_pages'];
const LANGUAGE_TABLE_CANDIDATES = ['language_values'];

const DEFAULT_SUBSCRIPTIONS: { id: number; name: string }[] = [
  { id: 1, name: 'Single User — Trial' },
  { id: 2, name: 'Single User — Base' },
  { id: 3, name: 'Single User — Premium' },
  { id: 4, name: 'Single User — Professional' },
  { id: 5, name: 'Coach — Base' },
  { id: 6, name: 'Coach — Premium' },
  { id: 7, name: 'Team — Base' },
  { id: 8, name: 'Group — Base' },
  { id: 9, name: 'Club — Base' },
  { id: 10, name: 'Club — Premium' },
  { id: 11, name: 'Club — Professional' },
  { id: 12, name: 'Coach — Professional' },
  { id: 13, name: 'Team — Premium' },
  { id: 14, name: 'Team — Professional' },
  { id: 15, name: 'Group — Premium' },
  { id: 16, name: 'Group — Professional' },
];

const SUBSCRIPTION_ROLE_BY_ID: Record<number, number> = {
  1: 5,
  2: 5,
  3: 5,
  4: 5,
  5: 6,
  6: 6,
  12: 6,
  7: 7,
  13: 7,
  14: 7,
  8: 9,
  15: 9,
  16: 9,
  9: 8,
  10: 8,
  11: 8,
};

const LEGACY_HELP_HTML_PAGES: { id: number; title: string; langId: number; content: string }[] =
  legacyHelpHtmlPages.map((row) => ({
    id: row.id,
    title: row.title,
    langId: row.langId,
    content: row.content ?? '',
  }));

const DEFAULT_LANGUAGES: { id: number; name: string }[] = [
  { id: 1, name: 'en' },
  { id: 4, name: 'it' },
];

export function getDefaultPromocodeMeta(): {
  subscriptions: { id: number; name: string }[];
  helpHtmlPages: { id: number; title: string }[];
  languages: { id: number; name: string }[];
} {
  return {
    subscriptions: DEFAULT_SUBSCRIPTIONS.map((row) => ({ id: row.id, name: row.name })),
    helpHtmlPages: LEGACY_HELP_HTML_PAGES.filter((row) => row.langId === 1).map((row) => ({
      id: row.id,
      title: row.title,
    })),
    languages: DEFAULT_LANGUAGES.map((row) => ({ id: row.id, name: row.name })),
  };
}

const DEFAULT_INVITE_PARAGRAPH_EN = `<p>Dear user,&nbsp;<br />
we are happy to send you the promotional code with which you can register on the Movesbook platform and which will allow you to access exclusive services for athletes, technicians and managers of clubs and sports centers, taking advantage of discounts and benefits.</p>
<p>Registering with the code received allows you to immediately have credits that can be used as a discount for purchases of services available on Movesbook.<br />
The same code can be used by you to invite other potential users who, once registered, will allow you to earn further credits based on the type of version purchased.&nbsp;</p>
<p>The users you invite will also be able to register with the same promotional code and in turn invite other users with the same promo code.</p>
<p>You will be able to benefit from the credits earned from the registration of 2 levels of users to whom you have sent the code, therefore you will receive credits from the registration of friends and friends of friends</p>
<p>The Movesbook team</p>`;

async function seedHelpHtmlPagesFromLegacy(): Promise<void> {
  if (!(await tableExists('help_html_pages'))) return;
  if ((await countRows('help_html_pages')) > 0) return;

  const columns = await getTableColumns('help_html_pages');
  const titleCol = pickColumn(columns, ['page_title', 'title']);
  if (!titleCol) return;

  const langCol = pickColumn(columns, ['lang_id', 'language_id']);
  const contentCol = pickColumn(columns, ['content']);
  const createdCol = pickColumn(columns, ['created']);

  for (const row of LEGACY_HELP_HTML_PAGES) {
    try {
      const fields = ['id', titleCol];
      const placeholders = ['?', '?'];
      const values: unknown[] = [row.id, row.title];
      const updates = [`\`${titleCol}\` = VALUES(\`${titleCol}\`)`];

      if (langCol) {
        fields.push(langCol);
        placeholders.push('?');
        values.push(row.langId);
        updates.push(`\`${langCol}\` = VALUES(\`${langCol}\`)`);
      }
      if (contentCol) {
        fields.push(contentCol);
        placeholders.push('?');
        values.push(row.content);
        updates.push(`\`${contentCol}\` = VALUES(\`${contentCol}\`)`);
      }
      if (createdCol) {
        fields.push(createdCol);
        placeholders.push('NOW()');
      }
      const uniqueCol = pickColumn(columns, ['uniqueid']);
      if (uniqueCol && row.id === 2 && row.title === 'OTD') {
        fields.push(uniqueCol);
        placeholders.push('?');
        values.push(OTD_HELP_UNIQUE_ID);
        updates.push(`\`${uniqueCol}\` = VALUES(\`${uniqueCol}\`)`);
      }

      await prisma.$executeRawUnsafe(
        `INSERT INTO help_html_pages (${fields.map((f) => `\`${f}\``).join(', ')})
         VALUES (${placeholders.join(', ')})
         ON DUPLICATE KEY UPDATE ${updates.join(', ')}`,
        ...values
      );
    } catch (err) {
      console.warn(`help_html_pages seed skipped for id=${row.id}:`, err);
    }
  }
}


async function tableExists(tableName: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ TABLE_NAME: string }[]>(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
    tableName
  );
  return rows.length > 0;
}

async function countRows(tableName: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ c: bigint | number }[]>(
    `SELECT COUNT(*) AS c FROM \`${tableName}\``
  );
  return Number(rows[0]?.c ?? 0);
}

/** Create minimal legacy meta tables in the app DB when missing (local/dev bootstrap). */
export async function ensurePromocodeMetaTables(): Promise<void> {
  if (!(process.env.DATABASE_URL || '').startsWith('mysql')) return;
  if (promocodeMetaTablesEnsured) return;

  if (!(await tableExists('subscription_settings'))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE subscription_settings (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        subscription_name VARCHAR(255) NOT NULL DEFAULT '',
        short_name VARCHAR(64) NULL,
        role_id INT NULL,
        price DECIMAL(10,2) NULL,
        credit1 VARCHAR(32) NULL,
        delete_status TINYINT NULL DEFAULT 2
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await tableExists('help_html_pages'))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE help_html_pages (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        page_title VARCHAR(255) NOT NULL,
        lang_id INT NOT NULL DEFAULT 1,
        uniqueid VARCHAR(64) NULL,
        user_id INT NULL,
        content MEDIUMTEXT NULL,
        created DATETIME NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } else {
    const helpColumns = await getTableColumns('help_html_pages');
    if (!helpColumns.has('content')) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE help_html_pages ADD COLUMN content MEDIUMTEXT NULL`
      );
    }
  }

  if (!(await tableExists('language_values'))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE language_values (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        lang_name VARCHAR(64) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await tableExists('language_paragraphs'))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE language_paragraphs (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        en MEDIUMTEXT NOT NULL,
        fr MEDIUMTEXT NOT NULL,
        it MEDIUMTEXT NOT NULL,
        de MEDIUMTEXT NOT NULL,
        es MEDIUMTEXT NOT NULL,
        por MEDIUMTEXT NOT NULL,
        rus MEDIUMTEXT NOT NULL,
        ind MEDIUMTEXT NOT NULL,
        chin MEDIUMTEXT NOT NULL,
        arab MEDIUMTEXT NOT NULL,
        variable_name VARCHAR(255) NOT NULL DEFAULT '',
        created VARCHAR(64) NOT NULL DEFAULT '',
        modified VARCHAR(64) NOT NULL DEFAULT ''
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await tableExists('promocode_settings'))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE promocode_settings (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(100) NOT NULL,
        valid_from DATE NOT NULL,
        valid_to DATE NOT NULL,
        usable_by VARCHAR(16) NOT NULL DEFAULT 'Once',
        used INT NOT NULL DEFAULT 0,
        version_id VARCHAR(100) NOT NULL DEFAULT '',
        discount INT NOT NULL DEFAULT 0,
        enable VARCHAR(16) NOT NULL DEFAULT 'Disable',
        enable_extension INT NULL DEFAULT 0,
        subscription_extends INT NULL,
        social_options VARCHAR(500) NULL,
        management_section VARCHAR(50) NULL,
        enable_free_accounts INT NULL DEFAULT 0,
        basic_version VARCHAR(100) NULL,
        premium_version VARCHAR(100) NULL,
        professional_version VARCHAR(100) NULL,
        delete_status INT NOT NULL DEFAULT 2,
        delete_date DATE NULL,
        created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        modified DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        email VARCHAR(255) NULL,
        recipient VARCHAR(50) NULL,
        help_html_pages_id VARCHAR(20) NULL,
        creater_id VARCHAR(50) NULL,
        creator_id INT NULL,
        language_id VARCHAR(10) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await tableExists('promocode_applies'))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE promocode_applies (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL DEFAULT 0,
        promocode_id INT NOT NULL DEFAULT 0,
        delete_status INT NOT NULL DEFAULT 2,
        delete_date DATE NULL,
        created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        modified DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        sender_email VARCHAR(255) NULL,
        receiver_email VARCHAR(255) NULL,
        sender_id INT NULL DEFAULT 0,
        receiver_id INT NULL DEFAULT 0,
        sender_credit VARCHAR(32) NULL,
        receiver_credit VARCHAR(32) NULL,
        receiver_version VARCHAR(32) NULL,
        secondary_sender_id INT NULL,
        secondary_sender_username VARCHAR(255) NULL,
        secondary_sender_credit VARCHAR(32) NULL,
        new_receiver VARCHAR(8) NULL,
        level VARCHAR(20) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (await tableExists('subscription_settings')) {
    try {
      await seedMissingDefaultSubscriptions();
    } catch (err) {
      console.warn('subscription_settings seed skipped:', err);
    }
  }

  try {
    await seedHelpHtmlPagesFromLegacy();
  } catch (err) {
    console.warn('help_html_pages bootstrap skipped:', err);
  }

  try {
    await ensureLegacyPromocodeUserTables();
  } catch (err) {
    console.warn('legacy user tables bootstrap skipped:', err);
  }

  if ((await countRows('language_values')) === 0) {
    for (const row of DEFAULT_LANGUAGES) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO language_values (id, lang_name) VALUES (?, ?)`,
        row.id,
        row.name
      );
    }
  } else if (await tableExists('language_values')) {
    await prisma.$executeRawUnsafe(
      `UPDATE language_values SET lang_name = 'en' WHERE id = 1 AND LOWER(lang_name) = 'english'`
    );
    await prisma.$executeRawUnsafe(
      `UPDATE language_values SET lang_name = 'it' WHERE id = 4 AND LOWER(lang_name) IN ('italian', 'italiano')`
    );
  }

  if ((await countRows('language_paragraphs')) === 0) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO language_paragraphs (
         id, en, fr, it, de, es, por, rus, ind, chin, arab, variable_name, created, modified
       ) VALUES (?, ?, '', ?, '', '', '', '', '', '', '', 'dim', ?, ?)`,
      3,
      DEFAULT_INVITE_PARAGRAPH_EN,
      DEFAULT_INVITE_PARAGRAPH_IT,
      String(Math.floor(Date.now() / 1000)),
      String(Math.floor(Date.now() / 1000))
    );
  }

  try {
    await ensurePromocodeInviteLocalizedContent();
  } catch (err) {
    console.warn('promocode invite localized content bootstrap skipped:', err);
  }

  if (await tableExists('promocode_applies')) {
    try {
      const applyColumns = await getTableColumns('promocode_applies');
      if (!applyColumns.has('other_info')) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE promocode_applies ADD COLUMN other_info VARCHAR(512) NULL DEFAULT NULL`
        );
      }
      if (!applyColumns.has('adv_page')) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE promocode_applies ADD COLUMN adv_page VARCHAR(512) NULL DEFAULT NULL`
        );
      }
      if (!applyColumns.has('invite_mode')) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE promocode_applies ADD COLUMN invite_mode VARCHAR(32) NULL DEFAULT NULL`
        );
      }
      if (!applyColumns.has('invite_intro')) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE promocode_applies ADD COLUMN invite_intro TEXT NULL`
        );
      }
      if (!applyColumns.has('invite_expires_at')) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE promocode_applies ADD COLUMN invite_expires_at DATE NULL`
        );
      }
      if (!applyColumns.has('registration_date')) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE promocode_applies ADD COLUMN registration_date DATETIME NULL`
        );
      }
      if (!applyColumns.has('subscription_start_date')) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE promocode_applies ADD COLUMN subscription_start_date DATE NULL`
        );
      }
      if (!applyColumns.has('subscription_end_date')) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE promocode_applies ADD COLUMN subscription_end_date DATE NULL`
        );
      }
      if (!applyColumns.has('is_registered')) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE promocode_applies ADD COLUMN is_registered TINYINT NULL DEFAULT NULL`
        );
      }
      if (!applyColumns.has('cost_paid')) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE promocode_applies ADD COLUMN cost_paid VARCHAR(64) NULL DEFAULT NULL`
        );
      }
      if (!applyColumns.has('total_payment')) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE promocode_applies ADD COLUMN total_payment VARCHAR(64) NULL DEFAULT NULL`
        );
      }
    } catch (err) {
      console.warn('promocode_applies column migration skipped:', err);
    }
  }

  if (await tableExists('promocode_settings')) {
    try {
      const settingColumns = await getTableColumns('promocode_settings');
      const settingAlters: Array<[string, string]> = [
        ['allow_child_promocodes', 'TINYINT NOT NULL DEFAULT 0'],
        ['allow_generate_promocodes', 'TINYINT NOT NULL DEFAULT 0'],
        ['child_promo_limit', 'INT NULL'],
        ['child_promo_until', 'DATE NULL'],
        ['child_version_ids', 'VARCHAR(255) NULL'],
        ['child_duration_days', 'INT NULL'],
        ['child_invite_duration_days', 'INT NULL'],
        ['max_child_promocodes', 'INT NULL'],
        ['parent_promocode_id', 'INT NULL'],
      ];
      for (const [col, def] of settingAlters) {
        if (!settingColumns.has(col)) {
          await prisma.$executeRawUnsafe(
            `ALTER TABLE promocode_settings ADD COLUMN \`${col}\` ${def}`
          );
        }
      }
    } catch (err) {
      console.warn('promocode_settings child-promo column migration skipped:', err);
    }
  }

  if (!(await tableExists('promocode_monthly_stats'))) {
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE promocode_monthly_stats (
          year INT NOT NULL,
          month INT NOT NULL,
          country_id INT NOT NULL DEFAULT 0,
          country_code VARCHAR(8) NOT NULL DEFAULT '',
          invites_sent INT NOT NULL DEFAULT 0,
          registrations INT NOT NULL DEFAULT 0,
          PRIMARY KEY (year, month, country_id, country_code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    } catch (err) {
      console.warn('promocode_monthly_stats create skipped:', err);
    }
  }

  try {
    const { ensurePromocodeAppSettingsTable } = await import('./promocodeAppSettings');
    await ensurePromocodeAppSettingsTable();
  } catch (err) {
    console.warn('promocode_app_settings bootstrap skipped:', err);
  }

  clearPromocodeTableCache();
  resetQuickRegisterSubscriptionSeedCache();
  if (await tableExists('promocode_settings')) {
    await repairInvalidPromocodeSettingDates('promocode_settings');
  }
  promocodeMetaTablesEnsured = true;
}

async function seedMissingDefaultSubscriptions(): Promise<void> {
  if (!(await tableExists('subscription_settings'))) return;

  const columns = await getTableColumns('subscription_settings');
  const nameCol = pickColumn(columns, ['subscription_name', 'name']) ?? 'subscription_name';
  const hasRoleId = columns.has('role_id');
  const hasDeleteStatus = columns.has('delete_status');

  const existingRows = await prisma.$queryRawUnsafe<
    { id: number | bigint; subscription_name: string | null }[]
  >(`SELECT id, \`${nameCol}\` AS subscription_name FROM subscription_settings`);

  const existingNames = new Set(
    existingRows
      .map((r) => (r.subscription_name ? String(r.subscription_name).trim().toLowerCase() : ''))
      .filter(Boolean)
  );
  const takenIds = new Set(existingRows.map((r) => Number(r.id)));

  for (const row of DEFAULT_SUBSCRIPTIONS) {
    if (existingNames.has(row.name.trim().toLowerCase())) continue;

    const roleId = SUBSCRIPTION_ROLE_BY_ID[row.id];
    const useExplicitId = !takenIds.has(row.id);

    try {
      if (useExplicitId && hasRoleId && roleId && hasDeleteStatus) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO subscription_settings (id, \`${nameCol}\`, role_id, delete_status)
           VALUES (?, ?, ?, 2)`,
          row.id,
          row.name,
          roleId
        );
      } else if (useExplicitId && hasRoleId && roleId) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO subscription_settings (id, \`${nameCol}\`, role_id)
           VALUES (?, ?, ?)`,
          row.id,
          row.name,
          roleId
        );
      } else if (useExplicitId && hasDeleteStatus) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO subscription_settings (id, \`${nameCol}\`, delete_status)
           VALUES (?, ?, 2)`,
          row.id,
          row.name
        );
      } else if (useExplicitId) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO subscription_settings (id, \`${nameCol}\`)
           VALUES (?, ?)`,
          row.id,
          row.name
        );
      } else if (hasRoleId && roleId && hasDeleteStatus) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO subscription_settings (\`${nameCol}\`, role_id, delete_status)
           VALUES (?, ?, 2)`,
          row.name,
          roleId
        );
      } else if (hasDeleteStatus) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO subscription_settings (\`${nameCol}\`, delete_status)
           VALUES (?, 2)`,
          row.name
        );
      } else {
        await prisma.$executeRawUnsafe(
          `INSERT INTO subscription_settings (\`${nameCol}\`)
           VALUES (?)`,
          row.name
        );
      }
      existingNames.add(row.name.trim().toLowerCase());
      if (useExplicitId) takenIds.add(row.id);
    } catch (err) {
      console.warn(`subscription_settings seed skipped for "${row.name}":`, err);
    }
  }
}

function pickColumn(columns: Set<string>, candidates: string[]): string | null {
  return candidates.find((c) => columns.has(c)) ?? null;
}

export async function loadSubscriptionsFromTable(
  query: <T>(sql: string, params?: unknown[]) => Promise<T>
): Promise<{ id: number; name: string }[]> {
  const table = await findExistingTable(SUBSCRIPTION_TABLE_CANDIDATES);
  if (!table) return [];
  const columns = await getTableColumns(table);
  const idCol = pickColumn(columns, ['id']) ?? 'id';
  const nameCol = pickColumn(columns, ['subscription_name', 'name']) ?? 'subscription_name';

  let sql = `SELECT \`${idCol}\` AS id, \`${nameCol}\` AS subscription_name
             FROM \`${table}\``;
  sql += ` ORDER BY \`${idCol}\` ASC`;

  const rows = await query<{ id: number | bigint; subscription_name: string | null }[]>(sql);
  return rows
    .map((row) => ({
      id: Number(row.id),
      name: row.subscription_name ? String(row.subscription_name).trim() : '',
    }))
    .filter((row) => row.name !== '');
}

export async function loadHelpHtmlPagesFromTable(
  query: <T>(sql: string, params?: unknown[]) => Promise<T>
): Promise<{ id: number; title: string }[]> {
  const table = await findExistingTable(HELP_PAGES_TABLE_CANDIDATES);
  if (!table) return [];
  const columns = await getTableColumns(table);
  const idCol = pickColumn(columns, ['id']) ?? 'id';
  const titleCol = pickColumn(columns, ['page_title', 'title']) ?? 'page_title';
  const langCol = pickColumn(columns, ['lang_id', 'language_id']);

  let sql = `SELECT \`${idCol}\` AS id, \`${titleCol}\` AS page_title FROM \`${table}\``;
  const params: unknown[] = [];
  if (langCol) {
    sql += ` WHERE \`${langCol}\` = ?`;
    params.push(1);
  }
  sql += ` ORDER BY \`${idCol}\` DESC`;

  let rows = await query<{ id: number | bigint; page_title: string | null }[]>(sql, params);

  if (rows.length === 0 && langCol) {
    rows = await query<{ id: number | bigint; page_title: string | null }[]>(
      `SELECT \`${idCol}\` AS id, \`${titleCol}\` AS page_title FROM \`${table}\` ORDER BY \`${idCol}\` DESC`
    );
  }

  return rows
    .map((row) => ({
      id: Number(row.id),
      title: row.page_title ? String(row.page_title).trim() : '',
    }))
    .filter((row) => row.title !== '');
}

export async function loadLanguagesFromTable(
  query: <T>(sql: string, params?: unknown[]) => Promise<T>
): Promise<{ id: number; name: string }[]> {
  const table = await findExistingTable(LANGUAGE_TABLE_CANDIDATES);
  if (!table) return [];
  const columns = await getTableColumns(table);
  const idCol = pickColumn(columns, ['id']) ?? 'id';
  const nameCol = pickColumn(columns, ['lang_name', 'name']) ?? 'lang_name';

  const rows = await query<{ id: number | bigint; lang_name: string | null }[]>(
    `SELECT \`${idCol}\` AS id, \`${nameCol}\` AS lang_name FROM \`${table}\` ORDER BY \`${idCol}\` ASC`
  );

  return rows.map((row) => ({
    id: Number(row.id),
    name: row.lang_name ? String(row.lang_name) : `Lang ${row.id}`,
  }));
}

export {
  SUBSCRIPTION_TABLE_CANDIDATES,
  HELP_PAGES_TABLE_CANDIDATES,
  LANGUAGE_TABLE_CANDIDATES,
};
