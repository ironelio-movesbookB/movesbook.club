import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { mergeClubScoped, safeJsonParse } from '@/lib/club/memberProfileDefaults';
import type { ClubMemberScopedData } from '@/lib/club/memberProfileTypes';
import {
  DISMISS_KEY_MAX_LENGTH,
  listDismissedPopupKeys,
  memberNotePopupDismissKey,
  setPopupDismissed,
} from '@/lib/club/memberNotePopupDismissals';
import { parseSupportImageUrlsJson } from '@/lib/messages/supportImages';
import { ensureNotesTable } from '@/lib/club/memberProfileService';

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
  visibleToMember?: number | boolean;
  kind?: string;
  imageUrlsJson?: string | null;
};

type PopupItem = {
  id: string;
  kind: 'coach' | 'staff';
  title: string;
  body: string;
  bodyIsHtml: boolean;
  clubName: string;
  enableFrom: string;
  enableTo: string;
  imageUrls: string[];
  dismissKey?: string;
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
  // Prefer UTC calendar day for date-only values (midnight or noon UTC, or
  // legacy local-noon stored as a non-zero UTC hour that still maps cleanly).
  const utcH = d.getUTCHours();
  const utcM = d.getUTCMinutes();
  const utcS = d.getUTCSeconds();
  if (utcM === 0 && utcS === 0 && (utcH === 0 || utcH === 12)) {
    return d.toISOString().slice(0, 10);
  }
  // Legacy local-noon rows (e.g. 16:00Z for America/New_York): use local YMD.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
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

/** Club memberships and team memberships keep their member notes in separate tables. */
const MEMBERSHIP_SOURCES = [
  {
    store: 'club' as const,
    membershipsSql: `SELECT cm.id AS clubMemberId, c.name AS clubName, p.profileJson
       FROM club_members_new cm
       INNER JOIN clubs_new c
         ON c.id COLLATE utf8mb4_unicode_ci = cm.clubId COLLATE utf8mb4_unicode_ci
       LEFT JOIN club_member_profiles p
         ON p.clubMemberId COLLATE utf8mb4_unicode_ci = cm.id COLLATE utf8mb4_unicode_ci
       WHERE cm.memberId COLLATE utf8mb4_unicode_ci = ?`,
    notesFromSql: `FROM club_member_notes n
       INNER JOIN club_members_new cm
         ON cm.id = n.clubMemberId COLLATE utf8mb4_unicode_ci
       INNER JOIN clubs_new c
         ON c.id COLLATE utf8mb4_unicode_ci = cm.clubId COLLATE utf8mb4_unicode_ci
       WHERE cm.memberId COLLATE utf8mb4_unicode_ci = ?`,
  },
  {
    store: 'team' as const,
    membershipsSql: `SELECT tm.id AS clubMemberId, t.name AS clubName, p.profileJson
       FROM team_members_new tm
       INNER JOIN teams_new t
         ON t.id COLLATE utf8mb4_unicode_ci = tm.teamId COLLATE utf8mb4_unicode_ci
       LEFT JOIN team_member_profiles p
         ON p.teamMemberId COLLATE utf8mb4_unicode_ci = tm.id COLLATE utf8mb4_unicode_ci
       WHERE tm.athleteId COLLATE utf8mb4_unicode_ci = ?`,
    notesFromSql: `FROM team_member_notes n
       INNER JOIN team_members_new cm
         ON cm.id COLLATE utf8mb4_unicode_ci = n.clubMemberId COLLATE utf8mb4_unicode_ci
       INNER JOIN teams_new c
         ON c.id COLLATE utf8mb4_unicode_ci = cm.teamId COLLATE utf8mb4_unicode_ci
       WHERE cm.athleteId COLLATE utf8mb4_unicode_ci = ?`,
  },
];

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
 * 3) Messages document editor (staffMessage HTML) — only when that membership
 *    has no Comment posts already queued for this moment (avoids double-counting
 *    the rich-text draft plus the posted alerts that share the same schedule).
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
  const staffDocCandidates: {
    clubMemberId: string;
    clubName: string;
    html: string;
    schedule: Schedule;
  }[] = [];
  /** Memberships that already have a Comments (staff) popup for this moment. */
  const staffNotesShownForMember = new Set<string>();

  for (const source of MEMBERSHIP_SOURCES) {
    try {
      const memberships = await prisma.$queryRawUnsafe<
        { clubMemberId: string; clubName: string; profileJson: string | null }[]
      >(source.membershipsSql, userId);

      for (const row of memberships) {
        const scoped = mergeClubScoped(
          row.profileJson
            ? (safeJsonParse(row.profileJson, {}) as Partial<ClubMemberScopedData>)
            : undefined,
        );
        staffVisibleByMember.set(row.clubMemberId, Boolean(scoped.visibility.messagesStaff));
        const sm = scoped.staffMessage;
        const schedule: Schedule = {
          enableFrom: sm.enableFrom || null,
          enableTo: sm.enableTo || null,
          showAtLogin: Boolean(sm.showAtLogin),
          showAtLogout: Boolean(sm.showAtLogout),
        };
        staffScheduleByMember.set(row.clubMemberId, schedule);

        if (!scoped.visibility.messagesStaff) continue;

        const html = String(sm.html || '').trim();
        if (!html || htmlLooksEmpty(html)) continue;
        if (moment === 'login' && !sm.showAtLogin) continue;
        if (moment === 'logout' && !sm.showAtLogout) continue;
        if (!inRange(sm.enableFrom || null, sm.enableTo || null, today)) continue;

        staffDocCandidates.push({
          clubMemberId: row.clubMemberId,
          clubName: row.clubName,
          html,
          schedule,
        });
      }
    } catch (e) {
      console.error(`member-note-popups ${source.store} staffMessage query failed`, e);
    }
  }

  for (const source of MEMBERSHIP_SOURCES) {
    try {
      await ensureNotesTable(source.store);
      // COLLATE avoids utf8mb4_unicode_ci vs utf8mb4_general_ci join failures across tables.
      const noteRows = await prisma.$queryRawUnsafe<PopupRow[]>(
        `SELECT n.id, n.clubMemberId, n.title, n.body, c.name AS clubName, n.kind,
              n.enableFrom, n.enableTo, n.showAtLogin, n.showAtLogout, n.visibleToMember,
              n.imageUrlsJson
       ${source.notesFromSql}
         AND n.parentId IS NULL
         AND n.kind IN ('coach', 'staff')
         AND (
           n.visibleToMember = 1
           OR (
             n.kind = 'coach'
             AND (n.showAtLogin = 1 OR n.showAtLogout = 1)
           )
         )
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
          kind: row.kind === 'coach' ? 'coach' : 'staff',
          title: row.title || (row.kind === 'staff' ? 'Staff message' : 'Coach note'),
          body,
          bodyIsHtml: /<\/?[a-z][\s\S]*>/i.test(body),
          clubName: row.clubName,
          enableFrom: dateYmd(schedule.enableFrom) || '',
          enableTo: dateYmd(schedule.enableTo) || '',
          imageUrls: parseSupportImageUrlsJson(row.imageUrlsJson),
        });
        if (row.kind === 'staff') {
          staffNotesShownForMember.add(String(row.clubMemberId));
        }
      }
    } catch (e) {
      console.error(`member-note-popups ${source.store} notes query failed`, e);
      return NextResponse.json({ error: 'Failed to load popups' }, { status: 500 });
    }
  }

  // HTML document is a fallback only — not an extra alert on top of Comments posts.
  for (const doc of staffDocCandidates) {
    if (staffNotesShownForMember.has(doc.clubMemberId)) continue;
    pushItem({
      id: `staff-doc-${doc.clubMemberId}`,
      kind: 'staff',
      title: 'Staff message',
      body: doc.html,
      bodyIsHtml: true,
      clubName: doc.clubName,
      enableFrom: dateYmd(doc.schedule.enableFrom) || '',
      enableTo: dateYmd(doc.schedule.enableTo) || '',
      imageUrls: [],
    });
  }

  let visible = items.map((item) => ({
    ...item,
    dismissKey: memberNotePopupDismissKey(item),
  }));
  // Only the automatic popup skips dismissed items; the notices panels still list them.
  if (request.nextUrl.searchParams.get('popup') === '1') {
    try {
      const dismissed = await listDismissedPopupKeys(String(userId));
      visible = visible.filter((item) => !dismissed.has(item.dismissKey));
    } catch (e) {
      console.error('member-note-popups dismissals query failed', e);
    }
  }

  return NextResponse.json({ moment, today, items: visible });
}

/** Body: { dismissKey: string, dismissed: boolean } — "Don't display at login/logout the next time". */
export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const decoded = verifyToken(token);
  const userId = decoded?.userId;
  if (!userId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    dismissKey?: unknown;
    dismissed?: unknown;
  } | null;
  const dismissKey = typeof body?.dismissKey === 'string' ? body.dismissKey.trim() : '';
  if (!dismissKey || dismissKey.length > DISMISS_KEY_MAX_LENGTH) {
    return NextResponse.json({ error: 'dismissKey is required' }, { status: 400 });
  }
  const dismissed = body?.dismissed !== false;

  try {
    await setPopupDismissed(String(userId), dismissKey, dismissed);
    return NextResponse.json({ success: true, dismissKey, dismissed });
  } catch (e) {
    console.error('member-note-popups dismiss failed', e);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
