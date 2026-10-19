import {
  ALT_ROW_COLORS,
  ARCHIVE_SECTIONS,
  DEFAULT_ALT_COLOR,
  DEFAULT_VISIBLE_ROWS,
  SUMMARY_TILES,
  type ArchiveSectionId,
  type SummaryTileId,
} from '@/lib/club/monitoring/dashboardCatalog';

export type TileSetting = {
  id: SummaryTileId;
  enabled: boolean;
};

export type SectionSetting = {
  id: ArchiveSectionId;
  enabled: boolean;
  rows: number;
  altColor: string;
};

export type MonitoringDashboardSettings = {
  summaryEnabled: boolean;
  tiles: TileSetting[];
  sections: SectionSetting[];
};

export function factoryDashboardSettings(): MonitoringDashboardSettings {
  return {
    summaryEnabled: true,
    tiles: SUMMARY_TILES.map((tile) => ({ id: tile.id, enabled: true })),
    sections: ARCHIVE_SECTIONS.map((section) => ({
      id: section.id,
      enabled: true,
      rows: DEFAULT_VISIBLE_ROWS,
      altColor: DEFAULT_ALT_COLOR,
    })),
  };
}

function isColor(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    (value === DEFAULT_ALT_COLOR || ALT_ROW_COLORS.includes(value))
  );
}

export function normalizeDashboardSettings(raw: unknown): MonitoringDashboardSettings {
  const factory = factoryDashboardSettings();
  if (!raw || typeof raw !== 'object') return factory;
  const source = raw as Partial<MonitoringDashboardSettings>;

  const tileOrder = new Map(factory.tiles.map((tile, index) => [tile.id, index]));
  const seenTiles = new Set<SummaryTileId>();
  const tiles: TileSetting[] = [];
  if (Array.isArray(source.tiles)) {
    for (const tile of source.tiles) {
      if (!tile || typeof tile !== 'object') continue;
      const id = (tile as TileSetting).id;
      if (!tileOrder.has(id) || seenTiles.has(id)) continue;
      seenTiles.add(id);
      tiles.push({ id, enabled: (tile as TileSetting).enabled !== false });
    }
  }
  for (const tile of factory.tiles) {
    if (!seenTiles.has(tile.id)) tiles.push(tile);
  }

  const sectionOrder = new Map(factory.sections.map((section, index) => [section.id, index]));
  const seenSections = new Set<ArchiveSectionId>();
  const sections: SectionSetting[] = [];
  if (Array.isArray(source.sections)) {
    for (const section of source.sections) {
      if (!section || typeof section !== 'object') continue;
      const id = (section as SectionSetting).id;
      if (!sectionOrder.has(id) || seenSections.has(id)) continue;
      seenSections.add(id);
      const rows = Number((section as SectionSetting).rows);
      sections.push({
        id,
        enabled: (section as SectionSetting).enabled !== false,
        rows: Number.isFinite(rows) ? Math.min(100, Math.max(1, Math.round(rows))) : DEFAULT_VISIBLE_ROWS,
        altColor: isColor((section as SectionSetting).altColor)
          ? (section as SectionSetting).altColor
          : DEFAULT_ALT_COLOR,
      });
    }
  }
  for (const section of factory.sections) {
    if (!seenSections.has(section.id)) sections.push(section);
  }

  return {
    summaryEnabled: source.summaryEnabled !== false,
    tiles,
    sections,
  };
}

function storageKey(clubId: string, kind: 'current' | 'default') {
  return `clubMonitoringDashboard:${kind}:${clubId}`;
}

export function readDashboardSettings(clubId: string): MonitoringDashboardSettings {
  if (typeof window === 'undefined' || !clubId) return factoryDashboardSettings();
  try {
    const raw = window.localStorage.getItem(storageKey(clubId, 'current'));
    if (!raw) return factoryDashboardSettings();
    return normalizeDashboardSettings(JSON.parse(raw));
  } catch {
    return factoryDashboardSettings();
  }
}

export function writeDashboardSettings(clubId: string, settings: MonitoringDashboardSettings) {
  window.localStorage.setItem(
    storageKey(clubId, 'current'),
    JSON.stringify(normalizeDashboardSettings(settings)),
  );
}

export function readDefaultDashboardSettings(clubId: string): MonitoringDashboardSettings | null {
  if (typeof window === 'undefined' || !clubId) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(clubId, 'default'));
    if (!raw) return null;
    return normalizeDashboardSettings(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeDefaultDashboardSettings(clubId: string, settings: MonitoringDashboardSettings) {
  window.localStorage.setItem(
    storageKey(clubId, 'default'),
    JSON.stringify(normalizeDashboardSettings(settings)),
  );
}
