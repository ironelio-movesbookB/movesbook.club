import { mkdir, unlink, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getServerPublicDir } from '@/lib/serverPublicDir';

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
  icon: string | null;
  iconProvided: boolean;
  color: string | null;
  colorProvided: boolean;
  removeImage: boolean;
  image: File | null;
};

type ExpenseRow = {
  id: string | number | bigint;
  user_id?: string | number | bigint | null;
  name?: string | null;
  parent_id?: string | number | bigint | null;
  icon?: string | null;
  color?: string | null;
  image_url?: string | null;
  created?: string | Date | null;
  modified?: string | Date | null;
};

const EXPENSE_TABLE_CANDIDATES = ['expenses'];
const EXPENSE_TABLE = 'expenses';

const EXPENSE_COLUMN_DEFINITIONS: Record<string, string> = {
  user_id: 'VARCHAR(191) NOT NULL',
  name: 'VARCHAR(250) NOT NULL',
  parent_id: 'BIGINT NOT NULL DEFAULT 0',
  icon: 'VARCHAR(50) NULL',
  color: 'VARCHAR(7) NULL',
  image_url: 'VARCHAR(255) NULL',
  created: 'DATETIME DEFAULT CURRENT_TIMESTAMP',
  modified: 'DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
};

const EXPENSE_IMAGE_DIR = ['img', 'expenses'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const ALLOWED_ICONS = new Set([
  'sliders', 'eye', 'bell', 'alarm', 'heartHandshake', 'wand', 'sparkles', 'trophy', 'settings', 'printer',
  'cloud', 'send', 'tag', 'pin', 'file', 'copy', 'bookmark', 'grid', 'contact', 'scanFace', 'user', 'users',
  'userPlus', 'clock', 'globe', 'shoppingCart', 'info', 'help', 'chart', 'megaphone', 'link', 'paperclip',
  'hourglass', 'play', 'store', 'walletCards', 'hand', 'pointer', 'filter', 'lightbulb', 'landmark', 'card',
  'briefcase', 'graduation', 'dollar', 'receipt', 'ticket', 'medal', 'smartphone', 'monitor', 'laptop',
  'camera', 'moon', 'sun', 'book', 'clipboard', 'banknote', 'building', 'bus', 'document', 'health',
  'shopping', 'utensils', 'tools', 'wallet'
]);

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeParentId(value: unknown): string {
  const raw = text(value);
  if (!raw || raw === '0') return '0';
  return raw;
}

function normalizeExpenseImagePath(value: unknown): string | null {
  const image = text(value);
  if (!image) return null;
  if (/^https?:\/\//i.test(image)) return image;
  if (image.startsWith('/api/media/img/expenses/')) return image;
  if (image.startsWith('/img/expenses/')) return `/api/media${image}`;
  if (image.startsWith('img/expenses/')) return `/api/media/${image}`;
  return null;
}

function getExpenseImageDiskPath(value: unknown): string | null {
  const imagePath = normalizeExpenseImagePath(value);
  if (!imagePath || !imagePath.startsWith('/api/media/img/expenses/')) return null;
  return join(getServerPublicDir(), 'img', 'expenses', imagePath.slice('/api/media/img/expenses/'.length));
}

function normalizeImageExtension(fileName: string): '.png' | '.jpg' | '.gif' | '.webp' | null {
  const extension = extname(fileName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) return null;
  if (extension === '.png') return '.png';
  if (extension === '.gif') return '.gif';
  if (extension === '.webp') return '.webp';
  return '.jpg';
}

function hasValidImageSignature(buffer: Buffer, extension: '.png' | '.jpg' | '.gif' | '.webp'): boolean {
  if (extension === '.png') return buffer.length > 8 && buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG';
  if (extension === '.jpg') return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (extension === '.gif') return buffer.length > 6 && buffer.toString('ascii', 0, 3) === 'GIF';
  return buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
}

async function saveExpenseImage(file: File): Promise<{ path: string } | { error: string }> {
  const extension = normalizeImageExtension(file.name);
  if (!extension || file.size > MAX_IMAGE_BYTES) return { error: 'Only PNG, JPG, GIF, or WEBP images up to 5MB are allowed.' };
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!hasValidImageSignature(buffer, extension)) return { error: 'The selected file is not a valid image.' };

  const uploadDir = join(getServerPublicDir(), ...EXPENSE_IMAGE_DIR);
  await mkdir(uploadDir, { recursive: true });
  const fileName = `Expense_${Date.now()}_${Math.round(Math.random() * 1_000_000)}${extension}`;
  await writeFile(join(uploadDir, fileName), buffer, { flag: 'wx' });
  return { path: `/img/expenses/${fileName}` };
}

async function deleteExpenseImage(value: unknown) {
  const diskPath = getExpenseImageDiskPath(value);
  if (!diskPath) return;
  try {
    await unlink(diskPath);
  } catch {
    // Missing old images should not block the table update.
  }
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
  const formData = body instanceof FormData ? body : null;
  const iconValue = formData ? formData.get('icon') : data.icon;
  const colorValue = formData ? formData.get('color') : data.color;
  const removeImageValue = formData ? formData.get('removeImage') : data.removeImage;
  const imageValue = formData ? formData.get('image') : data.image;
  return {
    name: text(formData ? formData.get('name') : data.name),
    parentId: normalizeParentId(formData ? formData.get('parentId') : data.parentId),
    icon: iconValue == null || text(iconValue) === '' ? null : text(iconValue),
    iconProvided: formData ? formData.has('icon') : Object.prototype.hasOwnProperty.call(data, 'icon'),
    color: colorValue == null || text(colorValue) === '' ? null : text(colorValue),
    colorProvided: formData ? formData.has('color') : Object.prototype.hasOwnProperty.call(data, 'color'),
    removeImage: removeImageValue === '1' || removeImageValue === 'true' || removeImageValue === true || removeImageValue === 1,
    image: imageValue instanceof File && imageValue.size > 0 ? imageValue : null
  };
}

function validatePayload(payload: ExpensePayload): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  if (!payload.name) {
    fieldErrors.name = 'Please enter expense name.';
  } else if (payload.name.length > 250) {
    fieldErrors.name = 'Expense name must be 250 characters or fewer.';
  }
  if (payload.icon && !ALLOWED_ICONS.has(payload.icon)) {
    fieldErrors.icon = 'Please choose a valid expense icon.';
  }
  if (payload.color && !/^#[0-9a-f]{6}$/i.test(payload.color)) {
    fieldErrors.color = 'Please choose a valid color.';
  }
  if (payload.image && (!normalizeImageExtension(payload.image.name) || payload.image.size > MAX_IMAGE_BYTES)) {
    fieldErrors.image = 'Only PNG, JPG, GIF, or WEBP images up to 5MB are allowed.';
  }

  return fieldErrors;
}

function normalizeExpense(row: ExpenseRow) {
  const parentId = normalizeParentId(row.parent_id);
  return {
    id: String(row.id),
    name: text(row.name),
    parentId,
    icon: ALLOWED_ICONS.has(text(row.icon)) ? text(row.icon) : null,
    color: /^#[0-9a-f]{6}$/i.test(text(row.color)) ? text(row.color) : null,
    imageUrl: normalizeExpenseImagePath(row.image_url),
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
    `SELECT id, user_id, name, parent_id, icon, color, image_url, created, modified
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
      `SELECT id, user_id, name, parent_id, icon, color, image_url, created, modified
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
    const body = request.headers.get('content-type')?.includes('multipart/form-data')
      ? await request.formData()
      : await request.json();
    const payload = parsePayload(body);
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

    const uploaded = payload.image ? await saveExpenseImage(payload.image) : null;
    if (uploaded && 'error' in uploaded) {
      return NextResponse.json({ error: uploaded.error, fieldErrors: { image: uploaded.error } }, { status: 400 });
    }
    const imageUrl = uploaded && 'path' in uploaded ? uploaded.path : null;

    await prisma.$executeRawUnsafe(
      `INSERT INTO \`${tableName}\` (user_id, name, parent_id, icon, color, image_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      storageUserId,
      payload.name,
      parentIdValue,
      payload.icon,
      payload.color,
      imageUrl
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
    const body = request.headers.get('content-type')?.includes('multipart/form-data')
      ? await request.formData()
      : await request.json();
    const bodyData = body instanceof FormData ? Object.fromEntries(body.entries()) : body as Record<string, unknown>;
    const id = text(bodyData?.id);
    if (!id) {
      return NextResponse.json({ error: 'Expense id is required' }, { status: 400 });
    }

    const existing = await assertOwnedExpense(tableName, context, id);
    if (!existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const parsedPayload = parsePayload(body);
    const payload = { ...parsedPayload, parentId: bodyData?.parentId == null ? existing.parentId : parsedPayload.parentId };

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

    const uploaded = payload.image ? await saveExpenseImage(payload.image) : null;
    if (uploaded && 'error' in uploaded) {
      return NextResponse.json({ error: uploaded.error, fieldErrors: { image: uploaded.error } }, { status: 400 });
    }
    const nextIcon = payload.iconProvided ? payload.icon : (existing.icon ?? null);
    const nextColor = payload.colorProvided ? payload.color : (existing.color ?? null);
    const nextImageUrl = uploaded && 'path' in uploaded
      ? uploaded.path
      : payload.removeImage ? null : existing.imageUrl;

    await prisma.$executeRawUnsafe(
      `UPDATE \`${tableName}\`
       SET name = ?,
           icon = ?,
           color = ?,
           image_url = ?,
           modified = CURRENT_TIMESTAMP
       WHERE id = ?`,
      payload.name,
      nextIcon,
      nextColor,
      nextImageUrl,
      id
    );
    if (uploaded || payload.removeImage) await deleteExpenseImage(existing.imageUrl);

    return NextResponse.json({
      success: true,
      item: { id, name: payload.name, parentId: payload.parentId, icon: nextIcon, color: nextColor, imageUrl: normalizeExpenseImagePath(nextImageUrl) }
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

    const existing = await assertOwnedExpense(tableName, context, id);
    if (!existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    await prisma.$executeRawUnsafe(
      `DELETE FROM \`${tableName}\` WHERE id = ?`,
      id
    );
    await deleteExpenseImage(existing.imageUrl);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/club/settings/tables/expenses:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
