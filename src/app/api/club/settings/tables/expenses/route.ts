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

type ExpensePayload = {
  name: string;
  parentId: string;
};

type ExpenseRow = {
  id: string | number | bigint;
  user_id?: string | number | bigint | null;
  name?: string | null;
  parent_id?: string | number | bigint | null;
  created?: string | Date | null;
  modified?: string | Date | null;
};

const EXPENSE_TABLE_CANDIDATES = ['expenses'];
const EXPENSE_TABLE = 'expenses';

const EXPENSE_COLUMN_DEFINITIONS: Record<string, string> = {
  user_id: 'VARCHAR(191) NOT NULL',
  name: 'VARCHAR(250) NOT NULL',
  parent_id: 'BIGINT NOT NULL DEFAULT 0',
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

async function ensureExpensesTable(): Promise<string> {
  const existing = await findExistingTable(EXPENSE_TABLE_CANDIDATES);
  const tableName = existing ?? EXPENSE_TABLE;

  if (!existing) {
    const columnSql = Object.entries(EXPENSE_COLUMN_DEFINITIONS)
      .map(([column, definition]) => `\`${column}\` ${definition}`)
      .join(',\n      ');

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`${tableName}\` (
        id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        ${columnSql},
        INDEX idx_expenses_user_parent (user_id, parent_id),
        INDEX idx_expenses_name (name)
      )
    `);
  }

  const columns = await getTableColumns(tableName);
  for (const [column, definition] of Object.entries(EXPENSE_COLUMN_DEFINITIONS)) {
    if (!columns.has(column)) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE \`${tableName}\` ADD COLUMN \`${column}\` ${definition}`
      );
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

function parsePayload(body: unknown): ExpensePayload {
  const data = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  return {
    name: text(data.name),
    parentId: normalizeParentId(data.parentId)
  };
}

function validatePayload(payload: ExpensePayload): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  if (!payload.name) {
    fieldErrors.name = 'Please enter expense name.';
  } else if (payload.name.length > 250) {
    fieldErrors.name = 'Expense name must be 250 characters or fewer.';
  }

  return fieldErrors;
}

function normalizeExpense(row: ExpenseRow) {
  const parentId = normalizeParentId(row.parent_id);
  return {
    id: String(row.id),
    name: text(row.name),
    parentId,
    created: toIsoDate(row.created),
    modified: toIsoDate(row.modified)
  };
}

function groupExpenses(
  rows: ReturnType<typeof normalizeExpense>[]
) {
  const parents = rows.filter((row) => isTopLevel(row.parentId) && row.name);
  const childrenByParent = new Map<string, ReturnType<typeof normalizeExpense>[]>();

  for (const row of rows) {
    if (isTopLevel(row.parentId) || !row.name) continue;
    const bucket = childrenByParent.get(row.parentId) ?? [];
    bucket.push(row);
    childrenByParent.set(row.parentId, bucket);
  }

  return parents.map((parent) => ({
    ...parent,
    children: (childrenByParent.get(parent.id) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    )
  }));
}

async function ensureNoDuplicate(
  tableName: string,
  context: AuthorizedContext,
  payload: ExpensePayload,
  exceptId?: string
): Promise<boolean> {
  const userPlaceholders = context.userIds.map(() => '?').join(',');
  const params: unknown[] = [...context.userIds, payload.name];

  let parentClause = 'AND (parent_id = 0 OR parent_id IS NULL)';
  if (!isTopLevel(payload.parentId)) {
    parentClause = 'AND parent_id = ?';
    params.push(payload.parentId);
  }

  const rows = await prisma.$queryRawUnsafe<{ count: number | bigint }[]>(
    `SELECT COUNT(*) AS count
     FROM \`${tableName}\`
     WHERE user_id IN (${userPlaceholders})
       AND LOWER(TRIM(name)) = LOWER(TRIM(?))
       ${parentClause}
       ${exceptId ? 'AND id <> ?' : ''}`,
    ...params,
    ...(exceptId ? [exceptId] : [])
  );

  return Number(rows[0]?.count ?? 0) === 0;
}

async function assertOwnedExpense(
  tableName: string,
  context: AuthorizedContext,
  id: string
): Promise<ReturnType<typeof normalizeExpense> | null> {
  const userPlaceholders = context.userIds.map(() => '?').join(',');
  const rows = await prisma.$queryRawUnsafe<ExpenseRow[]>(
    `SELECT id, user_id, name, parent_id, created, modified
     FROM \`${tableName}\`
     WHERE id = ?
       AND user_id IN (${userPlaceholders})
     LIMIT 1`,
    id,
    ...context.userIds
  );

  return rows[0] ? normalizeExpense(rows[0]) : null;
}

async function assertParentExists(
  tableName: string,
  context: AuthorizedContext,
  parentId: string
): Promise<boolean> {
  if (isTopLevel(parentId)) return true;

  const userPlaceholders = context.userIds.map(() => '?').join(',');
  const rows = await prisma.$queryRawUnsafe<{ id: string | number | bigint }[]>(
    `SELECT id
     FROM \`${tableName}\`
     WHERE id = ?
       AND user_id IN (${userPlaceholders})
       AND (parent_id = 0 OR parent_id IS NULL)
     LIMIT 1`,
    parentId,
    ...context.userIds
  );

  return Boolean(rows[0]);
}

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthorizedContext(request);
    if ('error' in context) return context.error;

    const tableName = await ensureExpensesTable();
    const userPlaceholders = context.userIds.map(() => '?').join(',');
    const rows = await prisma.$queryRawUnsafe<ExpenseRow[]>(
      `SELECT id, user_id, name, parent_id, created, modified
       FROM \`${tableName}\`
       WHERE user_id IN (${userPlaceholders})
       ORDER BY parent_id ASC, id DESC`,
      ...context.userIds
    );

    const normalized = rows.map(normalizeExpense);
    const groups = groupExpenses(normalized);

    return NextResponse.json({
      club: context.club,
      items: groups,
      flatItems: normalized
    });
  } catch (error) {
    console.error('GET /api/club/settings/tables/expenses:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthorizedContext(request);
    if ('error' in context) return context.error;

    const tableName = await ensureExpensesTable();
    const payload = parsePayload(await request.json());
    const fieldErrors = validatePayload(payload);
    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json({ error: 'Validation failed', fieldErrors }, { status: 400 });
    }

    if (!(await assertParentExists(tableName, context, payload.parentId))) {
      return NextResponse.json({
        error: 'Parent expense not found',
        fieldErrors: { parentId: 'Please select a valid parent expense.' }
      }, { status: 400 });
    }

    if (!(await ensureNoDuplicate(tableName, context, payload))) {
      return NextResponse.json({
        error: 'Duplicate value',
        fieldErrors: { name: 'This expense already exists.' }
      }, { status: 409 });
    }

    const storageUserId = context.legacyUserId ?? context.userId;
    const parentIdValue = isTopLevel(payload.parentId) ? 0 : payload.parentId;

    await prisma.$executeRawUnsafe(
      `INSERT INTO \`${tableName}\` (user_id, name, parent_id)
       VALUES (?, ?, ?)`,
      storageUserId,
      payload.name,
      parentIdValue
    );

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
    console.error('POST /api/club/settings/tables/expenses:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const context = await getAuthorizedContext(request);
    if ('error' in context) return context.error;

    const tableName = await ensureExpensesTable();
    const body = await request.json();
    const id = text((body as Record<string, unknown>)?.id);
    if (!id) {
      return NextResponse.json({ error: 'Expense id is required' }, { status: 400 });
    }

    const existing = await assertOwnedExpense(tableName, context, id);
    if (!existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const payload = parsePayload({
      ...(body as Record<string, unknown>),
      parentId: (body as Record<string, unknown>)?.parentId ?? existing.parentId
    });

    const fieldErrors = validatePayload(payload);
    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json({ error: 'Validation failed', fieldErrors }, { status: 400 });
    }

    if (!isTopLevel(existing.parentId) && isTopLevel(payload.parentId)) {
      return NextResponse.json({
        error: 'Validation failed',
        fieldErrors: { parentId: 'Sub-expense cannot be moved to top level.' }
      }, { status: 400 });
    }

    if (isTopLevel(existing.parentId) && !isTopLevel(payload.parentId)) {
      return NextResponse.json({
        error: 'Validation failed',
        fieldErrors: { parentId: 'Top-level expense cannot be converted to sub-expense.' }
      }, { status: 400 });
    }

    if (!(await ensureNoDuplicate(tableName, context, payload, id))) {
      return NextResponse.json({
        error: 'Duplicate value',
        fieldErrors: { name: 'This expense already exists.' }
      }, { status: 409 });
    }

    await prisma.$executeRawUnsafe(
      `UPDATE \`${tableName}\`
       SET name = ?,
           modified = CURRENT_TIMESTAMP
       WHERE id = ?`,
      payload.name,
      id
    );

    return NextResponse.json({
      success: true,
      item: { id, ...payload }
    });
  } catch (error) {
    console.error('PUT /api/club/settings/tables/expenses:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await getAuthorizedContext(request);
    if ('error' in context) return context.error;

    const tableName = await ensureExpensesTable();
    const id = text(request.nextUrl.searchParams.get('id'));
    if (!id) {
      return NextResponse.json({ error: 'Expense id is required' }, { status: 400 });
    }

    if (!(await assertOwnedExpense(tableName, context, id))) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    await prisma.$executeRawUnsafe(
      `DELETE FROM \`${tableName}\` WHERE id = ?`,
      id
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/club/settings/tables/expenses:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
