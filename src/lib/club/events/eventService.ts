import { randomBytes, randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { prisma } from '@/lib/prisma';
import { getServerPublicDir } from '@/lib/serverPublicDir';
import { toMediaApiPath } from '@/lib/uploadMediaUrl';
import {
  CLUB_EVENT_TYPES,
  emptyEventProfile,
  locationOf,
  type ClubEvent,
  type ClubEventDiscountRule,
  type ClubEventExtraText,
  type ClubEventListItem,
  type ClubEventProfile,
  type ClubEventPublicCard,
  type ClubEventService,
  type ClubEventSettings,
  type ClubEventSubevent,
  type ClubEventType,
  type ClubEventWorkspace,
} from '@/lib/club/events/eventConstants';

export class ClubEventError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = 'ClubEventError';
  }
}

const UPLOAD_SUBDIR = 'club_events';
let tablesReady = false;

function str(value: unknown, max: number): string {
  return String(value ?? '')
    .trim()
    .slice(0, max);
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function ymd(value: unknown, fallback = ''): string {
  const s = String(value ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : fallback;
}

function mediaUrl(path: string | null | undefined): string | null {
  return path ? toMediaApiPath(path) : null;
}

function bool(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

export async function ensureClubEventTables(): Promise<void> {
  if (tablesReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS org_club_events (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      workspace_kind VARCHAR(10) NOT NULL,
      workspace_id VARCHAR(191) NOT NULL,
      name VARCHAR(191) NOT NULL,
      event_type VARCHAR(40) NOT NULL DEFAULT 'Event',
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      cost DECIMAL(12,2) NOT NULL DEFAULT 0,
      seats INT NOT NULL DEFAULT 0,
      allow_subevents TINYINT(1) NOT NULL DEFAULT 0,
      hide_from_share TINYINT(1) NOT NULL DEFAULT 0,
      allow_multi_subevent TINYINT(1) NOT NULL DEFAULT 0,
      subscriber_type VARCHAR(20) NOT NULL DEFAULT 'Singles',
      members_only TINYINT(1) NOT NULL DEFAULT 0,
      open_to_non_members TINYINT(1) NOT NULL DEFAULT 1,
      confirmation_text TEXT NULL,
      city VARCHAR(120) NOT NULL DEFAULT '',
      zip VARCHAR(20) NOT NULL DEFAULT '',
      address VARCHAR(255) NOT NULL DEFAULT '',
      province VARCHAR(40) NOT NULL DEFAULT '',
      description TEXT NULL,
      banner_url VARCHAR(512) NOT NULL DEFAULT '',
      cover_path VARCHAR(255) NULL,
      sponsor_id VARCHAR(191) NOT NULL DEFAULT '',
      privacy_text TEXT NULL,
      photo_video_text TEXT NULL,
      attachment1_name VARCHAR(191) NOT NULL DEFAULT '',
      attachment1_path VARCHAR(255) NULL,
      attachment2_name VARCHAR(191) NOT NULL DEFAULT '',
      attachment2_path VARCHAR(255) NULL,
      file_upload_enabled TINYINT(1) NOT NULL DEFAULT 0,
      file_upload_label VARCHAR(191) NOT NULL DEFAULT '',
      sibling_enabled TINYINT(1) NOT NULL DEFAULT 0,
      sibling_parent_name VARCHAR(191) NOT NULL DEFAULT '',
      sibling_fiscal_code VARCHAR(32) NOT NULL DEFAULT '',
      sibling_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
      public_token VARCHAR(64) NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY org_club_events_token (public_token),
      KEY org_club_events_ws (workspace_kind, workspace_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS org_club_event_subevents (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      event_id VARCHAR(191) NOT NULL,
      name VARCHAR(191) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      cost DECIMAL(12,2) NOT NULL DEFAULT 0,
      seats INT NOT NULL DEFAULT 0,
      external_to_main TINYINT(1) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      KEY org_club_event_subevents_event (event_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS org_club_event_services (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      event_id VARCHAR(191) NOT NULL,
      name VARCHAR(191) NOT NULL,
      price DECIMAL(12,2) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      KEY org_club_event_services_event (event_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS org_club_event_texts (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      event_id VARCHAR(191) NOT NULL,
      label VARCHAR(500) NOT NULL,
      mandatory TINYINT(1) NOT NULL DEFAULT 0,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      KEY org_club_event_texts_event (event_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS org_club_event_registrations (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      event_id VARCHAR(191) NOT NULL,
      full_name VARCHAR(191) NOT NULL DEFAULT '',
      email VARCHAR(191) NOT NULL DEFAULT '',
      phone VARCHAR(64) NOT NULL DEFAULT '',
      fiscal_code VARCHAR(32) NOT NULL DEFAULT '',
      birthdate VARCHAR(10) NOT NULL DEFAULT '',
      address VARCHAR(255) NOT NULL DEFAULT '',
      city VARCHAR(120) NOT NULL DEFAULT '',
      province VARCHAR(40) NOT NULL DEFAULT '',
      zip VARCHAR(20) NOT NULL DEFAULT '',
      is_minor TINYINT(1) NOT NULL DEFAULT 0,
      parent_name VARCHAR(191) NOT NULL DEFAULT '',
      parent_fiscal_code VARCHAR(32) NOT NULL DEFAULT '',
      notes TEXT NULL,
      group_or_team_name VARCHAR(191) NOT NULL DEFAULT '',
      member_user_id VARCHAR(191) NULL,
      is_member TINYINT(1) NOT NULL DEFAULT 0,
      selected_main_event TINYINT(1) NOT NULL DEFAULT 1,
      selected_subevent_ids TEXT NULL,
      selected_service_ids TEXT NULL,
      text_answers_json TEXT NULL,
      file_path VARCHAR(255) NULL,
      amount_gross DECIMAL(12,2) NOT NULL DEFAULT 0,
      discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
      amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
      pay_mode VARCHAR(64) NOT NULL DEFAULT '',
      status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
      receipt_number VARCHAR(64) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY org_club_event_regs_event (event_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS org_club_event_settings (
      workspace_kind VARCHAR(10) NOT NULL,
      workspace_id VARCHAR(191) NOT NULL,
      disable_subscription_emails TINYINT(1) NOT NULL DEFAULT 0,
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (workspace_kind, workspace_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS org_club_event_discount_rules (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      workspace_kind VARCHAR(10) NOT NULL,
      workspace_id VARCHAR(191) NOT NULL,
      min_subevents INT NOT NULL DEFAULT 2,
      discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
      KEY org_club_event_discount_ws (workspace_kind, workspace_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tablesReady = true;
}

type EventRow = {
  id: string;
  workspace_kind: string;
  workspace_id: string;
  name: string;
  event_type: string;
  start_date: Date | string;
  end_date: Date | string;
  cost: unknown;
  seats: number;
  allow_subevents: number | boolean;
  hide_from_share: number | boolean;
  allow_multi_subevent: number | boolean;
  subscriber_type: string;
  members_only: number | boolean;
  open_to_non_members: number | boolean;
  confirmation_text: string | null;
  city: string;
  zip: string;
  address: string;
  province: string;
  description: string | null;
  banner_url: string;
  cover_path: string | null;
  sponsor_id: string;
  privacy_text: string | null;
  photo_video_text: string | null;
  attachment1_name: string;
  attachment1_path: string | null;
  attachment2_name: string;
  attachment2_path: string | null;
  file_upload_enabled: number | boolean;
  file_upload_label: string;
  sibling_enabled: number | boolean;
  sibling_parent_name: string;
  sibling_fiscal_code: string;
  sibling_percent: unknown;
  public_token: string;
  created_at: Date | string;
  updated_at: Date | string;
};

function dbYmd(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function iso(value: Date | string): string {
  if (typeof value === 'string') return new Date(value).toISOString();
  return value.toISOString();
}

async function countRegistered(eventId: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint | number }>>(
    `SELECT COUNT(*) AS n FROM org_club_event_registrations WHERE event_id = ? AND status <> 'cancelled'`,
    eventId,
  );
  return Number(rows[0]?.n ?? 0);
}

async function loadChildren(eventId: string): Promise<{
  services: ClubEventService[];
  texts: ClubEventExtraText[];
  subevents: ClubEventSubevent[];
}> {
  const [services, texts, subevents, subReg] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ id: string; name: string; price: unknown; sort_order: number }>>(
      `SELECT id, name, price, sort_order FROM org_club_event_services WHERE event_id = ? ORDER BY sort_order ASC, name ASC`,
      eventId,
    ),
    prisma.$queryRawUnsafe<
      Array<{ id: string; label: string; mandatory: number | boolean; enabled: number | boolean; sort_order: number }>
    >(
      `SELECT id, label, mandatory, enabled, sort_order FROM org_club_event_texts WHERE event_id = ? ORDER BY sort_order ASC`,
      eventId,
    ),
    prisma.$queryRawUnsafe<
      Array<{
        id: string;
        name: string;
        start_date: Date | string;
        end_date: Date | string;
        cost: unknown;
        seats: number;
        external_to_main: number | boolean;
        sort_order: number;
      }>
    >(
      `SELECT id, name, start_date, end_date, cost, seats, external_to_main, sort_order
       FROM org_club_event_subevents WHERE event_id = ? ORDER BY sort_order ASC, start_date ASC`,
      eventId,
    ),
    prisma.$queryRawUnsafe<Array<{ selected_subevent_ids: string | null }>>(
      `SELECT selected_subevent_ids FROM org_club_event_registrations WHERE event_id = ? AND status <> 'cancelled'`,
      eventId,
    ),
  ]);
  const subCounts = new Map<string, number>();
  for (const r of subReg) {
    try {
      const ids = JSON.parse(r.selected_subevent_ids || '[]') as string[];
      for (const id of ids) subCounts.set(id, (subCounts.get(id) ?? 0) + 1);
    } catch {
      /* ignore */
    }
  }
  return {
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      price: num(s.price),
      sortOrder: s.sort_order,
    })),
    texts: texts.map((t) => ({
      id: t.id,
      label: t.label,
      mandatory: bool(t.mandatory),
      enabled: bool(t.enabled),
      sortOrder: t.sort_order,
    })),
    subevents: subevents.map((s) => ({
      id: s.id,
      name: s.name,
      startDate: dbYmd(s.start_date),
      endDate: dbYmd(s.end_date),
      cost: num(s.cost),
      seats: s.seats,
      registered: subCounts.get(s.id) ?? 0,
      externalToMain: bool(s.external_to_main),
      sortOrder: s.sort_order,
    })),
  };
}

function mapEvent(row: EventRow, children: Awaited<ReturnType<typeof loadChildren>>, registered: number): ClubEvent {
  const profileBits = {
    city: row.city,
    zip: row.zip,
    address: row.address,
    province: row.province,
  };
  return {
    id: row.id,
    workspaceKind: row.workspace_kind,
    workspaceId: row.workspace_id,
    name: row.name,
    eventType: (CLUB_EVENT_TYPES.includes(row.event_type as ClubEventType)
      ? row.event_type
      : 'Event') as ClubEventType,
    startDate: dbYmd(row.start_date),
    endDate: dbYmd(row.end_date),
    cost: num(row.cost),
    seats: row.seats,
    allowSubevents: bool(row.allow_subevents),
    hideFromShare: bool(row.hide_from_share),
    allowMultiSubeventSelect: bool(row.allow_multi_subevent),
    subscriberType: (['Singles', 'Groups', 'Teams'].includes(row.subscriber_type)
      ? row.subscriber_type
      : 'Singles') as ClubEvent['subscriberType'],
    membersOnly: bool(row.members_only),
    openToNonMembers: bool(row.open_to_non_members),
    confirmationText: row.confirmation_text || emptyEventProfile().confirmationText,
    ...profileBits,
    location: locationOf(profileBits),
    description: row.description || '',
    bannerUrl: row.banner_url || '',
    coverUrl: mediaUrl(row.cover_path),
    sponsorId: row.sponsor_id || '',
    privacyText: row.privacy_text || '',
    photoVideoText: row.photo_video_text || '',
    attachment1Name: row.attachment1_name || '',
    attachment1Url: mediaUrl(row.attachment1_path),
    attachment2Name: row.attachment2_name || '',
    attachment2Url: mediaUrl(row.attachment2_path),
    fileUploadEnabled: bool(row.file_upload_enabled),
    fileUploadLabel: row.file_upload_label || emptyEventProfile().fileUploadLabel,
    siblingDiscount: {
      enabled: bool(row.sibling_enabled),
      parentName: row.sibling_parent_name || '',
      fiscalCode: row.sibling_fiscal_code || '',
      percent: num(row.sibling_percent),
    },
    publicToken: row.public_token,
    subeventCount: children.subevents.length,
    registered,
    services: children.services,
    texts: children.texts,
    subevents: children.subevents,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

async function getEventRow(ws: ClubEventWorkspace, id: string): Promise<EventRow> {
  const rows = await prisma.$queryRawUnsafe<EventRow[]>(
    `SELECT * FROM org_club_events WHERE id = ? AND workspace_kind = ? AND workspace_id = ? LIMIT 1`,
    id,
    ws.kind,
    ws.id,
  );
  if (!rows[0]) throw new ClubEventError('Event not found', 404);
  return rows[0];
}

export async function listClubEvents(ws: ClubEventWorkspace): Promise<ClubEventListItem[]> {
  await ensureClubEventTables();
  const rows = await prisma.$queryRawUnsafe<EventRow[]>(
    `SELECT * FROM org_club_events WHERE workspace_kind = ? AND workspace_id = ? ORDER BY start_date DESC, name ASC`,
    ws.kind,
    ws.id,
  );
  const out: ClubEventListItem[] = [];
  for (const row of rows) {
    const [children, registered] = await Promise.all([loadChildren(row.id), countRegistered(row.id)]);
    const mapped = mapEvent(row, children, registered);
    out.push({
      id: mapped.id,
      name: mapped.name,
      location: mapped.location,
      startDate: mapped.startDate,
      endDate: mapped.endDate,
      eventType: mapped.eventType,
      subeventCount: mapped.subeventCount,
      cost: mapped.cost,
      seats: mapped.seats,
      registered: mapped.registered,
      coverUrl: mapped.coverUrl,
      publicToken: mapped.publicToken,
    });
  }
  return out;
}

export async function getClubEvent(ws: ClubEventWorkspace, id: string): Promise<ClubEvent> {
  await ensureClubEventTables();
  const row = await getEventRow(ws, id);
  const [children, registered] = await Promise.all([loadChildren(row.id), countRegistered(row.id)]);
  return mapEvent(row, children, registered);
}

export async function getClubEventByToken(token: string): Promise<ClubEvent | null> {
  if (!/^[a-f0-9]{16,64}$/i.test(token)) return null;
  await ensureClubEventTables();
  const rows = await prisma.$queryRawUnsafe<EventRow[]>(
    `SELECT * FROM org_club_events WHERE public_token = ? LIMIT 1`,
    token,
  );
  const row = rows[0];
  if (!row) return null;
  const [children, registered] = await Promise.all([loadChildren(row.id), countRegistered(row.id)]);
  return mapEvent(row, children, registered);
}

function profileFromInput(input: Partial<ClubEventProfile>): ClubEventProfile {
  const base = emptyEventProfile();
  const eventType = CLUB_EVENT_TYPES.includes(input.eventType as ClubEventType)
    ? (input.eventType as ClubEventType)
    : base.eventType;
  return {
    ...base,
    ...input,
    eventType,
    name: str(input.name ?? base.name, 191),
    startDate: ymd(input.startDate, base.startDate),
    endDate: ymd(input.endDate, base.endDate),
    cost: Math.max(0, num(input.cost)),
    seats: Math.max(0, Math.round(num(input.seats))),
    allowSubevents: bool(input.allowSubevents),
    hideFromShare: bool(input.hideFromShare),
    allowMultiSubeventSelect: bool(input.allowMultiSubeventSelect),
    subscriberType: (['Singles', 'Groups', 'Teams'].includes(String(input.subscriberType))
      ? input.subscriberType
      : base.subscriberType) as ClubEventProfile['subscriberType'],
    membersOnly: bool(input.membersOnly),
    openToNonMembers: input.openToNonMembers === undefined ? !bool(input.membersOnly) : bool(input.openToNonMembers),
    confirmationText: str(input.confirmationText ?? base.confirmationText, 4000),
    city: str(input.city, 120),
    zip: str(input.zip, 20),
    address: str(input.address, 255),
    province: str(input.province, 40),
    description: str(input.description, 20000),
    bannerUrl: str(input.bannerUrl, 512),
    coverUrl: input.coverUrl ?? null,
    sponsorId: str(input.sponsorId, 191),
    privacyText: str(input.privacyText, 20000),
    photoVideoText: str(input.photoVideoText, 20000),
    attachment1Name: str(input.attachment1Name, 191),
    attachment1Url: input.attachment1Url ?? null,
    attachment2Name: str(input.attachment2Name, 191),
    attachment2Url: input.attachment2Url ?? null,
    fileUploadEnabled: bool(input.fileUploadEnabled),
    fileUploadLabel: str(input.fileUploadLabel ?? base.fileUploadLabel, 191),
    siblingDiscount: {
      enabled: bool(input.siblingDiscount?.enabled),
      parentName: str(input.siblingDiscount?.parentName, 191),
      fiscalCode: str(input.siblingDiscount?.fiscalCode, 32),
      percent: Math.min(100, Math.max(0, num(input.siblingDiscount?.percent))),
    },
  };
}

export async function createClubEvent(
  ws: ClubEventWorkspace,
  input: Partial<ClubEventProfile>,
): Promise<ClubEvent> {
  await ensureClubEventTables();
  const p = profileFromInput(input);
  if (!p.name) throw new ClubEventError('Event name is required');
  const id = randomUUID();
  const token = randomBytes(24).toString('hex');
  const now = new Date();
  await prisma.$executeRawUnsafe(
    `INSERT INTO org_club_events
      (id, workspace_kind, workspace_id, name, event_type, start_date, end_date, cost, seats,
       allow_subevents, hide_from_share, allow_multi_subevent, subscriber_type, members_only, open_to_non_members,
       confirmation_text, city, zip, address, province, description, banner_url, sponsor_id,
       privacy_text, photo_video_text, file_upload_enabled, file_upload_label,
       sibling_enabled, sibling_parent_name, sibling_fiscal_code, sibling_percent,
       public_token, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id,
    ws.kind,
    ws.id,
    p.name,
    p.eventType,
    p.startDate,
    p.endDate,
    p.cost,
    p.seats,
    p.allowSubevents ? 1 : 0,
    p.hideFromShare ? 1 : 0,
    p.allowMultiSubeventSelect ? 1 : 0,
    p.subscriberType,
    p.membersOnly ? 1 : 0,
    p.openToNonMembers ? 1 : 0,
    p.confirmationText,
    p.city,
    p.zip,
    p.address,
    p.province,
    p.description,
    p.bannerUrl,
    p.sponsorId,
    p.privacyText,
    p.photoVideoText,
    p.fileUploadEnabled ? 1 : 0,
    p.fileUploadLabel,
    p.siblingDiscount.enabled ? 1 : 0,
    p.siblingDiscount.parentName,
    p.siblingDiscount.fiscalCode,
    p.siblingDiscount.percent,
    token,
    now,
    now,
  );
  return getClubEvent(ws, id);
}

export async function updateClubEvent(
  ws: ClubEventWorkspace,
  id: string,
  input: Partial<ClubEventProfile>,
): Promise<ClubEvent> {
  await ensureClubEventTables();
  await getEventRow(ws, id);
  const p = profileFromInput(input);
  if (!p.name) throw new ClubEventError('Event name is required');
  await prisma.$executeRawUnsafe(
    `UPDATE org_club_events SET
      name=?, event_type=?, start_date=?, end_date=?, cost=?, seats=?,
      allow_subevents=?, hide_from_share=?, allow_multi_subevent=?, subscriber_type=?,
      members_only=?, open_to_non_members=?, confirmation_text=?,
      city=?, zip=?, address=?, province=?, description=?, banner_url=?, sponsor_id=?,
      privacy_text=?, photo_video_text=?,
      attachment1_name=?, attachment2_name=?,
      file_upload_enabled=?, file_upload_label=?,
      sibling_enabled=?, sibling_parent_name=?, sibling_fiscal_code=?, sibling_percent=?,
      updated_at=?
     WHERE id=? AND workspace_kind=? AND workspace_id=?`,
    p.name,
    p.eventType,
    p.startDate,
    p.endDate,
    p.cost,
    p.seats,
    p.allowSubevents ? 1 : 0,
    p.hideFromShare ? 1 : 0,
    p.allowMultiSubeventSelect ? 1 : 0,
    p.subscriberType,
    p.membersOnly ? 1 : 0,
    p.openToNonMembers ? 1 : 0,
    p.confirmationText,
    p.city,
    p.zip,
    p.address,
    p.province,
    p.description,
    p.bannerUrl,
    p.sponsorId,
    p.privacyText,
    p.photoVideoText,
    p.attachment1Name,
    p.attachment2Name,
    p.fileUploadEnabled ? 1 : 0,
    p.fileUploadLabel,
    p.siblingDiscount.enabled ? 1 : 0,
    p.siblingDiscount.parentName,
    p.siblingDiscount.fiscalCode,
    p.siblingDiscount.percent,
    new Date(),
    id,
    ws.kind,
    ws.id,
  );
  return getClubEvent(ws, id);
}

export async function deleteClubEvent(ws: ClubEventWorkspace, id: string): Promise<void> {
  await ensureClubEventTables();
  const registered = await countRegistered(id);
  if (registered > 0) {
    throw new ClubEventError(`Cannot delete: ${registered} subscriber(s) registered. Remove or cancel them first.`, 409);
  }
  await getEventRow(ws, id);
  await prisma.$executeRawUnsafe(`DELETE FROM org_club_event_services WHERE event_id = ?`, id);
  await prisma.$executeRawUnsafe(`DELETE FROM org_club_event_texts WHERE event_id = ?`, id);
  await prisma.$executeRawUnsafe(`DELETE FROM org_club_event_subevents WHERE event_id = ?`, id);
  await prisma.$executeRawUnsafe(`DELETE FROM org_club_event_registrations WHERE event_id = ?`, id);
  await prisma.$executeRawUnsafe(
    `DELETE FROM org_club_events WHERE id = ? AND workspace_kind = ? AND workspace_id = ?`,
    id,
    ws.kind,
    ws.id,
  );
}

export async function replaceEventServices(
  ws: ClubEventWorkspace,
  eventId: string,
  services: Array<{ name: string; price: number }>,
): Promise<ClubEvent> {
  await getEventRow(ws, eventId);
  await prisma.$executeRawUnsafe(`DELETE FROM org_club_event_services WHERE event_id = ?`, eventId);
  let i = 0;
  for (const s of services) {
    const name = str(s.name, 191);
    if (!name) continue;
    await prisma.$executeRawUnsafe(
      `INSERT INTO org_club_event_services (id, event_id, name, price, sort_order) VALUES (?,?,?,?,?)`,
      randomUUID(),
      eventId,
      name,
      Math.max(0, num(s.price)),
      i++,
    );
  }
  return getClubEvent(ws, eventId);
}

export async function replaceEventTexts(
  ws: ClubEventWorkspace,
  eventId: string,
  texts: Array<{ label: string; mandatory?: boolean; enabled?: boolean }>,
): Promise<ClubEvent> {
  await getEventRow(ws, eventId);
  await prisma.$executeRawUnsafe(`DELETE FROM org_club_event_texts WHERE event_id = ?`, eventId);
  let i = 0;
  for (const t of texts) {
    const label = str(t.label, 500);
    if (!label) continue;
    await prisma.$executeRawUnsafe(
      `INSERT INTO org_club_event_texts (id, event_id, label, mandatory, enabled, sort_order) VALUES (?,?,?,?,?,?)`,
      randomUUID(),
      eventId,
      label,
      t.mandatory ? 1 : 0,
      t.enabled === false ? 0 : 1,
      i++,
    );
  }
  return getClubEvent(ws, eventId);
}

export async function upsertSubevent(
  ws: ClubEventWorkspace,
  eventId: string,
  input: Partial<ClubEventSubevent> & { id?: string },
): Promise<ClubEvent> {
  await getEventRow(ws, eventId);
  const name = str(input.name, 191);
  if (!name) throw new ClubEventError('Sub-event name is required');
  const startDate = ymd(input.startDate, emptyEventProfile().startDate);
  const endDate = ymd(input.endDate, startDate);
  const id = input.id || randomUUID();
  if (input.id) {
    await prisma.$executeRawUnsafe(
      `UPDATE org_club_event_subevents SET name=?, start_date=?, end_date=?, cost=?, seats=?, external_to_main=?, sort_order=?
       WHERE id=? AND event_id=?`,
      name,
      startDate,
      endDate,
      Math.max(0, num(input.cost)),
      Math.max(0, Math.round(num(input.seats))),
      input.externalToMain ? 1 : 0,
      Math.round(num(input.sortOrder)),
      id,
      eventId,
    );
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO org_club_event_subevents
        (id, event_id, name, start_date, end_date, cost, seats, external_to_main, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      id,
      eventId,
      name,
      startDate,
      endDate,
      Math.max(0, num(input.cost)),
      Math.max(0, Math.round(num(input.seats))),
      input.externalToMain ? 1 : 0,
      Math.round(num(input.sortOrder)),
    );
  }
  return getClubEvent(ws, eventId);
}

export async function deleteSubevent(ws: ClubEventWorkspace, eventId: string, subId: string): Promise<ClubEvent> {
  await getEventRow(ws, eventId);
  await prisma.$executeRawUnsafe(`DELETE FROM org_club_event_subevents WHERE id = ? AND event_id = ?`, subId, eventId);
  return getClubEvent(ws, eventId);
}

async function storeFile(file: Blob, originalName: string, allowed: string[], maxBytes: number): Promise<string> {
  if (file.size === 0) throw new ClubEventError('The file is empty');
  if (file.size > maxBytes) throw new ClubEventError('File too large');
  const ext = (originalName.split('.').pop() ?? '').toLowerCase();
  if (!allowed.includes(ext)) throw new ClubEventError('File type not allowed');
  const dir = join(getServerPublicDir(), 'uploads', UPLOAD_SUBDIR);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  const stored = `${randomBytes(16).toString('hex')}.${ext}`;
  await writeFile(join(dir, stored), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${UPLOAD_SUBDIR}/${stored}`;
}

async function removeStored(path: string | null) {
  if (!path?.startsWith(`/uploads/${UPLOAD_SUBDIR}/`)) return;
  await unlink(join(getServerPublicDir(), path)).catch(() => undefined);
}

export async function setEventCover(
  ws: ClubEventWorkspace,
  eventId: string,
  file: Blob | null,
  fileName = '',
): Promise<ClubEvent> {
  const row = await getEventRow(ws, eventId);
  const path = file ? await storeFile(file, fileName, ['jpg', 'jpeg', 'png', 'webp'], 3 * 1024 * 1024) : null;
  await prisma.$executeRawUnsafe(
    `UPDATE org_club_events SET cover_path = ?, updated_at = ? WHERE id = ?`,
    path,
    new Date(),
    eventId,
  );
  await removeStored(row.cover_path);
  return getClubEvent(ws, eventId);
}

export async function setEventAttachment(
  ws: ClubEventWorkspace,
  eventId: string,
  slot: 1 | 2,
  file: Blob | null,
  fileName = '',
  displayName = '',
): Promise<ClubEvent> {
  const row = await getEventRow(ws, eventId);
  const path = file
    ? await storeFile(file, fileName, ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx'], 8 * 1024 * 1024)
    : null;
  const nameCol = slot === 1 ? 'attachment1_name' : 'attachment2_name';
  const pathCol = slot === 1 ? 'attachment1_path' : 'attachment2_path';
  const oldPath = slot === 1 ? row.attachment1_path : row.attachment2_path;
  const label = str(displayName || fileName, 191);
  await prisma.$executeRawUnsafe(
    `UPDATE org_club_events SET ${nameCol} = ?, ${pathCol} = ?, updated_at = ? WHERE id = ?`,
    path ? label : '',
    path,
    new Date(),
    eventId,
  );
  await removeStored(oldPath);
  return getClubEvent(ws, eventId);
}

export async function getEventSettings(ws: ClubEventWorkspace): Promise<{
  settings: ClubEventSettings;
  discountRules: ClubEventDiscountRule[];
}> {
  await ensureClubEventTables();
  const rows = await prisma.$queryRawUnsafe<Array<{ disable_subscription_emails: number | boolean }>>(
    `SELECT disable_subscription_emails FROM org_club_event_settings WHERE workspace_kind = ? AND workspace_id = ? LIMIT 1`,
    ws.kind,
    ws.id,
  );
  const rules = await prisma.$queryRawUnsafe<
    Array<{ id: string; min_subevents: number; discount_percent: unknown }>
  >(
    `SELECT id, min_subevents, discount_percent FROM org_club_event_discount_rules
     WHERE workspace_kind = ? AND workspace_id = ? ORDER BY min_subevents ASC`,
    ws.kind,
    ws.id,
  );
  return {
    settings: { disableSubscriptionEmails: bool(rows[0]?.disable_subscription_emails) },
    discountRules: rules.map((r) => ({
      id: r.id,
      minSubevents: r.min_subevents,
      discountPercent: num(r.discount_percent),
    })),
  };
}

export async function saveEventSettings(
  ws: ClubEventWorkspace,
  input: Partial<ClubEventSettings>,
): Promise<ClubEventSettings> {
  await ensureClubEventTables();
  const disable = bool(input.disableSubscriptionEmails);
  await prisma.$executeRawUnsafe(
    `INSERT INTO org_club_event_settings (workspace_kind, workspace_id, disable_subscription_emails, updated_at)
     VALUES (?,?,?,?)
     ON DUPLICATE KEY UPDATE disable_subscription_emails = VALUES(disable_subscription_emails), updated_at = VALUES(updated_at)`,
    ws.kind,
    ws.id,
    disable ? 1 : 0,
    new Date(),
  );
  return { disableSubscriptionEmails: disable };
}

export async function addDiscountRule(
  ws: ClubEventWorkspace,
  minSubevents: number,
  discountPercent: number,
): Promise<ClubEventDiscountRule[]> {
  await ensureClubEventTables();
  const min = Math.max(2, Math.round(num(minSubevents)));
  const pct = Math.min(100, Math.max(0, num(discountPercent)));
  await prisma.$executeRawUnsafe(
    `INSERT INTO org_club_event_discount_rules (id, workspace_kind, workspace_id, min_subevents, discount_percent)
     VALUES (?,?,?,?,?)`,
    randomUUID(),
    ws.kind,
    ws.id,
    min,
    pct,
  );
  return (await getEventSettings(ws)).discountRules;
}

export async function deleteDiscountRule(ws: ClubEventWorkspace, id: string): Promise<ClubEventDiscountRule[]> {
  await ensureClubEventTables();
  await prisma.$executeRawUnsafe(
    `DELETE FROM org_club_event_discount_rules WHERE id = ? AND workspace_kind = ? AND workspace_id = ?`,
    id,
    ws.kind,
    ws.id,
  );
  return (await getEventSettings(ws)).discountRules;
}

/** Paid event registrations for Archive of Payments (movement_cash). */
export async function listEventArchiveCash(ws: ClubEventWorkspace): Promise<Record<string, unknown>[]> {
  await ensureClubEventTables();
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      full_name: string;
      event_name: string;
      event_type: string;
      amount_paid: unknown;
      created_at: Date | string;
      pay_mode: string;
      email: string;
    }>
  >(
    `SELECT r.id, r.full_name, e.name AS event_name, e.event_type, r.amount_paid, r.created_at, r.pay_mode, r.email
     FROM org_club_event_registrations r
     INNER JOIN org_club_events e ON e.id = r.event_id
     WHERE e.workspace_kind = ? AND e.workspace_id = ? AND r.amount_paid > 0 AND r.status = 'confirmed'
     ORDER BY r.created_at DESC`,
    ws.kind,
    ws.id,
  );
  return rows.map((r) => {
    const paid = num(r.amount_paid);
    return {
      id: `event-cash-${r.id}`,
      name: r.full_name || r.email,
      typology: 'EVENTS',
      service: `${r.event_type} — ${r.event_name}`,
      insertDate: dbYmd(r.created_at),
      paid,
      value: paid,
      rest: 0,
      direction: 'IN',
      payMod: r.pay_mode || '-',
      casual: r.event_name,
      operator: '',
      eventRegistrationId: r.id,
    };
  });
}

export async function listPublicWorkspaceEvents(ws: ClubEventWorkspace): Promise<ClubEventListItem[]> {
  const all = await listClubEvents(ws);
  return all.filter((e) => {
    /* hideFromShare filtered in full get — listClubEvents doesn't include flag; reload light */
    return true;
  });
}

export async function listPublicEventsForOrg(orgId: string): Promise<ClubEventPublicCard[]> {
  await ensureClubEventTables();
  const rows = await prisma.$queryRawUnsafe<EventRow[]>(
    `SELECT * FROM org_club_events
     WHERE workspace_id = ? AND hide_from_share = 0
     ORDER BY start_date ASC, name ASC`,
    orgId,
  );
  const out: ClubEventPublicCard[] = [];
  for (const row of rows) {
    const [children, registered] = await Promise.all([loadChildren(row.id), countRegistered(row.id)]);
    const mapped = mapEvent(row, children, registered);
    out.push({
      id: mapped.id,
      name: mapped.name,
      location: mapped.location,
      startDate: mapped.startDate,
      endDate: mapped.endDate,
      eventType: mapped.eventType,
      subeventCount: mapped.subeventCount,
      cost: mapped.cost,
      seats: mapped.seats,
      registered: mapped.registered,
      coverUrl: mapped.coverUrl,
      publicToken: mapped.publicToken,
      description: mapped.description,
      bannerUrl: mapped.bannerUrl,
      subevents: mapped.subevents.map((s) => ({
        id: s.id,
        name: s.name,
        startDate: s.startDate,
        endDate: s.endDate,
        cost: s.cost,
      })),
    });
  }
  return out;
}
