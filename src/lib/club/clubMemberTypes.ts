import { prisma } from '@/lib/prisma';

const MEMBER_TYPE_TABLE_CANDIDATES = ['club_setting_membertypes', 'club_setting_membertype'];

async function findMemberTypeTable(): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe<{ TABLE_NAME: string }[]>(
    `SELECT TABLE_NAME
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN (?, ?)`,
    ...MEMBER_TYPE_TABLE_CANDIDATES,
  );
  const existing = new Set(rows.map((r) => r.TABLE_NAME));
  return MEMBER_TYPE_TABLE_CANDIDATES.find((t) => existing.has(t)) ?? null;
}

async function legacyUserIdFor(userId: string): Promise<string | null> {
  const fromId = userId.match(/^legacy_(\d+)(?:_|$)/);
  if (fromId?.[1]) return fromId[1];
  try {
    const rows = await prisma.$queryRawUnsafe<{ legacy_id: number | string }[]>(
      `SELECT legacy_id FROM legacy_id_mappings
       WHERE new_id = ? AND legacy_table = 'users'
       ORDER BY legacy_id DESC LIMIT 1`,
      userId,
    );
    return rows[0]?.legacy_id != null ? String(rows[0].legacy_id) : null;
  } catch {
    return null;
  }
}

/**
 * Member type names from Club management → General settings → Tables → Member type,
 * keyed by id (what member profiles store in `settings.memberTypeId`).
 */
export async function loadClubMemberTypeNames(clubId: string): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  try {
    const table = await findMemberTypeTable();
    if (!table) return names;

    const club = await prisma.club.findUnique({ where: { id: clubId }, select: { adminId: true } });
    const team = club
      ? null
      : await prisma.team.findUnique({ where: { id: clubId }, select: { adminId: true } });
    const adminId = club?.adminId ?? team?.adminId ?? null;

    const ownerIds = adminId
      ? Array.from(new Set([adminId, await legacyUserIdFor(adminId)].filter(Boolean) as string[]))
      : [];
    const ownerClause = ownerIds.length
      ? `OR ((club_id IS NULL OR TRIM(CAST(club_id AS CHAR)) = '') AND user_id IN (${ownerIds
          .map(() => '?')
          .join(',')}))`
      : '';

    const rows = await prisma.$queryRawUnsafe<
      { id: bigint | number | string; member_type_name: string | null }[]
    >(
      `SELECT id, member_type_name FROM \`${table}\` WHERE club_id = ? ${ownerClause}`,
      clubId,
      ...ownerIds,
    );
    for (const row of rows) {
      const name = String(row.member_type_name ?? '').trim();
      if (name) names.set(String(row.id), name);
    }
  } catch (error) {
    console.warn('loadClubMemberTypeNames failed', error);
  }
  return names;
}

export function memberTypeIdFromProfileJson(profileJson: string | null | undefined): string {
  if (!profileJson) return '';
  try {
    const parsed = JSON.parse(profileJson) as { settings?: { memberTypeId?: unknown } };
    return String(parsed.settings?.memberTypeId ?? '').trim();
  } catch {
    return '';
  }
}
