'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Cake,
  Calendar,
  CalendarClock,
  ClipboardList,
  Loader2,
  Mail,
  Printer,
  Receipt,
  Settings,
  User,
  Users,
} from 'lucide-react';
import { clubApiFetch } from '@/lib/club/servicePurchasesClient';
import {
  PREVIEW_LIMIT,
  archiveSectionById,
  summaryTileById,
  type ArchiveSectionId,
  type SummaryTileId,
} from '@/lib/club/monitoring/dashboardCatalog';
import {
  factoryDashboardSettings,
  readDashboardSettings,
  readDefaultDashboardSettings,
  writeDashboardSettings,
  writeDefaultDashboardSettings,
  type MonitoringDashboardSettings,
} from '@/lib/club/monitoring/dashboardSettings';
import type { MonthPoint, PreviewRow } from '@/lib/club/monitoring/dashboardSummary';
import DashboardSettingsModal from '@/components/club/monitoring/DashboardSettingsModal';

type Snapshot = {
  counts: Record<SummaryTileId, number>;
  courses: { id: string; name: string }[];
  series: { id: ArchiveSectionId; title: string; points: MonthPoint[] };
};

type Preview = { id: string; title: string; items: PreviewRow[] };

const TILE_ICONS: Record<SummaryTileId, typeof Users> = {
  'total-members': Users,
  'active-members': ClipboardList,
  'next-appointments': CalendarClock,
  'payment-overdue': Receipt,
  'present-today': Calendar,
  'name-days': Calendar,
  birthdays: Cake,
  'unread-messages': Mail,
};

function clubStorageId(): string {
  if (typeof window === 'undefined') return 'default';
  return localStorage.getItem('selectedClub') || localStorage.getItem('selectedTeam') || 'default';
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) =>
    ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '"' ? '&quot;' : '&#39;',
  );
}

function printRows(title: string, rows: PreviewRow[]) {
  const popup = window.open('', '_blank', 'noopener,noreferrer');
  if (!popup) return;
  const body = rows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.title)}</td><td>${escapeHtml(row.detail)}</td><td>${escapeHtml(row.date)}</td></tr>`,
    )
    .join('');
  popup.document.write(
    `<!doctype html><title>${escapeHtml(title)}</title><body><h1>${escapeHtml(title)}</h1><table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Name</th><th>Detail</th><th>Date</th></tr></thead><tbody>${body}</tbody></table><script>window.print()</script></body>`,
  );
  popup.document.close();
}

export default function ClubMonitoringDashboard({
  initialSettingsOpen = false,
}: {
  initialSettingsOpen?: boolean;
}) {
  const router = useRouter();
  const [clubId, setClubId] = useState('default');
  const [settings, setSettings] = useState<MonitoringDashboardSettings>(factoryDashboardSettings);
  const [draft, setDraft] = useState<MonitoringDashboardSettings>(factoryDashboardSettings);
  const [settingsOpen, setSettingsOpen] = useState(initialSettingsOpen);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [courseId, setCourseId] = useState('all');
  const [chartArchive, setChartArchive] = useState<ArchiveSectionId>('subscriptions');
  const [detail, setDetail] = useState<Preview | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [sectionRows, setSectionRows] = useState<Record<string, PreviewRow[]>>({});
  const [sectionLoading, setSectionLoading] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const id = clubStorageId();
    setClubId(id);
    const saved = readDashboardSettings(id);
    setSettings(saved);
    setDraft(saved);
  }, []);

  useEffect(() => {
    if (!initialSettingsOpen) return;
    setDraft(readDashboardSettings(clubStorageId()));
    setSettingsOpen(true);
  }, [initialSettingsOpen]);

  const loadSnapshot = useCallback(async (archive: ArchiveSectionId, course: string) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ series: archive });
      if (course && course !== 'all') params.set('courseId', course);
      const data = await clubApiFetch<Snapshot>(`/api/club/monitoring/dashboard?${params.toString()}`);
      setSnapshot(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSnapshot(chartArchive, courseId);
  }, [chartArchive, courseId, loadSnapshot]);

  const loadPreview = useCallback(async (id: string) => {
    const data = await clubApiFetch<Preview>(
      `/api/club/monitoring/dashboard?section=${encodeURIComponent(id)}`,
    );
    return data;
  }, []);

  const openDetail = async (id: SummaryTileId) => {
    if (detail?.id === id) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    setDetail({ id, title: summaryTileById(id)?.label ?? id, items: [] });
    try {
      setDetail(await loadPreview(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this list');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleSection = async (id: ArchiveSectionId) => {
    setChartArchive(id);
    setDetail(null);
    if (openSection === id) {
      setOpenSection(null);
      return;
    }
    setOpenSection(id);
    if (sectionRows[id]) return;
    setSectionLoading(id);
    try {
      const preview = await loadPreview(id);
      setSectionRows((current) => ({ ...current, [id]: preview.items }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this archive');
    } finally {
      setSectionLoading(null);
    }
  };

  const visibleTiles = useMemo(
    () => (settings.summaryEnabled ? settings.tiles.filter((tile) => tile.enabled) : []),
    [settings],
  );
  const visibleSections = useMemo(
    () => settings.sections.filter((section) => section.enabled),
    [settings],
  );

  const series = snapshot?.series;
  const maxCount = Math.max(0, ...(series?.points.map((point) => point.count) ?? [0]));
  const legend =
    chartArchive === 'subscriptions' || chartArchive === 'subscription-stats'
      ? 'Subscription'
      : archiveSectionById(chartArchive)?.label ?? 'Records';

  return (
    <div className="bg-white pb-10">
      <div className="mb-3 flex items-center justify-end">
        <button
          type="button"
          onClick={() => {
            setDraft(settings);
            setSettingsOpen(true);
          }}
          className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
        >
          <Settings className="h-3.5 w-3.5" />
          Dashboard setting
        </button>
      </div>

      {error ? <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {visibleTiles.length > 0 ? (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {visibleTiles.map((tile) => {
            const def = summaryTileById(tile.id);
            if (!def) return null;
            const Icon = TILE_ICONS[tile.id];
            const count = snapshot?.counts[tile.id];
            return (
              <div key={tile.id} className="overflow-hidden rounded border border-gray-300 shadow-sm">
                <div className="flex items-start justify-between px-3 py-2 text-white" style={{ backgroundColor: def.color }}>
                  <Icon className="h-8 w-8 opacity-90" strokeWidth={1.5} />
                  <div className="text-right">
                    <div className="text-2xl font-semibold leading-none">{count == null ? '…' : count}</div>
                    <div className="mt-1 text-sm">{def.label}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void openDetail(tile.id)}
                  className="flex w-full items-center justify-center gap-2 bg-white py-1.5 text-sm text-gray-800 hover:bg-gray-50"
                >
                  <Icon className="h-4 w-4" style={{ color: def.color }} />
                  View Detail
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      <section className="mb-6 rounded border border-gray-200 p-3" aria-label="Dashboard chart">
        <div className="mb-2 flex justify-end">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            Select a course:
            <select
              className="rounded border border-gray-300 bg-white px-2 py-1"
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
            >
              <option value="all">All</option>
              {(snapshot?.courses ?? []).map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {detail ? (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">{detail.title}</h3>
              <button type="button" onClick={() => setDetail(null)} className="text-sm text-blue-700 underline">
                Show chart
              </button>
            </div>
            {detailLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
              </div>
            ) : (
              <PreviewTable rows={detail.items} altColor="#f3f4f6" visibleCount={detail.items.length} />
            )}
          </div>
        ) : loading && !series ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
          </div>
        ) : (
          <div>
            <p className="text-center text-sm text-gray-800">{series?.title}</p>
            <div className="mb-1 flex items-center justify-center gap-2 text-xs text-gray-600">
              <span className="inline-block h-3 w-8 rounded-sm bg-[#c6e48b]" />
              {legend}
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series?.points ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, maxCount === 0 ? 1 : 'auto']} allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
                  <Tooltip />
                  <Area type="monotone" dataKey="count" name={legend} stroke="#7cb342" fill="#d9f0a8" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>

      <div className="divide-y divide-gray-200 border border-gray-200">
        {visibleSections.map((section) => {
          const def = archiveSectionById(section.id);
          if (!def) return null;
          const open = openSection === section.id;
          const rows = sectionRows[section.id] ?? [];
          const showAll = expandedRows[section.id] === true;
          const visibleCount = showAll ? rows.length : Math.min(section.rows, rows.length);
          return (
            <div key={section.id}>
              <div className="flex items-center bg-[#f7f7f7] hover:bg-[#efefef]">
                <button
                  type="button"
                  onClick={() => void toggleSection(section.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm text-gray-800"
                >
                  <User className="h-4 w-4 shrink-0 text-gray-600" />
                  <span className="truncate font-medium">{def.label}</span>
                </button>
                <button
                  type="button"
                  className="px-2 py-2 text-sm text-gray-700 hover:underline"
                  onClick={() => router.push(def.readAllPath)}
                >
                  Read all
                </button>
                <button
                  type="button"
                  className="px-3 py-2 text-gray-600"
                  aria-label={`Print ${def.label}`}
                  onClick={() => printRows(def.label, (sectionRows[section.id] ?? []).slice(0, visibleCount || PREVIEW_LIMIT))}
                >
                  <Printer className="h-4 w-4" />
                </button>
              </div>
              {open ? (
                <div className="border-t border-gray-200 bg-white px-3 py-3">
                  {sectionLoading === section.id ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
                    </div>
                  ) : (
                    <>
                      <PreviewTable rows={rows} altColor={section.altColor} visibleCount={visibleCount} />
                      {rows.length > section.rows && !showAll ? (
                        <button
                          type="button"
                          className="mt-2 text-sm font-medium text-blue-700 underline"
                          onClick={() => setExpandedRows((current) => ({ ...current, [section.id]: true }))}
                        >
                          View all ({rows.length - section.rows} more, up to {PREVIEW_LIMIT})
                        </button>
                      ) : null}
                      {rows.length >= PREVIEW_LIMIT ? (
                        <p className="mt-2 text-xs text-gray-500">
                          Showing the latest {PREVIEW_LIMIT} records. Read all opens the full archive.
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {settingsOpen ? (
        <DashboardSettingsModal
          draft={draft}
          onChange={setDraft}
          onCancel={() => {
            setDraft(settings);
            setSettingsOpen(false);
          }}
          onSave={() => {
            const next = draft;
            writeDashboardSettings(clubId, next);
            setSettings(next);
            setSettingsOpen(false);
          }}
          onSaveDefault={() => writeDefaultDashboardSettings(clubId, draft)}
          onLoadDefault={() => setDraft(readDefaultDashboardSettings(clubId) ?? factoryDashboardSettings())}
        />
      ) : null}
    </div>
  );
}

function PreviewTable({
  rows,
  altColor,
  visibleCount,
}: {
  rows: PreviewRow[];
  altColor: string;
  visibleCount: number;
}) {
  if (rows.length === 0) {
    return <p className="py-4 text-center text-sm text-gray-500">No records.</p>;
  }
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="bg-gray-100 text-left text-gray-700">
          <th className="px-2 py-1.5 font-semibold">Name</th>
          <th className="px-2 py-1.5 font-semibold">Detail</th>
          <th className="px-2 py-1.5 font-semibold">Date</th>
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, visibleCount).map((row, index) => (
          <tr key={row.id} style={{ backgroundColor: index % 2 === 1 ? altColor : '#ffffff' }}>
            <td className="px-2 py-1.5">{row.title}</td>
            <td className="px-2 py-1.5">{row.detail || '—'}</td>
            <td className="px-2 py-1.5 whitespace-nowrap">{row.date || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
