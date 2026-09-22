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

type MemberTypePayload = {
  name: string;
  discountSubscription: string;
  discountServices: string;
  discountRest: string;
  discountSupplement: string;
  discountClothing: string;
  discountOutfit: string;
  affiliateCost: string;
  debtMax: string;
  discountEnabled: boolean;
  header: 'A' | 'B';
  modelId: string;
};

type MemberTypeRow = {
  id: string | number | bigint;
  user_id?: string | number | bigint | null;
  club_id?: string | number | bigint | null;
  member_type_name?: string | null;
  discount_subscription?: string | number | null;
  discount_services?: string | number | null;
  discount_rest?: string | number | null;
  discount_suppl?: string | number | null;
  discount_clothing?: string | number | null;
  discount_outfit?: string | number | null;
  affiliate_cost?: string | number | null;
  debt_max?: string | number | null;
  discount_status?: string | null;
  header?: string | null;
  membertyp_id?: string | number | bigint | null;
  model_name?: string | null;
  created?: string | Date | null;
  modified?: string | Date | null;
};

type MemberTypeModelRow = {
  id: string | number | bigint;
  name?: string | null;
};

const MEMBER_TYPE_TABLE_CANDIDATES = ['club_setting_membertypes', 'club_setting_membertype'];
const MEMBER_TYPE_MODEL_TABLE_CANDIDATES = ['clubsetting_membertype_models', 'clubsetting_membertype_model'];
const MEMBER_TYPE_TABLE = 'club_setting_membertypes';
const MEMBER_TYPE_MODEL_TABLE = 'clubsetting_membertype_models';
const INITIAL_MODELS = [
  { id: '1', name: 'simple receipt' },
  { id: '2', name: 'tax receipt' },
  { id: '3', name: 'invoice' }
];

const MEMBER_TYPE_COLUMN_DEFINITIONS: Record<string, string> = {
  member_type_name: 'VARCHAR(250) NULL',
  discount_subscription: 'VARCHAR(50) NULL',
  discount_services: 'VARCHAR(50) NULL',
  discount_rest: 'VARCHAR(50) NULL',
  discount_suppl: 'VARCHAR(50) NULL',
  discount_clothing: 'VARCHAR(50) NULL',
  discount_outfit: 'VARCHAR(50) NULL',
  affiliate_cost: 'VARCHAR(50) NULL',
  debt_max: 'VARCHAR(50) NULL',
  discount_status: "CHAR(1) NOT NULL DEFAULT 'N'",
  header: "CHAR(1) NOT NULL DEFAULT 'A'",
  membertyp_id: 'BIGINT NULL',
  user_id: 'VARCHAR(191) NULL',
  club_id: 'VARCHAR(191) NULL',
  created: 'DATETIME DEFAULT CURRENT_TIMESTAMP',
  modified: 'DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
};

const MEMBER_TYPE_MODEL_COLUMN_DEFINITIONS: Record<string, string> = {
  name: 'VARCHAR(100) NULL',
  created: 'DATETIME DEFAULT CURRENT_TIMESTAMP',
  modified: 'DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
};

const NUMERIC_FIELDS: Array<keyof Pick<
  MemberTypePayload,
  | 'discountSubscription'
  | 'discountServices'
  | 'discountRest'
  | 'discountSupplement'
  | 'discountClothing'
  | 'discountOutfit'
  | 'affiliateCost'
  | 'debtMax'
>> = [
  'discountSubscription',
  'discountServices',
  'discountRest',
  'discountSupplement',
  'discountClothing',
  'discountOutfit',
  'affiliateCost',
  'debtMax'
];

const NUMERIC_FIELD_LABELS: Record<(typeof NUMERIC_FIELDS)[number], string> = {
  discountSubscription: 'Subscription discount',
  discountServices: 'Services discount',
  discountRest: 'Bar/Restaurant discount',
  discountSupplement: 'Supplements discount',
  discountClothing: 'Clothing discount',
  discountOutfit: 'Outfit discount',
  affiliateCost: 'Affiliate cost',
  debtMax: 'Debt max'
};

const NUMERIC_MIN = 0;
const NUMERIC_MAX = 100;

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function yesNo(value: unknown): 'Y' | 'N' {
  return value === true
    || value === 1
    || value === '1'
    || value === 'Y'
    || value === 'y'
    || value === 'true'
    ? 'Y'
    : 'N';
}

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(value as string | Date);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeNumber(value: string): string {
  return String(Number(value));
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

async function seedMemberTypeModels(tableName: string) {
  const memberTypeTable = await findExistingTable(MEMBER_TYPE_TABLE_CANDIDATES);
  const memberTypeColumns = memberTypeTable ? await getTableColumns(memberTypeTable) : new Set<string>();

  await prisma.$executeRawUnsafe(
    `INSERT INTO \`${tableName}\` (id, name, created, modified)
     VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
            (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
            (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       modified = CURRENT_TIMESTAMP`,
    INITIAL_MODELS[0].id,
    INITIAL_MODELS[0].name,
    INITIAL_MODELS[1].id,
    INITIAL_MODELS[1].name,
    INITIAL_MODELS[2].id,
    INITIAL_MODELS[2].name
  );

  for (const model of INITIAL_MODELS) {
    const duplicates = await prisma.$queryRawUnsafe<{ id: string | number | bigint }[]>(
      `SELECT id
       FROM \`${tableName}\`
       WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
         AND id <> ?
       ORDER BY id ASC`,
      model.name,
      model.id
    );
    const duplicateIds = duplicates.map((row) => String(row.id));
    if (duplicateIds.length === 0) continue;

    const duplicatePlaceholders = duplicateIds.map(() => '?').join(',');

    if (memberTypeTable && memberTypeColumns.has('membertyp_id')) {
      await prisma.$executeRawUnsafe(
        `UPDATE \`${memberTypeTable}\`
         SET membertyp_id = ?
         WHERE CAST(membertyp_id AS CHAR) IN (${duplicatePlaceholders})`,
        model.id,
        ...duplicateIds
      );
    }

    await prisma.$executeRawUnsafe(
      `DELETE FROM \`${tableName}\`
       WHERE id IN (${duplicatePlaceholders})`,
      ...duplicateIds
    );
  }
}

async function ensureMemberTypeModelTable(): Promise<string> {
  const existing = await findExistingTable(MEMBER_TYPE_MODEL_TABLE_CANDIDATES);
  const tableName = existing ?? MEMBER_TYPE_MODEL_TABLE;

  if (!existing) {
    const columnSql = Object.entries(MEMBER_TYPE_MODEL_COLUMN_DEFINITIONS)
      .map(([column, definition]) => `\`${column}\` ${definition}`)
      .join(',\n      ');

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`${tableName}\` (
        id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        ${columnSql},
        INDEX idx_member_type_models_name (name)
      )
    `);
  }

  const columns = await getTableColumns(tableName);
  for (const [column, definition] of Object.entries(MEMBER_TYPE_MODEL_COLUMN_DEFINITIONS)) {
    if (!columns.has(column)) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE \`${tableName}\` ADD COLUMN \`${column}\` ${definition}`
      );
    }
  }

  await seedMemberTypeModels(tableName);

  return tableName;
}

async function ensureMemberTypeTable(): Promise<string> {
  const existing = await findExistingTable(MEMBER_TYPE_TABLE_CANDIDATES);
  const tableName = existing ?? MEMBER_TYPE_TABLE;

  if (!existing) {
    const columnSql = Object.entries(MEMBER_TYPE_COLUMN_DEFINITIONS)
      .map(([column, definition]) => `\`${column}\` ${definition}`)
      .join(',\n      ');

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`${tableName}\` (
        id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        ${columnSql},
        INDEX idx_club_setting_membertypes_user_club (user_id, club_id),
        INDEX idx_club_setting_membertypes_name (member_type_name),
        INDEX idx_club_setting_membertypes_model (membertyp_id)
      )
    `);
  }

  const columns = await getTableColumns(tableName);
  for (const [column, definition] of Object.entries(MEMBER_TYPE_COLUMN_DEFINITIONS)) {
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

/** Member profile settings: read member types for the club being viewed. */
async function getProfileReadContext(request: NextRequest) {
  const decoded = getTokenPayload(request);
  if (!decoded?.userId) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const clubId = text(request.nextUrl.searchParams.get('clubId'));
  if (!clubId) {
    return { error: NextResponse.json({ error: 'clubId is required' }, { status: 400 }) };
  }

  const clubRows = await prisma.$queryRaw<{ id: string; adminId: string }[]>`
    SELECT id, adminId
    FROM clubs_new
    WHERE id = ${clubId}
    LIMIT 1
  `;
  const club = clubRows[0];
  if (!club) {
    return { error: NextResponse.json({ error: 'Club not found' }, { status: 404 }) };
  }

  const viewerId = String(decoded.userId);
  const isAdmin = club.adminId === viewerId;
  if (!isAdmin) {
    const membership = await prisma.clubMember.findUnique({
      where: { clubId_memberId: { clubId, memberId: viewerId } },
      select: { id: true },
    });
    if (!membership) {
      return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }
  }

  const legacyAdminId = await getLegacyUserId(club.adminId);
  const userIds = Array.from(
    new Set([club.adminId, legacyAdminId].filter(Boolean) as string[]),
  );

  return { userId: viewerId, club, userIds };
}

function parsePayload(body: unknown): MemberTypePayload {
  const data = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const header = text(data.header).toUpperCase() === 'B' ? 'B' : 'A';

  return {
    name: text(data.name),
    discountSubscription: text(data.discountSubscription),
    discountServices: text(data.discountServices),
    discountRest: text(data.discountRest),
    discountSupplement: text(data.discountSupplement),
    discountClothing: text(data.discountClothing),
    discountOutfit: text(data.discountOutfit),
    affiliateCost: text(data.affiliateCost),
    debtMax: text(data.debtMax),
    discountEnabled: yesNo(data.discountEnabled) === 'Y',
    header,
    modelId: text(data.modelId)
  };
}

async function validatePayload(
  modelTable: string,
  payload: MemberTypePayload
): Promise<Record<string, string>> {
  const fieldErrors: Record<string, string> = {};

  if (!payload.name) {
    fieldErrors.name = 'Please enter member type.';
  }

  for (const field of NUMERIC_FIELDS) {
    const value = payload[field];
    if (!value || !Number.isFinite(Number(value))) {
      fieldErrors[field] = `${NUMERIC_FIELD_LABELS[field]} must be a number.`;
    } else if (value.length > 6) {
      fieldErrors[field] = `${NUMERIC_FIELD_LABELS[field]} must be 6 characters or fewer.`;
    } else {
      const numeric = Number(value);
      if (numeric < NUMERIC_MIN || numeric > NUMERIC_MAX) {
        fieldErrors[field] = `${NUMERIC_FIELD_LABELS[field]} must be between ${NUMERIC_MIN} and ${NUMERIC_MAX}.`;
      }
    }
  }

  if (!payload.modelId) {
    fieldErrors.modelId = 'Please select option.';
  } else {
    const rows = await prisma.$queryRawUnsafe<{ id: string | number | bigint }[]>(
      `SELECT id FROM \`${modelTable}\` WHERE id = ? LIMIT 1`,
      payload.modelId
    );
    if (!rows[0]) {
      fieldErrors.modelId = 'Selected model does not exist.';
    }
  }

  return fieldErrors;
}

async function ensureNoDuplicate(
  tableName: string,
  context: AuthorizedContext,
  name: string,
  exceptId?: string
): Promise<boolean> {
  const userPlaceholders = context.userIds.map(() => '?').join(',');
  const rows = await prisma.$queryRawUnsafe<{ count: number | bigint }[]>(
    `SELECT COUNT(*) AS count
     FROM \`${tableName}\`
     WHERE user_id IN (${userPlaceholders})
       AND LOWER(TRIM(member_type_name)) = LOWER(TRIM(?))
       ${exceptId ? 'AND id <> ?' : ''}`,
    ...context.userIds,
    name,
    ...(exceptId ? [exceptId] : [])
  );

  return Number(rows[0]?.count ?? 0) === 0;
}

async function getOwnedMemberType(
  tableName: string,
  context: AuthorizedContext,
  id: string
): Promise<MemberTypeRow | null> {
  const userPlaceholders = context.userIds.map(() => '?').join(',');
  const rows = await prisma.$queryRawUnsafe<MemberTypeRow[]>(
    `SELECT id
     FROM \`${tableName}\`
     WHERE id = ?
       AND user_id IN (${userPlaceholders})
     LIMIT 1`,
    id,
    ...context.userIds
  );

  return rows[0] ?? null;
}

function normalizeModel(row: MemberTypeModelRow) {
  return {
    id: String(row.id),
    name: text(row.name)
  };
}

function normalizeMemberType(row: MemberTypeRow) {
  return {
    id: String(row.id),
    name: text(row.member_type_name),
    discountSubscription: text(row.discount_subscription),
    discountServices: text(row.discount_services),
    discountRest: text(row.discount_rest),
    discountSupplement: text(row.discount_suppl),
    discountClothing: text(row.discount_clothing),
    discountOutfit: text(row.discount_outfit),
    affiliateCost: text(row.affiliate_cost),
    debtMax: text(row.debt_max),
    discountEnabled: yesNo(row.discount_status) === 'Y',
    header: text(row.header) === 'B' ? 'B' : 'A',
    modelId: text(row.membertyp_id),
    modelName: text(row.model_name) || '-',
    created: toIsoDate(row.created),
    modified: toIsoDate(row.modified)
  };
}

export async function GET(request: NextRequest) {
  try {
    const scope = request.nextUrl.searchParams.get('scope');
    const modelTable = await ensureMemberTypeModelTable();
    const tableName = await ensureMemberTypeTable();

    if (scope === 'profile') {
      const context = await getProfileReadContext(request);
      if ('error' in context) return context.error;

      const userPlaceholders = context.userIds.map(() => '?').join(',');
      const rows = await prisma.$queryRawUnsafe<MemberTypeRow[]>(
        `SELECT membertypes.id, membertypes.user_id, membertypes.club_id,
                membertypes.member_type_name, membertypes.discount_subscription,
                membertypes.discount_services, membertypes.discount_rest,
                membertypes.discount_suppl, membertypes.discount_clothing,
                membertypes.discount_outfit, membertypes.affiliate_cost,
                membertypes.debt_max, membertypes.discount_status,
                membertypes.header, membertypes.membertyp_id,
                membertypes.created, membertypes.modified,
                models.name AS model_name
         FROM \`${tableName}\` membertypes
         LEFT JOIN \`${modelTable}\` models
           ON CAST(models.id AS CHAR) = CAST(membertypes.membertyp_id AS CHAR)
         WHERE membertypes.club_id = ?
            OR (
              (membertypes.club_id IS NULL OR TRIM(CAST(membertypes.club_id AS CHAR)) = '')
              AND membertypes.user_id IN (${userPlaceholders})
            )
         ORDER BY membertypes.member_type_name ASC`,
        context.club.id,
        ...context.userIds,
      );

      return NextResponse.json({
        items: rows.map(normalizeMemberType),
      });
    }

    const context = await getAuthorizedContext(request);
    if ('error' in context) return context.error;

    const userPlaceholders = context.userIds.map(() => '?').join(',');

    const models = await prisma.$queryRawUnsafe<MemberTypeModelRow[]>(
      `SELECT id, name
       FROM \`${modelTable}\`
       ORDER BY id ASC`
    );

    const rows = await prisma.$queryRawUnsafe<MemberTypeRow[]>(
      `SELECT membertypes.id, membertypes.user_id, membertypes.club_id,
              membertypes.member_type_name, membertypes.discount_subscription,
              membertypes.discount_services, membertypes.discount_rest,
              membertypes.discount_suppl, membertypes.discount_clothing,
              membertypes.discount_outfit, membertypes.affiliate_cost,
              membertypes.debt_max, membertypes.discount_status,
              membertypes.header, membertypes.membertyp_id,
              membertypes.created, membertypes.modified,
              models.name AS model_name
       FROM \`${tableName}\` membertypes
       LEFT JOIN \`${modelTable}\` models
         ON CAST(models.id AS CHAR) = CAST(membertypes.membertyp_id AS CHAR)
       WHERE membertypes.user_id IN (${userPlaceholders})
         AND (
           ? IS NULL
           OR membertypes.club_id = ?
           OR membertypes.club_id IS NULL
           OR TRIM(CAST(membertypes.club_id AS CHAR)) = ''
         )
       ORDER BY membertypes.id DESC`,
      ...context.userIds,
      context.club?.id ?? null,
      context.club?.id ?? null,
    );

    return NextResponse.json({
      club: context.club,
      models: models.map(normalizeModel),
      items: rows.map(normalizeMemberType)
    });
  } catch (error) {
    console.error('GET /api/club/settings/tables/member-types:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthorizedContext(request);
    if ('error' in context) return context.error;

    const modelTable = await ensureMemberTypeModelTable();
    const tableName = await ensureMemberTypeTable();
    const payload = parsePayload(await request.json());
    const fieldErrors = await validatePayload(modelTable, payload);

    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json({ error: 'Validation failed', fieldErrors }, { status: 400 });
    }

    if (!(await ensureNoDuplicate(tableName, context, payload.name))) {
      return NextResponse.json({
        error: 'Duplicate value',
        fieldErrors: { name: 'This name already exists.' }
      }, { status: 409 });
    }

    const storageUserId = context.legacyUserId ?? context.userId;
    await prisma.$executeRawUnsafe(
      `INSERT INTO \`${tableName}\`
         (member_type_name, discount_subscription, discount_services, discount_rest,
          discount_suppl, discount_clothing, discount_outfit, affiliate_cost,
          debt_max, discount_status, header, membertyp_id, user_id, club_id,
          created, modified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      payload.name,
      normalizeNumber(payload.discountSubscription),
      normalizeNumber(payload.discountServices),
      normalizeNumber(payload.discountRest),
      normalizeNumber(payload.discountSupplement),
      normalizeNumber(payload.discountClothing),
      normalizeNumber(payload.discountOutfit),
      normalizeNumber(payload.affiliateCost),
      normalizeNumber(payload.debtMax),
      yesNo(payload.discountEnabled),
      payload.header,
      payload.modelId,
      storageUserId,
      context.club?.id ?? null
    );

    const idRows = await prisma.$queryRawUnsafe<{ id: bigint | number | string }[]>(
      'SELECT LAST_INSERT_ID() AS id'
    );

    return NextResponse.json({
      success: true,
      item: { id: String(idRows[0]?.id ?? ''), ...payload }
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/club/settings/tables/member-types:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const context = await getAuthorizedContext(request);
    if ('error' in context) return context.error;

    const modelTable = await ensureMemberTypeModelTable();
    const tableName = await ensureMemberTypeTable();
    const body = await request.json();
    const id = text((body as Record<string, unknown>)?.id);
    if (!id) {
      return NextResponse.json({ error: 'Member type id is required' }, { status: 400 });
    }

    if (!(await getOwnedMemberType(tableName, context, id))) {
      return NextResponse.json({ error: 'Member type not found' }, { status: 404 });
    }

    const payload = parsePayload(body);
    const fieldErrors = await validatePayload(modelTable, payload);
    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json({ error: 'Validation failed', fieldErrors }, { status: 400 });
    }

    if (!(await ensureNoDuplicate(tableName, context, payload.name, id))) {
      return NextResponse.json({
        error: 'Duplicate value',
        fieldErrors: { name: 'This name already exists.' }
      }, { status: 409 });
    }

    await prisma.$executeRawUnsafe(
      `UPDATE \`${tableName}\`
       SET member_type_name = ?,
           discount_subscription = ?,
           discount_services = ?,
           discount_rest = ?,
           discount_suppl = ?,
           discount_clothing = ?,
           discount_outfit = ?,
           affiliate_cost = ?,
           debt_max = ?,
           discount_status = ?,
           header = ?,
           membertyp_id = ?,
           modified = CURRENT_TIMESTAMP
       WHERE id = ?`,
      payload.name,
      normalizeNumber(payload.discountSubscription),
      normalizeNumber(payload.discountServices),
      normalizeNumber(payload.discountRest),
      normalizeNumber(payload.discountSupplement),
      normalizeNumber(payload.discountClothing),
      normalizeNumber(payload.discountOutfit),
      normalizeNumber(payload.affiliateCost),
      normalizeNumber(payload.debtMax),
      yesNo(payload.discountEnabled),
      payload.header,
      payload.modelId,
      id
    );

    return NextResponse.json({
      success: true,
      item: { id, ...payload }
    });
  } catch (error) {
    console.error('PUT /api/club/settings/tables/member-types:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await getAuthorizedContext(request);
    if ('error' in context) return context.error;

    const tableName = await ensureMemberTypeTable();
    const id = text(request.nextUrl.searchParams.get('id'));
    if (!id) {
      return NextResponse.json({ error: 'Member type id is required' }, { status: 400 });
    }

    if (!(await getOwnedMemberType(tableName, context, id))) {
      return NextResponse.json({ error: 'Member type not found' }, { status: 404 });
    }

    await prisma.$executeRawUnsafe(
      `DELETE FROM \`${tableName}\` WHERE id = ?`,
      id
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/club/settings/tables/member-types:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
