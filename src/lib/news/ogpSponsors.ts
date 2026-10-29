export const OGP_CARDS_PER_ROW = 6;

export const SPONSOR_START_ROW_MIN = 1;
export const SPONSOR_START_ROW_MAX = 5;
export const SPONSOR_INTERVAL_MIN = 3;
export const SPONSOR_INTERVAL_MAX = 99;
export const SPONSOR_DELAY_MS_MIN = 1000;
export const SPONSOR_DELAY_MS_MAX = 60_000;
export const SPONSOR_DELAY_MS_DEFAULT = 5000;

export type OgpSponsorSize = 'single' | 'double' | 'triple' | 'quadruple';
export type OgpSponsorColSpan = 1 | 2 | 3 | 4;

const SPONSOR_SIZE_COLS: Record<OgpSponsorSize, OgpSponsorColSpan> = {
  single: 1,
  double: 2,
  triple: 3,
  quadruple: 4,
};

export type OgpSponsorLinkTarget = 'tab' | 'window';

export type OgpSponsor = {
  id: string;
  image: string;
  size: OgpSponsorSize;
  hoverTitle: string;
  linkUrl: string;
  linkTarget: OgpSponsorLinkTarget;
  sortOrder: number;
};

/** One named group of rotating sponsors with its own placement + schedule. */
export type OgpSponsorGroup = {
  id: string;
  name: string;
  startRow: number;
  intervalRows: number;
  delayMs: number;
  enabled: boolean;
  /** Inclusive YYYY-MM-DD; null/empty = no start bound. */
  enabledFrom: string | null;
  /** Inclusive YYYY-MM-DD; null/empty = no end bound. */
  enabledTo: string | null;
  sortOrder: number;
  sponsors: OgpSponsor[];
};

/** Payload for the Sponsored News settings + feed. */
export type OgpSponsorSettings = {
  groups: OgpSponsorGroup[];
};

/** @deprecated Use OgpSponsorGroup fields via isSponsorDisplayActive. */
export type OgpSponsorSchedule = Pick<
  OgpSponsorGroup,
  'enabled' | 'enabledFrom' | 'enabledTo'
>;

/** Normalize ISO / Date / YYYY-MM-DD to `YYYY-MM-DD` for `<input type="date">`. */
export function toSponsorDateInput(value: string | Date | null | undefined): string {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const s = String(value).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '';
    return toSponsorDateInput(d);
  } catch {
    return '';
  }
}

/** Parse `YYYY-MM-DD` (or empty) to a UTC midnight Date, or null. */
export function parseSponsorDateInput(value: unknown): Date | null {
  if (value == null) return null;
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function todayYmd(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Whether a sponsor group should appear in the feed right now.
 * `enabled` must be true; optional from/to are inclusive calendar days (local).
 */
export function isSponsorDisplayActive(
  settings: OgpSponsorSchedule | null | undefined,
  now = new Date(),
): boolean {
  if (!settings || settings.enabled === false) return false;
  const today = todayYmd(now);
  const from = toSponsorDateInput(settings.enabledFrom);
  const to = toSponsorDateInput(settings.enabledTo);
  if (from && today < from) return false;
  if (to && today > to) return false;
  return true;
}

export function activeSponsorGroups(
  settings: OgpSponsorSettings | null | undefined,
  now = new Date(),
): OgpSponsorGroup[] {
  if (!settings?.groups?.length) return [];
  return settings.groups.filter(
    (g) => isSponsorDisplayActive(g, now) && g.sponsors.length > 0,
  );
}

export type SponsoredPageCell<T> =
  | { kind: 'news'; item: T }
  | { kind: 'sponsor'; groupId: string };

function toInt(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n);
}

export function clampStartRow(value: unknown): number {
  return Math.min(
    SPONSOR_START_ROW_MAX,
    Math.max(SPONSOR_START_ROW_MIN, toInt(value, 2)),
  );
}

export function clampIntervalRows(value: unknown): number {
  return Math.min(
    SPONSOR_INTERVAL_MAX,
    Math.max(SPONSOR_INTERVAL_MIN, toInt(value, 12)),
  );
}

export function clampDelayMs(value: unknown): number {
  return Math.min(
    SPONSOR_DELAY_MS_MAX,
    Math.max(SPONSOR_DELAY_MS_MIN, toInt(value, SPONSOR_DELAY_MS_DEFAULT)),
  );
}

export function isSponsorSize(value: unknown): value is OgpSponsorSize {
  return value === 'single' || value === 'double' || value === 'triple' || value === 'quadruple';
}

export function isSponsorLinkTarget(value: unknown): value is OgpSponsorLinkTarget {
  return value === 'tab' || value === 'window';
}

export function sponsorColsForSize(size: OgpSponsorSize): OgpSponsorColSpan {
  return SPONSOR_SIZE_COLS[size] ?? 1;
}

export function maxSponsorCols(sponsors: Pick<OgpSponsor, 'size'>[]): OgpSponsorColSpan {
  return sponsors.reduce<OgpSponsorColSpan>(
    (max, s) => {
      const cols = sponsorColsForSize(s.size);
      return cols > max ? cols : max;
    },
    1,
  );
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export type OgpSponsorSourceArticle = {
  id: string;
  title: string;
  image: string;
  url: string;
};

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, '').toLowerCase();
}

/** Prefer a custom picture; otherwise use the selected / URL-matched OGP News picture. */
export function resolveSponsorImage(
  draft: { image?: string | null; ogpArticleId?: string | null; linkUrl?: string | null },
  ogpArticles: OgpSponsorSourceArticle[],
): string {
  const custom = typeof draft.image === 'string' ? draft.image.trim() : '';
  if (custom) return custom;
  const byId = draft.ogpArticleId
    ? ogpArticles.find((a) => a.id === draft.ogpArticleId)
    : undefined;
  if (byId?.image) return byId.image.trim();
  const link = typeof draft.linkUrl === 'string' ? normalizeUrl(draft.linkUrl) : '';
  if (!link) return '';
  const byUrl = ogpArticles.find((a) => normalizeUrl(a.url) === link);
  return byUrl?.image?.trim() || '';
}

export function findOgpArticleForSponsor(
  draft: { ogpArticleId?: string | null; linkUrl?: string | null },
  ogpArticles: OgpSponsorSourceArticle[],
): OgpSponsorSourceArticle | undefined {
  if (draft.ogpArticleId) {
    const byId = ogpArticles.find((a) => a.id === draft.ogpArticleId);
    if (byId) return byId;
  }
  const link = typeof draft.linkUrl === 'string' ? normalizeUrl(draft.linkUrl) : '';
  if (!link) return undefined;
  return ogpArticles.find((a) => normalizeUrl(a.url) === link);
}

/** 1-based local rows on this page that should show a sponsor (before last-row clamp). */
export function sponsorLocalRowsOnPage(
  page: number,
  startRow: number,
  intervalRows: number,
  rowsPerPage: number,
): number[] {
  if (page < 1 || rowsPerPage < 1) return [];
  const a = clampStartRow(startRow);
  const b = clampIntervalRows(intervalRows);
  const pageFirst = (page - 1) * rowsPerPage + 1;
  const pageLast = page * rowsPerPage;
  const rows: number[] = [];
  const firstK = a >= pageFirst ? 0 : Math.ceil((pageFirst - a) / b);
  for (let k = firstK; k < firstK + rowsPerPage + 2; k++) {
    const globalRow = a + k * b;
    if (globalRow > pageLast) break;
    if (globalRow >= pageFirst) {
      rows.push(globalRow - pageFirst + 1);
    }
  }
  return rows;
}

export function clampToLastAvailableRow(localRow: number, actualRowsOnPage: number): number {
  if (actualRowsOnPage <= 0) return 1;
  return Math.min(Math.max(1, localRow), actualRowsOnPage);
}

export type SponsorPlacementInput = {
  groupId: string;
  startRow: number;
  intervalRows: number;
  sponsorCols: OgpSponsorColSpan;
};

/**
 * Split items into pages, inserting sponsor slots for each active group at its rows.
 * If a selected row does not exist on a page, that group’s slot is shown on the last available row.
 */
export function paginateWithSponsors<T>(
  items: T[],
  rowsPerPage: number,
  colsPerRow: number,
  placements: SponsorPlacementInput[],
): SponsoredPageCell<T>[][] {
  const R = Math.max(1, rowsPerPage);
  const C = Math.max(1, colsPerRow);
  const groups = placements.filter((p) => !!p.groupId);
  if (groups.length === 0) {
    const pages: SponsoredPageCell<T>[][] = [];
    for (let i = 0; i < items.length; i += R * C) {
      pages.push(items.slice(i, i + R * C).map((item) => ({ kind: 'news' as const, item })));
    }
    return pages.length > 0 ? pages : [];
  }

  const maxSpan = groups.reduce(
    (m, g) => Math.max(m, Math.min(C, Math.max(1, g.sponsorCols))),
    1,
  ) as OgpSponsorColSpan;

  if (items.length === 0) {
    const locals = groups.flatMap((g) =>
      sponsorLocalRowsOnPage(1, g.startRow, g.intervalRows, R).map((row) => ({
        row,
        groupId: g.groupId,
      })),
    );
    if (locals.length === 0) return [];
    return [
      locals.map(({ groupId }) => ({ kind: 'sponsor' as const, groupId })),
    ];
  }

  const pages: SponsoredPageCell<T>[][] = [];
  let i = 0;
  let page = 1;

  while (i < items.length) {
    const intended = groups.flatMap((g) => {
      const span = Math.min(C, Math.max(1, g.sponsorCols));
      return sponsorLocalRowsOnPage(page, g.startRow, g.intervalRows, R).map((row) => ({
        row,
        groupId: g.groupId,
        span,
      }));
    });
    const slotCount = intended.length;
    const capacityNews = Math.max(0, R * C - slotCount * maxSpan);
    const take = Math.min(items.length - i, capacityNews);
    if (take === 0) {
      if (slotCount > 0) {
        pages.push(intended.map(({ groupId }) => ({ kind: 'sponsor' as const, groupId })));
      }
      break;
    }
    const slice = items.slice(i, i + take);
    i += take;

    const rowsWithoutSponsor = Math.max(1, Math.ceil(Math.max(slice.length, 1) / C));
    const byRow = new Map<number, { groupId: string; span: number }[]>();
    for (const slot of intended) {
      const row = clampToLastAvailableRow(slot.row, rowsWithoutSponsor);
      const list = byRow.get(row) ?? [];
      list.push({ groupId: slot.groupId, span: slot.span });
      byRow.set(row, list);
    }

    const cells: SponsoredPageCell<T>[] = [];
    let n = 0;
    let r = 1;
    const maxRows = Math.max(
      rowsWithoutSponsor,
      byRow.size > 0 ? Math.max(...byRow.keys()) : 0,
    );
    while (n < slice.length || r <= maxRows) {
      let used = 0;
      const rowSlots = byRow.get(r) ?? [];
      for (const slot of rowSlots) {
        cells.push({ kind: 'sponsor', groupId: slot.groupId });
        used += slot.span;
      }
      while (used < C && n < slice.length) {
        cells.push({ kind: 'news', item: slice[n++] });
        used += 1;
      }
      r += 1;
      if (r > maxRows && n >= slice.length) break;
      if (r > 10_000) break;
    }

    pages.push(cells);
    page += 1;
    if (page > 100_000) break;
  }

  return pages;
}

export function openSponsorLink(url: string, target: OgpSponsorLinkTarget): void {
  if (!url) return;
  if (target === 'window') {
    window.open(url, '_blank', 'noopener,noreferrer,width=1200,height=800');
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
