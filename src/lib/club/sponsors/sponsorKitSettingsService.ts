import { prisma } from '@/lib/prisma';
import { ensureSponsorTables, type SponsorWorkspace } from '@/lib/club/sponsors/sponsorService';
import {
  DEFAULT_GRADIENT_FROM,
  DEFAULT_GRADIENT_TO,
  DEFAULT_SPONSOR_KIT_SETTINGS,
  SPONSOR_REPORT_MAX_INTERVAL_DAYS,
  cleanHexColor,
  type SponsorKitSettings,
} from '@/lib/club/sponsors/sponsorKitSettings';
import { sendIonosEmail } from '@/lib/ionosEmail';
import { getSiteOrigin } from '@/lib/siteUrl';

let tablesReady = false;

async function ensureKitSettingsTables(): Promise<void> {
  if (tablesReady) return;
  await ensureSponsorTables();
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS org_sponsor_settings (
      workspace_kind VARCHAR(10) NOT NULL,
      workspace_id VARCHAR(191) NOT NULL,
      use_banner TINYINT(1) NOT NULL DEFAULT 1,
      gradient_from VARCHAR(9) NOT NULL DEFAULT '${DEFAULT_GRADIENT_FROM}',
      gradient_to VARCHAR(9) NOT NULL DEFAULT '${DEFAULT_GRADIENT_TO}',
      report_interval_days INT NOT NULL DEFAULT 0,
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (workspace_kind, workspace_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS org_sponsor_report_log (
      sponsor_id VARCHAR(191) NOT NULL,
      last_sent_at DATETIME(3) NULL,
      PRIMARY KEY (sponsor_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tablesReady = true;
}

type SettingsRow = {
  use_banner: number | boolean;
  gradient_from: string;
  gradient_to: string;
  report_interval_days: number;
};

function rowToSettings(row: SettingsRow | undefined): SponsorKitSettings {
  if (!row) return { ...DEFAULT_SPONSOR_KIT_SETTINGS };
  return {
    useBanner: Boolean(Number(row.use_banner)),
    gradientFrom: cleanHexColor(row.gradient_from, DEFAULT_GRADIENT_FROM),
    gradientTo: cleanHexColor(row.gradient_to, DEFAULT_GRADIENT_TO),
    reportIntervalDays: Math.max(0, Number(row.report_interval_days) || 0),
  };
}

export async function getSponsorKitSettings(ws: SponsorWorkspace): Promise<SponsorKitSettings> {
  await ensureKitSettingsTables();
  const rows = await prisma.$queryRawUnsafe<SettingsRow[]>(
    `SELECT use_banner, gradient_from, gradient_to, report_interval_days FROM org_sponsor_settings
     WHERE workspace_kind = ? AND workspace_id = ? LIMIT 1`,
    ws.kind,
    ws.id,
  );
  return rowToSettings(rows[0]);
}

export async function saveSponsorKitSettings(
  ws: SponsorWorkspace,
  input: Partial<SponsorKitSettings>,
): Promise<SponsorKitSettings> {
  await ensureKitSettingsTables();
  const days = Math.round(Number(input.reportIntervalDays));
  const next: SponsorKitSettings = {
    useBanner: input.useBanner !== false,
    gradientFrom: cleanHexColor(input.gradientFrom, DEFAULT_GRADIENT_FROM),
    gradientTo: cleanHexColor(input.gradientTo, DEFAULT_GRADIENT_TO),
    reportIntervalDays: Number.isFinite(days) ? Math.min(SPONSOR_REPORT_MAX_INTERVAL_DAYS, Math.max(0, days)) : 0,
  };
  await prisma.$executeRawUnsafe(
    `INSERT INTO org_sponsor_settings
       (workspace_kind, workspace_id, use_banner, gradient_from, gradient_to, report_interval_days, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE use_banner = VALUES(use_banner), gradient_from = VALUES(gradient_from),
       gradient_to = VALUES(gradient_to), report_interval_days = VALUES(report_interval_days),
       updated_at = VALUES(updated_at)`,
    ws.kind,
    ws.id,
    next.useBanner ? 1 : 0,
    next.gradientFrom,
    next.gradientTo,
    next.reportIntervalDays,
    new Date(),
  );
  return next;
}

/**
 * Report link of a sponsor. Generating it counts as a submission: `last_sent_at` is updated so the
 * cadence (`reportIntervalDays`) restarts from now. No email is sent here.
 */
export async function generateSponsorReportLink(
  ws: SponsorWorkspace,
  sponsorId: string,
): Promise<{ token: string; path: string; lastSentAt: string }> {
  await ensureKitSettingsTables();
  const rows = await prisma.$queryRawUnsafe<Array<{ report_token: string }>>(
    `SELECT report_token FROM org_sponsors WHERE id = ? AND workspace_kind = ? AND workspace_id = ? LIMIT 1`,
    sponsorId,
    ws.kind,
    ws.id,
  );
  const token = rows[0]?.report_token;
  if (!token) throw new Error('Sponsor not found');
  const now = new Date();
  await markReportSent(sponsorId, now);
  return { token, path: `/sponsor-report/${encodeURIComponent(token)}`, lastSentAt: now.toISOString() };
}

async function markReportSent(sponsorId: string, at: Date): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO org_sponsor_report_log (sponsor_id, last_sent_at) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE last_sent_at = VALUES(last_sent_at)`,
    sponsorId,
    at,
  );
}

/**
 * Sponsors whose report is due: the workspace has a cadence (`reportIntervalDays` > 0) and the last
 * submission is older than that (or never happened). Emails the sponsor (or club owner as fallback)
 * with the public report link, then sets `last_sent_at`.
 */
export async function processSponsorReportCadence(
  ws?: SponsorWorkspace,
): Promise<Array<{ sponsorId: string; workspaceKind: string; workspaceId: string; reportToken: string }>> {
  await ensureKitSettingsTables();
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      name: string;
      email: string;
      workspace_kind: string;
      workspace_id: string;
      report_token: string;
      report_interval_days: number;
      last_sent_at: Date | null;
    }>
  >(
    `SELECT s.id, s.name, s.email, s.workspace_kind, s.workspace_id, s.report_token, c.report_interval_days, l.last_sent_at
     FROM org_sponsors s
     JOIN org_sponsor_settings c ON c.workspace_kind = s.workspace_kind AND c.workspace_id = s.workspace_id
     LEFT JOIN org_sponsor_report_log l ON l.sponsor_id = s.id
     WHERE s.visible = 1 AND c.report_interval_days > 0
       ${ws ? 'AND s.workspace_kind = ? AND s.workspace_id = ?' : ''}`,
    ...(ws ? [ws.kind, ws.id] : []),
  );
  const now = new Date();
  const due: Awaited<ReturnType<typeof processSponsorReportCadence>> = [];
  const origin = getSiteOrigin();
  const ownerCache = new Map<string, string | null>();

  for (const r of rows) {
    const dueAt = r.last_sent_at
      ? new Date(new Date(r.last_sent_at).getTime() + Number(r.report_interval_days) * 86_400_000)
      : null;
    if (dueAt && dueAt > now) continue;

    let to = (r.email || '').trim();
    if (!to) {
      const key = `${r.workspace_kind}:${r.workspace_id}`;
      if (!ownerCache.has(key)) {
        const owner =
          r.workspace_kind === 'team'
            ? await prisma.team.findUnique({
                where: { id: r.workspace_id },
                select: { admin: { select: { email: true } } },
              })
            : await prisma.club.findUnique({
                where: { id: r.workspace_id },
                select: { admin: { select: { email: true } } },
              });
        ownerCache.set(key, owner?.admin?.email ?? null);
      }
      to = ownerCache.get(key) || '';
    }
    if (!to) continue;

    const reportUrl = `${origin}/sponsor-report/${encodeURIComponent(r.report_token)}`;
    try {
      await sendIonosEmail({
        to,
        subject: `Sponsor report: ${r.name}`,
        html: `<p>Your sponsorship performance report for <strong>${escapeHtml(r.name)}</strong> is ready.</p><p><a href="${reportUrl}">Open the report</a></p><p>You can print it or save it as PDF from the report page.</p>`,
      });
      await markReportSent(r.id, now);
      due.push({
        sponsorId: r.id,
        workspaceKind: r.workspace_kind,
        workspaceId: r.workspace_id,
        reportToken: r.report_token,
      });
    } catch (e) {
      console.error('sponsor report cadence', r.id, e);
    }
  }
  return due;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
