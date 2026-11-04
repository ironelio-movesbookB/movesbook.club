import { prisma } from '@/lib/prisma';
import { getClubLegalDocuments } from '@/lib/club/clubLegalDocuments';
import {
  sourceLabel,
  type DocumentSourceKey,
} from '@/lib/club/clubDocumentsFolder';
import {
  listClubMembersArchive,
  listTeamMembersArchive,
} from '@/lib/club/archives/clubArchiveService';
import { listClubStaff } from '@/lib/club/clubStaffService';
import { fetchProductSaleFormOptions } from '@/lib/procedures/productSaleFormOptions';
import type { ClubAuthContext } from '@/lib/procedures/types';
import {
  buildCourseTimetableRows,
  COURSE_TIMETABLE_DAY_INDEXES,
  COURSE_TIMETABLE_DAY_NAMES,
} from '@/lib/clubCourseTimetable';
import type { MemberArchiveStatus } from '@/lib/club/memberArchiveStatus';

const LISTPRICE_TABLE_CANDIDATES = [
  'club_setting_typology_listprices',
  'club_setting_typology_listprice',
];
const TYPOLOGY_TABLE_CANDIDATES = [
  'club_setting_subscription_typologies',
  'club_setting_subscription_typology',
];
const TIMETABLE_TABLE_CANDIDATES = ['club_card_timetables', 'club_card_timetable'];
const SERVICE_TABLE_CANDIDATES = ['club_setting_services', 'club_setting_service'];
const SECTOR_TABLE_CANDIDATES = ['club_setting_sectors', 'club_setting_sector'];

type SectionBlock = {
  key: DocumentSourceKey;
  title: string;
  columns: string[];
  rows: string[][];
  /** Plain text / HTML appendix (e.g. club rules). */
  bodyHtml?: string;
  emptyMessage?: string;
};

async function findExistingTable(candidates: string[]): Promise<string | null> {
  const placeholders = candidates.map(() => '?').join(',');
  const rows = await prisma.$queryRawUnsafe<{ TABLE_NAME: string }[]>(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${placeholders})`,
    ...candidates,
  );
  const existing = new Set(rows.map((row) => row.TABLE_NAME));
  return candidates.find((c) => existing.has(c)) ?? null;
}

async function getTableColumns(tableName: string): Promise<Set<string>> {
  const rows = await prisma.$queryRawUnsafe<{ COLUMN_NAME: string }[]>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    tableName,
  );
  return new Set(rows.map((row) => row.COLUMN_NAME));
}

/** Same identity resolution as typology_subscription / services settings APIs. */
async function resolveAdminUserIds(adminUserId: string): Promise<string[]> {
  const ids = new Set<string>([adminUserId]);
  const fromId = adminUserId.match(/^legacy_(\d+)(?:_|$)/);
  if (fromId?.[1]) {
    ids.add(fromId[1]);
    return Array.from(ids);
  }
  const mappingTable = await findExistingTable(['legacy_id_mappings']);
  if (!mappingTable) return Array.from(ids);
  const rows = await prisma.$queryRawUnsafe<{ legacy_id: number | string }[]>(
    `SELECT legacy_id FROM \`${mappingTable}\`
     WHERE new_id = ? AND legacy_table = 'users'
     ORDER BY legacy_id DESC LIMIT 1`,
    adminUserId,
  );
  if (rows[0]?.legacy_id != null) ids.add(String(rows[0].legacy_id));
  return Array.from(ids);
}

async function resolveClubIds(clubId: string | null): Promise<string[]> {
  if (!clubId) return [];
  const ids = new Set<string>([clubId]);
  const mappingTable = await findExistingTable(['legacy_id_mappings']);
  if (!mappingTable) return Array.from(ids);
  const rows = await prisma.$queryRawUnsafe<{ legacy_id: number | string }[]>(
    `SELECT legacy_id FROM \`${mappingTable}\`
     WHERE new_id = ? AND legacy_table = 'clubs'
     ORDER BY legacy_id DESC LIMIT 1`,
    clubId,
  );
  if (rows[0]?.legacy_id != null) ids.add(String(rows[0].legacy_id));
  return Array.from(ids);
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&rsquo;|&#8217;/gi, "'")
    .replace(/&lsquo;|&#8216;/gi, "'")
    .replace(/&rdquo;|&#8221;/gi, '"')
    .replace(/&ldquo;|&#8220;/gi, '"')
    .replace(/&mdash;|&#8212;/gi, '—')
    .replace(/&ndash;|&#8211;/gi, '–')
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return Number.isFinite(n) && n > 0 ? String.fromCharCode(n) : ' ';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const n = Number.parseInt(hex, 16);
      return Number.isFinite(n) && n > 0 ? String.fromCharCode(n) : ' ';
    })
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** jsPDF default fonts are WinAnsi; drop chars that would render as garbage. */
function pdfSafeText(value: string): string {
  return value.replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '');
}

function authContext(params: {
  adminUserId: string;
  entityId: string;
  entityName: string;
  kind: 'club' | 'team';
}): ClubAuthContext {
  return {
    userId: params.adminUserId,
    club: { id: params.entityId, name: params.entityName },
    workspaceKind: params.kind,
  };
}

function htmlTable(columns: string[], rows: string[][], emptyMessage: string): string {
  if (rows.length === 0) {
    return `<p><em>${esc(emptyMessage)}</em></p>`;
  }
  return `
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;margin:12px 0;">
      <thead>
        <tr style="background:#134e4a;color:#fff;">
          ${columns.map((c) => `<th align="left">${esc(c)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) =>
              `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`,
          )
          .join('')}
      </tbody>
    </table>`;
}

async function buildCoursesListPricesSection(
  adminUserId: string,
  clubId: string | null,
): Promise<SectionBlock> {
  const typologyTable = await findExistingTable(TYPOLOGY_TABLE_CANDIDATES);
  const listpriceTable = await findExistingTable(LISTPRICE_TABLE_CANDIDATES);
  const columns = [
    'Course',
    'Active',
    'Description',
    'Cost',
    'Months',
    'Installments',
    'Recursivity',
    '1st installment',
  ];
  const rows: string[][] = [];

  if (!typologyTable) {
    return {
      key: 'courses-listprices',
      title: sourceLabel('courses-listprices'),
      columns,
      rows,
      emptyMessage: 'No courses (subscription typologies) found.',
    };
  }

  const userIds = await resolveAdminUserIds(adminUserId);
  const clubIds = await resolveClubIds(clubId);
  const userPlaceholders = userIds.map(() => '?').join(',');
  const typologyCols = await getTableColumns(typologyTable);
  const hasTypologyClub = typologyCols.has('club_id');

  const typologyBase = `
    SELECT * FROM \`${typologyTable}\`
    WHERE user_id IN (${userPlaceholders})`;
  let typologies: Record<string, unknown>[] = [];
  if (hasTypologyClub && clubIds.length > 0) {
    const clubPlaceholders = clubIds.map(() => '?').join(',');
    typologies = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `${typologyBase} AND club_id IN (${clubPlaceholders}) ORDER BY activity_name ASC`,
      ...userIds,
      ...clubIds,
    );
  }
  if (typologies.length === 0) {
    typologies = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `${typologyBase} ORDER BY activity_name ASC`,
      ...userIds,
    );
  }

  const lpCols = listpriceTable ? await getTableColumns(listpriceTable) : null;
  const hasLpClub = Boolean(lpCols?.has('club_id'));

  for (const typology of typologies) {
    const typologyId = String(typology.id ?? '');
    const courseName = String(
      typology.activity_name || typology.name || `Course #${typologyId}`,
    );
    if (!listpriceTable || !typologyId) {
      rows.push([courseName, '-', '-', '-', '-', '-', '-', '-']);
      continue;
    }

    const priceBase = `
      SELECT * FROM \`${listpriceTable}\`
      WHERE user_id IN (${userPlaceholders}) AND typology_id = ?`;
    let prices: Record<string, unknown>[] = [];
    if (hasLpClub && clubIds.length > 0) {
      const clubPlaceholders = clubIds.map(() => '?').join(',');
      prices = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `${priceBase} AND club_id IN (${clubPlaceholders}) ORDER BY id ASC`,
        ...userIds,
        typologyId,
        ...clubIds,
      );
    }
    if (prices.length === 0) {
      prices = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `${priceBase} ORDER BY id ASC`,
        ...userIds,
        typologyId,
      );
    }

    if (prices.length === 0) {
      rows.push([courseName, '-', 'No list prices', '-', '-', '-', '-', '-']);
      continue;
    }
    for (const row of prices) {
      const active = String(row.active_status || 'Y').toUpperCase() === 'Y' ? 'Y' : 'N';
      rows.push([
        courseName,
        active,
        String(row.subscription_name ?? '-'),
        String(row.cost ?? '-'),
        String(row.sale_duration_months ?? '-'),
        String(row.installnment ?? '-'),
        String(row.days_recursion ?? '-'),
        String(row.first_cost_installnment ?? '-'),
      ]);
    }
  }

  return {
    key: 'courses-listprices',
    title: sourceLabel('courses-listprices'),
    columns,
    rows,
    emptyMessage: 'No courses found for this club.',
  };
}

async function buildCoursesTimetablesSection(
  adminUserId: string,
  clubId: string | null,
): Promise<SectionBlock> {
  const columns = ['Course', ...COURSE_TIMETABLE_DAY_NAMES];
  const timetableTable = await findExistingTable(TIMETABLE_TABLE_CANDIDATES);
  const typologyTable = await findExistingTable(TYPOLOGY_TABLE_CANDIDATES);
  if (!timetableTable || !typologyTable) {
    return {
      key: 'courses-timetables',
      title: sourceLabel('courses-timetables'),
      columns,
      rows: [],
      emptyMessage: 'No course timetables found.',
    };
  }

  const userIds = await resolveAdminUserIds(adminUserId);
  const clubIds = await resolveClubIds(clubId);
  const userPlaceholders = userIds.map(() => '?').join(',');
  const typologyColumns = await getTableColumns(typologyTable);
  const hasColor = typologyColumns.has('color');
  const hasClubId = typologyColumns.has('club_id');
  const colorSelect = hasColor ? 'COALESCE(ty.color, \'\') AS color' : '\'\' AS color';

  type TimetableJoinRow = {
    typology_message_id: string | number;
    am_time: string | null;
    pm_time: string | null;
    activity_name: string | null;
    color: string | null;
  };

  const baseSql = `
    SELECT
      t.typology_message_id,
      t.am_time,
      t.pm_time,
      ty.activity_name,
      ${colorSelect}
    FROM \`${timetableTable}\` t
    INNER JOIN \`${typologyTable}\` ty ON ty.id = t.typology_message_id
    WHERE t.user_id IN (${userPlaceholders})
      AND ty.user_id IN (${userPlaceholders})`;

  let raw: TimetableJoinRow[] = [];
  if (hasClubId && clubIds.length > 0) {
    const clubPlaceholders = clubIds.map(() => '?').join(',');
    raw = await prisma.$queryRawUnsafe<TimetableJoinRow[]>(
      `${baseSql} AND ty.club_id IN (${clubPlaceholders}) ORDER BY t.id ASC`,
      ...userIds,
      ...userIds,
      ...clubIds,
    );
  }
  if (raw.length === 0) {
    raw = await prisma.$queryRawUnsafe<TimetableJoinRow[]>(
      `${baseSql} ORDER BY t.id ASC`,
      ...userIds,
      ...userIds,
    );
  }

  const built = buildCourseTimetableRows(
    raw.map((row) => ({
      typologyId: String(row.typology_message_id),
      amTime: row.am_time,
      pmTime: row.pm_time,
      activityName: String(row.activity_name || ''),
      color: String(row.color || ''),
    })),
  );

  const rows = built.map((course) => [
    course.courseName,
    ...COURSE_TIMETABLE_DAY_INDEXES.map((day) => (course.days[day] || []).join(', ') || '-'),
  ]);

  return {
    key: 'courses-timetables',
    title: sourceLabel('courses-timetables'),
    columns,
    rows,
    emptyMessage: 'No course timetables found.',
  };
}

async function buildServicesSection(
  adminUserId: string,
  clubId: string | null,
): Promise<SectionBlock> {
  const columns = ['Sector', 'Service', 'Cost', 'Qty', 'Available'];
  const serviceTable = await findExistingTable(SERVICE_TABLE_CANDIDATES);
  if (!serviceTable) {
    return {
      key: 'services',
      title: sourceLabel('services'),
      columns,
      rows: [],
      emptyMessage: 'No services found.',
    };
  }
  const userIds = await resolveAdminUserIds(adminUserId);
  const clubIds = await resolveClubIds(clubId);
  const userPlaceholders = userIds.map(() => '?').join(',');
  const sectorTable = await findExistingTable(SECTOR_TABLE_CANDIDATES);
  const cols = await getTableColumns(serviceTable);
  const hasClubId = cols.has('club_id');
  const sectorJoin = sectorTable
    ? `LEFT JOIN \`${sectorTable}\` sec ON CAST(sec.id AS CHAR) = CAST(svc.sector_id AS CHAR)`
    : '';
  const sectorSelect = sectorTable
    ? 'COALESCE(sec.sector_name, \'\') AS sector_name'
    : '\'\' AS sector_name';

  const baseSql = `
    SELECT svc.*, ${sectorSelect}
    FROM \`${serviceTable}\` svc
    ${sectorJoin}
    WHERE svc.user_id IN (${userPlaceholders})`;

  let services: Record<string, unknown>[] = [];
  if (hasClubId && clubIds.length > 0) {
    const clubPlaceholders = clubIds.map(() => '?').join(',');
    services = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `${baseSql} AND svc.club_id IN (${clubPlaceholders})
       ORDER BY sector_name ASC, service_name ASC`,
      ...userIds,
      ...clubIds,
    );
  }
  // Match settings Services table: if no club-scoped rows, list all for this admin.
  if (services.length === 0) {
    services = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `${baseSql} ORDER BY sector_name ASC, service_name ASC`,
      ...userIds,
    );
  }

  const rows = services.map((row) => {
    const availableRaw = row.service_available;
    const available =
      availableRaw === false ||
      availableRaw === 0 ||
      availableRaw === '0' ||
      String(availableRaw).toLowerCase() === 'n'
        ? 'No'
        : 'Yes';
    return [
      String(row.sector_name || '-'),
      String(row.service_name || '-'),
      String(row.club_currency_cost ?? row.actual_cost ?? '-'),
      String(row.service_qty ?? '-'),
      available,
    ];
  });

  return {
    key: 'services',
    title: sourceLabel('services'),
    columns,
    rows,
    emptyMessage: 'No services found.',
  };
}

async function buildProductsSection(ctx: ClubAuthContext): Promise<SectionBlock> {
  const columns = ['Product', 'Price'];
  try {
    const options = await fetchProductSaleFormOptions(ctx);
    return {
      key: 'products-catalog',
      title: sourceLabel('products-catalog'),
      columns,
      rows: options.products.map((p) => [p.name, String(p.cost)]),
      emptyMessage: 'No products found.',
    };
  } catch {
    return {
      key: 'products-catalog',
      title: sourceLabel('products-catalog'),
      columns,
      rows: [],
      emptyMessage: 'Could not load products catalog.',
    };
  }
}

async function buildStaffSection(ctx: ClubAuthContext): Promise<SectionBlock> {
  const columns = ['Name', 'Username', 'Email', 'Type', 'Role'];
  try {
    const staff = await listClubStaff(ctx);
    return {
      key: 'staff',
      title: sourceLabel('staff'),
      columns,
      rows: staff.map((s) => [
        s.name || '-',
        s.username || '-',
        s.email || '-',
        s.staffTypeLabel || s.staffType || '-',
        s.role || '-',
      ]),
      emptyMessage: 'No staff found.',
    };
  } catch {
    return {
      key: 'staff',
      title: sourceLabel('staff'),
      columns,
      rows: [],
      emptyMessage: 'Could not load staff list.',
    };
  }
}

async function buildMembersSection(
  ctx: ClubAuthContext,
  key: Extract<
    DocumentSourceKey,
    'members' | 'not-members' | 'members-pending' | 'members-archived'
  >,
): Promise<SectionBlock> {
  const statusMap: Record<typeof key, MemberArchiveStatus> = {
    members: 'member',
    'not-members': 'not_member',
    'members-pending': 'pending',
    'members-archived': 'archived',
  };
  const columns = ['Name', 'Surname', 'Gender', 'Date of birth', 'Type', 'City', 'Status'];
  try {
    const pageSize = 500;
    const items: Record<string, unknown>[] = [];
    let page = 1;
    let total = Infinity;
    while (items.length < total && page <= 200) {
      const list =
        ctx.workspaceKind === 'team' || ctx.workspaceKind === 'coach'
          ? await listTeamMembersArchive(ctx, {
              membershipStatus: statusMap[key],
              page,
              pageSize,
            })
          : await listClubMembersArchive(ctx, {
              membershipStatus: statusMap[key],
              page,
              pageSize,
            });
      total = list.total;
      if (list.items.length === 0) break;
      // Staff-only rows belong in "List of Staff", not member archives.
      items.push(...list.items.filter((row) => !row.isStaffOnly));
      if (list.items.length < pageSize) break;
      page += 1;
    }
    return {
      key,
      title: sourceLabel(key),
      columns,
      rows: items.map((row) => [
        String(row.name ?? '-'),
        String(row.surname ?? '-'),
        String(row.gender ?? '-'),
        String(row.dateOfBirth ?? '-'),
        String(row.memberType ?? '-'),
        String(row.localCity ?? row.Localcity ?? '-'),
        String(row.membershipStatus ?? '-'),
      ]),
      emptyMessage: 'No people in this list.',
    };
  } catch {
    return {
      key,
      title: sourceLabel(key),
      columns,
      rows: [],
      emptyMessage: 'Could not load this member list.',
    };
  }
}

function buildCommonRulesSection(description: string | null): SectionBlock {
  const legal = getClubLegalDocuments(description);
  const html = legal.rulesHtml?.trim() || '';
  return {
    key: 'common-rules',
    title: sourceLabel('common-rules'),
    columns: [],
    rows: [],
    bodyHtml: html || '<p><em>Rules of the Club/Team have not been written yet.</em></p>',
    emptyMessage: 'Rules of the Club/Team have not been written yet.',
  };
}

function sectionToHtml(section: SectionBlock): string {
  const parts = [`<h2>${esc(section.title)}</h2>`];
  if (section.bodyHtml) {
    parts.push(`<div>${section.bodyHtml}</div>`);
  }
  if (section.columns.length > 0) {
    parts.push(
      htmlTable(
        section.columns,
        section.rows,
        section.emptyMessage || 'No data.',
      ),
    );
  }
  return parts.join('\n');
}

async function buildPdfBuffer(params: {
  entityName: string;
  title: string;
  sections: SectionBlock[];
  orientation?: 'portrait' | 'landscape';
}): Promise<Buffer> {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  // CJS/ESM interop: webpack may expose the fn on `.default`, Node often on `.default.default`.
  const autoTableCandidate = autoTableMod.default ?? autoTableMod;
  const autoTable =
    typeof autoTableCandidate === 'function'
      ? autoTableCandidate
      : typeof (autoTableCandidate as { default?: unknown })?.default === 'function'
        ? (autoTableCandidate as { default: typeof import('jspdf-autotable').default }).default
        : null;
  if (!autoTable) {
    throw new Error('jspdf-autotable failed to load');
  }
  const orientation = params.orientation || 'landscape';
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const today = new Date().toISOString().slice(0, 10);
  const pageBottom = orientation === 'portrait' ? 275 : 190;
  const sectionBreakY = orientation === 'portrait' ? 260 : 175;

  doc.setFontSize(16);
  doc.text(pdfSafeText(params.title), 14, 16);
  doc.setFontSize(11);
  doc.text(pdfSafeText(params.entityName), 14, 23);
  doc.setFontSize(9);
  doc.text(`Generated on ${today}`, 14, 29);

  let y = 36;
  for (const section of params.sections) {
    if (y > sectionBreakY) {
      doc.addPage();
      y = 16;
    }
    // Avoid printing the same title twice for single-HTML documents (email Rules/Privacy).
    const skipSectionTitle =
      Boolean(section.bodyHtml) &&
      section.columns.length === 0 &&
      section.title.trim().toLowerCase() === params.title.trim().toLowerCase();
    if (!skipSectionTitle && section.title.trim()) {
      doc.setFontSize(12);
      doc.text(pdfSafeText(section.title), 14, y);
      y += 6;
    }

    if (section.bodyHtml) {
      const plain =
        pdfSafeText(stripHtml(section.bodyHtml)) ||
        section.emptyMessage ||
        'This document has no readable text content.';
      const lines = doc.splitTextToSize(plain || '—', doc.internal.pageSize.getWidth() - 28);
      doc.setFontSize(9);
      for (const line of lines as string[]) {
        if (y > pageBottom) {
          doc.addPage();
          y = 16;
        }
        doc.text(line, 14, y);
        y += 5;
      }
      y += 6;
      continue;
    }

    autoTable(doc, {
      startY: y,
      head: [section.columns.length ? section.columns.map(pdfSafeText) : ['Info']],
      body:
        section.rows.length > 0
          ? section.rows.map((row) => row.map(pdfSafeText))
          : [[section.emptyMessage || 'No data.']],
      styles: { fontSize: 7, cellPadding: 1.2, overflow: 'linebreak' },
      headStyles: { fillColor: [19, 78, 74], textColor: 255 },
      margin: { left: 14, right: 14 },
    });
    y =
      ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
        y) + 10;
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.text(
      `${page} / ${pages}`,
      doc.internal.pageSize.getWidth() - 14,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'right' },
    );
  }

  const arrayBuffer = doc.output('arraybuffer') as ArrayBuffer;
  return Buffer.from(arrayBuffer);
}

/** Rebuild a PDF snapshot after the generated document HTML was edited. */
export async function buildPdfBufferFromHtmlContent(params: {
  title: string;
  entityName: string;
  html: string;
  orientation?: 'portrait' | 'landscape';
}): Promise<Buffer> {
  return buildPdfBuffer({
    title: params.title,
    entityName: params.entityName,
    orientation: params.orientation || 'portrait',
    sections: [
      {
        key: 'common-rules',
        title: params.title,
        columns: [],
        rows: [],
        bodyHtml: params.html || '<p><em>Empty document.</em></p>',
      },
    ],
  });
}

export async function generateDocumentsBundle(params: {
  sourceKeys: DocumentSourceKey[];
  adminUserId: string;
  entityId: string;
  entityName: string;
  kind: 'club' | 'team';
  description: string | null;
}): Promise<{ title: string; html: string; pdfBuffer: Buffer; fileName: string }> {
  const keys = params.sourceKeys.filter(Boolean);
  const clubId = params.kind === 'club' ? params.entityId : null;
  const ctx = authContext({
    adminUserId: params.adminUserId,
    entityId: params.entityId,
    entityName: params.entityName,
    kind: params.kind,
  });

  const sections: SectionBlock[] = [];
  for (const key of keys) {
    switch (key) {
      case 'courses-listprices':
        sections.push(await buildCoursesListPricesSection(params.adminUserId, clubId));
        break;
      case 'courses-timetables':
        sections.push(await buildCoursesTimetablesSection(params.adminUserId, clubId));
        break;
      case 'services':
        sections.push(await buildServicesSection(params.adminUserId, clubId));
        break;
      case 'products-catalog':
        sections.push(await buildProductsSection(ctx));
        break;
      case 'staff':
        sections.push(await buildStaffSection(ctx));
        break;
      case 'members':
      case 'not-members':
      case 'members-pending':
      case 'members-archived':
        sections.push(await buildMembersSection(ctx, key));
        break;
      case 'common-rules':
        sections.push(buildCommonRulesSection(params.description));
        break;
      default:
        break;
    }
  }

  const title =
    keys.length === 1
      ? sourceLabel(keys[0]!)
      : keys.length > 1
        ? `Generated documents (${keys.length})`
        : 'Generated document';

  const html = [
    `<h1>${esc(title)} — ${esc(params.entityName)}</h1>`,
    `<p>Generated on ${esc(new Date().toLocaleString())}</p>`,
    ...sections.map(sectionToHtml),
  ].join('\n');

  const pdfBuffer = await buildPdfBuffer({
    entityName: params.entityName,
    title,
    sections,
  });

  const slug =
    title
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
      .slice(0, 60) || 'generated-document';
  const fileName = `${slug}-${new Date().toISOString().slice(0, 10)}.pdf`;

  return { title, html, pdfBuffer, fileName };
}

/** @deprecated use generateDocumentsBundle */
export async function generateDocumentsHtml(params: {
  sourceKeys: DocumentSourceKey[];
  adminUserId: string;
  clubId: string | null;
  description: string | null;
  entityName: string;
}): Promise<{ title: string; html: string }> {
  const bundle = await generateDocumentsBundle({
    sourceKeys: params.sourceKeys,
    adminUserId: params.adminUserId,
    entityId: params.clubId || 'unknown',
    entityName: params.entityName,
    kind: params.clubId ? 'club' : 'team',
    description: params.description,
  });
  return { title: bundle.title, html: bundle.html };
}
