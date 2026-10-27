import { prisma } from '@/lib/prisma';
import {
  OGP_SPONSOR_SETTINGS_ID,
  clampDelayMs,
  clampIntervalRows,
  clampStartRow,
  isSponsorLinkTarget,
  isSponsorSize,
  toSponsorDateInput,
  type OgpSponsor,
  type OgpSponsorSettings,
} from '@/lib/news/ogpSponsors';

let schemaReady = false;

async function ensureSponsorSettingsSchema() {
  if (schemaReady) return;
  const alters = [
    'ALTER TABLE `ogp_news_sponsor_settings` ADD COLUMN `enabled` BOOLEAN NOT NULL DEFAULT true',
    'ALTER TABLE `ogp_news_sponsor_settings` ADD COLUMN `enabledFrom` DATETIME NULL',
    'ALTER TABLE `ogp_news_sponsor_settings` ADD COLUMN `enabledTo` DATETIME NULL',
  ];
  for (const sql of alters) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (e) {
      const code = typeof e === 'object' && e && 'code' in e ? String((e as { code?: string }).code) : '';
      const message = e instanceof Error ? e.message : String(e);
      if (!code.includes('ER_DUP_FIELDNAME') && !/Duplicate column|already exists/i.test(message)) {
        throw e;
      }
    }
  }
  schemaReady = true;
}

export async function ensureSponsorSettings() {
  await ensureSponsorSettingsSchema();
  return prisma.ogpNewsSponsorSettings.upsert({
    where: { id: OGP_SPONSOR_SETTINGS_ID },
    create: { id: OGP_SPONSOR_SETTINGS_ID },
    update: {},
    include: {
      sponsors: { orderBy: { sortOrder: 'asc' } },
    },
  });
}

/** Read date range via raw SQL so it works before `prisma generate` picks up new fields. */
export async function readSponsorEnabledDates(): Promise<{
  enabledFrom: Date | null;
  enabledTo: Date | null;
}> {
  await ensureSponsorSettingsSchema();
  const rows = await prisma.$queryRaw<{ enabledFrom: Date | null; enabledTo: Date | null }[]>`
    SELECT enabledFrom, enabledTo
    FROM ogp_news_sponsor_settings
    WHERE id = ${OGP_SPONSOR_SETTINGS_ID}
    LIMIT 1
  `;
  return {
    enabledFrom: rows[0]?.enabledFrom ?? null,
    enabledTo: rows[0]?.enabledTo ?? null,
  };
}

export async function writeSponsorEnabledDates(
  enabledFrom: Date | null,
  enabledTo: Date | null,
): Promise<void> {
  await ensureSponsorSettingsSchema();
  await prisma.$executeRaw`
    UPDATE ogp_news_sponsor_settings
    SET enabledFrom = ${enabledFrom}, enabledTo = ${enabledTo}
    WHERE id = ${OGP_SPONSOR_SETTINGS_ID}
  `;
}

export function serializeSponsorSettings(row: {
  startRow: number;
  intervalRows: number;
  delayMs: number;
  enabled?: boolean | null;
  enabledFrom?: Date | string | null;
  enabledTo?: Date | string | null;
  sponsors: {
    id: string;
    image: string;
    size: string;
    hoverTitle: string | null;
    linkUrl: string;
    linkTarget: string;
    sortOrder: number;
  }[];
}): OgpSponsorSettings {
  return {
    startRow: clampStartRow(row.startRow),
    intervalRows: clampIntervalRows(row.intervalRows),
    delayMs: clampDelayMs(row.delayMs),
    enabled: row.enabled !== false,
    enabledFrom: toSponsorDateInput(row.enabledFrom) || null,
    enabledTo: toSponsorDateInput(row.enabledTo) || null,
    sponsors: row.sponsors.map((s, index): OgpSponsor => ({
      id: s.id,
      image: s.image,
      size: isSponsorSize(s.size) ? s.size : 'single',
      hoverTitle: s.hoverTitle ?? '',
      linkUrl: s.linkUrl,
      linkTarget: isSponsorLinkTarget(s.linkTarget) ? s.linkTarget : 'tab',
      sortOrder: s.sortOrder ?? index,
    })),
  };
}

export async function loadSerializedSponsorSettings(): Promise<OgpSponsorSettings> {
  const row = await ensureSponsorSettings();
  const dates = await readSponsorEnabledDates();
  return serializeSponsorSettings({
    ...row,
    enabledFrom: dates.enabledFrom,
    enabledTo: dates.enabledTo,
  });
}
