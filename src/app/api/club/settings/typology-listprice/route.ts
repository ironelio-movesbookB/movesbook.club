import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import {
  buildListpriceDbValues,
  createEmptyListpriceForm,
  mapDbRowToListpriceForm,
  mapDbRowToListpriceListRow,
  text,
  type TypologyListpriceForm
} from '@/lib/clubTypologyListprice';
import { validateListpriceForm } from '@/lib/clubTypologyListprice.validation';

export const dynamic = 'force-dynamic';

const LISTPRICE_TABLE_CANDIDATES = [
  'club_setting_typology_listprices',
  'club_setting_typology_listprice'
];
const TYPOLOGY_TABLE_CANDIDATES = [
  'club_setting_subscription_typologies',
  'club_setting_subscription_typology'
];
const DEFAULT_TABLE_CANDIDATES = [
  'club_setting_subscription_typology_defaults',
  'club_setting_subscription_typology_default'
];
const PACKAGE_TABLE_CANDIDATES = ['club_setting_subscription_packages'];

function isClubAccountUserType(userType: string): boolean {
  return userType === 'CLUB' || userType === 'CLUB_TRAINER';
}

function getTokenPayload(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  return verifyToken(token);
}

async function findExistingTable(candidates: string[]): Promise<string | null> {
  const placeholders = candidates.map(() => '?').join(',');
  const rows = await prisma.$queryRawUnsafe<{ TABLE_NAME: string }[]>(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${placeholders})`,
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

async function ensureLocalListpriceTable(): Promise<string> {
  const tableName = 'club_setting_typology_listprices';
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(191) NOT NULL,
      club_id VARCHAR(191) NULL,
      typology_id BIGINT NOT NULL,
      subscription_name VARCHAR(255) NOT NULL,
      active_status CHAR(1) DEFAULT 'Y',
      search_keyword VARCHAR(10) NULL,
      cost VARCHAR(80) NULL,
      discount VARCHAR(80) NULL,
      expiry_date DATE NULL,
      installnment VARCHAR(80) NULL,
      first_cost_installnment VARCHAR(80) NULL,
      days_recursion VARCHAR(80) NULL,
      fix_expiry_day_status CHAR(1) DEFAULT 'N',
      fix_expiry_day VARCHAR(80) NULL,
      coundition_renewal_status CHAR(1) DEFAULT 'N',
      suspension_available_status CHAR(1) DEFAULT 'N',
      renewal_next_discount VARCHAR(80) NULL,
      suspension_max_days VARCHAR(80) NULL,
      sale_duration_months VARCHAR(80) NULL,
      sale_number_access VARCHAR(80) NULL,
      sale_related_days VARCHAR(80) NULL,
      sale_max_number VARCHAR(80) NULL,
      sale_cost_access VARCHAR(80) NULL,
      sale_number_access_status CHAR(1) DEFAULT 'N',
      sale_max_number_status CHAR(1) DEFAULT 'N',
      recursive_expires CHAR(1) DEFAULT 'N',
      subscripion_points_status CHAR(1) DEFAULT 'N',
      subscripion_points VARCHAR(80) NULL,
      created DATETIME DEFAULT CURRENT_TIMESTAMP,
      modified DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_listprice_user_club (user_id, club_id),
      INDEX idx_listprice_typology (typology_id)
    )
  `);
  return tableName;
}

async function getListpriceTable(): Promise<string> {
  return (await findExistingTable(LISTPRICE_TABLE_CANDIDATES)) ?? ensureLocalListpriceTable();
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

async function getAuthorizedContext(request: NextRequest) {
  const decoded = getTokenPayload(request);
  if (!decoded?.userId || !decoded.userType) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (!isClubAccountUserType(String(decoded.userType))) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  const userId = String(decoded.userId);
  const club = await getOwnedClub(userId, request.nextUrl.searchParams.get('clubId'));
  const legacyUserId = await getLegacyUserId(userId);
  const userIds = Array.from(new Set([userId, legacyUserId].filter(Boolean) as string[]));
  return { userId, club, userIds };
}

async function fetchTypologyOptions(userIds: string[], clubId: string | null) {
  const typologyTable = await findExistingTable(TYPOLOGY_TABLE_CANDIDATES);
  if (!typologyTable) return [];
  const userPlaceholders = userIds.map(() => '?').join(',');
  const columns = await getTableColumns(typologyTable);
  const clubFilter = clubId && columns.has('club_id') ? ' AND club_id = ?' : '';
  const rows = await prisma.$queryRawUnsafe<{ id: string | number; activity_name: string | null }[]>(
    `SELECT id, activity_name FROM \`${typologyTable}\`
     WHERE user_id IN (${userPlaceholders}) ${clubFilter} ORDER BY activity_name ASC`,
    ...userIds,
    ...(clubFilter ? [clubId] : [])
  );
  return rows.map((row) => ({
    id: String(row.id),
    name: text(row.activity_name) || `Typology ${row.id}`
  }));
}

async function fetchDefaultTypologyId(userIds: string[], clubId: string | null): Promise<string | null> {
  const defaultTable = await findExistingTable(DEFAULT_TABLE_CANDIDATES);
  if (!defaultTable) return null;
  const userPlaceholders = userIds.map(() => '?').join(',');
  const clubFilter = clubId ? ' AND club_id = ?' : '';
  const rows = await prisma.$queryRawUnsafe<{ club_setting_subscription_typology_id: string | number }[]>(
    `SELECT club_setting_subscription_typology_id FROM \`${defaultTable}\`
     WHERE user_id IN (${userPlaceholders}) ${clubFilter} LIMIT 1`,
    ...userIds,
    ...(clubFilter ? [clubId] : [])
  );
  return rows[0]?.club_setting_subscription_typology_id != null
    ? String(rows[0].club_setting_subscription_typology_id)
    : null;
}

async function fetchPackageNames(listpriceIds: string[], userIds: string[], clubId: string | null) {
  const result = new Map<string, string>();
  const packageTable = await findExistingTable(PACKAGE_TABLE_CANDIDATES);
  if (!packageTable || listpriceIds.length === 0) return result;
  const columns = await getTableColumns(packageTable);
  if (!columns.has('listprice_id') || !columns.has('package_name')) return result;
  const userPlaceholders = userIds.map(() => '?').join(',');
  const idPlaceholders = listpriceIds.map(() => '?').join(',');
  const clubFilter = clubId && columns.has('club_id') ? ' AND club_id = ?' : '';
  const rows = await prisma.$queryRawUnsafe<{ listprice_id: string | number; package_name: string | null }[]>(
    `SELECT listprice_id, package_name FROM \`${packageTable}\`
     WHERE listprice_id IN (${idPlaceholders}) AND user_id IN (${userPlaceholders}) ${clubFilter}`,
    ...listpriceIds,
    ...userIds,
    ...(clubFilter ? [clubId] : [])
  );
  for (const row of rows) result.set(String(row.listprice_id), text(row.package_name));
  return result;
}

async function fetchListpriceRows(userIds: string[], clubId: string | null, typologyId: string | null) {
  const listpriceTable = await getListpriceTable();
  const typologyTable = await findExistingTable(TYPOLOGY_TABLE_CANDIDATES);
  const userPlaceholders = userIds.map(() => '?').join(',');
  const listpriceColumns = await getTableColumns(listpriceTable);
  const clubFilter = clubId && listpriceColumns.has('club_id') ? ' AND lp.club_id = ?' : '';
  const typologyFilter = typologyId ? ' AND lp.typology_id = ?' : '';
  const typologyJoin = typologyTable ? `LEFT JOIN \`${typologyTable}\` t ON t.id = lp.typology_id` : '';
  const typologyNameSelect = typologyTable ? 'COALESCE(t.activity_name, \'\') AS typology_name' : '\'\' AS typology_name';
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT lp.*, ${typologyNameSelect} FROM \`${listpriceTable}\` lp ${typologyJoin}
     WHERE lp.user_id IN (${userPlaceholders}) ${clubFilter} ${typologyFilter}
     ORDER BY lp.id DESC`,
    ...userIds,
    ...(clubFilter ? [clubId] : []),
    ...(typologyFilter ? [typologyId] : [])
  );
  const packageNames = await fetchPackageNames(
    rows.map((row) => text(row.id)).filter(Boolean),
    userIds,
    clubId
  );
  return rows.map((row) =>
    mapDbRowToListpriceListRow(row, text(row.typology_name), packageNames.get(text(row.id)) ?? '')
  );
}

async function fetchListpriceById(id: string, userIds: string[], clubId: string | null) {
  const listpriceTable = await getListpriceTable();
  const userPlaceholders = userIds.map(() => '?').join(',');
  const columns = await getTableColumns(listpriceTable);
  const clubFilter = clubId && columns.has('club_id') ? ' AND club_id = ?' : '';
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM \`${listpriceTable}\` WHERE id = ? AND user_id IN (${userPlaceholders}) ${clubFilter} LIMIT 1`,
    id,
    ...userIds,
    ...(clubFilter ? [clubId] : [])
  );
  return rows[0] ?? null;
}

async function hasDuplicateName(name: string, userIds: string[], excludeId?: string) {
  const table = await getListpriceTable();
  const userPlaceholders = userIds.map(() => '?').join(',');
  const excludeFilter = excludeId ? ' AND id <> ?' : '';
  const rows = await prisma.$queryRawUnsafe<{ id: string | number }[]>(
    `SELECT id FROM \`${table}\` WHERE user_id IN (${userPlaceholders}) ${excludeFilter}
     AND LOWER(subscription_name) = LOWER(?) LIMIT 1`,
    ...userIds,
    ...(excludeId ? [excludeId] : []),
    name
  );
  return rows.length > 0;
}

async function resolveCopyName(baseName: string, userIds: string[]) {
  const root = (baseName.trim() || 'Subscription').replace(/\s+copy(?:\s+\d+)?$/i, '').trim();
  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? `${root} copy` : `${root} copy ${i + 1}`;
    if (!(await hasDuplicateName(candidate, userIds))) return candidate;
  }
  return `${root} copy ${Date.now()}`;
}

function parseFormBody(body: Record<string, unknown>): TypologyListpriceForm {
  return {
    ...createEmptyListpriceForm(),
    ...(body as Partial<TypologyListpriceForm>),
    typologyId: text(body.typologyId),
    subscriptionName: text(body.subscriptionName),
    searchKeyword: text(body.searchKeyword),
    cost: text(body.cost),
    discount: text(body.discount),
    expiryDate: text(body.expiryDate),
    installnment: text(body.installnment),
    firstCostInstallnment: text(body.firstCostInstallnment),
    daysRecursion: text(body.daysRecursion),
    fixExpiryDay: text(body.fixExpiryDay),
    renewalNextDiscount: text(body.renewalNextDiscount),
    suspensionMaxDays: text(body.suspensionMaxDays),
    saleDurationMonths: text(body.saleDurationMonths),
    saleNumberAccess: text(body.saleNumberAccess),
    saleRelatedDays: text(body.saleRelatedDays),
    saleMaxNumber: text(body.saleMaxNumber),
    saleCostAccess: text(body.saleCostAccess),
    subscriptionPoints: text(body.subscriptionPoints),
    activeStatus: body.activeStatus === true || body.activeStatus === 'Y',
    fixExpiryDayStatus: body.fixExpiryDayStatus === true || body.fixExpiryDayStatus === 'Y',
    conditionRenewalStatus: body.conditionRenewalStatus === true || body.conditionRenewalStatus === 'Y',
    suspensionAvailableStatus: body.suspensionAvailableStatus === true || body.suspensionAvailableStatus === 'Y',
    saleNumberAccessStatus: body.saleNumberAccessStatus === true || body.saleNumberAccessStatus === 'Y',
    saleMaxNumberStatus: body.saleMaxNumberStatus === true || body.saleMaxNumberStatus === 'Y',
    recursiveExpires: body.recursiveExpires === true || body.recursiveExpires === 'Y',
    subscriptionPointsStatus: body.subscriptionPointsStatus === true || body.subscriptionPointsStatus === 'Y'
  };
}

function validateForm(form: TypologyListpriceForm): Record<string, string> {
  return validateListpriceForm(form);
}

async function insertListprice(form: TypologyListpriceForm, userIds: string[], clubId: string | null) {
  const tableName = await getListpriceTable();
  const columns = await getTableColumns(tableName);
  const values: Record<string, unknown> = {
    user_id: userIds[userIds.length - 1] ?? '',
    club_id: clubId,
    ...buildListpriceDbValues(form)
  };
  const insertColumns = Object.keys(values).filter((c) => columns.has(c));
  await prisma.$executeRawUnsafe(
    `INSERT INTO \`${tableName}\` (${insertColumns.map((c) => `\`${c}\``).join(', ')})
     VALUES (${insertColumns.map(() => '?').join(', ')})`,
    ...insertColumns.map((c) => values[c])
  );
  const idRows = await prisma.$queryRawUnsafe<{ id: bigint | number | string }[]>(
    'SELECT LAST_INSERT_ID() AS id'
  );
  return idRows[0]?.id != null ? String(idRows[0].id) : null;
}

async function updateListprice(id: string, form: TypologyListpriceForm, userIds: string[], clubId: string | null) {
  const tableName = await getListpriceTable();
  const columns = await getTableColumns(tableName);
  const values = buildListpriceDbValues(form);
  const updateColumns = Object.keys(values).filter((c) => columns.has(c));
  const userPlaceholders = userIds.map(() => '?').join(',');
  const clubFilter = clubId && columns.has('club_id') ? ' AND club_id = ?' : '';
  await prisma.$executeRawUnsafe(
    `UPDATE \`${tableName}\` SET ${updateColumns.map((c) => `\`${c}\` = ?`).join(', ')}
     WHERE id = ? AND user_id IN (${userPlaceholders}) ${clubFilter}`,
    ...updateColumns.map((c) => values[c]),
    id,
    ...userIds,
    ...(clubFilter ? [clubId] : [])
  );
}

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthorizedContext(request);
    if ('error' in context) return context.error;

    const typologyId = request.nextUrl.searchParams.get('typologyId');
    const listpriceId = request.nextUrl.searchParams.get('id');
    const typologies = await fetchTypologyOptions(context.userIds, context.club?.id ?? null);
    const defaultTypologyId = await fetchDefaultTypologyId(context.userIds, context.club?.id ?? null);

    if (listpriceId) {
      const row = await fetchListpriceById(listpriceId, context.userIds, context.club?.id ?? null);
      if (!row) return NextResponse.json({ error: 'List price not found' }, { status: 404 });
      return NextResponse.json({
        typologies,
        defaultTypologyId,
        listprice: mapDbRowToListpriceForm(row)
      });
    }

    const selectedId = typologyId ?? defaultTypologyId ?? '';
    const items = selectedId
      ? await fetchListpriceRows(context.userIds, context.club?.id ?? null, selectedId)
      : [];

    return NextResponse.json({
      typologies,
      defaultTypologyId,
      selectedTypologyId: selectedId || null,
      items
    });
  } catch (error) {
    console.error('GET typology-listprice:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthorizedContext(request);
    if ('error' in context) return context.error;
    const body = await request.json();

    if (body.action === 'copy-listprice') {
      const sourceId = String(body.sourceId ?? body.id ?? '');
      if (!sourceId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
      const sourceRow = await fetchListpriceById(sourceId, context.userIds, context.club?.id ?? null);
      if (!sourceRow) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const form = mapDbRowToListpriceForm(sourceRow);
      form.subscriptionName = await resolveCopyName(form.subscriptionName, context.userIds);
      const newId = await insertListprice(form, context.userIds, context.club?.id ?? null);
      if (!newId) return NextResponse.json({ error: 'Copy failed' }, { status: 500 });
      return NextResponse.json({ success: true, id: newId, subscriptionName: form.subscriptionName });
    }

    const form = parseFormBody(body);
    const fieldErrors = validateForm(form);
    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json({ error: 'Validation failed', fieldErrors }, { status: 400 });
    }
    if (await hasDuplicateName(form.subscriptionName, context.userIds)) {
      return NextResponse.json({
        error: 'Validation failed',
        fieldErrors: { subscriptionName: 'This subscription name already exists.' }
      }, { status: 400 });
    }
    const id = await insertListprice(form, context.userIds, context.club?.id ?? null);
    if (!id) return NextResponse.json({ error: 'Create failed' }, { status: 500 });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('POST typology-listprice:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const context = await getAuthorizedContext(request);
    if ('error' in context) return context.error;
    const body = await request.json();
    const id = String(body.id ?? '');
    if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    if (!(await fetchListpriceById(id, context.userIds, context.club?.id ?? null))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const form = parseFormBody(body);
    const fieldErrors = validateForm(form);
    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json({ error: 'Validation failed', fieldErrors }, { status: 400 });
    }
    if (await hasDuplicateName(form.subscriptionName, context.userIds, id)) {
      return NextResponse.json({
        error: 'Validation failed',
        fieldErrors: { subscriptionName: 'This subscription name already exists.' }
      }, { status: 400 });
    }
    await updateListprice(id, form, context.userIds, context.club?.id ?? null);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('PUT typology-listprice:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await getAuthorizedContext(request);
    if ('error' in context) return context.error;
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    const tableName = await getListpriceTable();
    const userPlaceholders = context.userIds.map(() => '?').join(',');
    const columns = await getTableColumns(tableName);
    const clubFilter = context.club?.id && columns.has('club_id') ? ' AND club_id = ?' : '';
    await prisma.$executeRawUnsafe(
      `DELETE FROM \`${tableName}\` WHERE id = ? AND user_id IN (${userPlaceholders}) ${clubFilter}`,
      id,
      ...context.userIds,
      ...(clubFilter ? [context.club?.id] : [])
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE typology-listprice:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
