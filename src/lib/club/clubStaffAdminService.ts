import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import type { ClubAuthContext } from '@/lib/procedures/types';
import { listClubCoaches, type CoachWorkspace } from '@/lib/club/clubCoachService';
import { listWorkGroups } from '@/lib/club/clubWorkGroupService';
import {
  EMPTY_STAFF_DETAILS,
  REMUNERATION_KINDS,
  REMUNERATION_PAYMENT_TYPES,
  STAFF_DETAILS_DATE_KEYS,
  STAFF_DETAILS_FLAG_KEYS,
  STAFF_DETAILS_TEXT_LIMITS,
  isStaffCompanyRole,
  type RemunerationKind,
  type StaffDetails,
  type StaffGroupLink,
  type StaffGroupOption,
  type StaffRemuneration,
  type StaffRemunerationInput,
} from '@/lib/club/clubStaffAdmin.constants';

const DETAILS = 'club_staff_details';
const COUNTERS = 'club_member_number_counters';
const GROUP_ROLES = 'club_staff_group_roles';
const REMUNERATIONS = 'club_staff_remunerations';

export class StaffAdminError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function staffWorkspace(ctx: ClubAuthContext): CoachWorkspace {
  if (ctx.workspaceKind !== 'club' && ctx.workspaceKind !== 'team') {
    throw new StaffAdminError('Staff is managed from a Club or Team', 403);
  }
  return { kind: ctx.workspaceKind, id: ctx.club.id, name: ctx.club.name };
}

let tablesReady = false;

async function ensureTables() {
  if (tablesReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`${DETAILS}\` (
      staff_id VARCHAR(191) NOT NULL,
      workspace_kind VARCHAR(10) NOT NULL,
      workspace_id VARCHAR(191) NOT NULL,
      details_json TEXT NOT NULL,
      member_number VARCHAR(40) NULL,
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (staff_id),
      KEY club_staff_details_workspace_idx (workspace_kind, workspace_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`${COUNTERS}\` (
      workspace_kind VARCHAR(10) NOT NULL,
      workspace_id VARCHAR(191) NOT NULL,
      last_number INT NOT NULL DEFAULT 0,
      PRIMARY KEY (workspace_kind, workspace_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`${GROUP_ROLES}\` (
      id VARCHAR(191) NOT NULL,
      workspace_kind VARCHAR(10) NOT NULL,
      workspace_id VARCHAR(191) NOT NULL,
      staff_id VARCHAR(191) NOT NULL,
      group_id VARCHAR(191) NOT NULL,
      role VARCHAR(80) NOT NULL DEFAULT '',
      notes TEXT NULL,
      assigned_at DATE NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY club_staff_group_roles_staff_group_key (staff_id, group_id),
      KEY club_staff_group_roles_workspace_idx (workspace_kind, workspace_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`${REMUNERATIONS}\` (
      id VARCHAR(191) NOT NULL,
      workspace_kind VARCHAR(10) NOT NULL,
      workspace_id VARCHAR(191) NOT NULL,
      staff_id VARCHAR(191) NOT NULL,
      paid_on DATE NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      kind VARCHAR(20) NOT NULL,
      payment_type VARCHAR(40) NOT NULL DEFAULT '',
      notes TEXT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY club_staff_remunerations_staff_idx (staff_id, paid_on)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tablesReady = true;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const ymdOrEmpty = (v: unknown) => (YMD.test(String(v ?? '').trim()) ? String(v).trim() : '');
const isoDate = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');

function parseJson(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** Normalised details; also used to read stored JSON so new keys get defaults. */
export function parseStaffDetails(raw: unknown): StaffDetails {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const details: StaffDetails = { ...EMPTY_STAFF_DETAILS };
  for (const [key, max] of Object.entries(STAFF_DETAILS_TEXT_LIMITS) as [keyof StaffDetails, number][]) {
    if (o[key] !== undefined) (details as Record<string, unknown>)[key] = str(o[key], max);
  }
  for (const key of STAFF_DETAILS_DATE_KEYS) details[key] = ymdOrEmpty(o[key]);
  for (const key of STAFF_DETAILS_FLAG_KEYS) {
    if (o[key] !== undefined) details[key] = Boolean(o[key]);
  }
  details.taxCode = details.taxCode.toUpperCase().replace(/\s+/g, '');
  details.iban = details.iban.toUpperCase().replace(/\s+/g, '');
  return details;
}

export function validateStaffDetails(details: StaffDetails) {
  if (!details.taxCode) throw new StaffAdminError('Tax code is required', 400);
  if (details.companyRole && !isStaffCompanyRole(details.companyRole)) {
    throw new StaffAdminError('Select a valid company role', 400);
  }
  if (details.activityStart && details.activityEnd && details.activityEnd < details.activityStart) {
    throw new StaffAdminError('The end of activity must be after the start', 400);
  }
  if (details.hireDate && details.contractExpiry && details.contractExpiry < details.hireDate) {
    throw new StaffAdminError('The contract expiry must be after the hiring date', 400);
  }
  if (!details.isMember) {
    details.memberNumber = '';
  } else if (!details.memberNumber) {
    throw new StaffAdminError('Enter the member number', 400);
  }
}

export async function getStaffDetails(ws: CoachWorkspace, staffId: string): Promise<StaffDetails> {
  await ensureTables();
  const rows = await prisma.$queryRawUnsafe<{ details_json: string }[]>(
    `SELECT details_json FROM \`${DETAILS}\` WHERE staff_id = ? AND workspace_kind = ? AND workspace_id = ?`,
    staffId,
    ws.kind,
    ws.id,
  );
  return rows[0] ? parseStaffDetails(parseJson(rows[0].details_json)) : { ...EMPTY_STAFF_DETAILS };
}

export async function listStaffDetails(ws: CoachWorkspace): Promise<Map<string, StaffDetails>> {
  await ensureTables();
  const rows = await prisma.$queryRawUnsafe<{ staff_id: string; details_json: string }[]>(
    `SELECT staff_id, details_json FROM \`${DETAILS}\` WHERE workspace_kind = ? AND workspace_id = ?`,
    ws.kind,
    ws.id,
  );
  return new Map(rows.map((r) => [r.staff_id, parseStaffDetails(parseJson(r.details_json))]));
}

/** Checks done before the staff account itself is written, so a bad member number never half-saves. */
export async function assertStaffDetailsSavable(ws: CoachWorkspace, staffId: string | null, details: StaffDetails) {
  validateStaffDetails(details);
  if (!details.memberNumber) return;
  await ensureTables();
  const taken = await prisma.$queryRawUnsafe<{ staff_id: string }[]>(
    `SELECT staff_id FROM \`${DETAILS}\` WHERE workspace_kind = ? AND workspace_id = ? AND member_number = ?`,
    ws.kind,
    ws.id,
    details.memberNumber,
  );
  if (taken.some((r) => r.staff_id !== staffId)) {
    throw new StaffAdminError('This member number is already used by another component of the staff', 409);
  }
}

export async function saveStaffDetails(ws: CoachWorkspace, staffId: string, details: StaffDetails) {
  await ensureTables();
  await prisma.$executeRawUnsafe(
    `INSERT INTO \`${DETAILS}\` (staff_id, workspace_kind, workspace_id, details_json, member_number, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE details_json = VALUES(details_json), member_number = VALUES(member_number), updated_at = VALUES(updated_at)`,
    staffId,
    ws.kind,
    ws.id,
    JSON.stringify(details),
    details.memberNumber || null,
    new Date(),
  );
  const n = Number(details.memberNumber);
  if (details.isMember && details.storeMemberNumber && Number.isInteger(n) && n > 0) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO \`${COUNTERS}\` (workspace_kind, workspace_id, last_number) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE last_number = GREATEST(last_number, VALUES(last_number))`,
      ws.kind,
      ws.id,
      n,
    );
  }
}

/** Member numbers typed in the athletes' profiles and the coaches' records share the same register. */
async function memberAndCoachNumbers(ws: CoachWorkspace): Promise<string[]> {
  const profiles =
    ws.kind === 'team'
      ? await prisma.teamMember.findMany({ where: { teamId: ws.id }, select: { profile: { select: { profileJson: true } } } })
      : await prisma.clubMember.findMany({ where: { clubId: ws.id }, select: { profile: { select: { profileJson: true } } } });
  const coaches = await listClubCoaches(ws, 'all');
  return [
    ...profiles.map((p) => {
      const other = parseJson(p.profile?.profileJson).otherDetails as Record<string, unknown> | undefined;
      return String(other?.membershipRegistrationNumber ?? '');
    }),
    ...coaches.map((c) => c.membershipNumber),
  ];
}

/** Next number of the progressive member counter (stored counter and numbers already in use). */
export async function nextMemberNumber(ws: CoachWorkspace): Promise<number> {
  await ensureTables();
  const [counter, used, others] = await Promise.all([
    prisma.$queryRawUnsafe<{ last_number: number }[]>(
      `SELECT last_number FROM \`${COUNTERS}\` WHERE workspace_kind = ? AND workspace_id = ?`,
      ws.kind,
      ws.id,
    ),
    prisma.$queryRawUnsafe<{ member_number: string }[]>(
      `SELECT member_number FROM \`${DETAILS}\` WHERE workspace_kind = ? AND workspace_id = ? AND member_number IS NOT NULL`,
      ws.kind,
      ws.id,
    ),
    memberAndCoachNumbers(ws),
  ]);
  const usedMax = [...used.map((r) => r.member_number), ...others].reduce((max, value) => {
    const n = Number(String(value ?? '').trim());
    return Number.isInteger(n) && n > max ? n : max;
  }, 0);
  return Math.max(Number(counter[0]?.last_number ?? 0), usedMax) + 1;
}

export async function deleteStaffAdminData(ws: CoachWorkspace, staffIds: string[]) {
  if (staffIds.length === 0) return;
  await ensureTables();
  const marks = staffIds.map(() => '?').join(', ');
  for (const table of [DETAILS, GROUP_ROLES, REMUNERATIONS]) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM \`${table}\` WHERE workspace_kind = ? AND workspace_id = ? AND staff_id IN (${marks})`,
      ws.kind,
      ws.id,
      ...staffIds,
    );
  }
}

// ---------------------------------------------------------------------------
// Staff of the workspace (club_staff / team_staff) with display names

type StaffPerson = { id: string; name: string; username: string };

export async function listStaffPeople(ws: CoachWorkspace): Promise<Map<string, StaffPerson>> {
  const select = { id: true, user: { select: { username: true, name: true, firstName: true, surname: true } } };
  const rows =
    ws.kind === 'team'
      ? await prisma.teamStaff.findMany({ where: { teamId: ws.id }, select })
      : await prisma.clubStaff.findMany({ where: { clubId: ws.id }, select });
  return new Map(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        username: r.user.username,
        name: [r.user.surname, r.user.firstName].filter(Boolean).join(' ').trim() || r.user.name || r.user.username,
      },
    ]),
  );
}

export async function assertStaffInWorkspace(ws: CoachWorkspace, staffId: string) {
  const people = await listStaffPeople(ws);
  if (!people.has(staffId)) throw new StaffAdminError('Staff member not found', 404);
}

// ---------------------------------------------------------------------------
// Groups & roles associated

export async function listStaffGroupOptions(ws: CoachWorkspace): Promise<StaffGroupOption[]> {
  const groups = await listWorkGroups(ws);
  return groups.map((g) => ({ id: g.id, name: g.name })).sort((a, b) => a.name.localeCompare(b.name));
}

type GroupRoleRow = {
  id: string;
  staff_id: string;
  group_id: string;
  role: string;
  notes: string | null;
  assigned_at: Date;
};

/** Links of one staff member, or of the whole workspace for the Groups & roles grid. */
export async function listStaffGroupLinks(ws: CoachWorkspace, staffId?: string): Promise<StaffGroupLink[]> {
  await ensureTables();
  const [rows, groups, people] = await Promise.all([
    prisma.$queryRawUnsafe<GroupRoleRow[]>(
      `SELECT id, staff_id, group_id, role, notes, assigned_at FROM \`${GROUP_ROLES}\`
       WHERE workspace_kind = ? AND workspace_id = ?${staffId ? ' AND staff_id = ?' : ''}
       ORDER BY assigned_at DESC, created_at DESC`,
      ws.kind,
      ws.id,
      ...(staffId ? [staffId] : []),
    ),
    listStaffGroupOptions(ws),
    listStaffPeople(ws),
  ]);
  const groupNames = new Map(groups.map((g) => [g.id, g.name]));
  return rows
    .filter((r) => people.has(r.staff_id) && groupNames.has(r.group_id))
    .map((r) => ({
      id: r.id,
      staffId: r.staff_id,
      staffName: people.get(r.staff_id)!.name,
      username: people.get(r.staff_id)!.username,
      groupId: r.group_id,
      groupName: groupNames.get(r.group_id)!,
      role: r.role,
      notes: r.notes ?? '',
      assignedAt: isoDate(r.assigned_at),
    }));
}

function parseGroupRole(body: Record<string, unknown>) {
  const role = str(body.role, 80);
  if (role && !isStaffCompanyRole(role)) throw new StaffAdminError('Select a valid role', 400);
  return {
    role,
    notes: str(body.notes, 2000),
    assignedAt: ymdOrEmpty(body.assignedAt) || new Date().toISOString().slice(0, 10),
  };
}

export async function addStaffGroupLink(ws: CoachWorkspace, staffId: string, body: Record<string, unknown>) {
  await ensureTables();
  await assertStaffInWorkspace(ws, staffId);
  const groupId = str(body.groupId, 191);
  const groups = await listStaffGroupOptions(ws);
  if (!groupId) throw new StaffAdminError('Select a group', 400);
  if (!groups.some((g) => g.id === groupId)) throw new StaffAdminError('Group not found', 404);
  const { role, notes, assignedAt } = parseGroupRole(body);
  const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM \`${GROUP_ROLES}\` WHERE staff_id = ? AND group_id = ?`,
    staffId,
    groupId,
  );
  if (existing.length) throw new StaffAdminError('This component of the staff is already in this group', 409);
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO \`${GROUP_ROLES}\` (id, workspace_kind, workspace_id, staff_id, group_id, role, notes, assigned_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    ws.kind,
    ws.id,
    staffId,
    groupId,
    role,
    notes || null,
    assignedAt,
  );
  return id;
}

export async function updateStaffGroupLink(
  ws: CoachWorkspace,
  staffId: string,
  linkId: string,
  body: Record<string, unknown>,
) {
  await ensureTables();
  const { role, notes, assignedAt } = parseGroupRole(body);
  const updated = await prisma.$executeRawUnsafe(
    `UPDATE \`${GROUP_ROLES}\` SET role = ?, notes = ?, assigned_at = ?
     WHERE id = ? AND staff_id = ? AND workspace_kind = ? AND workspace_id = ?`,
    role,
    notes || null,
    assignedAt,
    linkId,
    staffId,
    ws.kind,
    ws.id,
  );
  if (!updated) throw new StaffAdminError('Group not found', 404);
}

export async function removeStaffGroupLink(ws: CoachWorkspace, staffId: string, linkId: string) {
  await ensureTables();
  const deleted = await prisma.$executeRawUnsafe(
    `DELETE FROM \`${GROUP_ROLES}\` WHERE id = ? AND staff_id = ? AND workspace_kind = ? AND workspace_id = ?`,
    linkId,
    staffId,
    ws.kind,
    ws.id,
  );
  if (!deleted) throw new StaffAdminError('Group not found', 404);
}

// ---------------------------------------------------------------------------
// Contract and remunerations

type RemunerationRow = {
  id: string;
  paid_on: Date;
  amount: string | number;
  kind: string;
  payment_type: string;
  notes: string | null;
};

const KIND_VALUES = REMUNERATION_KINDS.map((k) => k.value) as string[];

function toRemuneration(r: RemunerationRow): StaffRemuneration {
  return {
    id: r.id,
    paidOn: isoDate(r.paid_on),
    amount: Number(r.amount),
    kind: (KIND_VALUES.includes(r.kind) ? r.kind : 'compensation') as RemunerationKind,
    paymentType: r.payment_type,
    notes: r.notes ?? '',
  };
}

export function parseRemunerationInput(body: Record<string, unknown>): StaffRemunerationInput {
  const paidOn = ymdOrEmpty(body.paidOn);
  if (!paidOn) throw new StaffAdminError('Enter the date', 400);
  const amount = Math.round(Number(String(body.amount ?? '').replace(',', '.')) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) throw new StaffAdminError('Enter a valid amount', 400);
  const kind = str(body.kind, 20);
  if (!KIND_VALUES.includes(kind)) throw new StaffAdminError('Select the type of remuneration', 400);
  const paymentType = str(body.paymentType, 40);
  if (!(REMUNERATION_PAYMENT_TYPES as readonly string[]).includes(paymentType)) {
    throw new StaffAdminError('Select the payment type', 400);
  }
  return { paidOn, amount, kind: kind as RemunerationKind, paymentType, notes: str(body.notes, 2000) };
}

export async function listStaffRemunerations(ws: CoachWorkspace, staffId: string): Promise<StaffRemuneration[]> {
  await ensureTables();
  await assertStaffInWorkspace(ws, staffId);
  const rows = await prisma.$queryRawUnsafe<RemunerationRow[]>(
    `SELECT id, paid_on, amount, kind, payment_type, notes FROM \`${REMUNERATIONS}\`
     WHERE staff_id = ? AND workspace_kind = ? AND workspace_id = ? ORDER BY paid_on DESC, created_at DESC`,
    staffId,
    ws.kind,
    ws.id,
  );
  return rows.map(toRemuneration);
}

export async function addStaffRemuneration(ws: CoachWorkspace, staffId: string, input: StaffRemunerationInput) {
  await ensureTables();
  await assertStaffInWorkspace(ws, staffId);
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO \`${REMUNERATIONS}\` (id, workspace_kind, workspace_id, staff_id, paid_on, amount, kind, payment_type, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    ws.kind,
    ws.id,
    staffId,
    input.paidOn,
    input.amount,
    input.kind,
    input.paymentType,
    input.notes || null,
  );
  return id;
}

export async function updateStaffRemuneration(
  ws: CoachWorkspace,
  staffId: string,
  id: string,
  input: StaffRemunerationInput,
) {
  await ensureTables();
  const updated = await prisma.$executeRawUnsafe(
    `UPDATE \`${REMUNERATIONS}\` SET paid_on = ?, amount = ?, kind = ?, payment_type = ?, notes = ?
     WHERE id = ? AND staff_id = ? AND workspace_kind = ? AND workspace_id = ?`,
    input.paidOn,
    input.amount,
    input.kind,
    input.paymentType,
    input.notes || null,
    id,
    staffId,
    ws.kind,
    ws.id,
  );
  if (!updated) throw new StaffAdminError('Remuneration not found', 404);
}

export async function deleteStaffRemuneration(ws: CoachWorkspace, staffId: string, id: string) {
  await ensureTables();
  const deleted = await prisma.$executeRawUnsafe(
    `DELETE FROM \`${REMUNERATIONS}\` WHERE id = ? AND staff_id = ? AND workspace_kind = ? AND workspace_id = ?`,
    id,
    staffId,
    ws.kind,
    ws.id,
  );
  if (!deleted) throw new StaffAdminError('Remuneration not found', 404);
}
