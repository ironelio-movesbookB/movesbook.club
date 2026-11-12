import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { sanitizeRichHtml } from '@/lib/sanitizeRichHtml';

/**
 * Server helpers for the legacy "Subscription package" / "Package features" /
 * "All subscription packages" sections (ClubSettingsController in movesbook-new).
 * Tables are shared with the PHP version: club_setting_subscription_packages,
 * club_setting_typology_listprices, club_setting_special_services.
 */

const LISTPRICE_TABLE_CANDIDATES = ['club_setting_typology_listprices', 'club_setting_typology_listprice'];
const TYPOLOGY_TABLE_CANDIDATES = ['club_setting_subscription_typologies', 'club_setting_subscription_typology'];
const PACKAGE_TABLE_CANDIDATES = ['club_setting_subscription_packages', 'club_setting_subscription_package'];
const SERVICE_TABLE_CANDIDATES = ['club_setting_special_services', 'club_setting_special_service'];
const SECTOR_TABLE_CANDIDATES = ['club_setting_sectors', 'club_setting_sector'];
const PACKAGE_TABLE = 'club_setting_subscription_packages';
const SHARE_LINK_TTL_SECONDS = 30 * 24 * 60 * 60;

const PACKAGE_COLUMN_DEFINITIONS: Record<string, string> = {
  user_id: 'VARCHAR(191) NULL',
  club_id: 'VARCHAR(191) NULL',
  listprice_id: 'BIGINT NULL',
  package_name: 'VARCHAR(255) NULL',
  service_ids: 'TEXT NULL',
  put_table: "CHAR(1) DEFAULT 'N'",
  view_order: 'TEXT NULL',
  package_feature: 'LONGTEXT NULL',
  created: 'DATETIME DEFAULT CURRENT_TIMESTAMP',
  modified: 'DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
};

export type PackageContext = {
  userId: string;
  club: { id: string; name: string } | null;
  userIds: string[];
};

export type PackageService = {
  id: string;
  sectorId: string;
  sectorName: string;
  serviceName: string;
  cost: string;
  actualCost: string;
  currencyCode: string;
  imageUrl: string | null;
  image1Url: string | null;
  image2Url: string | null;
  videoUrl: string;
  showCost: boolean;
  orderPosition: number;
};

export type PackageRecord = {
  id: string | null;
  listpriceId: string;
  packageName: string;
  putTable: boolean;
  serviceIds: string[];
  viewOrder: Record<string, number>;
  packageFeature: string;
};

export type PackageTableRow = {
  id: string;
  listpriceId: string;
  packageName: string;
  typologyName: string;
  subscriptionName: string;
  packageFeature: string;
  totalCost: number;
  serviceIds: string[];
};

export function text(value: unknown): string {
  return String(value ?? '').trim();
}

function isTruthyFlag(value: unknown): boolean {
  const v = text(value).toUpperCase();
  return v === 'Y' || v === '1' || v === 'TRUE';
}

function placeholders(values: unknown[]): string {
  return values.map(() => '?').join(',');
}

export async function findExistingTable(candidates: string[]): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe<{ TABLE_NAME: string }[]>(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${placeholders(candidates)})`,
    ...candidates
  );
  const existing = new Set(rows.map((row) => row.TABLE_NAME));
  return candidates.find((c) => existing.has(c)) ?? null;
}

async function getTableColumns(tableName: string): Promise<Set<string>> {
  const rows = await prisma.$queryRawUnsafe<{ COLUMN_NAME: string }[]>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    tableName
  );
  return new Set(rows.map((row) => row.COLUMN_NAME));
}

export async function ensurePackageTable(): Promise<string> {
  const existing = await findExistingTable(PACKAGE_TABLE_CANDIDATES);
  const tableName = existing ?? PACKAGE_TABLE;
  if (!existing) {
    const columnSql = Object.entries(PACKAGE_COLUMN_DEFINITIONS)
      .map(([column, definition]) => `\`${column}\` ${definition}`)
      .join(',\n      ');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`${tableName}\` (
        id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        ${columnSql},
        INDEX idx_subscription_package_user_club (user_id, club_id),
        INDEX idx_subscription_package_listprice (listprice_id)
      ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }
  const columns = await getTableColumns(tableName);
  for (const [column, definition] of Object.entries(PACKAGE_COLUMN_DEFINITIONS)) {
    if (!columns.has(column)) {
      await prisma.$executeRawUnsafe(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${column}\` ${definition}`);
    }
  }
  return tableName;
}

async function getLegacyUserId(userId: string): Promise<string | null> {
  const fromId = userId.match(/^legacy_(\d+)(?:_|$)/);
  if (fromId?.[1]) return fromId[1];
  const mappingTable = await findExistingTable(['legacy_id_mappings']);
  if (!mappingTable) return null;
  const rows = await prisma.$queryRawUnsafe<{ legacy_id: number | string }[]>(
    `SELECT legacy_id FROM \`${mappingTable}\`
     WHERE new_id = ? AND legacy_table = 'users' ORDER BY legacy_id DESC LIMIT 1`,
    userId
  );
  return rows[0]?.legacy_id != null ? String(rows[0].legacy_id) : null;
}

async function getOwnedClub(userId: string, requestedClubId: string | null) {
  if (requestedClubId) {
    const selected = await prisma.$queryRaw<{ id: string; name: string }[]>`
      SELECT id, name FROM clubs_new WHERE id = ${requestedClubId} AND adminId = ${userId} LIMIT 1`;
    if (selected[0]) return selected[0];
  }
  const fallback = await prisma.$queryRaw<{ id: string; name: string }[]>`
    SELECT id, name FROM clubs_new WHERE adminId = ${userId} ORDER BY createdAt DESC LIMIT 1`;
  return fallback[0] ?? null;
}

export async function buildContext(userId: string, requestedClubId: string | null): Promise<PackageContext> {
  const club = await getOwnedClub(userId, requestedClubId);
  const legacyUserId = await getLegacyUserId(userId);
  const userIds = Array.from(new Set([userId, legacyUserId].filter(Boolean) as string[]));
  return { userId, club, userIds };
}

export async function getAuthorizedContext(
  request: NextRequest
): Promise<PackageContext | { error: NextResponse }> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const decoded = token ? verifyToken(token) : null;
  if (!decoded?.userId || !decoded.userType) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const userType = String(decoded.userType);
  if (userType !== 'CLUB' && userType !== 'CLUB_TRAINER') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return buildContext(String(decoded.userId), request.nextUrl.searchParams.get('clubId'));
}

function clubFilter(columns: Set<string>, context: PackageContext, alias = ''): { sql: string; params: string[] } {
  if (!context.club?.id || !columns.has('club_id')) return { sql: '', params: [] };
  return { sql: ` AND ${alias}club_id = ?`, params: [context.club.id] };
}

/* ---------------- List prices ---------------- */

export async function fetchListprice(context: PackageContext, id: string) {
  const listpriceTable = await findExistingTable(LISTPRICE_TABLE_CANDIDATES);
  if (!listpriceTable) return null;
  const typologyTable = await findExistingTable(TYPOLOGY_TABLE_CANDIDATES);
  const columns = await getTableColumns(listpriceTable);
  const club = clubFilter(columns, context, 'lp.');
  const typologyJoin = typologyTable ? `LEFT JOIN \`${typologyTable}\` t ON t.id = lp.typology_id` : '';
  const typologyName = typologyTable ? "COALESCE(t.activity_name, '')" : "''";
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT lp.id, lp.typology_id, lp.subscription_name, lp.cost, lp.discount, CAST(lp.expiry_date AS CHAR) AS expiry_date,
            ${typologyName} AS typology_name
     FROM \`${listpriceTable}\` lp ${typologyJoin}
     WHERE lp.id = ? AND lp.user_id IN (${placeholders(context.userIds)}) ${club.sql}
     LIMIT 1`,
    id,
    ...context.userIds,
    ...club.params
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: text(row.id),
    typologyId: text(row.typology_id),
    typologyName: text(row.typology_name),
    subscriptionName: text(row.subscription_name),
    cost: text(row.cost),
    discount: text(row.discount),
    expiryDate: formatDate(row.expiry_date)
  };
}

/** Dropdown options "Typology - Subscription", sorted alphabetically (legacy asort). */
export async function fetchPricelistOptions(context: PackageContext) {
  const listpriceTable = await findExistingTable(LISTPRICE_TABLE_CANDIDATES);
  if (!listpriceTable) return [];
  const typologyTable = await findExistingTable(TYPOLOGY_TABLE_CANDIDATES);
  const columns = await getTableColumns(listpriceTable);
  const club = clubFilter(columns, context, 'lp.');
  const typologyJoin = typologyTable ? `LEFT JOIN \`${typologyTable}\` t ON t.id = lp.typology_id` : '';
  const typologyName = typologyTable ? "COALESCE(t.activity_name, 'Unknown')" : "'Unknown'";
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT lp.id, lp.subscription_name, ${typologyName} AS typology_name
     FROM \`${listpriceTable}\` lp ${typologyJoin}
     WHERE lp.user_id IN (${placeholders(context.userIds)}) ${club.sql}`,
    ...context.userIds,
    ...club.params
  );
  return rows
    .map((row) => ({
      id: text(row.id),
      label: `${text(row.typology_name) || 'Unknown'} - ${text(row.subscription_name)}`
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function formatDate(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  return text(value).slice(0, 10);
}

/** Cost with discount applied while the discount expiry date is not yet passed. */
export function discountedCost(cost: unknown, discount: unknown, expiryDate: unknown): number {
  const base = Number(text(cost)) || 0;
  const percent = Number(text(discount));
  const expiry = formatDate(expiryDate);
  if (!Number.isFinite(percent) || percent <= 0 || !expiry) return base;
  const today = new Date().toISOString().slice(0, 10);
  if (expiry < today) return base;
  return Math.round(base * (1 - percent / 100) * 100) / 100;
}

/* ---------------- Packages ---------------- */

function parseServiceIds(value: unknown): string[] {
  return text(value)
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function parseViewOrder(value: unknown): Record<string, number> {
  const map: Record<string, number> = {};
  for (const pair of text(value).split(',')) {
    const [id, position] = pair.split(':');
    if (id && position && Number.isFinite(Number(position))) map[id.trim()] = Number(position);
  }
  return map;
}

function mapPackageRow(row: Record<string, unknown>, listpriceId: string): PackageRecord {
  return {
    id: text(row.id) || null,
    listpriceId,
    packageName: text(row.package_name),
    putTable: isTruthyFlag(row.put_table),
    serviceIds: parseServiceIds(row.service_ids),
    viewOrder: parseViewOrder(row.view_order),
    packageFeature: typeof row.package_feature === 'string' ? row.package_feature : ''
  };
}

export async function fetchPackageByListprice(context: PackageContext, listpriceId: string): Promise<PackageRecord> {
  const tableName = await ensurePackageTable();
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM \`${tableName}\` WHERE listprice_id = ? AND user_id IN (${placeholders(context.userIds)})
     ORDER BY id ASC LIMIT 1`,
    listpriceId,
    ...context.userIds
  );
  return rows[0]
    ? mapPackageRow(rows[0], listpriceId)
    : {
        id: null,
        listpriceId,
        packageName: '',
        putTable: false,
        serviceIds: [],
        viewOrder: {},
        packageFeature: ''
      };
}

/** Insert or update the package row linked to a list price (legacy upsert by listprice_id). */
export async function upsertPackage(
  context: PackageContext,
  listpriceId: string,
  values: Partial<{
    package_name: string;
    service_ids: string;
    put_table: 'Y' | 'N';
    view_order: string;
    package_feature: string;
  }>
) {
  const tableName = await ensurePackageTable();
  const existing = await fetchPackageByListprice(context, listpriceId);
  const ownerValues = {
    user_id: context.userIds[context.userIds.length - 1] ?? context.userId,
    club_id: context.club?.id ?? null
  };

  if (existing.id) {
    const entries = Object.entries({ ...values, club_id: ownerValues.club_id });
    await prisma.$executeRawUnsafe(
      `UPDATE \`${tableName}\` SET ${entries.map(([c]) => `\`${c}\` = ?`).join(', ')} WHERE id = ?`,
      ...entries.map(([, v]) => v),
      existing.id
    );
    return;
  }

  const insertValues: Record<string, unknown> = {
    service_ids: '',
    put_table: 'N',
    view_order: '',
    package_name: '',
    package_feature: '',
    ...values,
    ...ownerValues,
    listprice_id: listpriceId
  };
  const columns = Object.keys(insertValues);
  await prisma.$executeRawUnsafe(
    `INSERT INTO \`${tableName}\` (${columns.map((c) => `\`${c}\``).join(', ')})
     VALUES (${columns.map(() => '?').join(', ')})`,
    ...columns.map((c) => insertValues[c])
  );
}

export function sanitizePackageFeature(value: unknown): string {
  return sanitizeRichHtml(value);
}

/* ---------------- Special services ---------------- */

function normalizeImagePath(value: unknown): string | null {
  const image = text(value);
  if (!image) return null;
  if (/^https?:\/\//i.test(image)) return image;
  if (image.startsWith('/api/media/')) return image;
  if (image.startsWith('/img/')) return `/api/media${image}`;
  if (image.startsWith('img/')) return `/api/media/${image}`;
  if (image.startsWith('/')) return image;
  return `/api/media/img/special_services/${image}`;
}

/** Available special services of the club, ordered by order_position. */
export async function fetchSpecialServices(context: PackageContext): Promise<PackageService[]> {
  const serviceTable = await findExistingTable(SERVICE_TABLE_CANDIDATES);
  if (!serviceTable) return [];
  const sectorTable = await findExistingTable(SECTOR_TABLE_CANDIDATES);
  const columns = await getTableColumns(serviceTable);
  const optional = ['service_img1', 'service_img2', 'video_url', 'show_cost', 'order_position', 'service_available']
    .filter((c) => columns.has(c))
    .map((c) => `svc.${c}`);
  const sectorJoin = sectorTable
    ? `LEFT JOIN \`${sectorTable}\` sector ON CAST(sector.id AS CHAR) = CAST(svc.sector_id AS CHAR)`
    : '';
  const sectorName = sectorTable ? 'sector.sector_name' : "''";
  const availableFilter = columns.has('service_available') ? ' AND svc.service_available = 1' : '';
  const orderBy = columns.has('order_position')
    ? 'COALESCE(svc.order_position, 999999) ASC, svc.id ASC'
    : 'svc.id ASC';
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT svc.id, svc.sector_id, svc.service_name, svc.club_currency_cost, svc.actual_cost,
            svc.club_currency_code, svc.service_img${optional.length ? `, ${optional.join(', ')}` : ''},
            ${sectorName} AS sector_name
     FROM \`${serviceTable}\` svc ${sectorJoin}
     WHERE svc.user_id IN (${placeholders(context.userIds)}) ${availableFilter}
     ORDER BY ${orderBy}`,
    ...context.userIds
  );
  return rows.map((row) => ({
    id: text(row.id),
    sectorId: text(row.sector_id),
    sectorName: text(row.sector_name),
    serviceName: text(row.service_name),
    cost: text(row.club_currency_cost),
    actualCost: text(row.actual_cost),
    currencyCode: text(row.club_currency_code) || 'EUR',
    imageUrl: normalizeImagePath(row.service_img),
    image1Url: normalizeImagePath(row.service_img1),
    image2Url: normalizeImagePath(row.service_img2),
    videoUrl: text(row.video_url),
    showCost: row.show_cost == null ? true : isTruthyFlag(row.show_cost),
    orderPosition: Number(row.order_position ?? 0)
  }));
}

/** Persists new global order_position values (column drag & drop on the packages table). */
export async function updateServiceOrder(context: PackageContext, orders: { id: string; orderPosition: number }[]) {
  const serviceTable = await findExistingTable(SERVICE_TABLE_CANDIDATES);
  if (!serviceTable) return 0;
  let updated = 0;
  for (const order of orders) {
    if (!order.id || !Number.isFinite(order.orderPosition) || order.orderPosition < 1) continue;
    const count = await prisma.$executeRawUnsafe(
      `UPDATE \`${serviceTable}\` SET order_position = ?, modified = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id IN (${placeholders(context.userIds)})`,
      order.orderPosition,
      order.id,
      ...context.userIds
    );
    updated += Number(count);
  }
  return updated;
}

/* ---------------- Packages table ---------------- */

export async function fetchPackagesTable(context: PackageContext) {
  const packageTable = await ensurePackageTable();
  const listpriceTable = await findExistingTable(LISTPRICE_TABLE_CANDIDATES);
  const services = await fetchSpecialServices(context);
  if (!listpriceTable) return { services, packages: [] as PackageTableRow[] };

  const typologyTable = await findExistingTable(TYPOLOGY_TABLE_CANDIDATES);
  const packageColumns = await getTableColumns(packageTable);
  const club = clubFilter(packageColumns, context, 'p.');
  const typologyJoin = typologyTable ? `LEFT JOIN \`${typologyTable}\` t ON t.id = lp.typology_id` : '';
  const typologyName = typologyTable ? "COALESCE(t.activity_name, '')" : "''";
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT p.id, p.listprice_id, p.package_name, p.package_feature, p.service_ids,
            lp.subscription_name, lp.cost, lp.discount, CAST(lp.expiry_date AS CHAR) AS expiry_date, ${typologyName} AS typology_name
     FROM \`${packageTable}\` p
     INNER JOIN \`${listpriceTable}\` lp ON lp.id = p.listprice_id
     ${typologyJoin}
     WHERE p.user_id IN (${placeholders(context.userIds)}) ${club.sql}
       AND UPPER(p.put_table) IN ('Y', '1')
     ORDER BY p.id ASC`,
    ...context.userIds,
    ...club.params
  );

  const packages: PackageTableRow[] = rows.map((row) => ({
    id: text(row.id),
    listpriceId: text(row.listprice_id),
    packageName: text(row.package_name),
    typologyName: text(row.typology_name),
    subscriptionName: text(row.subscription_name),
    packageFeature: sanitizePackageFeature(row.package_feature),
    totalCost: discountedCost(row.cost, row.discount, row.expiry_date),
    serviceIds: parseServiceIds(row.service_ids)
  }));
  return { services, packages };
}

/* ---------------- Shareable link (Get link) ---------------- */

function getShareSecret(): string {
  return process.env.JWT_SECRET || 'movesbook-nextjs-jwt-secret-key-2024';
}

function signShareData(data: string): string {
  return crypto.createHmac('sha256', getShareSecret()).update(data).digest('hex');
}

export function createShareToken(context: PackageContext): { data: string; token: string } {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    user_id: context.userId,
    club_id: context.club?.id ?? null,
    timestamp: now,
    expires: now + SHARE_LINK_TTL_SECONDS
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return { data, token: signShareData(data) };
}

export function readShareToken(data: string, token: string): { userId: string; clubId: string | null } | null {
  if (!data || !token) return null;
  const expected = signShareData(data);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!payload?.user_id || !payload.expires || payload.expires < Math.floor(Date.now() / 1000)) return null;
    return { userId: String(payload.user_id), clubId: payload.club_id ? String(payload.club_id) : null };
  } catch {
    return null;
  }
}
