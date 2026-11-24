/** Building blocks shared by the athlete and team per-sport profiles. */

export type SportFieldDef = {
  /** Stable storage key (slug of the label unless set explicitly). */
  key: string;
  label: string;
  /** Rendered as a select when set, otherwise as free text. */
  options?: readonly string[];
  /** When true with options, render checkboxes and store a multi value. */
  multi?: boolean;
};

export type SportStatGroup = {
  title: string;
  items: SportFieldDef[];
};

/** Stat values per season: `{ '2026/2027': { goals: '12' } }`. */
export type SportSeasonStats = Record<string, Record<string, string>>;

export function sportFieldKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/%/g, ' pct ')
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function field(
  label: string,
  options?: readonly string[],
  multi = false,
): SportFieldDef {
  if (!options) return { key: sportFieldKey(label), label };
  return multi
    ? { key: sportFieldKey(label), label, options, multi: true }
    : { key: sportFieldKey(label), label, options };
}

/** Persist multi-check choices as a JSON string array (legacy single values still decode). */
export function encodeMultiSportValues(values: readonly string[]): string {
  return JSON.stringify([...values]);
}

export function decodeMultiSportValues(raw: string | null | undefined): string[] {
  const s = String(raw ?? '').trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v).trim()).filter(Boolean);
      }
    } catch {
      /* fall through */
    }
  }
  return [s];
}

export function statGroup(title: string, labels: readonly string[]): SportStatGroup {
  return { title, items: labels.map((label) => field(label)) };
}

/** Storage key of a stat value; scoped by group so equal labels in two groups stay apart. */
export function statValueKey(group: SportStatGroup, item: SportFieldDef): string {
  return `${sportFieldKey(group.title)}.${item.key}`;
}

/** Season label for a date: from July on the season is `YYYY/YYYY+1`. */
export function currentSportSeason(date = new Date()): string {
  const year = date.getFullYear();
  const start = date.getMonth() >= 6 ? year : year - 1;
  return `${start}/${start + 1}`;
}

export function normalizeSeasonStats(raw: unknown): SportSeasonStats {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: SportSeasonStats = {};
  for (const [season, values] of Object.entries(raw as Record<string, unknown>)) {
    if (!season.trim() || !values || typeof values !== 'object' || Array.isArray(values)) continue;
    const row: Record<string, string> = {};
    for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
      if (value == null) continue;
      row[key] = String(value);
    }
    out[season] = row;
  }
  return out;
}

export function normalizeStringRecord(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value == null) continue;
    out[key] = String(value);
  }
  return out;
}
