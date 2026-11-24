import { ProcedureRecordStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { findExistingTable } from '@/lib/club/legacyTableLookup';
import { procedureService } from '@/lib/procedures';
import { PROCEDURE_TYPE_CODES } from '@/lib/procedures/types';
import type { ClubAuthContext } from '@/lib/procedures/types';
import {
  listAccessesArchive,
  listClubMembersArchive,
  listInsertCredits,
  listReservationsArchive,
  listUnifiedDeadlines,
  listUnifiedPayments,
  listUnifiedProductSales,
} from '@/lib/club/archives/clubArchiveService';
import {
  PREVIEW_LIMIT,
  archiveSectionById,
  isArchiveSectionId,
  isSummaryTileId,
  type ArchiveSectionId,
  type SummaryTileId,
} from '@/lib/club/monitoring/dashboardCatalog';

export type MonthPoint = { key: string; label: string; count: number };

export type PreviewRow = {
  id: string;
  title: string;
  detail: string;
  date: string;
};

export type DashboardSnapshot = {
  counts: Record<SummaryTileId, number>;
  courses: { id: string; name: string }[];
  series: {
    id: ArchiveSectionId;
    title: string;
    points: MonthPoint[];
  };
};

const COURSE_CODES = new Set<ArchiveSectionId>(['subscriptions', 'subscription-stats']);

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function monthWindow(now = new Date()): { from: Date; points: MonthPoint[] } {
  const points: MonthPoint[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    points.push({
      key,
      label: d.toLocaleString('en', { month: 'short' }),
      count: 0,
    });
  }
  return { from: new Date(now.getFullYear(), now.getMonth() - 11, 1), points };
}

function bucketDates(dates: Array<string | Date | null | undefined>): MonthPoint[] {
  const { points } = monthWindow();
  const index = new Map(points.map((point, i) => [point.key, i]));
  for (const value of dates) {
    if (!value) continue;
    const iso = value instanceof Date ? value.toISOString() : String(value);
    const key = iso.slice(0, 7);
    const at = index.get(key);
    if (at != null) points[at].count += 1;
  }
  return points;
}

async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(`monitoring dashboard ${label}:`, error);
    return fallback;
  }
}

function courseMatches(metadata: unknown, courseId: string | null): boolean {
  if (!courseId || courseId === 'all') return true;
  if (!metadata || typeof metadata !== 'object') return false;
  const meta = metadata as Record<string, unknown>;
  return String(meta.courseId ?? '') === courseId || String(meta.courseName ?? '') === courseId;
}

async function procedureDates(
  clubId: string,
  code: string,
  courseId: string | null,
): Promise<Array<Date>> {
  const { from } = monthWindow();
  const rows = await prisma.procedureRecord.findMany({
    where: {
      clubId,
      status: ProcedureRecordStatus.ACTIVE,
      recordDate: { gte: from },
      procedureType: { code },
    },
    select: { recordDate: true, metadata: true },
    take: 8000,
  });
  return rows.filter((row) => courseMatches(row.metadata, courseId)).map((row) => row.recordDate);
}

async function rawCount(sql: string, params: unknown[]): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ c: bigint | number }[]>(sql, ...params);
  return Number(rows[0]?.c ?? 0);
}

async function loadCourses(): Promise<{ id: string; name: string }[]> {
  const table = await findExistingTable(['club_courses', 'courses', 'course']);
  if (!table) return [];
  const rows = await prisma.$queryRawUnsafe<{ id: bigint | number; course_name: string | null }[]>(
    `SELECT id, course_name FROM \`${table}\` ORDER BY course_name ASC LIMIT 200`,
  );
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.course_name ?? '').trim() || `Course ${row.id}`,
  }));
}

async function countBirthdays(clubId: string): Promise<number> {
  return rawCount(
    `SELECT COUNT(*) AS c
     FROM club_members_new cm
     INNER JOIN users_new u ON u.id = cm.memberId
     WHERE cm.clubId = ?
       AND u.birthdate IS NOT NULL
       AND MONTH(u.birthdate) = MONTH(CURDATE())
       AND DAY(u.birthdate) = DAY(CURDATE())`,
    [clubId],
  );
}

async function countPresentToday(clubId: string): Promise<number> {
  const table = await findExistingTable(['club_access_controls']);
  if (!table) return 0;
  return rawCount(
    `SELECT COUNT(*) AS c
     FROM \`${table}\` a
     INNER JOIN club_members_new cm ON cm.memberId = a.user_id AND cm.clubId = ?
     WHERE DATE(a.\`date\`) = CURDATE()`,
    [clubId],
  );
}

async function countNextAppointments(clubId: string): Promise<number> {
  const table = await findExistingTable(['reservations']);
  if (!table) return 0;
  return rawCount(
    `SELECT COUNT(*) AS c
     FROM \`${table}\`
     WHERE club_id = ?
       AND (
         DATE(\`date\`) >= CURDATE()
         OR DATE(reservation_date) >= CURDATE()
       )`,
    [clubId],
  );
}

async function countUnread(userId: string): Promise<number> {
  const conversations = await prisma.chatConversation.findMany({
    where: { OR: [{ user1Id: userId }, { user2Id: userId }] },
    select: { id: true, user1Id: true, user1LastReadAt: true, user2LastReadAt: true },
  });
  const counts = await Promise.all(
    conversations.map((conversation) => {
      const lastRead =
        conversation.user1Id === userId ? conversation.user1LastReadAt : conversation.user2LastReadAt;
      return prisma.chatMessage.count({
        where: {
          conversationId: conversation.id,
          senderId: { not: userId },
          ...(lastRead ? { createdAt: { gt: lastRead } } : {}),
        },
      });
    }),
  );
  return counts.reduce((sum, n) => sum + n, 0);
}

async function countActiveMembers(clubId: string): Promise<number> {
  const type = await prisma.procedureType.findFirst({
    where: { code: PROCEDURE_TYPE_CODES.MEMBERSHIP },
    select: { id: true },
  });
  if (!type) return 0;
  const today = startOfToday();
  const rows = await prisma.procedureRecord.findMany({
    where: {
      clubId,
      procedureTypeId: type.id,
      status: ProcedureRecordStatus.ACTIVE,
      OR: [{ dueDate: null }, { dueDate: { gte: today } }],
    },
    select: { memberId: true },
    distinct: ['memberId'],
  });
  return rows.length;
}

export async function loadDashboardCounts(ctx: ClubAuthContext): Promise<Record<SummaryTileId, number>> {
  const clubId = ctx.club.id;
  const today = startOfToday();
  const [
    totalMembers,
    activeMembers,
    nextAppointments,
    paymentOverdue,
    presentToday,
    birthdays,
    unreadMessages,
  ] = await Promise.all([
    safe('total members', () => prisma.clubMember.count({ where: { clubId } }), 0),
    safe('active members', () => countActiveMembers(clubId), 0),
    safe('appointments', () => countNextAppointments(clubId), 0),
    safe(
      'overdue',
      () =>
        prisma.procedureRecord.count({
          where: {
            clubId,
            status: ProcedureRecordStatus.ACTIVE,
            balanceAmount: { gt: 0 },
            dueDate: { lt: today },
          },
        }),
      0,
    ),
    safe('present', () => countPresentToday(clubId), 0),
    safe('birthdays', () => countBirthdays(clubId), 0),
    safe('unread', () => countUnread(ctx.userId), 0),
  ]);

  return {
    'total-members': totalMembers,
    'active-members': activeMembers,
    'next-appointments': nextAppointments,
    'payment-overdue': paymentOverdue,
    'present-today': presentToday,
    'name-days': 0,
    birthdays,
    'unread-messages': unreadMessages,
  };
}

async function legacyMonthCounts(
  tableCandidates: string[],
  dateColumn: string,
  whereSql: string,
  params: unknown[],
): Promise<MonthPoint[]> {
  const table = await findExistingTable(tableCandidates);
  if (!table) return bucketDates([]);
  const { from } = monthWindow();
  const fromIso = from.toISOString().slice(0, 10);
  const rows = await prisma.$queryRawUnsafe<{ ym: string; c: bigint | number }[]>(
    `SELECT DATE_FORMAT(\`${dateColumn}\`, '%Y-%m') AS ym, COUNT(*) AS c
     FROM \`${table}\`
     WHERE ${whereSql} AND \`${dateColumn}\` >= ?
     GROUP BY ym`,
    ...params,
    fromIso,
  );
  const points = bucketDates([]);
  const index = new Map(points.map((point, i) => [point.key, i]));
  for (const row of rows) {
    const at = index.get(String(row.ym));
    if (at != null) points[at].count = Number(row.c);
  }
  return points;
}

export async function loadDashboardSeries(
  ctx: ClubAuthContext,
  archiveId: ArchiveSectionId,
  courseId: string | null,
): Promise<MonthPoint[]> {
  const clubId = ctx.club.id;
  const course = COURSE_CODES.has(archiveId) ? courseId : null;

  switch (archiveId) {
    case 'memberships':
      return bucketDates(await procedureDates(clubId, PROCEDURE_TYPE_CODES.MEMBERSHIP, null));
    case 'services':
      return bucketDates(await procedureDates(clubId, PROCEDURE_TYPE_CODES.SERVICE_SALE, null));
    case 'subscriptions':
    case 'subscription-stats':
      return bucketDates(await procedureDates(clubId, PROCEDURE_TYPE_CODES.COURSE_SUBSCRIPTION, course));
    case 'credits':
      return bucketDates(await procedureDates(clubId, PROCEDURE_TYPE_CODES.MEMBER_CREDIT, null));
    case 'sellings':
      return bucketDates(await procedureDates(clubId, PROCEDURE_TYPE_CODES.PRODUCT_SALE, null));
    case 'deadlines': {
      const { from } = monthWindow();
      const rows = await prisma.procedureRecord.findMany({
        where: {
          clubId,
          status: ProcedureRecordStatus.ACTIVE,
          balanceAmount: { gt: 0 },
          recordDate: { gte: from },
        },
        select: { recordDate: true },
        take: 8000,
      });
      return bucketDates(rows.map((row) => row.recordDate));
    }
    case 'payments': {
      const { from } = monthWindow();
      const rows = await prisma.procedurePayment.findMany({
        where: {
          paymentDate: { gte: from },
          procedureRecord: { clubId, status: ProcedureRecordStatus.ACTIVE },
        },
        select: { paymentDate: true },
        take: 8000,
      });
      return bucketDates(rows.map((row) => row.paymentDate));
    }
    case 'new-members': {
      const { from } = monthWindow();
      const rows = await prisma.clubMember.findMany({
        where: { clubId, joinedAt: { gte: from } },
        select: { joinedAt: true },
      });
      return bucketDates(rows.map((row) => row.joinedAt));
    }
    case 'accesses':
      return legacyMonthCounts(
        ['club_access_controls'],
        'date',
        `user_id IN (SELECT memberId FROM club_members_new WHERE clubId = ?)`,
        [clubId],
      );
    case 'reservations':
      return legacyMonthCounts(['reservations'], 'date', 'club_id = ?', [clubId]);
    case 'audio-messages': {
      const { from } = monthWindow();
      const rows = await prisma.chatBroadcastMessage.findMany({
        where: { clubId, createdAt: { gte: from } },
        select: { createdAt: true },
        take: 8000,
      });
      return bucketDates(rows.map((row) => row.createdAt));
    }
    default:
      return bucketDates([]);
  }
}

export async function getDashboardSnapshot(
  ctx: ClubAuthContext,
  archiveId: ArchiveSectionId,
  courseId: string | null,
): Promise<DashboardSnapshot> {
  const section = archiveSectionById(archiveId) ?? archiveSectionById('subscriptions')!;
  const [counts, courses, points] = await Promise.all([
    loadDashboardCounts(ctx),
    safe('courses', loadCourses, []),
    safe('series', () => loadDashboardSeries(ctx, section.id, courseId), bucketDates([])),
  ]);
  return {
    counts,
    courses,
    series: { id: section.id, title: section.chartTitle, points },
  };
}

function todayRange(): { fromDate: string; toDate: string } {
  const iso = startOfToday().toISOString().slice(0, 10);
  return { fromDate: iso, toDate: iso };
}

function mapArchiveRows(items: Record<string, unknown>[]): PreviewRow[] {
  return items.slice(0, PREVIEW_LIMIT).map((row, index) => ({
    id: String(row.id ?? index),
    title: String(row.name ?? row.fullName ?? '-'),
    detail: String(
      row.service ?? row.typology ?? row.course ?? row.casual ?? row.outcome ?? row.status ?? '',
    ),
    date: String(row.insertDate ?? row.insertDateDisplay ?? row.expirationDate ?? '').slice(0, 10),
  }));
}

async function previewMembers(ctx: ClubAuthContext, activeOnly: boolean): Promise<PreviewRow[]> {
  if (!activeOnly) {
    const result = await listClubMembersArchive(ctx, { page: 1, pageSize: PREVIEW_LIMIT });
    return mapArchiveRows(result.items);
  }
  const type = await prisma.procedureType.findFirst({
    where: { code: PROCEDURE_TYPE_CODES.MEMBERSHIP },
    select: { id: true },
  });
  if (!type) return [];
  const today = startOfToday();
  const rows = await prisma.procedureRecord.findMany({
    where: {
      clubId: ctx.club.id,
      procedureTypeId: type.id,
      status: ProcedureRecordStatus.ACTIVE,
      OR: [{ dueDate: null }, { dueDate: { gte: today } }],
    },
    orderBy: { recordDate: 'desc' },
    take: PREVIEW_LIMIT,
    select: {
      id: true,
      recordDate: true,
      member: { select: { name: true, firstName: true, surname: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    title:
      [row.member.firstName, row.member.surname].filter(Boolean).join(' ') || row.member.name || '-',
    detail: 'Active membership',
    date: row.recordDate.toISOString().slice(0, 10),
  }));
}

async function previewOverdue(ctx: ClubAuthContext): Promise<PreviewRow[]> {
  const today = startOfToday();
  const rows = await prisma.procedureRecord.findMany({
    where: {
      clubId: ctx.club.id,
      status: ProcedureRecordStatus.ACTIVE,
      balanceAmount: { gt: 0 },
      dueDate: { lt: today },
    },
    orderBy: { dueDate: 'asc' },
    take: PREVIEW_LIMIT,
    select: {
      id: true,
      dueDate: true,
      balanceAmount: true,
      member: { select: { name: true, firstName: true, surname: true } },
      procedureType: { select: { name: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    title:
      [row.member.firstName, row.member.surname].filter(Boolean).join(' ') || row.member.name || '-',
    detail: `${row.procedureType.name} · ${Number(row.balanceAmount).toFixed(2)}`,
    date: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : '',
  }));
}

async function previewBirthdays(clubId: string): Promise<PreviewRow[]> {
  const rows = await prisma.$queryRawUnsafe<
    { id: string; name: string; firstName: string | null; surname: string | null; birthdate: Date }[]
  >(
    `SELECT u.id, u.name, u.firstName, u.surname, u.birthdate
     FROM club_members_new cm
     INNER JOIN users_new u ON u.id = cm.memberId
     WHERE cm.clubId = ?
       AND u.birthdate IS NOT NULL
       AND MONTH(u.birthdate) = MONTH(CURDATE())
       AND DAY(u.birthdate) = DAY(CURDATE())
     LIMIT ${PREVIEW_LIMIT}`,
    clubId,
  );
  return rows.map((row) => ({
    id: row.id,
    title: [row.firstName, row.surname].filter(Boolean).join(' ') || row.name || '-',
    detail: 'Birthday',
    date: row.birthdate ? String(row.birthdate).slice(0, 10) : '',
  }));
}

async function previewUnread(userId: string): Promise<PreviewRow[]> {
  const conversations = await prisma.chatConversation.findMany({
    where: { OR: [{ user1Id: userId }, { user2Id: userId }] },
    select: { id: true, user1Id: true, user1LastReadAt: true, user2LastReadAt: true },
  });
  const rows: PreviewRow[] = [];
  for (const conversation of conversations) {
    if (rows.length >= PREVIEW_LIMIT) break;
    const lastRead =
      conversation.user1Id === userId ? conversation.user1LastReadAt : conversation.user2LastReadAt;
    const messages = await prisma.chatMessage.findMany({
      where: {
        conversationId: conversation.id,
        senderId: { not: userId },
        ...(lastRead ? { createdAt: { gt: lastRead } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: PREVIEW_LIMIT - rows.length,
      select: {
        id: true,
        content: true,
        createdAt: true,
        sender: { select: { name: true, firstName: true, surname: true } },
      },
    });
    for (const message of messages) {
      const sender =
        [message.sender.firstName, message.sender.surname].filter(Boolean).join(' ') ||
        message.sender.name;
      rows.push({
        id: message.id,
        title: sender,
        detail: message.content.replace(/\s+/g, ' ').slice(0, 120),
        date: message.createdAt.toISOString().slice(0, 10),
      });
    }
  }
  return rows;
}

async function previewProcedure(
  ctx: ClubAuthContext,
  code: string,
): Promise<PreviewRow[]> {
  const result = await procedureService.listRecords(ctx, code, { page: 1, pageSize: PREVIEW_LIMIT });
  return result.items.map((row) => {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const detail =
      String(meta.courseName ?? meta.serviceName ?? meta.productName ?? meta.debtLabel ?? '').trim() ||
      row.notes ||
      '';
    return {
      id: row.id,
      title: row.memberName || '-',
      detail,
      date: row.recordDate,
    };
  });
}

async function previewAudio(clubId: string): Promise<PreviewRow[]> {
  const rows = await prisma.chatBroadcastMessage.findMany({
    where: { clubId },
    orderBy: { createdAt: 'desc' },
    take: PREVIEW_LIMIT,
    select: { id: true, content: true, senderName: true, createdAt: true },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.senderName || 'Club',
    detail: row.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120),
    date: row.createdAt.toISOString().slice(0, 10),
  }));
}

export async function getDashboardPreview(
  ctx: ClubAuthContext,
  sectionId: string,
): Promise<{ id: string; title: string; items: PreviewRow[] }> {
  const archive = isArchiveSectionId(sectionId) ? archiveSectionById(sectionId) : undefined;
  const tile = isSummaryTileId(sectionId) ? sectionId : undefined;

  const items = await safe(sectionId, async () => {
    switch (sectionId) {
      case 'total-members':
      case 'new-members':
        return previewMembers(ctx, false);
      case 'active-members':
        return previewMembers(ctx, true);
      case 'payment-overdue':
      case 'deadlines':
        if (sectionId === 'payment-overdue') return previewOverdue(ctx);
        return mapArchiveRows((await listUnifiedDeadlines(ctx, { page: 1, pageSize: PREVIEW_LIMIT })).items);
      case 'present-today':
      case 'accesses':
        return mapArchiveRows(
          (await listAccessesArchive(ctx, { page: 1, pageSize: PREVIEW_LIMIT, ...todayRange() })).items,
        );
      case 'next-appointments':
        return mapArchiveRows(
          (
            await listReservationsArchive(ctx, {
              page: 1,
              pageSize: PREVIEW_LIMIT,
              fromDate: todayRange().fromDate,
            })
          ).items,
        );
      case 'reservations':
        return mapArchiveRows(
          (await listReservationsArchive(ctx, { page: 1, pageSize: PREVIEW_LIMIT, ...todayRange() })).items,
        );
      case 'birthdays':
        return previewBirthdays(ctx.club.id);
      case 'name-days':
        return [];
      case 'unread-messages':
        return previewUnread(ctx.userId);
      case 'memberships':
        return previewProcedure(ctx, PROCEDURE_TYPE_CODES.MEMBERSHIP);
      case 'services':
        return previewProcedure(ctx, PROCEDURE_TYPE_CODES.SERVICE_SALE);
      case 'subscriptions':
      case 'subscription-stats':
        return previewProcedure(ctx, PROCEDURE_TYPE_CODES.COURSE_SUBSCRIPTION);
      case 'credits':
        return mapArchiveRows((await listInsertCredits(ctx, { page: 1, pageSize: PREVIEW_LIMIT })).items);
      case 'payments':
        return mapArchiveRows((await listUnifiedPayments(ctx, { page: 1, pageSize: PREVIEW_LIMIT })).items);
      case 'sellings':
        return mapArchiveRows(
          (await listUnifiedProductSales(ctx, { page: 1, pageSize: PREVIEW_LIMIT })).items,
        );
      case 'audio-messages':
        return previewAudio(ctx.club.id);
      default:
        return [];
    }
  }, []);

  const label =
    archive?.label ??
    (tile === 'total-members'
      ? 'Total Members'
      : tile === 'active-members'
        ? 'Active Members'
        : tile === 'next-appointments'
          ? 'Next appointments'
          : tile === 'payment-overdue'
            ? 'Payment Overdue'
            : tile === 'present-today'
              ? 'Present Today'
              : tile === 'name-days'
                ? 'Day Names'
                : tile === 'birthdays'
                  ? 'Birth Days'
                  : tile === 'unread-messages'
                    ? 'Messages not read'
                    : sectionId);

  return { id: sectionId, title: label, items };
}
