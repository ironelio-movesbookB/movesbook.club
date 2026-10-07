import { randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import type { ClubAuthContext } from '@/lib/procedures/types';
import { listTeamMemberGroups } from '@/lib/club/teamMemberLists';
import {
  CLUB_COACH_STATUSES,
  type ClubCoach,
  type ClubCoachGroupOption,
  type ClubCoachInput,
  type ClubCoachProfileMatch,
  type ClubCoachSource,
  type ClubCoachStatus,
} from '@/lib/club/clubCoach.constants';

const TABLE = 'club_coaches';

export type CoachWorkspace = { kind: 'club' | 'team'; id: string; name: string };

export class ClubCoachError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`${TABLE}\` (
      id VARCHAR(191) NOT NULL,
      workspace_kind VARCHAR(10) NOT NULL,
      workspace_id VARCHAR(191) NOT NULL,
      user_id VARCHAR(191) NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      source VARCHAR(20) NOT NULL DEFAULT 'manual',
      surname VARCHAR(120) NOT NULL,
      first_name VARCHAR(120) NOT NULL,
      tax_code VARCHAR(40) NOT NULL,
      email VARCHAR(191) NULL,
      phone VARCHAR(60) NULL,
      birth_date DATE NULL,
      membership_number VARCHAR(80) NULL,
      iban VARCHAR(60) NULL,
      address VARCHAR(255) NULL,
      city VARCHAR(120) NULL,
      province VARCHAR(60) NULL,
      zip VARCHAR(20) NULL,
      birth_country VARCHAR(120) NULL,
      birth_city VARCHAR(120) NULL,
      birth_province VARCHAR(60) NULL,
      role VARCHAR(80) NULL,
      group_id VARCHAR(191) NULL,
      notes TEXT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY club_coaches_workspace_tax_code_key (workspace_kind, workspace_id, tax_code),
      KEY club_coaches_workspace_status_idx (workspace_kind, workspace_id, status),
      KEY club_coaches_user_id_idx (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tableReady = true;
}

type CoachRow = {
  id: string;
  workspace_kind: string;
  workspace_id: string;
  user_id: string | null;
  status: string;
  source: string;
  surname: string;
  first_name: string;
  tax_code: string;
  email: string | null;
  phone: string | null;
  birth_date: Date | null;
  membership_number: string | null;
  iban: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  zip: string | null;
  birth_country: string | null;
  birth_city: string | null;
  birth_province: string | null;
  role: string | null;
  group_id: string | null;
  notes: string | null;
  created_at: Date;
};

const text = (max: number) => z.string().trim().max(max).optional().default('');

const coachInputSchema = z.object({
  surname: z.string().trim().min(1, 'Surname is required').max(120),
  firstName: z.string().trim().min(1, 'Name is required').max(120),
  taxCode: z
    .string()
    .trim()
    .min(1, 'Tax code is required')
    .max(40)
    .transform((v) => v.toUpperCase().replace(/\s+/g, '')),
  email: z
    .string()
    .trim()
    .max(191)
    .optional()
    .default('')
    .refine((v) => !v || z.string().email().safeParse(v).success, 'Email is not valid'),
  phone: text(60),
  birthDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth is required'),
  membershipNumber: text(80),
  iban: text(60).transform((v) => v.toUpperCase().replace(/\s+/g, '')),
  address: text(255),
  city: text(120),
  province: text(60),
  zip: text(20),
  birthCountry: text(120),
  birthCity: text(120),
  birthProvince: text(60),
  role: text(80),
  groupId: text(191),
  notes: text(5000),
});

export function parseCoachInput(body: unknown): ClubCoachInput {
  const parsed = coachInputSchema.safeParse(body);
  if (!parsed.success) {
    throw new ClubCoachError(parsed.error.issues[0]?.message ?? 'Invalid coach data', 400);
  }
  return parsed.data;
}

export function workspaceFromContext(ctx: ClubAuthContext): CoachWorkspace {
  if (ctx.workspaceKind !== 'club' && ctx.workspaceKind !== 'team') {
    throw new ClubCoachError('Coaches are managed from a Club or Team', 403);
  }
  return { kind: ctx.workspaceKind, id: ctx.club.id, name: ctx.club.name };
}

const isoDate = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const orNull = (v: string) => (v ? v : null);

async function groupNames(ws: CoachWorkspace): Promise<Map<string, string>> {
  const groups = await listWorkspaceGroups(ws);
  return new Map(groups.map((g) => [g.id, g.name]));
}

function toCoach(row: CoachRow, groups: Map<string, string>, images: Map<string, string | null>): ClubCoach {
  const status = (CLUB_COACH_STATUSES as readonly string[]).includes(row.status)
    ? (row.status as ClubCoachStatus)
    : 'active';
  return {
    id: row.id,
    status,
    source: (row.source as ClubCoachSource) || 'manual',
    userId: row.user_id,
    surname: row.surname,
    firstName: row.first_name,
    taxCode: row.tax_code,
    email: row.email ?? '',
    phone: row.phone ?? '',
    birthDate: isoDate(row.birth_date),
    membershipNumber: row.membership_number ?? '',
    iban: row.iban ?? '',
    address: row.address ?? '',
    city: row.city ?? '',
    province: row.province ?? '',
    zip: row.zip ?? '',
    birthCountry: row.birth_country ?? '',
    birthCity: row.birth_city ?? '',
    birthProvince: row.birth_province ?? '',
    role: row.role ?? '',
    groupId: row.group_id ?? '',
    groupName: (row.group_id && groups.get(row.group_id)) || '',
    notes: row.notes ?? '',
    image: (row.user_id && images.get(row.user_id)) || null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function rowsToCoaches(ws: CoachWorkspace, rows: CoachRow[]): Promise<ClubCoach[]> {
  const userIds = [...new Set(rows.map((r) => r.user_id).filter((v): v is string => Boolean(v)))];
  const [groups, users] = await Promise.all([
    groupNames(ws),
    userIds.length
      ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, image: true } })
      : Promise.resolve([] as { id: string; image: string | null }[]),
  ]);
  const images = new Map(users.map((u) => [u.id, u.image]));
  return rows.map((r) => toCoach(r, groups, images));
}

export async function listWorkspaceGroups(ws: CoachWorkspace): Promise<ClubCoachGroupOption[]> {
  if (ws.kind === 'team') {
    const groups = await listTeamMemberGroups(ws.id);
    return groups.map((g) => ({ id: g.id, name: g.name })).sort((a, b) => a.name.localeCompare(b.name));
  }
  const groups = await prisma.clubMemberGroup.findMany({
    where: { clubId: ws.id },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  return groups;
}

async function assertGroup(ws: CoachWorkspace, groupId: string) {
  if (!groupId) return;
  const groups = await listWorkspaceGroups(ws);
  if (!groups.some((g) => g.id === groupId)) throw new ClubCoachError('Select a valid group', 400);
}

export async function listClubCoaches(ws: CoachWorkspace, status: ClubCoachStatus | 'all' = 'all') {
  await ensureTable();
  const rows = await prisma.$queryRawUnsafe<CoachRow[]>(
    `SELECT * FROM \`${TABLE}\` WHERE workspace_kind = ? AND workspace_id = ?${
      status === 'all' ? '' : ' AND status = ?'
    } ORDER BY surname, first_name`,
    ws.kind,
    ws.id,
    ...(status === 'all' ? [] : [status]),
  );
  return rowsToCoaches(ws, rows);
}

export async function getClubCoach(ws: CoachWorkspace, id: string): Promise<ClubCoach> {
  await ensureTable();
  const rows = await prisma.$queryRawUnsafe<CoachRow[]>(
    `SELECT * FROM \`${TABLE}\` WHERE id = ? AND workspace_kind = ? AND workspace_id = ? LIMIT 1`,
    id,
    ws.kind,
    ws.id,
  );
  if (!rows[0]) throw new ClubCoachError('Coach not found', 404);
  return (await rowsToCoaches(ws, rows))[0];
}

async function assertTaxCodeFree(ws: CoachWorkspace, taxCode: string, exceptId?: string) {
  const rows = await prisma.$queryRawUnsafe<{ id: string; status: string }[]>(
    `SELECT id, status FROM \`${TABLE}\` WHERE workspace_kind = ? AND workspace_id = ? AND tax_code = ? LIMIT 1`,
    ws.kind,
    ws.id,
    taxCode,
  );
  const hit = rows[0];
  if (hit && hit.id !== exceptId) {
    throw new ClubCoachError(
      hit.status === 'pending'
        ? 'A registration with this tax code is already waiting for approval'
        : 'A coach with this tax code already exists',
      409,
    );
  }
}

async function assertUserExists(userId: string | null) {
  if (!userId) return;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new ClubCoachError('Selected profile no longer exists', 400);
}

async function assertUserNotLinked(ws: CoachWorkspace, userId: string | null) {
  if (!userId) return;
  const rows = await prisma.$queryRawUnsafe<{ status: string }[]>(
    `SELECT status FROM \`${TABLE}\` WHERE workspace_kind = ? AND workspace_id = ? AND user_id = ? LIMIT 1`,
    ws.kind,
    ws.id,
    userId,
  );
  const hit = rows[0];
  if (!hit) return;
  throw new ClubCoachError(
    hit.status === 'pending'
      ? `This account already has a registration waiting for approval in this ${ws.kind}`
      : hit.status === 'archived'
        ? `This account is already an archived coach of this ${ws.kind}`
        : `This account is already a coach of this ${ws.kind}`,
    409,
  );
}

export async function createClubCoach(
  ws: CoachWorkspace,
  input: ClubCoachInput,
  options: { status?: ClubCoachStatus; source?: ClubCoachSource; userId?: string | null } = {},
): Promise<ClubCoach> {
  await ensureTable();
  await assertTaxCodeFree(ws, input.taxCode);
  await assertGroup(ws, input.groupId);
  await assertUserExists(options.userId ?? null);
  await assertUserNotLinked(ws, options.userId ?? null);
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO \`${TABLE}\` (id, workspace_kind, workspace_id, user_id, status, source, surname, first_name,
      tax_code, email, phone, birth_date, membership_number, iban, address, city, province, zip,
      birth_country, birth_city, birth_province, role, group_id, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    ws.kind,
    ws.id,
    options.userId ?? null,
    options.status ?? 'active',
    options.source ?? 'manual',
    input.surname,
    input.firstName,
    input.taxCode,
    orNull(input.email),
    orNull(input.phone),
    input.birthDate,
    orNull(input.membershipNumber),
    orNull(input.iban),
    orNull(input.address),
    orNull(input.city),
    orNull(input.province),
    orNull(input.zip),
    orNull(input.birthCountry),
    orNull(input.birthCity),
    orNull(input.birthProvince),
    orNull(input.role),
    orNull(input.groupId),
    orNull(input.notes),
  );
  return getClubCoach(ws, id);
}

export async function updateClubCoach(ws: CoachWorkspace, id: string, input: ClubCoachInput): Promise<ClubCoach> {
  await getClubCoach(ws, id);
  await assertTaxCodeFree(ws, input.taxCode, id);
  await assertGroup(ws, input.groupId);
  await prisma.$executeRawUnsafe(
    `UPDATE \`${TABLE}\` SET surname = ?, first_name = ?, tax_code = ?, email = ?, phone = ?, birth_date = ?,
      membership_number = ?, iban = ?, address = ?, city = ?, province = ?, zip = ?, birth_country = ?,
      birth_city = ?, birth_province = ?, role = ?, group_id = ?, notes = ?, updated_at = CURRENT_TIMESTAMP(3)
     WHERE id = ? AND workspace_kind = ? AND workspace_id = ?`,
    input.surname,
    input.firstName,
    input.taxCode,
    orNull(input.email),
    orNull(input.phone),
    input.birthDate,
    orNull(input.membershipNumber),
    orNull(input.iban),
    orNull(input.address),
    orNull(input.city),
    orNull(input.province),
    orNull(input.zip),
    orNull(input.birthCountry),
    orNull(input.birthCity),
    orNull(input.birthProvince),
    orNull(input.role),
    orNull(input.groupId),
    orNull(input.notes),
    id,
    ws.kind,
    ws.id,
  );
  return getClubCoach(ws, id);
}

function idPlaceholders(ids: string[]) {
  if (ids.length === 0) throw new ClubCoachError('Select at least one coach', 400);
  return ids.map(() => '?').join(', ');
}

export async function deleteClubCoaches(ws: CoachWorkspace, ids: string[]) {
  await ensureTable();
  const deleted = await prisma.$executeRawUnsafe(
    `DELETE FROM \`${TABLE}\` WHERE workspace_kind = ? AND workspace_id = ? AND id IN (${idPlaceholders(ids)})`,
    ws.kind,
    ws.id,
    ...ids,
  );
  return { deleted };
}

export async function setClubCoachesStatus(ws: CoachWorkspace, ids: string[], status: ClubCoachStatus) {
  await ensureTable();
  const updated = await prisma.$executeRawUnsafe(
    `UPDATE \`${TABLE}\` SET status = ?, updated_at = CURRENT_TIMESTAMP(3)
     WHERE workspace_kind = ? AND workspace_id = ? AND id IN (${idPlaceholders(ids)})`,
    status,
    ws.kind,
    ws.id,
    ...ids,
  );
  return { updated };
}

/** Members, staff and admin of the workspace — sources for "Duplicate an existing profile". */
export async function searchWorkspaceProfiles(ws: CoachWorkspace, query: string): Promise<ClubCoachProfileMatch[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const relation = new Map<string, string>();
  if (ws.kind === 'team') {
    const [members, staff, team] = await Promise.all([
      prisma.teamMember.findMany({ where: { teamId: ws.id }, select: { athleteId: true } }),
      prisma.teamStaff.findMany({ where: { teamId: ws.id }, select: { userId: true } }),
      prisma.team.findUnique({ where: { id: ws.id }, select: { adminId: true } }),
    ]);
    members.forEach((m) => relation.set(m.athleteId, 'Member'));
    staff.forEach((s) => relation.set(s.userId, 'Staff'));
    if (team) relation.set(team.adminId, 'Team admin');
  } else {
    const [members, staff, club] = await Promise.all([
      prisma.clubMember.findMany({ where: { clubId: ws.id }, select: { memberId: true } }),
      prisma.clubStaff.findMany({ where: { clubId: ws.id }, select: { userId: true } }),
      prisma.club.findUnique({ where: { id: ws.id }, select: { adminId: true } }),
    ]);
    members.forEach((m) => relation.set(m.memberId, 'Member'));
    staff.forEach((s) => relation.set(s.userId, 'Staff'));
    if (club) relation.set(club.adminId, 'Club admin');
  }
  if (relation.size === 0) return [];
  const users = await prisma.user.findMany({
    where: {
      id: { in: [...relation.keys()] },
      OR: [
        { username: { contains: q } },
        { email: { contains: q } },
        { firstName: { contains: q } },
        { surname: { contains: q } },
        { name: { contains: q } },
      ],
    },
    select: { id: true, username: true, firstName: true, surname: true, name: true, email: true, birthdate: true, country: true },
    take: 20,
    orderBy: { username: 'asc' },
  });
  return users.map((u) => {
    const [first, ...rest] = (u.name ?? '').trim().split(/\s+/);
    return {
      userId: u.id,
      username: u.username,
      firstName: u.firstName?.trim() || first || '',
      surname: u.surname?.trim() || rest.join(' '),
      email: u.email,
      birthDate: u.birthdate ? new Date(u.birthdate).toISOString().slice(0, 10) : '',
      country: u.country ?? '',
      relation: relation.get(u.id) ?? '',
    };
  });
}

/** Resolves the `society` id of an invite link to the club or team it belongs to. */
export async function resolveSociety(societyId: string): Promise<CoachWorkspace | null> {
  const id = societyId.trim();
  if (!id) return null;
  const club = await prisma.club.findUnique({ where: { id }, select: { id: true, name: true } });
  if (club) return { kind: 'club', id: club.id, name: club.name };
  const team = await prisma.team.findUnique({ where: { id }, select: { id: true, name: true } });
  if (team) return { kind: 'team', id: team.id, name: team.name };
  return null;
}
