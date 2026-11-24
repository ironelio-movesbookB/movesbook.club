import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type AuthorizedContext = {
  userId: string;
  legacyUserId: string | null;
  club: { id: string; name: string } | null;
  userIds: string[];
};

type CategoryPayload = {
  name: string;
  parentId: string;
};

type CategoryRow = {
  id: string | number | bigint;
  user_id?: string | number | bigint | null;
  name?: string | null;
  created?: string | Date | null;
  modified?: string | Date | null;
};

type SubCategoryRow = {
  id: string | number | bigint;
  user_id?: string | number | bigint | null;
  cat_id?: string | number | bigint | null;
  name?: string | null;
  created?: string | Date | null;
  modified?: string | Date | null;
};

const CATEGORY_TABLE_CANDIDATES = ['product_categories', 'product_category'];
const SUB_CATEGORY_TABLE_CANDIDATES = ['product_sub_categories', 'product_sub_category'];
const CATEGORY_TABLE = 'product_categories';
const SUB_CATEGORY_TABLE = 'product_sub_categories';

const CATEGORY_COLUMN_DEFINITIONS: Record<string, string> = {
  user_id: 'VARCHAR(191) NULL',
  name: 'VARCHAR(250) NOT NULL',
  created: 'DATETIME DEFAULT CURRENT_TIMESTAMP',
  modified: 'DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
};

const SUB_CATEGORY_COLUMN_DEFINITIONS: Record<string, string> = {
  user_id: 'VARCHAR(191) NULL',
  cat_id: 'BIGINT NOT NULL',
  name: 'VARCHAR(250) NOT NULL',
  created: 'DATETIME DEFAULT CURRENT_TIMESTAMP',
  modified: 'DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
};

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeParentId(value: unknown): string {
  const raw = text(value);
  if (!raw || raw === '0') return '0';
  return raw;
}

function isTopLevel(parentId: string): boolean {
  return parentId === '0';
}

function isSubCategoryFlag(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'sub';
}

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(value as string | Date);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

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
    `SELECT TABLE_NAME
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN (${placeholders})`,
    ...candidates
  );

  const existing = new Set(rows.map((row) => row.TABLE_NAME));
  return candidates.find((candidate) => existing.has(candidate)) ?? null;
}

async function getTableColumns(tableName: string): Promise<Set<string>> {
  const rows = await prisma.$queryRawUnsafe<{ COLUMN_NAME: string }[]>(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?`,
    tableName
  );

  return new Set(rows.map((row) => row.COLUMN_NAME));
}

async function ensureTable(
  candidates: string[],
  fallback: string,
  definitions: Record<string, string>,
  indexSql: string
): Promise<string> {
  const existing = await findExistingTable(candidates);
  const tableName = existing ?? fallback;

  if (!existing) {
    const columnSql = Object.entries(definitions)
      .map(([column, definition]) => `\`${column}\` ${definition}`)
      .join(',\n      ');

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`${tableName}\` (
        id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        ${columnSql},
        ${indexSql}
      )
    `);
  }

  const columns = await getTableColumns(tableName);
  for (const [column, definition] of Object.entries(definitions)) {
    if (!columns.has(column)) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE \`${tableName}\` ADD COLUMN \`${column}\` ${definition}`
      );
    }
  }

  return tableName;
}

async function ensureCategoryTables() {
  const categoryTable = await ensureTable(
    CATEGORY_TABLE_CANDIDATES,
    CATEGORY_TABLE,
    CATEGORY_COLUMN_DEFINITIONS,
    'INDEX idx_product_categories_user (user_id), INDEX idx_product_categories_name (name)'
  );

  const subCategoryTable = await ensureTable(
    SUB_CATEGORY_TABLE_CANDIDATES,
    SUB_CATEGORY_TABLE,
    SUB_CATEGORY_COLUMN_DEFINITIONS,
    'INDEX idx_product_sub_categories_user_cat (user_id, cat_id), INDEX idx_product_sub_categories_name (name)'
  );

  return {
    categoryTable,
    subCategoryTable,
    categoryColumns: await getTableColumns(categoryTable),
    subCategoryColumns: await getTableColumns(subCategoryTable)
  };
}

async function getLegacyUserId(userId: string): Promise<string | null> {
  const fromId = userId.match(/^legacy_(\d+)(?:_|$)/);
  if (fromId?.[1]) return fromId[1];

  const mappingTable = await findExistingTable(['legacy_id_mappings']);
  if (!mappingTable) return null;

  const rows = await prisma.$queryRawUnsafe<{ legacy_id: number | string }[]>(
    `SELECT legacy_id
     FROM \`${mappingTable}\`
     WHERE new_id = ?
       AND legacy_table = 'users'
     ORDER BY legacy_id DESC
     LIMIT 1`,
    userId
  );

  return rows[0]?.legacy_id != null ? String(rows[0].legacy_id) : null;
}

async function getOwnedClub(userId: string, requestedClubId: string | null) {
  if (requestedClubId) {
    const selected = await prisma.$queryRaw<{ id: string; name: string }[]>`
      SELECT id, name
      FROM clubs_new
      WHERE id = ${requestedClubId}
        AND adminId = ${userId}
      LIMIT 1
    `;
    if (selected[0]) return selected[0];
  }

  const fallback = await prisma.$queryRaw<{ id: string; name: string }[]>`
    SELECT id, name
    FROM clubs_new
    WHERE adminId = ${userId}
    ORDER BY createdAt DESC
    LIMIT 1
  `;

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
  const requestedClubId = request.nextUrl.searchParams.get('clubId');
  const club = await getOwnedClub(userId, requestedClubId);
  const legacyUserId = await getLegacyUserId(userId);
  const userIds = Array.from(new Set([userId, legacyUserId].filter(Boolean) as string[]));

  return { userId, legacyUserId, club, userIds };
}

function userFilterClause(columns: Set<string>, context: AuthorizedContext, alias = ''): {
  clause: string;
  params: string[];
} {
  if (!columns.has('user_id')) {
    return { clause: '1=1', params: [] };
  }

  const prefix = alias ? `${alias}.` : '';
  const placeholders = context.userIds.map(() => '?').join(',');
  return {
    clause: `${prefix}user_id IN (${placeholders})`,
    params: [...context.userIds]
  };
}

function parsePayload(body: unknown): CategoryPayload {
  const data = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  return {
    name: text(data.name),
    parentId: normalizeParentId(data.parentId)
  };
}

function validatePayload(payload: CategoryPayload): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  if (!payload.name) {
    fieldErrors.name = 'Please enter category name.';
  } else if (payload.name.length > 250) {
    fieldErrors.name = 'Category name must be 250 characters or fewer.';
  }

  return fieldErrors;
}

function normalizeCategory(row: CategoryRow) {
  return {
    id: String(row.id),
    name: text(row.name),
    parentId: '0',
    created: toIsoDate(row.created),
    modified: toIsoDate(row.modified)
  };
}

function normalizeSubCategory(row: SubCategoryRow) {
  return {
    id: String(row.id),
    name: text(row.name),
    parentId: String(row.cat_id ?? ''),
    created: toIsoDate(row.created),
    modified: toIsoDate(row.modified)
  };
}

function groupCategories(
  categories: ReturnType<typeof normalizeCategory>[],
  subCategories: ReturnType<typeof normalizeSubCategory>[]
) {
  const childrenByParent = new Map<string, ReturnType<typeof normalizeSubCategory>[]>();

  for (const child of subCategories) {
    if (!child.name || !child.parentId) continue;
    const bucket = childrenByParent.get(child.parentId) ?? [];
    bucket.push(child);
    childrenByParent.set(child.parentId, bucket);
  }

  return categories
    .filter((category) => category.name)
    .map((category) => ({
      ...category,
      children: (childrenByParent.get(category.id) ?? []).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      )
    }));
}

async function ensureCategoryDuplicateFree(
  tables: Awaited<ReturnType<typeof ensureCategoryTables>>,
  context: AuthorizedContext,
  payload: CategoryPayload,
  exceptId?: string
): Promise<boolean> {
  if (isTopLevel(payload.parentId)) {
    const userFilter = userFilterClause(tables.categoryColumns, context);
    const rows = await prisma.$queryRawUnsafe<{ count: number | bigint }[]>(
      `SELECT COUNT(*) AS count
       FROM \`${tables.categoryTable}\`
       WHERE ${userFilter.clause}
         AND LOWER(TRIM(name)) = LOWER(TRIM(?))
         ${exceptId ? 'AND id <> ?' : ''}`,
      ...userFilter.params,
      payload.name,
      ...(exceptId ? [exceptId] : [])
    );
    return Number(rows[0]?.count ?? 0) === 0;
  }

  const userFilter = userFilterClause(tables.subCategoryColumns, context);
  const rows = await prisma.$queryRawUnsafe<{ count: number | bigint }[]>(
    `SELECT COUNT(*) AS count
     FROM \`${tables.subCategoryTable}\`
     WHERE ${userFilter.clause}
       AND cat_id = ?
       AND LOWER(TRIM(name)) = LOWER(TRIM(?))
       ${exceptId ? 'AND id <> ?' : ''}`,
    ...userFilter.params,
    payload.parentId,
    payload.name,
    ...(exceptId ? [exceptId] : [])
  );

  return Number(rows[0]?.count ?? 0) === 0;
}

async function assertOwnedCategory(
  tables: Awaited<ReturnType<typeof ensureCategoryTables>>,
  context: AuthorizedContext,
  id: string
) {
  const userFilter = userFilterClause(tables.categoryColumns, context);
  const rows = await prisma.$queryRawUnsafe<CategoryRow[]>(
    `SELECT id, user_id, name, created, modified
     FROM \`${tables.categoryTable}\`
     WHERE id = ?
       AND ${userFilter.clause}
     LIMIT 1`,
    id,
    ...userFilter.params
  );

  return rows[0] ? normalizeCategory(rows[0]) : null;
}

async function assertOwnedSubCategory(
  tables: Awaited<ReturnType<typeof ensureCategoryTables>>,
  context: AuthorizedContext,
  id: string
) {
  const userFilter = userFilterClause(tables.subCategoryColumns, context);
  const rows = await prisma.$queryRawUnsafe<SubCategoryRow[]>(
    `SELECT id, user_id, cat_id, name, created, modified
     FROM \`${tables.subCategoryTable}\`
     WHERE id = ?
       AND ${userFilter.clause}
     LIMIT 1`,
    id,
    ...userFilter.params
  );

  return rows[0] ? normalizeSubCategory(rows[0]) : null;
}

async function assertParentCategoryExists(
  tables: Awaited<ReturnType<typeof ensureCategoryTables>>,
  context: AuthorizedContext,
  parentId: string
): Promise<boolean> {
  if (isTopLevel(parentId)) return true;
  return Boolean(await assertOwnedCategory(tables, context, parentId));
}

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthorizedContext(request);
    if ('error' in context) return context.error;

    const tables = await ensureCategoryTables();
    const categoryFilter = userFilterClause(tables.categoryColumns, context);
    const subFilter = userFilterClause(tables.subCategoryColumns, context);

    const categoryRows = await prisma.$queryRawUnsafe<CategoryRow[]>(
      `SELECT id, user_id, name, created, modified
       FROM \`${tables.categoryTable}\`
       WHERE ${categoryFilter.clause}
       ORDER BY id DESC`,
      ...categoryFilter.params
    );

    const subRows = await prisma.$queryRawUnsafe<SubCategoryRow[]>(
      `SELECT id, user_id, cat_id, name, created, modified
       FROM \`${tables.subCategoryTable}\`
       WHERE ${subFilter.clause}
       ORDER BY cat_id ASC, id DESC`,
      ...subFilter.params
    );

    const items = groupCategories(
      categoryRows.map(normalizeCategory),
      subRows.map(normalizeSubCategory)
    );

    return NextResponse.json({
      club: context.club,
      items
    });
  } catch (error) {
    console.error('GET /api/club/settings/tables/categories:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthorizedContext(request);
    if ('error' in context) return context.error;

    const tables = await ensureCategoryTables();
    const payload = parsePayload(await request.json());
    const fieldErrors = validatePayload(payload);
    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json({ error: 'Validation failed', fieldErrors }, { status: 400 });
    }

    if (!(await assertParentCategoryExists(tables, context, payload.parentId))) {
      return NextResponse.json({
        error: 'Parent category not found',
        fieldErrors: { parentId: 'Please select a valid parent category.' }
      }, { status: 400 });
    }

    if (!(await ensureCategoryDuplicateFree(tables, context, payload))) {
      return NextResponse.json({
        error: 'Duplicate value',
        fieldErrors: { name: 'This category already exists.' }
      }, { status: 409 });
    }

    const storageUserId = context.legacyUserId ?? context.userId;

    if (isTopLevel(payload.parentId)) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO \`${tables.categoryTable}\` (user_id, name)
         VALUES (?, ?)`,
        storageUserId,
        payload.name
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO \`${tables.subCategoryTable}\` (user_id, cat_id, name)
         VALUES (?, ?, ?)`,
        storageUserId,
        payload.parentId,
        payload.name
      );
    }

    const idRows = await prisma.$queryRawUnsafe<{ id: bigint | number | string }[]>(
      'SELECT LAST_INSERT_ID() AS id'
    );

    return NextResponse.json({
      success: true,
      item: {
        id: String(idRows[0]?.id ?? ''),
        ...payload
      }
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/club/settings/tables/categories:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const context = await getAuthorizedContext(request);
    if ('error' in context) return context.error;

    const tables = await ensureCategoryTables();
    const body = await request.json() as Record<string, unknown>;
    const id = text(body.id);
    const isSub = isSubCategoryFlag(body.isSubCategory);

    if (!id) {
      return NextResponse.json({ error: 'Category id is required' }, { status: 400 });
    }

    const existing = isSub
      ? await assertOwnedSubCategory(tables, context, id)
      : await assertOwnedCategory(tables, context, id);

    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const payload = parsePayload({
      ...body,
      parentId: isSub ? existing.parentId : '0'
    });

    const fieldErrors = validatePayload(payload);
    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json({ error: 'Validation failed', fieldErrors }, { status: 400 });
    }

    if (!(await ensureCategoryDuplicateFree(tables, context, payload, id))) {
      return NextResponse.json({
        error: 'Duplicate value',
        fieldErrors: { name: 'This category already exists.' }
      }, { status: 409 });
    }

    if (isSub) {
      await prisma.$executeRawUnsafe(
        `UPDATE \`${tables.subCategoryTable}\`
         SET name = ?,
             modified = CURRENT_TIMESTAMP
         WHERE id = ?`,
        payload.name,
        id
      );
    } else {
      await prisma.$executeRawUnsafe(
        `UPDATE \`${tables.categoryTable}\`
         SET name = ?,
             modified = CURRENT_TIMESTAMP
         WHERE id = ?`,
        payload.name,
        id
      );
    }

    return NextResponse.json({
      success: true,
      item: { id, ...payload, isSubCategory: isSub }
    });
  } catch (error) {
    console.error('PUT /api/club/settings/tables/categories:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await getAuthorizedContext(request);
    if ('error' in context) return context.error;

    const tables = await ensureCategoryTables();
    const id = text(request.nextUrl.searchParams.get('id'));
    const isSub = isSubCategoryFlag(request.nextUrl.searchParams.get('isSubCategory'));

    if (!id) {
      return NextResponse.json({ error: 'Category id is required' }, { status: 400 });
    }

    if (isSub) {
      if (!(await assertOwnedSubCategory(tables, context, id))) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 });
      }

      await prisma.$executeRawUnsafe(
        `DELETE FROM \`${tables.subCategoryTable}\` WHERE id = ?`,
        id
      );
    } else {
      if (!(await assertOwnedCategory(tables, context, id))) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 });
      }

      await prisma.$executeRawUnsafe(
        `DELETE FROM \`${tables.categoryTable}\` WHERE id = ?`,
        id
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/club/settings/tables/categories:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
