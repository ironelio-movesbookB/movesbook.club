import { prisma } from '@/lib/prisma';
import { findExistingTable } from '@/lib/club/legacyTableLookup';

export type ArchiveQueryParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  fromDate?: string;
  toDate?: string;
  orderBy?: 'recent' | 'old';
  /** Scope to a single member (e.g. "Member selected" vs "All members" toggle). */
  memberId?: string;
  /** Scope to the single record selected in the archive we came from ("Record selected"). */
  recordId?: string;
  /** Filter athletes by main sport. */
  sport?: string;
  /** Filter athletes by group of training / team name. */
  groupTrained?: string;
  /** Saved member group id (Archive → Groups); resolved to `memberIdsIn` by the route. */
  memberGroupId?: string;
  /** Keep only rows whose member (user) id is in this list. */
  memberIdsIn?: string[];
  /**
   * Archive of Users membership bucket:
   * member | pending | not_member | archived | all (A+B+C, excludes archived).
   */
  membershipStatus?: 'member' | 'pending' | 'not_member' | 'archived' | 'all';
  /** Archive of Payments: only payments still to be verified. */
  toBeVerified?: boolean;
};

export type PaginatedArchive<T> = { items: T[]; total: number; page: number; pageSize: number };

function text(v: unknown): string {
  return String(v ?? '').trim();
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatName(first: unknown, last: unknown, fallback: unknown): string {
  const name = [text(first), text(last)].filter(Boolean).join(' ').trim();
  return name || text(fallback) || '-';
}

function paginate<T>(items: T[], page: number, pageSize: number): PaginatedArchive<T> {
  const total = items.length;
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total, page, pageSize };
}

function applyFilters(
  items: Record<string, unknown>[],
  params: ArchiveQueryParams
): Record<string, unknown>[] {
  let result = [...items];
  const search = params.search?.trim().toLowerCase();
  if (search) {
    result = result.filter((row) =>
      Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(search))
    );
  }
  if (params.fromDate) {
    result = result.filter((row) => {
      const d = String(row.insertDate ?? row.dateStart ?? row.paydate ?? '');
      return !d || d >= params.fromDate!;
    });
  }
  if (params.toDate) {
    result = result.filter((row) => {
      const d = String(row.insertDate ?? row.dateStart ?? row.paydate ?? '');
      return !d || d <= params.toDate!;
    });
  }
  if (params.sport && params.sport !== 'all') {
    const sport = params.sport.toLowerCase();
    result = result.filter((row) => String(row.sport ?? '').toLowerCase() === sport);
  }
  if (params.groupTrained && params.groupTrained !== 'all') {
    const group = params.groupTrained.toLowerCase();
    result = result.filter(
      (row) => String(row.groupTrained ?? row.groupTrainedId ?? '').toLowerCase() === group,
    );
  }
  if (params.memberIdsIn) {
    const allowed = new Set(params.memberIdsIn);
    result = result.filter((row) => allowed.has(String(row.memberId ?? row.id ?? '')));
  }
  if (params.membershipStatus && params.membershipStatus !== 'all') {
    result = result.filter(
      (row) => String(row.membershipStatus ?? 'member') === params.membershipStatus,
    );
  } else {
    // "all" / unset = active profiles only (A+B+C), hide Members Archived
    result = result.filter(
      (row) => String(row.membershipStatus ?? 'member') !== 'archived',
    );
  }
  if (params.orderBy === 'old') {
    result.reverse();
  }
  return result;
}

async function loadUsersByIds(ids: string[]) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map<string, { firstName: string | null; surname: string | null; name: string; image: string | null }>();
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, firstName: true, surname: true, name: true, username: true, image: true },
  });
  return new Map(users.map((u) => [u.id, u]));
}

function subscriptionStatus(endDate: string | null): string {
  if (!endDate) return 'Active';
  const end = new Date(`${endDate.slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (end < today) return 'Expired';
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 30);
  if (end <= soon) return 'Pending';
  return 'Active';
}

export async function queryClubMemberSubscriptions(
  clubId: string,
  params: ArchiveQueryParams
): Promise<PaginatedArchive<Record<string, unknown>>> {
  const table = await findExistingTable(['club_member_subscriptions', 'club_member_subscription']);
  const items: Record<string, unknown>[] = [];
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;

  if (table) {
    const rows = await prisma.$queryRawUnsafe<
      {
        id: bigint | number;
        user_id: bigint | number | null;
        start_date: string | Date | null;
        end_date: string | Date | null;
        subscription_name: string | null;
        amount: string | number | null;
        installments: string | number | null;
        area: string | null;
        activity_name: string | null;
      }[]
    >(
      `SELECT id, user_id, start_date, end_date, subscription_name, amount, installments, area, activity_name
       FROM \`${table}\`
       WHERE club_id = ? AND (delete_status IS NULL OR delete_status = 0)
       ORDER BY id DESC LIMIT 1000`,
      clubId
    );

    const userIds = rows.map((r) => String(r.user_id ?? '')).filter(Boolean);
    const userMap = await loadUsersByIds(userIds);

    for (const row of rows) {
      const user = userMap.get(String(row.user_id ?? ''));
      const dateEnd = row.end_date ? String(row.end_date).slice(0, 10) : null;
      const course = text(row.activity_name) || text(row.subscription_name) || text(row.area) || '-';
      items.push({
        id: String(row.id),
        name: user ? formatName(user.firstName, user.surname, user.name) : '-',
        image: user?.image ?? null,
        typology: text(row.area) || 'Affiliation',
        course,
        service: text(row.subscription_name) || '-',
        dateStart: row.start_date ? String(row.start_date).slice(0, 10) : '-',
        dateEnd,
        membershipEndDate: dateEnd,
        insertDate: row.start_date ? String(row.start_date).slice(0, 10) : '-',
        value: num(row.amount),
        installments: num(row.installments) || text(row.installments) || '-',
        installment: text(row.installments) || '-',
        status: subscriptionStatus(dateEnd),
      });
    }
  }

  return paginate(applyFilters(items, params), page, pageSize);
}

export async function queryLegacyTableArchive(
  tableCandidates: string[],
  mapRow: (row: Record<string, unknown>, userMap: Map<string, { firstName: string | null; surname: string | null; name: string; image: string | null }>) => Record<string, unknown> | null,
  sql: string,
  sqlParams: unknown[],
  params: ArchiveQueryParams
): Promise<PaginatedArchive<Record<string, unknown>>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  const table = await findExistingTable(tableCandidates);
  if (!table) return paginate([], page, pageSize);

  try {
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql.replace(/\{table\}/g, table), ...sqlParams);
    const userIds = rows.flatMap((r) => [String(r.user_id ?? ''), String(r.member_id ?? '')]).filter(Boolean);
    const userMap = await loadUsersByIds(userIds);
    const items = rows.map((r) => mapRow(r, userMap)).filter(Boolean) as Record<string, unknown>[];
    return paginate(applyFilters(items, params), page, pageSize);
  } catch {
    return paginate([], page, pageSize);
  }
}

export { text, num, formatName, paginate, applyFilters };
