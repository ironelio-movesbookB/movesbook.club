import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendIonosEmail } from '@/lib/ionosEmail';
import { listClubCoaches, type CoachWorkspace } from '@/lib/club/clubCoachService';
import { coachFullName } from '@/lib/club/clubCoach.constants';
import { ensureNotesTable } from '@/lib/club/memberProfileService';
import {
  MAX_SLOTS_PER_DAY,
  TIMETABLE_DAY_KEYS,
  TIMETABLE_MINUTES_MAX,
  createDefaultSlot,
  dayHasOverlappingSlots,
} from '@/lib/clubCardTimetable';
import {
  DEADLINE_RECURRENCES,
  MAX_ANNOUNCEMENT_ATTACHMENT_BYTES,
  MAX_DEADLINES,
  WORK_GROUP_CATEGORIES,
  emptyWorkGroupTimetable,
  type WorkGroup,
  type WorkGroupAnnouncement,
  type WorkGroupAnnouncementInput,
  type WorkGroupInput,
  type WorkGroupListItem,
  type WorkGroupPaymentPlan,
  type WorkGroupPerson,
  type WorkGroupRoom,
  type WorkGroupTimetable,
} from '@/lib/club/clubWorkGroup.constants';

const GROUPS = 'club_work_groups';
const GROUP_COACHES = 'club_work_group_coaches';
const GROUP_MEMBERS = 'club_work_group_members';
const ROOMS = 'club_work_rooms';
const ANNOUNCEMENTS = 'club_work_group_announcements';

export class WorkGroupError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

let tablesReady = false;

async function ensureTables() {
  if (tablesReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`${GROUPS}\` (
      id VARCHAR(191) NOT NULL,
      workspace_kind VARCHAR(10) NOT NULL,
      workspace_id VARCHAR(191) NOT NULL,
      name VARCHAR(160) NOT NULL,
      category VARCHAR(40) NOT NULL DEFAULT 'Mixed',
      sport VARCHAR(80) NOT NULL DEFAULT '',
      season VARCHAR(20) NOT NULL DEFAULT '',
      date_from DATE NULL,
      date_to DATE NULL,
      show_in_registration TINYINT(1) NOT NULL DEFAULT 0,
      registration_note TEXT NULL,
      price DECIMAL(10,2) NULL,
      timetable_json LONGTEXT NULL,
      payment_plans_json TEXT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY club_work_groups_workspace_idx (workspace_kind, workspace_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`${GROUP_COACHES}\` (
      group_id VARCHAR(191) NOT NULL,
      coach_id VARCHAR(191) NOT NULL,
      PRIMARY KEY (group_id, coach_id),
      KEY club_work_group_coaches_coach_idx (coach_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`${GROUP_MEMBERS}\` (
      group_id VARCHAR(191) NOT NULL,
      user_id VARCHAR(191) NOT NULL,
      PRIMARY KEY (group_id, user_id),
      KEY club_work_group_members_user_idx (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`${ROOMS}\` (
      id VARCHAR(191) NOT NULL,
      workspace_kind VARCHAR(10) NOT NULL,
      workspace_id VARCHAR(191) NOT NULL,
      name VARCHAR(120) NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY club_work_rooms_workspace_name_key (workspace_kind, workspace_id, name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`${ANNOUNCEMENTS}\` (
      id VARCHAR(191) NOT NULL,
      group_id VARCHAR(191) NOT NULL,
      title VARCHAR(191) NOT NULL,
      message TEXT NOT NULL,
      send_mail TINYINT(1) NOT NULL DEFAULT 0,
      post_to_account TINYINT(1) NOT NULL DEFAULT 0,
      show_at_login TINYINT(1) NOT NULL DEFAULT 0,
      enable_from DATE NULL,
      enable_to DATE NULL,
      attachment_name VARCHAR(191) NULL,
      mailed_count INT NOT NULL DEFAULT 0,
      posted_count INT NOT NULL DEFAULT 0,
      author_id VARCHAR(191) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY club_work_group_announcements_group_idx (group_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tablesReady = true;
}

// ---------------------------------------------------------------------------
// Input parsing

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const ymdOrEmpty = (v: unknown) => (YMD.test(String(v ?? '').trim()) ? String(v).trim() : '');
const idList = (v: unknown) =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && x.length > 0))] : [];

function parseTimetable(raw: unknown): WorkGroupTimetable {
  const result = emptyWorkGroupTimetable();
  if (!raw || typeof raw !== 'object') return result;
  const source = raw as Record<string, { enabled?: unknown; slots?: unknown }>;
  for (const key of TIMETABLE_DAY_KEYS) {
    const day = source[key];
    if (!day || !day.enabled || !Array.isArray(day.slots)) continue;
    const slots = day.slots
      .slice(0, MAX_SLOTS_PER_DAY)
      .map((s: { rangeStart?: unknown; rangeEnd?: unknown; room?: unknown }) => {
        const start = Math.max(0, Math.min(TIMETABLE_MINUTES_MAX, Math.round(Number(s?.rangeStart) || 0)));
        const end = Math.max(0, Math.min(TIMETABLE_MINUTES_MAX, Math.round(Number(s?.rangeEnd) || 0)));
        return { ...createDefaultSlot(start, end), room: str(s?.room, 191) };
      })
      .filter((s) => s.rangeEnd > s.rangeStart)
      .sort((a, b) => a.rangeStart - b.rangeStart);
    if (slots.length === 0) continue;
    if (dayHasOverlappingSlots(slots)) throw new WorkGroupError('Training sessions on the same day cannot overlap', 400);
    result[key] = { enabled: true, slots };
  }
  return result;
}

function parsePaymentPlans(raw: unknown): WorkGroupPaymentPlan[] {
  if (!Array.isArray(raw)) return [];
  const months = DEADLINE_RECURRENCES.map((r) => r.months as number);
  return raw.slice(0, 20).map((p) => {
    const recurrence = Number(p?.recurrenceMonths);
    const count = Math.round(Number(p?.count));
    const cost = Math.round(Number(p?.costEach) * 100) / 100;
    if (!months.includes(recurrence)) throw new WorkGroupError('Select how often the deadlines repeat', 400);
    if (!Number.isFinite(count) || count < 1 || count > MAX_DEADLINES) {
      throw new WorkGroupError('The number of deadlines must be between 1 and 36', 400);
    }
    if (!Number.isFinite(cost) || cost <= 0) throw new WorkGroupError('Enter the cost of each deadline', 400);
    const firstDate = ymdOrEmpty(p?.firstDate);
    if (!firstDate) throw new WorkGroupError('Enter the date of the first deadline', 400);
    return {
      id: str(p?.id, 64) || randomUUID(),
      recurrenceMonths: recurrence as 1 | 2 | 3,
      count,
      costEach: cost,
      firstDate,
      showStatusAtCallUp: Boolean(p?.showStatusAtCallUp),
    };
  });
}

export function parseWorkGroupInput(body: Record<string, unknown>): WorkGroupInput {
  const name = str(body.name, 160);
  if (!name) throw new WorkGroupError('Group name is required', 400);
  const category = str(body.category, 40);
  const dateFrom = ymdOrEmpty(body.dateFrom);
  const dateTo = ymdOrEmpty(body.dateTo);
  if (dateFrom && dateTo && dateTo < dateFrom) {
    throw new WorkGroupError('The end date must be after the start date', 400);
  }
  const priceRaw = String(body.price ?? '').trim().replace(',', '.');
  const price = priceRaw === '' ? '' : Number(priceRaw);
  if (price !== '' && (!Number.isFinite(price) || price < 0)) throw new WorkGroupError('Enter a valid price', 400);
  return {
    name,
    category: (WORK_GROUP_CATEGORIES as readonly string[]).includes(category) ? category : 'Mixed',
    sport: str(body.sport, 80),
    season: str(body.season, 20),
    dateFrom,
    dateTo,
    showInRegistration: Boolean(body.showInRegistration),
    registrationNote: str(body.registrationNote, 5000),
    price: price === '' ? '' : price.toFixed(2),
    timetable: parseTimetable(body.timetable),
    paymentPlans: parsePaymentPlans(body.paymentPlans),
    coachIds: idList(body.coachIds),
    memberIds: idList(body.memberIds),
  };
}

// ---------------------------------------------------------------------------
// People of the workspace

type UserLite = {
  id: string;
  username: string;
  firstName: string | null;
  surname: string | null;
  name: string | null;
  email: string;
  image: string | null;
};

const USER_SELECT = { id: true, username: true, firstName: true, surname: true, name: true, email: true, image: true } as const;

function personName(u: UserLite): string {
  const full = [u.surname, u.firstName].filter((v) => v && v.trim()).join(' ').trim();
  return full || u.name?.trim() || u.username;
}

const toPerson = (u: UserLite): WorkGroupPerson => ({ id: u.id, name: personName(u), username: u.username, image: u.image });

/** user id → membership row id (club_members_new / team_members_new) for this workspace. */
async function workspaceMemberships(ws: CoachWorkspace, userIds?: string[]): Promise<Map<string, string>> {
  const filter = userIds ? { in: userIds } : undefined;
  if (ws.kind === 'team') {
    const rows = await prisma.teamMember.findMany({
      where: { teamId: ws.id, ...(filter ? { athleteId: filter } : {}) },
      select: { id: true, athleteId: true },
    });
    return new Map(rows.map((r) => [r.athleteId, r.id]));
  }
  const rows = await prisma.clubMember.findMany({
    where: { clubId: ws.id, ...(filter ? { memberId: filter } : {}) },
    select: { id: true, memberId: true },
  });
  return new Map(rows.map((r) => [r.memberId, r.id]));
}

export async function searchWorkspaceMembers(ws: CoachWorkspace, query: string): Promise<WorkGroupPerson[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const memberships = await workspaceMemberships(ws);
  if (memberships.size === 0) return [];
  const users = await prisma.user.findMany({
    where: {
      id: { in: [...memberships.keys()] },
      OR: [
        { username: { contains: q } },
        { email: { contains: q } },
        { firstName: { contains: q } },
        { surname: { contains: q } },
        { name: { contains: q } },
      ],
    },
    select: USER_SELECT,
    take: 20,
    orderBy: { username: 'asc' },
  });
  return users.map(toPerson);
}

async function activeCoaches(ws: CoachWorkspace): Promise<WorkGroupPerson[]> {
  const coaches = await listClubCoaches(ws, 'active');
  return coaches.map((c) => ({ id: c.id, name: coachFullName(c), image: c.image }));
}

export async function workGroupMeta(ws: CoachWorkspace) {
  await ensureTables();
  const [coaches, rooms] = await Promise.all([activeCoaches(ws), listRooms(ws)]);
  return { workspace: ws, coaches, rooms };
}

// ---------------------------------------------------------------------------
// Rooms

export async function listRooms(ws: CoachWorkspace): Promise<WorkGroupRoom[]> {
  await ensureTables();
  return prisma.$queryRawUnsafe<WorkGroupRoom[]>(
    `SELECT id, name FROM \`${ROOMS}\` WHERE workspace_kind = ? AND workspace_id = ? ORDER BY name`,
    ws.kind,
    ws.id,
  );
}

export async function addRoom(ws: CoachWorkspace, rawName: unknown): Promise<WorkGroupRoom> {
  await ensureTables();
  const name = str(rawName, 120);
  if (!name) throw new WorkGroupError('Room name is required', 400);
  const existing = (await listRooms(ws)).find((r) => r.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO \`${ROOMS}\` (id, workspace_kind, workspace_id, name) VALUES (?, ?, ?, ?)`,
    id,
    ws.kind,
    ws.id,
    name,
  );
  return { id, name };
}

// ---------------------------------------------------------------------------
// Groups

type GroupRow = {
  id: string;
  name: string;
  category: string;
  sport: string;
  season: string;
  date_from: Date | null;
  date_to: Date | null;
  show_in_registration: number | boolean;
  registration_note: string | null;
  price: string | number | null;
  timetable_json: string | null;
  payment_plans_json: string | null;
  created_at: Date;
};

const isoDate = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function getGroupRow(ws: CoachWorkspace, id: string): Promise<GroupRow> {
  await ensureTables();
  const rows = await prisma.$queryRawUnsafe<GroupRow[]>(
    `SELECT * FROM \`${GROUPS}\` WHERE id = ? AND workspace_kind = ? AND workspace_id = ? LIMIT 1`,
    id,
    ws.kind,
    ws.id,
  );
  if (!rows[0]) throw new WorkGroupError('Group not found', 404);
  return rows[0];
}

async function linkedIds(table: string, column: string, groupIds: string[]) {
  if (groupIds.length === 0) return [] as { group_id: string; id: string }[];
  return prisma.$queryRawUnsafe<{ group_id: string; id: string }[]>(
    `SELECT group_id, ${column} AS id FROM \`${table}\` WHERE group_id IN (${groupIds.map(() => '?').join(', ')})`,
    ...groupIds,
  );
}

export async function listWorkGroups(ws: CoachWorkspace): Promise<WorkGroupListItem[]> {
  await ensureTables();
  const rows = await prisma.$queryRawUnsafe<GroupRow[]>(
    `SELECT * FROM \`${GROUPS}\` WHERE workspace_kind = ? AND workspace_id = ? ORDER BY name`,
    ws.kind,
    ws.id,
  );
  const ids = rows.map((r) => r.id);
  const [memberLinks, coachLinks, coaches, memberships] = await Promise.all([
    linkedIds(GROUP_MEMBERS, 'user_id', ids),
    linkedIds(GROUP_COACHES, 'coach_id', ids),
    activeCoaches(ws),
    workspaceMemberships(ws),
  ]);
  const coachNames = new Map(coaches.map((c) => [c.id, c.name]));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    sport: r.sport,
    season: r.season,
    dateFrom: isoDate(r.date_from),
    dateTo: isoDate(r.date_to),
    createdAt: new Date(r.created_at).toISOString(),
    // Members who left the club/team are not counted.
    memberCount: memberLinks.filter((l) => l.group_id === r.id && memberships.has(l.id)).length,
    coachNames: coachLinks
      .filter((l) => l.group_id === r.id)
      .map((l) => coachNames.get(l.id))
      .filter((n): n is string => Boolean(n)),
  }));
}

export async function getWorkGroup(ws: CoachWorkspace, id: string): Promise<WorkGroup> {
  const row = await getGroupRow(ws, id);
  const [memberLinks, coachLinks, coaches, memberships] = await Promise.all([
    linkedIds(GROUP_MEMBERS, 'user_id', [id]),
    linkedIds(GROUP_COACHES, 'coach_id', [id]),
    activeCoaches(ws),
    workspaceMemberships(ws),
  ]);
  const memberIds = memberLinks.map((l) => l.id).filter((uid) => memberships.has(uid));
  const users = memberIds.length
    ? await prisma.user.findMany({ where: { id: { in: memberIds } }, select: USER_SELECT })
    : [];
  const coachById = new Map(coaches.map((c) => [c.id, c]));
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    sport: row.sport,
    season: row.season,
    dateFrom: isoDate(row.date_from),
    dateTo: isoDate(row.date_to),
    showInRegistration: Boolean(Number(row.show_in_registration)),
    registrationNote: row.registration_note ?? '',
    price: row.price == null ? '' : Number(row.price).toFixed(2),
    timetable: (() => {
      try {
        return parseTimetable(parseJson(row.timetable_json));
      } catch {
        return emptyWorkGroupTimetable();
      }
    })(),
    paymentPlans: (() => {
      try {
        return parsePaymentPlans(parseJson(row.payment_plans_json));
      } catch {
        return [];
      }
    })(),
    coaches: coachLinks.map((l) => coachById.get(l.id)).filter((c): c is WorkGroupPerson => Boolean(c)),
    members: users.map(toPerson).sort((a, b) => a.name.localeCompare(b.name)),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function assertLinks(ws: CoachWorkspace, input: WorkGroupInput) {
  if (input.coachIds.length) {
    const coachIds = new Set((await activeCoaches(ws)).map((c) => c.id));
    if (input.coachIds.some((id) => !coachIds.has(id))) {
      throw new WorkGroupError('Select coaches from the list of coaches', 400);
    }
  }
  if (input.memberIds.length) {
    const memberships = await workspaceMemberships(ws, input.memberIds);
    if (input.memberIds.some((id) => !memberships.has(id))) {
      throw new WorkGroupError(
        ws.kind === 'team' ? 'Select athletes among the members of the team' : 'Select athletes among the members of the club',
        400,
      );
    }
  }
  const roomIds = new Set((await listRooms(ws)).map((r) => r.id));
  for (const key of TIMETABLE_DAY_KEYS) {
    for (const slot of input.timetable[key].slots) {
      if (slot.room && !roomIds.has(slot.room)) throw new WorkGroupError('Select a valid room', 400);
    }
  }
}

async function replaceLinks(groupId: string, table: string, column: string, ids: string[]) {
  await prisma.$executeRawUnsafe(`DELETE FROM \`${table}\` WHERE group_id = ?`, groupId);
  if (ids.length === 0) return;
  await prisma.$executeRawUnsafe(
    `INSERT INTO \`${table}\` (group_id, ${column}) VALUES ${ids.map(() => '(?, ?)').join(', ')}`,
    ...ids.flatMap((id) => [groupId, id]),
  );
}

function groupValues(input: WorkGroupInput) {
  return [
    input.name,
    input.category,
    input.sport,
    input.season,
    input.dateFrom || null,
    input.dateTo || null,
    input.showInRegistration ? 1 : 0,
    input.registrationNote || null,
    input.price === '' ? null : input.price,
    JSON.stringify(input.timetable),
    JSON.stringify(input.paymentPlans),
  ];
}

export async function createWorkGroup(ws: CoachWorkspace, input: WorkGroupInput): Promise<WorkGroup> {
  await ensureTables();
  await assertLinks(ws, input);
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO \`${GROUPS}\` (id, workspace_kind, workspace_id, name, category, sport, season, date_from, date_to,
      show_in_registration, registration_note, price, timetable_json, payment_plans_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    ws.kind,
    ws.id,
    ...groupValues(input),
  );
  await replaceLinks(id, GROUP_COACHES, 'coach_id', input.coachIds);
  await replaceLinks(id, GROUP_MEMBERS, 'user_id', input.memberIds);
  return getWorkGroup(ws, id);
}

export async function updateWorkGroup(ws: CoachWorkspace, id: string, input: WorkGroupInput): Promise<WorkGroup> {
  await getGroupRow(ws, id);
  await assertLinks(ws, input);
  await prisma.$executeRawUnsafe(
    `UPDATE \`${GROUPS}\` SET name = ?, category = ?, sport = ?, season = ?, date_from = ?, date_to = ?,
      show_in_registration = ?, registration_note = ?, price = ?, timetable_json = ?, payment_plans_json = ?,
      updated_at = CURRENT_TIMESTAMP(3)
     WHERE id = ? AND workspace_kind = ? AND workspace_id = ?`,
    ...groupValues(input),
    id,
    ws.kind,
    ws.id,
  );
  await replaceLinks(id, GROUP_COACHES, 'coach_id', input.coachIds);
  await replaceLinks(id, GROUP_MEMBERS, 'user_id', input.memberIds);
  return getWorkGroup(ws, id);
}

export async function deleteWorkGroups(ws: CoachWorkspace, ids: string[]) {
  await ensureTables();
  if (ids.length === 0) throw new WorkGroupError('Select at least one group', 400);
  const owned = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM \`${GROUPS}\` WHERE workspace_kind = ? AND workspace_id = ? AND id IN (${ids.map(() => '?').join(', ')})`,
    ws.kind,
    ws.id,
    ...ids,
  );
  const ownedIds = owned.map((r) => r.id);
  if (ownedIds.length === 0) return { deleted: 0 };
  const marks = ownedIds.map(() => '?').join(', ');
  for (const table of [GROUP_COACHES, GROUP_MEMBERS, ANNOUNCEMENTS]) {
    await prisma.$executeRawUnsafe(`DELETE FROM \`${table}\` WHERE group_id IN (${marks})`, ...ownedIds);
  }
  const deleted = await prisma.$executeRawUnsafe(`DELETE FROM \`${GROUPS}\` WHERE id IN (${marks})`, ...ownedIds);
  return { deleted };
}

// ---------------------------------------------------------------------------
// Announcements

type AnnouncementRow = {
  id: string;
  title: string;
  message: string;
  send_mail: number | boolean;
  post_to_account: number | boolean;
  show_at_login: number | boolean;
  enable_from: Date | null;
  enable_to: Date | null;
  attachment_name: string | null;
  mailed_count: number;
  posted_count: number;
  created_at: Date;
};

const toAnnouncement = (r: AnnouncementRow): WorkGroupAnnouncement => ({
  id: r.id,
  title: r.title,
  message: r.message,
  sendMail: Boolean(Number(r.send_mail)),
  postToAccount: Boolean(Number(r.post_to_account)),
  showAtLogin: Boolean(Number(r.show_at_login)),
  enableFrom: isoDate(r.enable_from),
  enableTo: isoDate(r.enable_to),
  attachmentName: r.attachment_name ?? '',
  mailedCount: Number(r.mailed_count) || 0,
  postedCount: Number(r.posted_count) || 0,
  createdAt: new Date(r.created_at).toISOString(),
});

export async function listAnnouncements(ws: CoachWorkspace, groupId: string): Promise<WorkGroupAnnouncement[]> {
  await getGroupRow(ws, groupId);
  const rows = await prisma.$queryRawUnsafe<AnnouncementRow[]>(
    `SELECT * FROM \`${ANNOUNCEMENTS}\` WHERE group_id = ? ORDER BY created_at DESC`,
    groupId,
  );
  return rows.map(toAnnouncement);
}

export function parseAnnouncementInput(body: Record<string, unknown>): WorkGroupAnnouncementInput {
  const title = str(body.title, 191);
  const message = String(body.message ?? '').trim().slice(0, 10000);
  if (!title) throw new WorkGroupError('Announcement title is required', 400);
  if (!message) throw new WorkGroupError('Message is required', 400);
  const sendMail = Boolean(body.sendMail);
  const postToAccount = Boolean(body.postToAccount);
  if (!sendMail && !postToAccount) {
    throw new WorkGroupError('Choose to send the announcement by mail, post it in the member account, or both', 400);
  }
  const showAtLogin = postToAccount && Boolean(body.showAtLogin);
  const enableFrom = ymdOrEmpty(body.enableFrom);
  const enableTo = ymdOrEmpty(body.enableTo);
  if (showAtLogin && (!enableFrom || !enableTo)) {
    throw new WorkGroupError('Enter the dates from and to for displaying the announcement at login', 400);
  }
  if (enableFrom && enableTo && enableTo < enableFrom) {
    throw new WorkGroupError('The end date must be after the start date', 400);
  }
  let attachment: WorkGroupAnnouncementInput['attachment'] = null;
  const raw = body.attachment as { name?: unknown; type?: unknown; base64?: unknown } | null | undefined;
  if (raw && typeof raw.base64 === 'string' && raw.base64) {
    if (Buffer.byteLength(raw.base64, 'base64') > MAX_ANNOUNCEMENT_ATTACHMENT_BYTES) {
      throw new WorkGroupError('The attachment cannot be larger than 2MB', 400);
    }
    attachment = { name: str(raw.name, 191) || 'attachment', type: str(raw.type, 120), base64: raw.base64 };
  }
  return { title, message, sendMail, postToAccount, showAtLogin, enableFrom, enableTo, attachment };
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const messageHtml = (message: string) =>
  message
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');

/** Emails of the member and of the parents saved in the member's club/team profile. */
async function recipientEmails(ws: CoachWorkspace, memberships: Map<string, string>): Promise<string[]> {
  const userIds = [...memberships.keys()];
  if (userIds.length === 0) return [];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { email: true } });
  const linkIds = [...memberships.values()];
  const profiles = await prisma.$queryRawUnsafe<{ profileJson: string | null }[]>(
    ws.kind === 'team'
      ? `SELECT profileJson FROM team_member_profiles WHERE teamMemberId IN (${linkIds.map(() => '?').join(', ')})`
      : `SELECT profileJson FROM club_member_profiles WHERE clubMemberId IN (${linkIds.map(() => '?').join(', ')})`,
    ...linkIds,
  ).catch(() => []);
  const emails = users.map((u) => u.email);
  for (const p of profiles) {
    const parents = (parseJson(p.profileJson) as { parents?: Record<string, { mainEmail?: string }> } | null)?.parents;
    for (const slot of ['parent1', 'parent2']) {
      const mail = parents?.[slot]?.mainEmail;
      if (typeof mail === 'string') emails.push(mail);
    }
  }
  const valid = emails.map((e) => String(e ?? '').trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  return [...new Set(valid)];
}

export async function sendAnnouncement(
  ws: CoachWorkspace,
  groupId: string,
  input: WorkGroupAnnouncementInput,
  authorId: string,
): Promise<WorkGroupAnnouncement & { mailFailed: number }> {
  const group = await getWorkGroup(ws, groupId);
  const memberships = await workspaceMemberships(ws, group.members.map((m) => m.id));
  if (memberships.size === 0) throw new WorkGroupError('Add at least one athlete to the group first', 400);

  let postedCount = 0;
  if (input.postToAccount) {
    const store = ws.kind === 'team' ? 'team' : 'club';
    await ensureNotesTable(store);
    const table = store === 'team' ? 'team_member_notes' : 'club_member_notes';
    const now = new Date();
    const asDate = (ymd: string) => (ymd ? new Date(`${ymd}T00:00:00.000Z`) : null);
    // A staff note without any schedule inherits the member's Messages popup schedule
    // (member-note-popups), so posts not meant for login always get a start date.
    const enableFrom = input.enableFrom || (input.showAtLogin ? '' : now.toISOString().slice(0, 10));
    for (const linkId of memberships.values()) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO ${table} (id, clubMemberId, kind, title, body, authorId, parentId, visibleToMember, commentsEnabled,
          enableFrom, enableTo, showAtLogin, showAtLogout, imageUrlsJson, createdAt, updatedAt)
         VALUES (?, ?, 'staff', ?, ?, ?, NULL, 1, 0, ?, ?, ?, 0, NULL, ?, ?)`,
        randomUUID(),
        linkId,
        `${group.name}: ${input.title}`.slice(0, 191),
        messageHtml(input.message),
        authorId,
        asDate(enableFrom),
        asDate(input.enableTo),
        input.showAtLogin ? 1 : 0,
        now,
        now,
      );
      postedCount += 1;
    }
  }

  let mailedCount = 0;
  let mailFailed = 0;
  if (input.sendMail) {
    const emails = await recipientEmails(ws, memberships);
    const attachments = input.attachment
      ? [{
          filename: input.attachment.name,
          content: Buffer.from(input.attachment.base64, 'base64'),
          contentType: input.attachment.type || undefined,
        }]
      : undefined;
    const html = `<p><strong>${escapeHtml(ws.name)} · ${escapeHtml(group.name)}</strong></p>${messageHtml(input.message)}`;
    for (const to of emails) {
      try {
        await sendIonosEmail({ to, subject: input.title, html, text: input.message, attachments });
        mailedCount += 1;
      } catch (e) {
        mailFailed += 1;
        console.error('Work group announcement mail failed', to, e);
      }
    }
  }

  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO \`${ANNOUNCEMENTS}\` (id, group_id, title, message, send_mail, post_to_account, show_at_login,
      enable_from, enable_to, attachment_name, mailed_count, posted_count, author_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    groupId,
    input.title,
    input.message,
    input.sendMail ? 1 : 0,
    input.postToAccount ? 1 : 0,
    input.showAtLogin ? 1 : 0,
    input.enableFrom || null,
    input.enableTo || null,
    input.attachment?.name ?? null,
    mailedCount,
    postedCount,
    authorId,
  );
  const [row] = await prisma.$queryRawUnsafe<AnnouncementRow[]>(`SELECT * FROM \`${ANNOUNCEMENTS}\` WHERE id = ?`, id);
  return { ...toAnnouncement(row), mailFailed };
}
