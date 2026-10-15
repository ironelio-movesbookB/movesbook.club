import { prisma } from '@/lib/prisma';
import { toMediaApiPath } from '@/lib/uploadMediaUrl';
import { findPublicOrg } from '@/lib/club/publicOrg';
import { ensureSponsorTables } from '@/lib/club/sponsors/sponsorService';
import {
  isSponsorSectionKey,
  type SponsorMediaKind,
  type SponsorSectionKey,
} from '@/lib/club/sponsors/sponsorConstants';
import type { SponsorSlotItem } from '@/lib/club/sponsors/sponsorSlotTypes';

/** `''` = club presentation (website sponsors block). */
export type TrackSection = SponsorSectionKey | '';

export function isTrackSection(value: unknown): value is TrackSection {
  return value === '' || isSponsorSectionKey(value);
}

type Row = {
  id: string;
  name: string;
  logo_path: string | null;
  banner_path: string | null;
  landing_url: string;
  placements_json: string | null;
};

export function sponsorClickUrl(sponsorId: string, section: TrackSection, origin = ''): string {
  return `${origin}/api/public/sponsors/click?s=${encodeURIComponent(sponsorId)}&sec=${encodeURIComponent(section)}`;
}

/** Visible sponsors placed in the given sections (one item per sponsor and section, with its chosen image). */
export async function listSectionSponsors(
  ws: { kind: 'club' | 'team'; id: string },
  sections: SponsorSectionKey[],
): Promise<SponsorSlotItem[]> {
  if (sections.length === 0) return [];
  await ensureSponsorTables();
  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT id, name, logo_path, banner_path, landing_url, placements_json FROM org_sponsors
     WHERE workspace_kind = ? AND workspace_id = ? AND visible = 1 ORDER BY name ASC`,
    ws.kind,
    ws.id,
  );
  const items: SponsorSlotItem[] = [];
  for (const r of rows) {
    let placements: Record<string, unknown> = {};
    try {
      placements = JSON.parse(r.placements_json || '{}') as Record<string, unknown>;
    } catch {
      continue;
    }
    for (const section of sections) {
      const kind = placements[section];
      if (kind !== 'logo' && kind !== 'banner') continue;
      const path = kind === 'logo' ? r.logo_path : r.banner_path;
      if (!path) continue;
      items.push({
        id: r.id,
        name: r.name,
        section,
        kind: kind as SponsorMediaKind,
        imageUrl: toMediaApiPath(path) ?? path,
        clickUrl: r.landing_url ? sponsorClickUrl(r.id, section) : null,
      });
    }
  }
  return items;
}

export async function listSectionSponsorsForOrg(orgId: string, sections: SponsorSectionKey[]) {
  const org = await findPublicOrg(orgId);
  if (!org) return [];
  return listSectionSponsors({ kind: org.kind, id: org.id }, sections);
}

/** Records events only for existing visible sponsors. */
export async function trackSponsorEvents(
  events: Array<{ sponsorId: string; section: TrackSection }>,
  event: 'view' | 'click',
): Promise<number> {
  const list = events.filter((e) => typeof e.sponsorId === 'string' && e.sponsorId.length <= 191).slice(0, 30);
  if (list.length === 0) return 0;
  await ensureSponsorTables();
  const ids = Array.from(new Set(list.map((e) => e.sponsorId)));
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM org_sponsors WHERE visible = 1 AND id IN (${ids.map(() => '?').join(',')})`,
    ...ids,
  );
  const valid = new Set(rows.map((r) => r.id));
  const keep = list.filter((e) => valid.has(e.sponsorId));
  if (keep.length === 0) return 0;
  await prisma.$executeRawUnsafe(
    `INSERT INTO org_sponsor_events (sponsor_id, event, section) VALUES ${keep.map(() => '(?, ?, ?)').join(', ')}`,
    ...keep.flatMap((e) => [e.sponsorId, event, e.section]),
  );
  return keep.length;
}

export async function sponsorLandingUrl(sponsorId: string): Promise<string | null> {
  await ensureSponsorTables();
  const rows = await prisma.$queryRawUnsafe<Array<{ landing_url: string }>>(
    `SELECT landing_url FROM org_sponsors WHERE id = ? AND visible = 1 LIMIT 1`,
    sponsorId,
  );
  const url = rows[0]?.landing_url;
  return url && /^https?:\/\//i.test(url) ? url : null;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * Sponsor block for automatic emails to members (sections `email_*`): images with tracked
 * click links and a view pixel. Empty string when no sponsor is placed in that email.
 */
export async function sponsorEmailBlockHtml(
  ws: { kind: 'club' | 'team'; id: string },
  section: Extract<SponsorSectionKey, `email_${string}`>,
  origin: string,
): Promise<string> {
  const items = await listSectionSponsors(ws, [section]);
  if (items.length === 0) return '';
  const base = origin.replace(/\/$/, '');
  const cells = items
    .map((i) => {
      const img = `<img src="${base}${i.imageUrl}" alt="${escapeHtml(i.name)}" style="${
        i.kind === 'banner' ? 'max-width:100%;height:auto;' : 'max-height:60px;max-width:140px;'
      }border:0;display:inline-block;" />`;
      const pixel = `<img src="${base}/api/public/sponsors/pixel?s=${encodeURIComponent(i.id)}&amp;sec=${section}" width="1" height="1" alt="" style="display:none;" />`;
      const linked = i.clickUrl ? `<a href="${base}${i.clickUrl}" target="_blank">${img}</a>` : img;
      return `<div style="display:inline-block;margin:6px 10px;vertical-align:middle;">${linked}${pixel}</div>`;
    })
    .join('');
  return `<div style="margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;text-align:center;">${cells}</div>`;
}
