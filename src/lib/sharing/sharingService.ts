import { randomUUID } from 'crypto';
import type { UserType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth';
import { getLogoUrlFromEntityDescription } from '@/lib/entity/entityLogo';
import { resolvePublicImageUrl } from '@/lib/profileImageUrl';
import { getUserVersionSettings, subscriptionUserTypeForUser } from '@/lib/admin/versionSettingsStore';
import { getCreatableCompaniesQuota } from '@/lib/club/creatableCompaniesQuota';
import {
  SHARE_PARTY_KINDS,
  isAllowedSharePair,
  sanitizeShareSections,
  shareSectionsForKind,
  type ShareLimit,
  type ShareParty,
  type SharePartyKind,
  type ShareRequestView,
  type ShareSearchRow,
  type ShareSide,
  type ShareStatus,
  type SharedEntry,
  type SharingSummary,
} from '@/lib/sharing/sharingTypes';

const REQUESTS = 'company_share_requests';
const DEFAULTS = 'company_share_defaults';

export class SharingError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

let tablesReady = false;

async function ensureTables() {
  if (tablesReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`${REQUESTS}\` (
      id VARCHAR(191) NOT NULL,
      sender_kind VARCHAR(10) NOT NULL,
      sender_id VARCHAR(191) NOT NULL,
      sender_admin_id VARCHAR(191) NOT NULL,
      recipient_kind VARCHAR(10) NOT NULL,
      recipient_id VARCHAR(191) NOT NULL,
      recipient_admin_id VARCHAR(191) NOT NULL,
      sender_sections TEXT NOT NULL,
      recipient_sections TEXT NOT NULL,
      status VARCHAR(12) NOT NULL DEFAULT 'pending',
      removed_by VARCHAR(10) NULL,
      sender_hidden TINYINT(1) NOT NULL DEFAULT 0,
      recipient_hidden TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      responded_at DATETIME(3) NULL,
      removed_at DATETIME(3) NULL,
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY company_share_requests_sender_admin_idx (sender_admin_id, recipient_kind, status),
      KEY company_share_requests_recipient_admin_idx (recipient_admin_id, status),
      KEY company_share_requests_sender_idx (sender_kind, sender_id),
      KEY company_share_requests_recipient_idx (recipient_kind, recipient_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`${DEFAULTS}\` (
      owner_kind VARCHAR(10) NOT NULL,
      owner_id VARCHAR(191) NOT NULL,
      recipient_kind VARCHAR(10) NOT NULL,
      sections TEXT NOT NULL,
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (owner_kind, owner_id, recipient_kind)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tablesReady = true;
}

/* ------------------------------------------------------------------ */
/* Parties                                                            */
/* ------------------------------------------------------------------ */

const MAX_INLINE_IMAGE = 200_000;

function userLogo(image: string | null): string | null {
  const url = resolvePublicImageUrl(image);
  if (url && url.startsWith('data:') && url.length > MAX_INLINE_IMAGE) return null;
  return url;
}

/** User types that are company admins (not "single users"). */
const COMPANY_ADMIN_USER_TYPES = new Set([
  'CLUB',
  'CLUB_TRAINER',
  'TEAM',
  'TEAM_MANAGER',
  'GROUP',
  'GROUP_ADMIN',
  'COACH',
  'ADMIN',
]);

export function isSingleUserType(userType: string): boolean {
  return !COMPANY_ADMIN_USER_TYPES.has(userType);
}

type ResolvedParty = ShareParty & { adminId: string };

export async function resolveParty(kind: SharePartyKind, id: string): Promise<ResolvedParty | null> {
  switch (kind) {
    case 'user': {
      const u = await prisma.user.findUnique({
        where: { id },
        select: { id: true, name: true, image: true },
      });
      return u ? { kind, id: u.id, name: u.name, logo: userLogo(u.image), adminId: u.id } : null;
    }
    case 'club': {
      const c = await prisma.club.findUnique({
        where: { id },
        select: { id: true, name: true, description: true, adminId: true },
      });
      return c
        ? { kind, id: c.id, name: c.name, logo: getLogoUrlFromEntityDescription(c.description), adminId: c.adminId }
        : null;
    }
    case 'team': {
      const t = await prisma.team.findUnique({
        where: { id },
        select: { id: true, name: true, description: true, adminId: true },
      });
      return t
        ? { kind, id: t.id, name: t.name, logo: getLogoUrlFromEntityDescription(t.description), adminId: t.adminId }
        : null;
    }
    case 'group': {
      const g = await prisma.group.findUnique({
        where: { id },
        select: { id: true, name: true, description: true, adminId: true },
      });
      return g
        ? { kind, id: g.id, name: g.name, logo: getLogoUrlFromEntityDescription(g.description), adminId: g.adminId }
        : null;
    }
    case 'coach': {
      const g = await prisma.coachingGroup.findUnique({
        where: { id },
        select: { id: true, name: true, description: true, coachId: true },
      });
      return g
        ? { kind, id: g.id, name: g.name, logo: getLogoUrlFromEntityDescription(g.description), adminId: g.coachId }
        : null;
    }
    default:
      return null;
  }
}

function stripAdmin(party: ResolvedParty): ShareParty {
  return { kind: party.kind, id: party.id, name: party.name, logo: party.logo };
}

/** Companies administered by the user: clubs, teams, groups and coach groups trained. */
export async function listOwnedCompanies(userId: string): Promise<ShareParty[]> {
  const [clubs, teams, groups, coachGroups] = await Promise.all([
    prisma.club.findMany({ where: { adminId: userId }, select: { id: true, name: true, description: true }, orderBy: { createdAt: 'asc' } }),
    prisma.team.findMany({ where: { adminId: userId }, select: { id: true, name: true, description: true }, orderBy: { createdAt: 'asc' } }),
    prisma.group.findMany({ where: { adminId: userId }, select: { id: true, name: true, description: true }, orderBy: { createdAt: 'asc' } }),
    prisma.coachingGroup.findMany({ where: { coachId: userId }, select: { id: true, name: true, description: true }, orderBy: { createdAt: 'asc' } }),
  ]);
  const map = (kind: SharePartyKind) => (row: { id: string; name: string; description: string | null }): ShareParty => ({
    kind,
    id: row.id,
    name: row.name,
    logo: getLogoUrlFromEntityDescription(row.description),
  });
  const { isClubCreatedFromForm } = await import('@/lib/club/clubSidebarLabel');
  return [
    ...clubs.filter(isClubCreatedFromForm).map(map('club')),
    ...teams.filter(isClubCreatedFromForm).map(map('team')),
    ...coachGroups.filter(isClubCreatedFromForm).map(map('coach')),
    ...groups.filter(isClubCreatedFromForm).map(map('group')),
  ];
}

async function assertOwnsParty(userId: string, kind: SharePartyKind, id: string): Promise<ResolvedParty> {
  const party = await resolveParty(kind, id);
  if (!party || party.adminId !== userId) {
    throw new SharingError('You do not administer this company or user', 403);
  }
  return party;
}

/* ------------------------------------------------------------------ */
/* Limits (read from the user's PCU version settings)                 */
/* ------------------------------------------------------------------ */

async function readLimitValues(userId: string, userType: string): Promise<Record<SharePartyKind, number>> {
  const zero: Record<SharePartyKind, number> = { user: 0, club: 0, team: 0, group: 0, coach: 0 };
  const pcu = await getUserVersionSettings(userId);
  if (!pcu) return zero;
  const s = pcu.data.settings;
  const membership = (m: { limit: number; sharingEnabled: boolean } | undefined) =>
    m && m.sharingEnabled ? Number(m.limit) || 0 : 0;
  const single = subscriptionUserTypeForUser(userType) === 'athlete';
  return {
    user: single ? 0 : Number(s.athletesLimit) || 0,
    club: membership(s.clubs),
    team: membership(s.teams),
    group: membership(s.groups),
    coach: single ? Number(s.coachesLimit) || 0 : membership(s.coachSharing),
  };
}

async function countUsedByKind(userId: string): Promise<Record<SharePartyKind, number>> {
  await ensureTables();
  const rows = await prisma.$queryRawUnsafe<{ recipient_kind: string; n: bigint | number }[]>(
    `SELECT recipient_kind, COUNT(*) AS n FROM \`${REQUESTS}\`
     WHERE sender_admin_id = ? AND status IN ('pending', 'accepted')
     GROUP BY recipient_kind`,
    userId,
  );
  const used: Record<SharePartyKind, number> = { user: 0, club: 0, team: 0, group: 0, coach: 0 };
  for (const r of rows) {
    if ((SHARE_PARTY_KINDS as string[]).includes(r.recipient_kind)) {
      used[r.recipient_kind as SharePartyKind] = Number(r.n);
    }
  }
  return used;
}

export async function getSharingLimits(userId: string, userType: string): Promise<Record<SharePartyKind, ShareLimit>> {
  const [limits, used] = await Promise.all([readLimitValues(userId, userType), countUsedByKind(userId)]);
  const out = {} as Record<SharePartyKind, ShareLimit>;
  for (const kind of SHARE_PARTY_KINDS) {
    const limit = limits[kind];
    out[kind] = {
      limit,
      used: used[kind],
      available: limit === -1 ? null : Math.max(0, limit - used[kind]),
    };
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Requests                                                           */
/* ------------------------------------------------------------------ */

type RequestRow = {
  id: string;
  sender_kind: string;
  sender_id: string;
  sender_admin_id: string;
  recipient_kind: string;
  recipient_id: string;
  recipient_admin_id: string;
  sender_sections: string;
  recipient_sections: string;
  status: string;
  removed_by: string | null;
  sender_hidden: number;
  recipient_hidden: number;
  created_at: Date;
  responded_at: Date | null;
  removed_at: Date | null;
};

function parseSections(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);

async function toView(row: RequestRow, viewerSide: ShareSide): Promise<ShareRequestView | null> {
  const [sender, recipient] = await Promise.all([
    resolveParty(row.sender_kind as SharePartyKind, row.sender_id),
    resolveParty(row.recipient_kind as SharePartyKind, row.recipient_id),
  ]);
  if (!sender || !recipient) return null;
  return {
    id: row.id,
    status: row.status as ShareStatus,
    createdAt: new Date(row.created_at).toISOString(),
    respondedAt: iso(row.responded_at),
    removedAt: iso(row.removed_at),
    removedBy: (row.removed_by as ShareSide | null) ?? null,
    sender: stripAdmin(sender),
    recipient: stripAdmin(recipient),
    senderSections: parseSections(row.sender_sections),
    recipientSections: parseSections(row.recipient_sections),
    viewerSide,
  };
}

async function loadRow(id: string): Promise<RequestRow | null> {
  await ensureTables();
  const rows = await prisma.$queryRawUnsafe<RequestRow[]>(
    `SELECT * FROM \`${REQUESTS}\` WHERE id = ? LIMIT 1`,
    id,
  );
  return rows[0] ?? null;
}

function viewerSideOf(row: RequestRow, userId: string): ShareSide | null {
  if (row.sender_admin_id === userId) return 'sender';
  if (row.recipient_admin_id === userId) return 'recipient';
  return null;
}

async function checkPassword(userId: string, password: unknown) {
  if (typeof password !== 'string' || !password.trim()) {
    throw new SharingError('Enter your admin password', 400);
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
  if (!user || !(await verifyPassword(password.trim(), user.password))) {
    throw new SharingError('Invalid password', 401);
  }
}

export async function getDefaultSections(
  ownerKind: SharePartyKind,
  ownerId: string,
  recipientKind: SharePartyKind,
): Promise<string[]> {
  await ensureTables();
  const rows = await prisma.$queryRawUnsafe<{ sections: string }[]>(
    `SELECT sections FROM \`${DEFAULTS}\` WHERE owner_kind = ? AND owner_id = ? AND recipient_kind = ? LIMIT 1`,
    ownerKind,
    ownerId,
    recipientKind,
  );
  if (rows[0]) return sanitizeShareSections(ownerKind, parseSections(rows[0].sections));
  return shareSectionsForKind(ownerKind).map((s) => s.key);
}

export async function saveDefaultSections(
  userId: string,
  ownerKind: SharePartyKind,
  ownerId: string,
  recipientKind: SharePartyKind,
  sections: unknown,
): Promise<string[]> {
  await assertOwnsParty(userId, ownerKind, ownerId);
  const clean = sanitizeShareSections(ownerKind, sections);
  await ensureTables();
  await prisma.$executeRawUnsafe(
    `INSERT INTO \`${DEFAULTS}\` (owner_kind, owner_id, recipient_kind, sections) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE sections = VALUES(sections), updated_at = CURRENT_TIMESTAMP(3)`,
    ownerKind,
    ownerId,
    recipientKind,
    JSON.stringify(clean),
  );
  return clean;
}

export async function createShareRequest(params: {
  userId: string;
  userType: string;
  sender: { kind: SharePartyKind; id: string };
  recipient: { kind: SharePartyKind; id: string };
  senderSections: unknown;
  password: unknown;
}): Promise<ShareRequestView> {
  const { userId, userType } = params;
  await checkPassword(userId, params.password);

  const sender = await assertOwnsParty(userId, params.sender.kind, params.sender.id);
  if (sender.kind === 'user' && !isSingleUserType(userType)) {
    throw new SharingError('Company admins share as one of their companies, not as themselves', 400);
  }
  if (sender.kind !== 'user') {
    const owned = await listOwnedCompanies(userId);
    if (!owned.some((c) => c.kind === sender.kind && c.id === sender.id)) {
      throw new SharingError('Choose one of the companies listed in your sidebar', 400);
    }
  }
  if (!isAllowedSharePair(sender.kind, params.recipient.kind)) {
    throw new SharingError('Single users can share only with clubs, teams, groups or coach groups', 400);
  }

  const recipient = await resolveParty(params.recipient.kind, params.recipient.id);
  if (!recipient) throw new SharingError('Recipient not found', 404);
  if (recipient.adminId === userId) {
    throw new SharingError('You cannot share with yourself or your own companies', 400);
  }
  if (recipient.kind === 'user') {
    const target = await prisma.user.findUnique({ where: { id: recipient.id }, select: { userType: true } });
    if (!target || !isSingleUserType(target.userType)) {
      throw new SharingError('Sharing friends must be single users', 400);
    }
  }

  const limits = await getSharingLimits(userId, userType);
  const limit = limits[recipient.kind];
  if (limit.available !== null && limit.available <= 0) {
    throw new SharingError(`Sharing limit reached for this list (limit ${limit.limit})`, 403);
  }

  await ensureTables();
  const duplicate = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM \`${REQUESTS}\`
     WHERE status IN ('pending', 'accepted')
       AND ((sender_kind = ? AND sender_id = ? AND recipient_kind = ? AND recipient_id = ?)
         OR (sender_kind = ? AND sender_id = ? AND recipient_kind = ? AND recipient_id = ?))
     LIMIT 1`,
    sender.kind, sender.id, recipient.kind, recipient.id,
    recipient.kind, recipient.id, sender.kind, sender.id,
  );
  if (duplicate.length > 0) {
    throw new SharingError('A sharing between these two already exists or is pending', 409);
  }

  const senderSections = sanitizeShareSections(sender.kind, params.senderSections);
  const recipientSections = await getDefaultSections(recipient.kind, recipient.id, sender.kind);
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO \`${REQUESTS}\`
       (id, sender_kind, sender_id, sender_admin_id, recipient_kind, recipient_id, recipient_admin_id,
        sender_sections, recipient_sections, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    id,
    sender.kind,
    sender.id,
    userId,
    recipient.kind,
    recipient.id,
    recipient.adminId,
    JSON.stringify(senderSections),
    JSON.stringify(recipientSections),
  );
  const row = await loadRow(id);
  const view = row ? await toView(row, 'sender') : null;
  if (!view) throw new SharingError('Could not create the request', 500);
  return view;
}

export type ShareScope =
  | { type: 'mypage' }
  | { type: 'party'; kind: SharePartyKind; id: string };

/**
 * Notifications for the central frame.
 * - My Page: requests the admin sent (any company), and requests received as a single user.
 * - My Club / My Team / My Coach group / My Group: requests sent or received by that company.
 */
export async function listShareRequests(userId: string, scope: ShareScope): Promise<ShareRequestView[]> {
  await ensureTables();
  let rows: RequestRow[];
  if (scope.type === 'mypage') {
    rows = await prisma.$queryRawUnsafe<RequestRow[]>(
      `SELECT * FROM \`${REQUESTS}\`
       WHERE (sender_admin_id = ? AND sender_hidden = 0)
          OR (recipient_kind = 'user' AND recipient_id = ? AND recipient_hidden = 0)
       ORDER BY created_at DESC LIMIT 100`,
      userId,
      userId,
    );
  } else {
    await assertOwnsParty(userId, scope.kind, scope.id);
    rows = await prisma.$queryRawUnsafe<RequestRow[]>(
      `SELECT * FROM \`${REQUESTS}\`
       WHERE (sender_kind = ? AND sender_id = ? AND sender_hidden = 0)
          OR (recipient_kind = ? AND recipient_id = ? AND recipient_hidden = 0)
       ORDER BY created_at DESC LIMIT 100`,
      scope.kind,
      scope.id,
      scope.kind,
      scope.id,
    );
  }

  const views: ShareRequestView[] = [];
  for (const row of rows) {
    const side = viewerSideOf(row, userId);
    if (!side) continue;
    if (row.status === 'removed' && row.removed_by === side) continue;
    const view = await toView(row, side);
    if (view) views.push(view);
  }
  return views;
}

export async function getShareRequestForViewer(userId: string, id: string): Promise<ShareRequestView> {
  const row = await loadRow(id);
  const side = row ? viewerSideOf(row, userId) : null;
  if (!row || !side) throw new SharingError('Request not found', 404);
  const view = await toView(row, side);
  if (!view) throw new SharingError('Request not found', 404);
  return view;
}

export type ShareAction =
  | { action: 'accept' }
  | { action: 'reject' }
  | { action: 'hide' }
  | { action: 'remove'; password: unknown }
  | { action: 'update_sections'; sections: unknown; saveAsDefault?: boolean };

export async function updateShareRequest(userId: string, id: string, input: ShareAction): Promise<ShareRequestView> {
  const row = await loadRow(id);
  const side = row ? viewerSideOf(row, userId) : null;
  if (!row || !side) throw new SharingError('Request not found', 404);

  switch (input.action) {
    case 'accept':
    case 'reject': {
      if (side !== 'recipient') throw new SharingError('Only the recipient can answer this request', 403);
      if (row.status !== 'pending') throw new SharingError('This request was already answered', 409);
      await prisma.$executeRawUnsafe(
        `UPDATE \`${REQUESTS}\` SET status = ?, responded_at = CURRENT_TIMESTAMP(3), updated_at = CURRENT_TIMESTAMP(3)
         WHERE id = ?`,
        input.action === 'accept' ? 'accepted' : 'rejected',
        id,
      );
      break;
    }
    case 'hide': {
      const column = side === 'sender' ? 'sender_hidden' : 'recipient_hidden';
      await prisma.$executeRawUnsafe(
        `UPDATE \`${REQUESTS}\` SET ${column} = 1, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?`,
        id,
      );
      break;
    }
    case 'remove': {
      await checkPassword(userId, input.password);
      if (row.status !== 'accepted' && row.status !== 'pending') {
        throw new SharingError('This sharing is not active', 409);
      }
      const otherHidden = side === 'sender' ? 'recipient_hidden' : 'sender_hidden';
      await prisma.$executeRawUnsafe(
        `UPDATE \`${REQUESTS}\` SET status = 'removed', removed_by = ?, removed_at = CURRENT_TIMESTAMP(3),
           ${otherHidden} = 0, updated_at = CURRENT_TIMESTAMP(3)
         WHERE id = ?`,
        side,
        id,
      );
      break;
    }
    case 'update_sections': {
      if (row.status === 'removed' || row.status === 'rejected') {
        throw new SharingError('This sharing is not active', 409);
      }
      const ownKind = (side === 'sender' ? row.sender_kind : row.recipient_kind) as SharePartyKind;
      const ownId = side === 'sender' ? row.sender_id : row.recipient_id;
      const otherKind = (side === 'sender' ? row.recipient_kind : row.sender_kind) as SharePartyKind;
      const clean = sanitizeShareSections(ownKind, input.sections);
      const column = side === 'sender' ? 'sender_sections' : 'recipient_sections';
      await prisma.$executeRawUnsafe(
        `UPDATE \`${REQUESTS}\` SET ${column} = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?`,
        JSON.stringify(clean),
        id,
      );
      if (input.saveAsDefault) await saveDefaultSections(userId, ownKind, ownId, otherKind, clean);
      break;
    }
    default:
      throw new SharingError('Unknown action', 400);
  }
  return getShareRequestForViewer(userId, id);
}

/* ------------------------------------------------------------------ */
/* Summary for the Communities sidebar                                */
/* ------------------------------------------------------------------ */

export async function getSharingSummary(userId: string, userType: string): Promise<SharingSummary> {
  await ensureTables();
  const self = await resolveParty('user', userId);
  if (!self) throw new SharingError('User not found', 404);

  const [companies, limits, companyQuota, acceptedRows] = await Promise.all([
    listOwnedCompanies(userId),
    getSharingLimits(userId, userType),
    getCreatableCompaniesQuota(userId, userType),
    prisma.$queryRawUnsafe<RequestRow[]>(
      `SELECT * FROM \`${REQUESTS}\`
       WHERE status = 'accepted' AND (sender_admin_id = ? OR recipient_admin_id = ?)
       ORDER BY created_at DESC`,
      userId,
      userId,
    ),
  ]);

  const shared: Record<SharePartyKind, SharedEntry[]> = { user: [], club: [], team: [], group: [], coach: [] };
  for (const row of acceptedRows) {
    const side = viewerSideOf(row, userId);
    if (!side) continue;
    const otherKind = (side === 'sender' ? row.recipient_kind : row.sender_kind) as SharePartyKind;
    const otherId = side === 'sender' ? row.recipient_id : row.sender_id;
    const other = await resolveParty(otherKind, otherId);
    if (!other) continue;
    shared[otherKind].push({ shareId: row.id, party: stripAdmin(other), viewerSide: side });
  }

  return {
    self: stripAdmin(self),
    companies,
    isCompanyAdmin: !isSingleUserType(userType) || companies.length > 0,
    limits,
    shared,
    companyQuota,
  };
}

/* ------------------------------------------------------------------ */
/* Recipient search (network search filtered by list type)             */
/* ------------------------------------------------------------------ */

export async function searchShareRecipients(
  userId: string,
  kind: SharePartyKind,
  q: string,
): Promise<ShareSearchRow[]> {
  const query = q.trim().slice(0, 120);
  const take = 30;
  const text = query ? { contains: query } : undefined;
  const { parseClubDescriptionMeta } = await import('@/lib/club/clubSidebarLabel');
  /** Company usernames live in the description meta JSON. */
  const nameOrUsername = text ? { OR: [{ name: text }, { description: text }] } : {};
  const companyRow = (k: SharePartyKind) => (row: { id: string; name: string; description: string | null }, subtitle: string): ShareSearchRow => ({
    kind: k,
    id: row.id,
    name: row.name,
    logo: getLogoUrlFromEntityDescription(row.description),
    subtitle: [parseClubDescriptionMeta(row.description).username?.trim(), subtitle].filter(Boolean).join(' · '),
  });

  switch (kind) {
    case 'user': {
      const users = await prisma.user.findMany({
        where: {
          id: { not: userId },
          userType: { notIn: Array.from(COMPANY_ADMIN_USER_TYPES) as UserType[] },
          ...(text ? { OR: [{ name: text }, { username: text }, { firstName: text }, { surname: text }] } : {}),
        },
        take,
        orderBy: { name: 'asc' },
        select: { id: true, name: true, username: true, image: true, country: true },
      });
      return users.map((u) => ({
        kind,
        id: u.id,
        name: u.name,
        logo: userLogo(u.image),
        subtitle: [u.username, u.country].filter(Boolean).join(' · '),
      }));
    }
    case 'club': {
      const rows = await prisma.club.findMany({
        where: { adminId: { not: userId }, ...(text ? { OR: [{ name: text }, { description: text }, { location: text }] } : {}) },
        take,
        orderBy: { name: 'asc' },
        select: { id: true, name: true, description: true, location: true },
      });
      return rows.map((r) => companyRow('club')(r, r.location ? `Club · ${r.location}` : 'Club'));
    }
    case 'team': {
      const rows = await prisma.team.findMany({
        where: { adminId: { not: userId }, ...(text ? { OR: [{ name: text }, { description: text }, { sport: text }] } : {}) },
        take,
        orderBy: { name: 'asc' },
        select: { id: true, name: true, description: true, sport: true },
      });
      return rows.map((r) => companyRow('team')(r, r.sport ? `Team · ${r.sport}` : 'Team'));
    }
    case 'group': {
      const rows = await prisma.group.findMany({
        where: { adminId: { not: userId }, ...nameOrUsername },
        take,
        orderBy: { name: 'asc' },
        select: { id: true, name: true, description: true },
      });
      return rows.map((r) => companyRow('group')(r, 'Group'));
    }
    case 'coach': {
      const rows = await prisma.coachingGroup.findMany({
        where: { coachId: { not: userId }, ...nameOrUsername },
        take,
        orderBy: { name: 'asc' },
        select: { id: true, name: true, description: true, coach: { select: { name: true } } },
      });
      return rows.map((r) => companyRow('coach')(r, `Coach group · ${r.coach.name}`));
    }
    default:
      return [];
  }
}

/* ------------------------------------------------------------------ */
/* Read-only view of a shared company / user                           */
/* ------------------------------------------------------------------ */

export type SharedPartyDetails = {
  share: ShareRequestView;
  party: ShareParty;
  sections: string[];
  info: { label: string; value: string }[];
  members: { id: string; name: string; logo: string | null }[];
};

export async function getSharedPartyDetails(userId: string, shareId: string): Promise<SharedPartyDetails> {
  const share = await getShareRequestForViewer(userId, shareId);
  if (share.status !== 'accepted') throw new SharingError('This sharing is not active', 403);
  const otherIsSender = share.viewerSide === 'recipient';
  const party = otherIsSender ? share.sender : share.recipient;
  const sections = otherIsSender ? share.senderSections : share.recipientSections;

  const info: { label: string; value: string }[] = [];
  let members: { id: string; name: string; logo: string | null }[] = [];
  const add = (label: string, value: unknown) => {
    if (typeof value === 'string' && value.trim()) info.push({ label, value: value.trim() });
  };

  if (party.kind === 'user') {
    const u = await prisma.user.findUnique({
      where: { id: party.id },
      select: { name: true, username: true, country: true, gender: true, createdAt: true },
    });
    add('Name', u?.name);
    add('Username', u?.username);
    add('Country', u?.country);
    add('Gender', u?.gender);
  } else {
    const { parseClubDescriptionMeta } = await import('@/lib/club/clubSidebarLabel');
    const load = async (): Promise<{ description: string | null; memberUsers: { id: string; name: string; image: string | null }[] } | null> => {
      const memberSelect = { select: { id: true, name: true, image: true } } as const;
      if (party.kind === 'club') {
        const c = await prisma.club.findUnique({ where: { id: party.id }, select: { description: true, location: true, members: { select: { member: memberSelect } } } });
        return c ? { description: c.description, memberUsers: c.members.map((m) => m.member) } : null;
      }
      if (party.kind === 'team') {
        const t = await prisma.team.findUnique({ where: { id: party.id }, select: { description: true, members: { select: { athlete: memberSelect } } } });
        return t ? { description: t.description, memberUsers: t.members.map((m) => m.athlete) } : null;
      }
      if (party.kind === 'group') {
        const g = await prisma.group.findUnique({ where: { id: party.id }, select: { description: true, members: { select: { user: memberSelect } } } });
        return g ? { description: g.description, memberUsers: g.members.map((m) => m.user) } : null;
      }
      const g = await prisma.coachingGroup.findUnique({ where: { id: party.id }, select: { description: true, members: { select: { athlete: memberSelect } } } });
      return g ? { description: g.description, memberUsers: g.members.map((m) => m.athlete) } : null;
    };
    const data = await load();
    const meta = parseClubDescriptionMeta(data?.description ?? null);
    add('Official name', party.name);
    add('Category', meta.category);
    add('Country', meta.country);
    add('Region', meta.region);
    add('Location', meta.location);
    add('Address', meta.address);
    add('Zip code', meta.zipCode);
    add('E-mail', meta.mail);
    add('Phone', meta.phone);
    members = (data?.memberUsers ?? []).map((m) => ({ id: m.id, name: m.name, logo: userLogo(m.image) }));
  }

  return {
    share,
    party,
    sections,
    info: sections.includes('info') ? info : [],
    members: sections.some((s) => s === 'dashboard' || s === 'management') ? members : [],
  };
}
