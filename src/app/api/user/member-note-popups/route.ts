import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import {
  mergeClubScoped,
  safeJsonParse,
} from '@/lib/club/memberProfileDefaults';
import type { ClubMemberScopedData } from '@/lib/club/memberProfileTypes';

export const dynamic = 'force-dynamic';

type PopupRow = {
  id: string;
  clubMemberId: string;
  title: string;
  body: string;
  clubName: string;
  enableFrom: Date | string | null;
  enableTo: Date | string | null;
  showAtLogin: number | boolean;
  showAtLogout: number | boolean;
  kind?: string;
};

type PopupItem = {
  id: string;
  title: string;
  body: string;
  bodyIsHtml: boolean;
  clubName: string;
  enableFrom: string;
  enableTo: string;
};

type Schedule = {
  enableFrom: Date | string | null;
  enableTo: Date | string | null;
  showAtLogin: boolean;
  showAtLogout: boolean;
};

function todayYmdLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateYmd(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  // MySQL DATE / UTC-midnight values must use the UTC calendar day; otherwise
  // western timezones shift Enable From/To back one day and drop valid notices.
  const useUtc =
    d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
  const y = useUtc ? d.getUTCFullYear() : d.getFullYear();
  const m = String((useUtc ? d.getUTCMonth() : d.getMonth()) + 1).padStart(2, '0');
  const day = String(useUtc ? d.getUTCDate() : d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function inRange(from: Date | string | null, to: Date | string | null, today: string): boolean {
  const fromYmd = dateYmd(from);
  const toYmd = dateYmd(to);
  if (fromYmd && today < fromYmd) return false;
  if (toYmd && today > toYmd) return false;
  return true;
}

function htmlLooksEmpty(html: string): boolean {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return !text;
}

function noteHasOwnSchedule(row: PopupRow): boolean {
  return (
    Boolean(Number(row.showAtLogin)) ||
    Boolean(Number(row.showAtLogout)) ||
    Boolean(dateYmd(row.enableFrom)) ||
    Boolean(dateYmd(row.enableTo))
  );
}

/**
 * Active staff / coach documents for the logged-in member as login/logout popups.
 * Query: moment=login|logout
 *
 * Sources:
 * 1) Coach Notes reflections (kind=coach) with showAtLogin / showAtLogout
 * 2) Messages → Comments root staff posts (kind=staff) with those flags,
 *    or inheriting the Messages document schedule when flags were never set
 * 3) Messages document editor (staffMessage HTML)
 */
export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const decoded = verifyToken(token);
  const userId = decoded?.userId;
  if (!userId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const moment = (request.nextUrl.searchParams.get('moment') || 'login').trim().toLowerCase();
  if (moment !== 'login' && moment !== 'logout') {
    return NextResponse.json({ error: 'moment must be login or logout' }, { status: 400 });
  }

  const today = todayYmdLocal();
  const items: PopupItem[] = [];
  const seen = new Set<string>();

  const pushItem = (item: PopupItem) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    items.push(item);
  };

  const staffScheduleByMember = new Map<string, Schedule>();
  const staffVisibleByMember = new Map<string, boolean>();

  try {
    const memberships = await prisma.$queryRawUnsafe<
      { clubMemberId: string; clubName: string; profileJson: string | null }[]
    >(
      `SELECT cm.id AS clubMemberId, c.name AS clubName, p.profileJson
       FROM club_members_new cm
       INNER JOIN clubs_new c
         ON c.id COLLATE utf8mb4_unicode_ci = cm.clubId COLLATE utf8mb4_unicode_ci
       LEFT JOIN club_member_profiles p
         ON p.clubMemberId COLLATE utf8mb4_unicode_ci = cm.id COLLATE utf8mb4_unicode_ci
       WHERE cm.memberId COLLATE utf8mb4_unicode_ci = ?`,
      userId,
    );

    for (const row of memberships) {
      const scoped = mergeClubScoped(
        row.profileJson
          ? (safeJsonParse(row.profileJson, {}) as Partial<ClubMemberScopedData>)
          : undefined,
      );
      staffVisibleByMember.set(row.clubMemberId, Boolean(scoped.visibility.messagesStaff));
      const sm = scoped.staffMessage;
      staffScheduleByMember.set(row.clubMemberId, {
        enableFrom: sm.enableFrom || null,
        enableTo: sm.enableTo || null,
        showAtLogin: Boolean(sm.showAtLogin),
        showAtLogout: Boolean(sm.showAtLogout),
      });

      if (!scoped.visibility.messagesStaff) continue;

      const html = String(sm.html || '').trim();
      if (!html || htmlLooksEmpty(html)) continue;
      if (moment === 'login' && !sm.showAtLogin) continue;
      if (moment === 'logout' && !sm.showAtLogout) continue;
      if (!inRange(sm.enableFrom || null, sm.enableTo || null, today)) continue;

      pushItem({
        id: `staff-doc-${row.clubMemberId}`,
        title: 'Staff message',
        body: html,
        bodyIsHtml: true,
        clubName: row.clubName,
        enableFrom: dateYmd(sm.enableFrom) || '',
        enableTo: dateYmd(sm.enableTo) || '',
      });
    }
  } catch (e) {
    console.error('member-note-popups staffMessage query failed', e);
  }

  try {
    // COLLATE avoids utf8mb4_unicode_ci vs utf8mb4_general_ci join failures across tables.
    const noteRows = await prisma.$queryRawUnsafe<PopupRow[]>(
      `SELECT n.id, n.clubMemberId, n.title, n.body, c.name AS clubName, n.kind,
              n.enableFrom, n.enableTo, n.showAtLogin, n.showAtLogout
       FROM club_member_notes n
       INNER JOIN club_members_new cm
         ON cm.id = n.clubMemberId COLLATE utf8mb4_unicode_ci
       INNER JOIN clubs_new c
         ON c.id COLLATE utf8mb4_unicode_ci = cm.clubId COLLATE utf8mb4_unicode_ci
       WHERE cm.memberId COLLATE utf8mb4_unicode_ci = ?
         AND n.parentId IS NULL
         AND n.kind IN ('coach', 'staff')
         AND n.visibleToMember = 1
       ORDER BY n.createdAt DESC`,
      userId,
    );

    for (const row of noteRows) {
      let schedule: Schedule = {
        enableFrom: row.enableFrom,
        enableTo: row.enableTo,
        showAtLogin: Boolean(Number(row.showAtLogin)),
        showAtLogout: Boolean(Number(row.showAtLogout)),
      };

      // Older Comments posts were saved with schedule flags cleared. Fall back to
      // the Messages document schedule for that membership so they still popup.
      if (row.kind === 'staff' && !noteHasOwnSchedule(row)) {
        const inherited = staffScheduleByMember.get(String(row.clubMemberId));
        if (inherited) schedule = inherited;
        if (staffVisibleByMember.get(String(row.clubMemberId)) === false) continue;
      }

      if (moment === 'login' && !schedule.showAtLogin) continue;
      if (moment === 'logout' && !schedule.showAtLogout) continue;
      if (!inRange(schedule.enableFrom, schedule.enableTo, today)) continue;
      const body = String(row.body || '').trim();
      if (!body) continue;
      pushItem({
        id: String(row.id),
        title: row.title || (row.kind === 'staff' ? 'Staff message' : 'Coach note'),
        body,
        bodyIsHtml: /<\/?[a-z][\s\S]*>/i.test(body),
        clubName: row.clubName,
        enableFrom: dateYmd(schedule.enableFrom) || '',
        enableTo: dateYmd(schedule.enableTo) || '',
      });
    }
  } catch (e) {
    console.error('member-note-popups notes query failed', e);
    return NextResponse.json({ error: 'Failed to load popups' }, { status: 500 });
  }

  return NextResponse.json({ moment, today, items });
}
