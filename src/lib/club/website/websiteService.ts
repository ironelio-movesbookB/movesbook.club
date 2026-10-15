import { randomBytes } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { prisma } from '@/lib/prisma';
import { getServerPublicDir } from '@/lib/serverPublicDir';
import { toMediaApiPath } from '@/lib/uploadMediaUrl';
import { sanitizeRichHtml } from '@/lib/sanitizeRichHtml';
import { parseClubDescriptionMeta } from '@/lib/club/clubSidebarLabel';
import {
  findPublicOrg,
  loadPublicTexts,
  publicOrgCard,
  resolvePublicLanguage,
  teamProfileOf,
  type PublicOrgCard,
} from '@/lib/club/publicOrg';
import { ensureSponsorTables } from '@/lib/club/sponsors/sponsorService';
import { todayYmd, type SponsorSectionKey } from '@/lib/club/sponsors/sponsorConstants';
import { listSectionSponsors, sponsorClickUrl } from '@/lib/club/sponsors/sponsorPlacementService';
import type { SponsorSlotItem } from '@/lib/club/sponsors/sponsorSlotTypes';
import {
  WEBSITE_MAX_COVER_BYTES,
  WEBSITE_SECTIONS,
  WEBSITE_SLUG_RE,
  WEBSITE_SOCIALS,
  currentWebsiteSeason,
  emptyWebsiteSections,
  isWebsiteSectionKey,
  slugifyWebsite,
  type WebsiteSectionKey,
  type WebsiteSectionSetting,
  type WebsiteSettings,
  type WebsiteSocialKey,
} from '@/lib/club/website/websiteConstants';
import { WEBSITE_PUBLIC_TEXTS, WEBSITE_TEXTS_CATEGORY } from '@/lib/club/website/websitePublicTexts';

export type WebsiteWorkspace = { kind: 'club' | 'team'; id: string };

export class WebsiteError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const UPLOAD_SUBDIR = 'club_websites';
let tableReady = false;

async function ensureWebsiteTable(): Promise<void> {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS org_websites (
      workspace_kind VARCHAR(10) NOT NULL,
      workspace_id VARCHAR(191) NOT NULL,
      enabled TINYINT(1) NOT NULL DEFAULT 0,
      slug VARCHAR(64) NULL,
      cover_path VARCHAR(255) NULL,
      about_text TEXT NULL,
      sections_json TEXT NULL,
      season VARCHAR(20) NOT NULL DEFAULT '',
      donation_enabled TINYINT(1) NOT NULL DEFAULT 0,
      donation_text TEXT NULL,
      donation_tax_code VARCHAR(32) NOT NULL DEFAULT '',
      socials_json TEXT NULL,
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (workspace_kind, workspace_id),
      UNIQUE KEY org_websites_slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tableReady = true;
}

type WebsiteRow = {
  workspace_kind: string;
  workspace_id: string;
  enabled: number | boolean;
  slug: string | null;
  cover_path: string | null;
  about_text: string | null;
  sections_json: string | null;
  season: string;
  donation_enabled: number | boolean;
  donation_text: string | null;
  donation_tax_code: string;
  socials_json: string | null;
};

function parseSections(raw: string | null): Record<WebsiteSectionKey, WebsiteSectionSetting> {
  const out = emptyWebsiteSections();
  if (!raw) return out;
  try {
    const data = JSON.parse(raw) as Record<string, { enabled?: unknown; url?: unknown }>;
    for (const [key, value] of Object.entries(data)) {
      if (!isWebsiteSectionKey(key) || !value || typeof value !== 'object') continue;
      out[key] = { enabled: value.enabled !== false, url: typeof value.url === 'string' ? value.url : '' };
    }
  } catch {
    /* defaults */
  }
  return out;
}

function parseSocials(raw: string | null): Record<WebsiteSocialKey, string> {
  const out = Object.fromEntries(WEBSITE_SOCIALS.map((k) => [k, ''])) as Record<WebsiteSocialKey, string>;
  if (!raw) return out;
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    for (const k of WEBSITE_SOCIALS) if (typeof data[k] === 'string') out[k] = data[k] as string;
  } catch {
    /* defaults */
  }
  return out;
}

function rowToSettings(row: WebsiteRow): WebsiteSettings {
  return {
    enabled: Boolean(Number(row.enabled)),
    slug: row.slug ?? '',
    coverUrl: row.cover_path ? toMediaApiPath(row.cover_path) : null,
    about: row.about_text ?? '',
    sections: parseSections(row.sections_json),
    season: row.season || currentWebsiteSeason(),
    donationEnabled: Boolean(Number(row.donation_enabled)),
    donationText: row.donation_text ?? '',
    donationTaxCode: row.donation_tax_code,
    socials: parseSocials(row.socials_json),
  };
}

async function getRow(ws: WebsiteWorkspace): Promise<WebsiteRow | null> {
  await ensureWebsiteTable();
  const rows = await prisma.$queryRawUnsafe<WebsiteRow[]>(
    `SELECT * FROM org_websites WHERE workspace_kind = ? AND workspace_id = ? LIMIT 1`,
    ws.kind,
    ws.id,
  );
  return rows[0] ?? null;
}

async function slugTaken(slug: string, ws: WebsiteWorkspace): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint | number }>>(
    `SELECT COUNT(*) AS n FROM org_websites WHERE slug = ? AND NOT (workspace_kind = ? AND workspace_id = ?)`,
    slug,
    ws.kind,
    ws.id,
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

async function suggestSlug(name: string, ws: WebsiteWorkspace): Promise<string> {
  const base = slugifyWebsite(name) || `club-${ws.id.slice(-6).toLowerCase()}`;
  const padded = base.length < 3 ? `${base}-club` : base;
  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? padded : `${padded.slice(0, 55)}-${i + 1}`;
    if (!(await slugTaken(candidate, ws))) return candidate;
  }
  return `${padded.slice(0, 50)}-${randomBytes(3).toString('hex')}`;
}

/** Saved settings, or defaults (suggested slug, club tax code) for a website not set up yet. */
export async function getWebsiteSettings(ws: WebsiteWorkspace): Promise<{ settings: WebsiteSettings; saved: boolean }> {
  const row = await getRow(ws);
  if (row) return { settings: rowToSettings(row), saved: true };
  const org = await findPublicOrg(ws.id);
  const meta = parseClubDescriptionMeta(org?.description);
  return {
    saved: false,
    settings: {
      enabled: false,
      slug: await suggestSlug(org?.name ?? '', ws),
      coverUrl: null,
      about: '',
      sections: emptyWebsiteSections(),
      season: currentWebsiteSeason(),
      donationEnabled: false,
      donationText: '',
      donationTaxCode: teamProfileOf(meta)?.mainData?.fiscalCode?.trim() ?? '',
      socials: parseSocials(null),
    },
  };
}

function cleanUrl(value: unknown, label: string): string {
  const raw = typeof value === 'string' ? value.trim().slice(0, 500) : '';
  if (!raw) return '';
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    throw new WebsiteError(`The link of "${label}" is not valid`, 400);
  }
}

export async function saveWebsiteSettings(ws: WebsiteWorkspace, input: Partial<WebsiteSettings>): Promise<WebsiteSettings> {
  await ensureWebsiteTable();
  const slug = String(input.slug ?? '').trim().toLowerCase();
  if (!WEBSITE_SLUG_RE.test(slug)) {
    throw new WebsiteError('The address must be 3–60 characters: lowercase letters, numbers and hyphens', 400);
  }
  if (await slugTaken(slug, ws)) throw new WebsiteError('This address is already used by another website', 409);

  const sections = emptyWebsiteSections();
  for (const s of WEBSITE_SECTIONS) {
    const v = input.sections?.[s.key];
    sections[s.key] = { enabled: v?.enabled !== false, url: cleanUrl(v?.url, s.label) };
  }
  const socials = parseSocials(null);
  for (const k of WEBSITE_SOCIALS) socials[k] = cleanUrl(input.socials?.[k], k);
  const season = /^\d{4}\/\d{4}$/.test(String(input.season ?? '')) ? String(input.season) : currentWebsiteSeason();
  const taxCode = String(input.donationTaxCode ?? '').replace(/\s+/g, '').toUpperCase().slice(0, 32);
  if (input.donationEnabled && !taxCode) throw new WebsiteError('Enter the tax code for the 5x1000', 400);

  await prisma.$executeRawUnsafe(
    `INSERT INTO org_websites
       (workspace_kind, workspace_id, enabled, slug, about_text, sections_json, season,
        donation_enabled, donation_text, donation_tax_code, socials_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), slug = VALUES(slug), about_text = VALUES(about_text),
       sections_json = VALUES(sections_json), season = VALUES(season), donation_enabled = VALUES(donation_enabled),
       donation_text = VALUES(donation_text), donation_tax_code = VALUES(donation_tax_code),
       socials_json = VALUES(socials_json), updated_at = VALUES(updated_at)`,
    ws.kind,
    ws.id,
    input.enabled ? 1 : 0,
    slug,
    String(input.about ?? '').slice(0, 10000),
    JSON.stringify(sections),
    season,
    input.donationEnabled ? 1 : 0,
    String(input.donationText ?? '').slice(0, 2000),
    taxCode,
    JSON.stringify(socials),
    new Date(),
  );
  return (await getWebsiteSettings(ws)).settings;
}

export async function setWebsiteCover(
  ws: WebsiteWorkspace,
  file: Blob | null,
  originalName = '',
): Promise<WebsiteSettings> {
  const row = await getRow(ws);
  if (!row) throw new WebsiteError('Save the website settings first', 400);
  let path: string | null = null;
  if (file) {
    if (file.size === 0) throw new WebsiteError('The file is empty', 400);
    if (file.size > WEBSITE_MAX_COVER_BYTES) throw new WebsiteError('The image cannot be larger than 8MB', 400);
    const ext = (originalName.split('.').pop() ?? '').toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) throw new WebsiteError('Use a JPG, PNG or WEBP image', 400);
    const dir = join(getServerPublicDir(), 'uploads', UPLOAD_SUBDIR);
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    const stored = `${randomBytes(16).toString('hex')}.${ext}`;
    await writeFile(join(dir, stored), Buffer.from(await file.arrayBuffer()));
    path = `/uploads/${UPLOAD_SUBDIR}/${stored}`;
  }
  await prisma.$executeRawUnsafe(
    `UPDATE org_websites SET cover_path = ?, updated_at = ? WHERE workspace_kind = ? AND workspace_id = ?`,
    path,
    new Date(),
    ws.kind,
    ws.id,
  );
  if (row.cover_path?.startsWith(`/uploads/${UPLOAD_SUBDIR}/`)) {
    await unlink(join(getServerPublicDir(), row.cover_path)).catch(() => undefined);
  }
  return (await getWebsiteSettings(ws)).settings;
}

// ---------- public site ----------

export type PublicSiteData = {
  language: string;
  texts: Record<string, string>;
  preview: boolean;
  org: PublicOrgCard & { location: string; sports: string[]; foundedYear: number; members: number; staff: number };
  coverUrl: string | null;
  about: string;
  season: string;
  links: Array<{ key: WebsiteSectionKey; url: string }>;
  documents: Array<{ key: 'rules' | 'privacy'; html: string }>;
  events: Array<{ id: string; title: string; date: string; type: string; description: string }> | null;
  shop: Array<{ id: string; name: string; price: number | null; imageUrl: string | null }> | null;
  sponsors: Array<{ id: string; name: string; logoUrl: string | null; clickUrl: string | null }> | null;
  /** Sponsors placed in a website card (key = website section). */
  sectionSponsors: Partial<Record<string, SponsorSlotItem[]>>;
  sponsorKitPath: string;
  donation: { text: string; taxCode: string } | null;
  socials: Partial<Record<WebsiteSocialKey, string>>;
};

async function tableColumns(table: string): Promise<Map<string, string>> {
  const rows = await prisma.$queryRawUnsafe<Array<{ COLUMN_NAME: string; DATA_TYPE: string }>>(
    `SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    table,
  );
  return new Map(rows.map((r) => [r.COLUMN_NAME.toLowerCase(), r.DATA_TYPE.toLowerCase()]));
}

const NUMERIC_TYPES = new Set(['int', 'bigint', 'smallint', 'mediumint', 'tinyint', 'decimal']);

/** `club_id` may be numeric in legacy tables; a cuid must not be compared to it (MySQL casts to 0). */
function clubIdMatches(cols: Map<string, string>, orgId: string): boolean {
  const type = cols.get('club_id');
  if (!type) return false;
  return !NUMERIC_TYPES.has(type) || /^\d+$/.test(orgId);
}

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function ymdOf(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = text(value);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '';
}

async function upcomingEvents(orgId: string): Promise<PublicSiteData['events']> {
  try {
    const cols = await tableColumns('events');
    if (!clubIdMatches(cols, orgId)) return [];
    const dateCol = ['start_date', 'date', 'event_date'].find((c) => cols.has(c));
    if (!dateCol) return [];
    const pick = (names: string[]) => names.filter((c) => cols.has(c));
    const select = ['id', dateCol, ...pick(['title', 'name', 'event_name', 'typology', 'event_type', 'description'])];
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT ${select.map((c) => `\`${c}\``).join(', ')} FROM \`events\`
       WHERE \`club_id\` = ? AND \`${dateCol}\` >= ? ORDER BY \`${dateCol}\` ASC LIMIT 12`,
      orgId,
      todayYmd(),
    );
    return rows
      .map((r) => ({
        id: text(r.id),
        title: text(r.title) || text(r.name) || text(r.event_name),
        date: ymdOf(r[dateCol]),
        type: text(r.typology) || text(r.event_type),
        description: text(r.description).slice(0, 300),
      }))
      .filter((e) => e.title && e.date);
  } catch {
    return [];
  }
}

function publicImage(value: unknown): string | null {
  const s = text(value);
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/uploads/')) return toMediaApiPath(s);
  return null;
}

async function shopItems(orgId: string): Promise<PublicSiteData['shop']> {
  try {
    const cols = await tableColumns('club_setting_services');
    if (!clubIdMatches(cols, orgId) || !cols.has('service_name')) return [];
    const priceCol = ['actual_cost', 'club_currency_cost'].find((c) => cols.has(c));
    const select = ['id', 'service_name', ...(priceCol ? [priceCol] : []), ...(cols.has('service_img') ? ['service_img'] : [])];
    const available = cols.has('service_available') ? 'AND (`service_available` IS NULL OR `service_available` <> 0)' : '';
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT ${select.map((c) => `\`${c}\``).join(', ')} FROM \`club_setting_services\`
       WHERE \`club_id\` = ? ${available} ORDER BY \`service_name\` ASC LIMIT 24`,
      orgId,
    );
    return rows
      .map((r) => {
        const price = priceCol ? Number(r[priceCol]) : NaN;
        return {
          id: text(r.id),
          name: text(r.service_name),
          price: Number.isFinite(price) && price > 0 ? price : null,
          imageUrl: publicImage(r.service_img),
        };
      })
      .filter((i) => i.name);
  } catch {
    return [];
  }
}

async function visibleSponsors(ws: WebsiteWorkspace): Promise<NonNullable<PublicSiteData['sponsors']>> {
  await ensureSponsorTables();
  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: string; name: string; logo_path: string | null; landing_url: string }>
  >(
    `SELECT id, name, logo_path, landing_url FROM org_sponsors
     WHERE workspace_kind = ? AND workspace_id = ? AND visible = 1 ORDER BY name ASC`,
    ws.kind,
    ws.id,
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    logoUrl: r.logo_path ? toMediaApiPath(r.logo_path) : null,
    clickUrl: r.landing_url ? sponsorClickUrl(r.id, '') : null,
  }));
}

/** Website card / block → sponsor Visibility sections shown in it. */
const SITE_SPONSOR_SECTIONS: Record<string, SponsorSectionKey[]> = {
  registrations: ['online_registrations'],
  online_payments: ['online_payments', 'fee_payments'],
  calendar: ['shared_calendar'],
  medical_visit: ['medical_visit'],
  events: ['events_page'],
  shop: ['online_shop'],
};

/**
 * Public website by slug. A disabled website is shown only to its owner (`viewerUserId`), as a preview.
 */
export async function getPublicSite(
  slug: string,
  requestedLang: string | null,
  viewerUserId: string | null,
): Promise<PublicSiteData | null> {
  if (!WEBSITE_SLUG_RE.test(slug)) return null;
  await ensureWebsiteTable();
  const rows = await prisma.$queryRawUnsafe<WebsiteRow[]>(`SELECT * FROM org_websites WHERE slug = ? LIMIT 1`, slug);
  const row = rows[0];
  if (!row) return null;
  const org = await findPublicOrg(row.workspace_id);
  if (!org) return null;
  const settings = rowToSettings(row);
  const preview = !settings.enabled;
  if (preview && viewerUserId !== org.ownerId) return null;

  const ws: WebsiteWorkspace = { kind: org.kind, id: org.id };
  const on = (key: WebsiteSectionKey) => settings.sections[key].enabled;
  const language = await resolvePublicLanguage(requestedLang, org.ownerId);
  const meta = parseClubDescriptionMeta(org.description);

  const slotSections = Object.entries(SITE_SPONSOR_SECTIONS)
    .filter(([key]) => on(key as WebsiteSectionKey))
    .flatMap(([, sections]) => sections);

  const [texts, members, staff, events, shop, sponsors, slotItems] = await Promise.all([
    loadPublicTexts(WEBSITE_PUBLIC_TEXTS, WEBSITE_TEXTS_CATEGORY, language),
    org.kind === 'club'
      ? prisma.clubMember.count({ where: { clubId: org.id } })
      : prisma.teamMember.count({ where: { teamId: org.id } }),
    org.kind === 'club'
      ? prisma.clubStaff.count({ where: { clubId: org.id } })
      : prisma.teamStaff.count({ where: { teamId: org.id } }),
    on('events') ? upcomingEvents(org.id) : Promise.resolve(null),
    on('shop') ? shopItems(org.id) : Promise.resolve(null),
    on('sponsors') ? visibleSponsors(ws) : Promise.resolve(null),
    listSectionSponsors(ws, slotSections).catch(() => []),
  ]);

  const sectionSponsors: PublicSiteData['sectionSponsors'] = {};
  for (const [key, sections] of Object.entries(SITE_SPONSOR_SECTIONS)) {
    const list = slotItems.filter((i) => (sections as string[]).includes(i.section));
    if (list.length) sectionSponsors[key] = list;
  }

  const documents: PublicSiteData['documents'] = [];
  if (on('documents')) {
    const rules = sanitizeRichHtml(meta.legalDocuments?.rulesHtml ?? '');
    const privacy = sanitizeRichHtml(meta.legalDocuments?.privacyPolicyHtml ?? '');
    if (rules.trim()) documents.push({ key: 'rules', html: rules });
    if (privacy.trim()) documents.push({ key: 'privacy', html: privacy });
  }

  const socials: PublicSiteData['socials'] = {};
  for (const k of WEBSITE_SOCIALS) if (settings.socials[k]) socials[k] = settings.socials[k];

  return {
    language,
    texts,
    preview,
    org: {
      ...publicOrgCard(org),
      location: [org.location, meta.province, meta.country].map((v) => (v ?? '').trim()).filter(Boolean).join(', '),
      sports: Array.isArray(meta.sports) ? meta.sports.filter((s) => typeof s === 'string' && s.trim()) : [],
      foundedYear: org.createdAt.getFullYear(),
      members,
      staff,
    },
    coverUrl: settings.coverUrl,
    about: settings.about,
    season: settings.season,
    links: (['registrations', 'online_payments', 'calendar', 'medical_visit'] as const)
      .filter((k) => on(k))
      .map((k) => ({ key: k, url: settings.sections[k].url })),
    documents,
    events,
    shop,
    sponsors,
    sectionSponsors,
    sponsorKitPath: `/sponsor-kit/${encodeURIComponent(org.id)}`,
    donation:
      settings.donationEnabled && settings.donationTaxCode
        ? { text: settings.donationText, taxCode: settings.donationTaxCode }
        : null,
    socials,
  };
}
