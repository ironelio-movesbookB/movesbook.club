import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import {
  SPONSOR_DELAY_MS_DEFAULT,
  clampDelayMs,
  clampIntervalRows,
  clampStartRow,
  isSponsorLinkTarget,
  isSponsorSize,
  toSponsorDateInput,
  type OgpSponsor,
  type OgpSponsorGroup,
  type OgpSponsorLinkTarget,
  type OgpSponsorSettings,
  type OgpSponsorSize,
} from '@/lib/news/ogpSponsors';

let schemaReady = false;
let hasSettingsIdColumn: boolean | null = null;

function newId(): string {
  return `c${randomBytes(12).toString('hex')}`;
}

async function execIgnoreDuplicate(sql: string) {
  try {
    await prisma.$executeRawUnsafe(sql);
  } catch (e) {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code?: string }).code) : '';
    const metaCode =
      typeof e === 'object' && e && 'meta' in e
        ? String((e as { meta?: { code?: string } }).meta?.code ?? '')
        : '';
    const message = e instanceof Error ? e.message : String(e);
    if (
      !code.includes('ER_DUP_FIELDNAME') &&
      !code.includes('ER_TABLE_EXISTS_ERROR') &&
      !code.includes('ER_DUP_KEYNAME') &&
      metaCode !== '1146' &&
      !/Duplicate column|already exists|Duplicate table|Duplicate key name|doesn't exist/i.test(
        message,
      )
    ) {
      throw e;
    }
  }
}

async function sponsorsHaveSettingsIdColumn(): Promise<boolean> {
  if (hasSettingsIdColumn != null) return hasSettingsIdColumn;
  try {
    const cols = await prisma.$queryRawUnsafe<{ Field: string }[]>(
      'SHOW COLUMNS FROM `ogp_news_sponsors`',
    );
    hasSettingsIdColumn = cols.some((c) => c.Field === 'settingsId');
  } catch {
    hasSettingsIdColumn = false;
  }
  return hasSettingsIdColumn;
}

async function ensureSponsorGroupsSchema() {
  if (schemaReady) return;

  await execIgnoreDuplicate(`
    CREATE TABLE IF NOT EXISTS \`ogp_news_sponsor_groups\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`name\` VARCHAR(191) NOT NULL,
      \`startRow\` INT NOT NULL DEFAULT 2,
      \`intervalRows\` INT NOT NULL DEFAULT 12,
      \`delayMs\` INT NOT NULL DEFAULT 5000,
      \`enabled\` BOOLEAN NOT NULL DEFAULT true,
      \`enabledFrom\` DATETIME NULL,
      \`enabledTo\` DATETIME NULL,
      \`sortOrder\` INT NOT NULL DEFAULT 0,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      INDEX \`ogp_news_sponsor_groups_sortOrder_idx\` (\`sortOrder\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await execIgnoreDuplicate(
    'ALTER TABLE `ogp_news_sponsors` ADD COLUMN `groupId` VARCHAR(191) NULL',
  );
  await execIgnoreDuplicate(
    'ALTER TABLE `ogp_news_sponsors` ADD INDEX `ogp_news_sponsors_groupId_sortOrder_idx` (`groupId`, `sortOrder`)',
  );

  const groupCount = await prisma.$queryRaw<{ c: bigint | number }[]>`
    SELECT COUNT(*) AS c FROM ogp_news_sponsor_groups
  `;
  const count = Number(groupCount[0]?.c ?? 0);
  if (count === 0) {
    let legacy: {
      startRow: number;
      intervalRows: number;
      delayMs: number;
      enabled: number | boolean | null;
      enabledFrom: Date | null;
      enabledTo: Date | null;
    } | null = null;
    try {
      const rows = await prisma.$queryRawUnsafe<
        {
          startRow: number;
          intervalRows: number;
          delayMs: number;
          enabled: number | boolean | null;
          enabledFrom: Date | null;
          enabledTo: Date | null;
        }[]
      >(
        `SELECT startRow, intervalRows, delayMs, enabled, enabledFrom, enabledTo
         FROM ogp_news_sponsor_settings WHERE id = 'default' LIMIT 1`,
      );
      legacy = rows[0] ?? null;
    } catch {
      legacy = null;
    }

    const groupId = newId();
    const startRow = clampStartRow(legacy?.startRow ?? 2);
    const intervalRows = clampIntervalRows(legacy?.intervalRows ?? 12);
    const delayMs = clampDelayMs(legacy?.delayMs ?? SPONSOR_DELAY_MS_DEFAULT);
    const enabled = legacy?.enabled === false || legacy?.enabled === 0 ? 0 : 1;

    await prisma.$executeRaw`
      INSERT INTO ogp_news_sponsor_groups
        (id, name, startRow, intervalRows, delayMs, enabled, enabledFrom, enabledTo, sortOrder, createdAt, updatedAt)
      VALUES
        (${groupId}, ${'Default'}, ${startRow}, ${intervalRows}, ${delayMs}, ${enabled},
         ${legacy?.enabledFrom ?? null}, ${legacy?.enabledTo ?? null}, ${0}, NOW(3), NOW(3))
    `;

    if (await sponsorsHaveSettingsIdColumn()) {
      await prisma.$executeRawUnsafe(
        `UPDATE ogp_news_sponsors SET groupId = ? WHERE groupId IS NULL OR groupId = '' OR settingsId = 'default'`,
        groupId,
      );
    } else {
      await prisma.$executeRaw`
        UPDATE ogp_news_sponsors
        SET groupId = ${groupId}
        WHERE groupId IS NULL OR groupId = ''
      `;
    }
  }

  schemaReady = true;
}

type GroupRow = {
  id: string;
  name: string;
  startRow: number;
  intervalRows: number;
  delayMs: number;
  enabled: number | boolean | null;
  enabledFrom: Date | string | null;
  enabledTo: Date | string | null;
  sortOrder: number;
};

type SponsorRow = {
  id: string;
  groupId: string | null;
  image: string;
  size: string;
  hoverTitle: string | null;
  linkUrl: string;
  linkTarget: string;
  sortOrder: number;
};

function serializeSponsor(s: SponsorRow, index: number): OgpSponsor {
  return {
    id: s.id,
    image: s.image,
    size: isSponsorSize(s.size) ? s.size : 'single',
    hoverTitle: s.hoverTitle ?? '',
    linkUrl: s.linkUrl,
    linkTarget: isSponsorLinkTarget(s.linkTarget) ? s.linkTarget : 'tab',
    sortOrder: s.sortOrder ?? index,
  };
}

function serializeGroup(row: GroupRow, sponsors: SponsorRow[]): OgpSponsorGroup {
  const groupSponsors = sponsors
    .filter((s) => s.groupId === row.id)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  return {
    id: row.id,
    name: row.name,
    startRow: clampStartRow(row.startRow),
    intervalRows: clampIntervalRows(row.intervalRows),
    delayMs: clampDelayMs(row.delayMs),
    enabled: row.enabled !== false && row.enabled !== 0,
    enabledFrom: toSponsorDateInput(row.enabledFrom) || null,
    enabledTo: toSponsorDateInput(row.enabledTo) || null,
    sortOrder: row.sortOrder ?? 0,
    sponsors: groupSponsors.map(serializeSponsor),
  };
}

export async function loadSerializedSponsorSettings(): Promise<OgpSponsorSettings> {
  await ensureSponsorGroupsSchema();
  const groups = await prisma.$queryRaw<GroupRow[]>`
    SELECT id, name, startRow, intervalRows, delayMs, enabled, enabledFrom, enabledTo, sortOrder
    FROM ogp_news_sponsor_groups
    ORDER BY sortOrder ASC, createdAt ASC
  `;
  const allSponsors = await prisma.$queryRawUnsafe<SponsorRow[]>(
    `SELECT id, groupId, image, size, hoverTitle, linkUrl, linkTarget, sortOrder
     FROM ogp_news_sponsors
     WHERE groupId IS NOT NULL AND groupId != ''
     ORDER BY sortOrder ASC`,
  );
  return {
    groups: groups.map((g) => serializeGroup(g, allSponsors)),
  };
}

export async function createSponsorGroup(name: string): Promise<OgpSponsorGroup> {
  await ensureSponsorGroupsSchema();
  const trimmed = name.trim() || 'New group';
  const id = newId();
  const maxOrder = await prisma.$queryRaw<{ m: number | null }[]>`
    SELECT MAX(sortOrder) AS m FROM ogp_news_sponsor_groups
  `;
  const sortOrder = (maxOrder[0]?.m ?? -1) + 1;
  await prisma.$executeRaw`
    INSERT INTO ogp_news_sponsor_groups
      (id, name, startRow, intervalRows, delayMs, enabled, enabledFrom, enabledTo, sortOrder, createdAt, updatedAt)
    VALUES
      (${id}, ${trimmed}, ${2}, ${12}, ${SPONSOR_DELAY_MS_DEFAULT}, ${1},
       ${null}, ${null}, ${sortOrder}, NOW(3), NOW(3))
  `;
  const settings = await loadSerializedSponsorSettings();
  const created = settings.groups.find((g) => g.id === id);
  if (!created) throw new Error('Failed to create sponsor group');
  return created;
}

export async function renameSponsorGroup(id: string, name: string): Promise<OgpSponsorGroup> {
  await ensureSponsorGroupsSchema();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Group name is required');
  await prisma.$executeRaw`
    UPDATE ogp_news_sponsor_groups SET name = ${trimmed}, updatedAt = NOW(3) WHERE id = ${id}
  `;
  const settings = await loadSerializedSponsorSettings();
  const group = settings.groups.find((g) => g.id === id);
  if (!group) throw new Error('Sponsor group not found');
  return group;
}

export async function deleteSponsorGroup(id: string): Promise<void> {
  await ensureSponsorGroupsSchema();
  await prisma.$executeRaw`DELETE FROM ogp_news_sponsors WHERE groupId = ${id}`;
  await prisma.$executeRaw`DELETE FROM ogp_news_sponsor_groups WHERE id = ${id}`;
}

export type SaveSponsorGroupInput = {
  name?: string;
  startRow: number;
  intervalRows: number;
  delayMs: number;
  enabled: boolean;
  enabledFrom: Date | null;
  enabledTo: Date | null;
  sponsors: {
    id: string | null;
    image: string;
    size: OgpSponsorSize;
    hoverTitle: string | null;
    linkUrl: string;
    linkTarget: OgpSponsorLinkTarget;
    sortOrder: number;
  }[];
};

export async function saveSponsorGroup(
  groupId: string,
  input: SaveSponsorGroupInput,
): Promise<OgpSponsorGroup> {
  await ensureSponsorGroupsSchema();
  const existing = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM ogp_news_sponsor_groups WHERE id = ${groupId} LIMIT 1
  `;
  if (!existing[0]) throw new Error('Sponsor group not found');

  const startRow = clampStartRow(input.startRow);
  const intervalRows = clampIntervalRows(input.intervalRows);
  const delayMs = clampDelayMs(input.delayMs);
  const enabled = input.enabled ? 1 : 0;
  const name = typeof input.name === 'string' && input.name.trim() ? input.name.trim() : null;

  if (name) {
    await prisma.$executeRaw`
      UPDATE ogp_news_sponsor_groups
      SET name = ${name},
          startRow = ${startRow},
          intervalRows = ${intervalRows},
          delayMs = ${delayMs},
          enabled = ${enabled},
          enabledFrom = ${input.enabledFrom},
          enabledTo = ${input.enabledTo},
          updatedAt = NOW(3)
      WHERE id = ${groupId}
    `;
  } else {
    await prisma.$executeRaw`
      UPDATE ogp_news_sponsor_groups
      SET startRow = ${startRow},
          intervalRows = ${intervalRows},
          delayMs = ${delayMs},
          enabled = ${enabled},
          enabledFrom = ${input.enabledFrom},
          enabledTo = ${input.enabledTo},
          updatedAt = NOW(3)
      WHERE id = ${groupId}
    `;
  }

  const current = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM ogp_news_sponsors WHERE groupId = ${groupId}
  `;
  const keepIds = new Set(
    input.sponsors.map((s) => s.id).filter((id): id is string => !!id),
  );
  const deleteIds = current.map((s) => s.id).filter((id) => !keepIds.has(id));
  for (const id of deleteIds) {
    await prisma.$executeRaw`DELETE FROM ogp_news_sponsors WHERE id = ${id}`;
  }

  const withSettingsId = await sponsorsHaveSettingsIdColumn();

  for (const sponsor of input.sponsors) {
    if (sponsor.id && keepIds.has(sponsor.id) && current.some((c) => c.id === sponsor.id)) {
      await prisma.$executeRaw`
        UPDATE ogp_news_sponsors
        SET image = ${sponsor.image},
            size = ${sponsor.size},
            hoverTitle = ${sponsor.hoverTitle},
            linkUrl = ${sponsor.linkUrl},
            linkTarget = ${sponsor.linkTarget},
            sortOrder = ${sponsor.sortOrder},
            groupId = ${groupId},
            updatedAt = NOW(3)
        WHERE id = ${sponsor.id}
      `;
    } else {
      const id = newId();
      if (withSettingsId) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO ogp_news_sponsors
            (id, groupId, settingsId, image, size, hoverTitle, linkUrl, linkTarget, sortOrder, createdAt, updatedAt)
           VALUES (?, ?, 'default', ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
          id,
          groupId,
          sponsor.image,
          sponsor.size,
          sponsor.hoverTitle,
          sponsor.linkUrl,
          sponsor.linkTarget,
          sponsor.sortOrder,
        );
      } else {
        await prisma.$executeRaw`
          INSERT INTO ogp_news_sponsors
            (id, groupId, image, size, hoverTitle, linkUrl, linkTarget, sortOrder, createdAt, updatedAt)
          VALUES
            (${id}, ${groupId}, ${sponsor.image}, ${sponsor.size}, ${sponsor.hoverTitle},
             ${sponsor.linkUrl}, ${sponsor.linkTarget}, ${sponsor.sortOrder}, NOW(3), NOW(3))
        `;
      }
    }
  }

  const settings = await loadSerializedSponsorSettings();
  const group = settings.groups.find((g) => g.id === groupId);
  if (!group) throw new Error('Sponsor group not found after save');
  return group;
}
