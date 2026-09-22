'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Sector,
  LabelList,
} from 'recharts';
import {
  STATS_USER_KINDS,
  type StatsUserKind,
  type StatsVersionBucket,
} from '@/lib/admin/statisticsKinds';
import {
  slicesForMetric,
  useStatisticsMetric,
} from '@/components/admin/statistics/StatisticsMetricToggle';
import type { StatsSlice } from '@/lib/admin/buildStatistics';
import { useStatisticsGraphTheme } from '@/components/admin/statistics/StatisticsGraphTheme';

type PieBlockProps = {
  title: string;
  subtitle?: string;
  slices: StatsSlice[];
  /** When true, colors follow StatsUserKind keys */
  kindColors?: boolean;
  /** When true, colors follow StatsVersionBucket keys */
  versionColors?: boolean;
  /** Paint every slice with one color (e.g. selected user-type accent). */
  uniformColor?: string;
  /** Paint every slice with the active theme color for this user kind. */
  uniformKind?: StatsUserKind;
  /** Color chip shown above the title (user-type accent without recoloring slices). */
  titleSwatchColor?: string;
  /** Title swatch from the active theme for this user kind. */
  titleSwatchKind?: StatsUserKind;
  height?: number;
  /** Extra classes on the outer card (e.g. h-full for equal-height grids). */
  className?: string;
  /** Called when a slice / legend item is selected (null when cleared). */
  onSelect?: (slice: StatsSlice | null) => void;
  /**
   * Legend primary figure: absolute count (default on versions drilldown)
   * or percent. Tooltip always includes both when available.
   */
  legendValueMode?: 'count' | 'percent';
};

function PieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: StatsSlice & { value?: number } }>;
}) {
  const theme = useStatisticsGraphTheme();
  const { metricLabel, formatMetricValue } = useStatisticsMetric();
  if (!active || !payload?.[0]) return null;
  const row = payload[0].payload;
  const name = payload[0].name ?? row?.label ?? '';
  const value = payload[0].value ?? row?.value ?? row?.count ?? 0;
  const percent = row?.percent;
  return (
    <div
      className="border px-3 py-2 text-xs shadow-sm"
      style={{
        background: theme.background.panel,
        borderColor: theme.background.border,
        color: theme.background.text,
      }}
    >
      <div className="font-semibold">{name}</div>
      <div style={{ color: theme.background.muted }}>
        {formatMetricValue(Number(value))}
        {percent != null ? ` (${percent}%)` : ''}
        <span className="ml-1 opacity-70">· {metricLabel}</span>
      </div>
    </div>
  );
}

function ActivePieShape(props: {
  cx?: number;
  cy?: number;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  fill?: string;
}) {
  const { cx = 0, cy = 0, innerRadius = 0, outerRadius = 0, startAngle = 0, endAngle = 0, fill } =
    props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={Math.max(0, innerRadius - 2)}
        outerRadius={outerRadius + 10}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke="#1f1f1f"
        strokeWidth={2}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={outerRadius + 12}
        outerRadius={outerRadius + 16}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.55}
      />
    </g>
  );
}

export function StatisticsPieBlock({
  title,
  subtitle,
  slices,
  kindColors,
  versionColors,
  uniformColor,
  uniformKind,
  titleSwatchColor,
  titleSwatchKind,
  height = 280,
  className,
  onSelect,
  legendValueMode = 'percent',
}: PieBlockProps) {
  const theme = useStatisticsGraphTheme();
  const { metric, formatMetricValue, sliceValue } = useStatisticsMetric();
  const resolvedUniform =
    uniformColor ?? (uniformKind ? theme.kindColor(uniformKind) : undefined);
  const resolvedSwatch =
    titleSwatchColor ?? (titleSwatchKind ? theme.kindColor(titleSwatchKind) : undefined);
  const metricSlices = useMemo(() => slicesForMetric(slices, metric), [slices, metric]);
  const chartData = useMemo(
    () => metricSlices.filter((s) => s.value > 0),
    [metricSlices],
  );
  const legendData = useMemo(() => {
    const positive = metricSlices.filter((s) => s.value > 0);
    const rest = metricSlices.find(
      (s) => (s.key === '__rest_of_world__' || s.key === '__others__') && s.value === 0,
    );
    return rest ? [...positive, rest] : positive;
  }, [metricSlices]);
  const empty = chartData.length === 0;

  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const activeKey = hoveredKey ?? selectedKey;
  const activeIndex = activeKey == null ? undefined : chartData.findIndex((s) => s.key === activeKey);

  const colorFor = (entry: StatsSlice, index: number) => {
    if (resolvedUniform) return resolvedUniform;
    if (kindColors) {
      const kind = entry.key as StatsUserKind;
      return theme.palette.kinds[kind] ?? theme.seriesColor(index);
    }
    if (versionColors) {
      const version = entry.key as StatsVersionBucket;
      return theme.palette.versions[version] ?? theme.seriesColor(index);
    }
    return theme.seriesColor(index);
  };

  const toggleSelect = (key: string) => {
    setSelectedKey((prev) => {
      const next = prev === key ? null : key;
      if (onSelect) {
        const slice = next ? slices.find((s) => s.key === next) ?? null : null;
        onSelect(slice);
      }
      return next;
    });
  };

  return (
    <div
      className={`border p-3 flex flex-col overflow-hidden ${className ?? ''}`}
      style={theme.panelStyle}
    >
      <div className="mb-2 shrink-0">
        {resolvedSwatch ? (
          <span
            className="mb-1.5 inline-block h-3.5 w-8 rounded-sm border border-black/10"
            style={{ backgroundColor: resolvedSwatch }}
            title="Type of user color"
            aria-hidden
          />
        ) : null}
        <h3 className="font-bold text-lg" style={{ color: theme.background.text }}>
          {title}
        </h3>
        {subtitle ? (
          <p className="text-base mt-0.5" style={{ color: theme.background.muted }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {empty ? (
        <div
          className="flex-1 flex items-center justify-center text-base min-h-[200px]"
          style={{ color: theme.background.muted }}
        >
          No data
        </div>
      ) : (
        <>
          <div className="w-full shrink-0" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius="68%"
                  innerRadius="36%"
                  paddingAngle={1}
                  {...(activeIndex != null && activeIndex >= 0
                    ? {
                        activeIndex,
                        activeShape: ActivePieShape,
                      }
                    : {})}
                  onMouseEnter={(_, index) => setHoveredKey(chartData[index]?.key ?? null)}
                  onMouseLeave={() => setHoveredKey(null)}
                  onClick={(_, index) => {
                    const key = chartData[index]?.key;
                    if (key) toggleSelect(key);
                  }}
                  style={{ cursor: 'pointer', outline: 'none' }}
                >
                  {chartData.map((entry, index) => {
                    const isActive = activeKey === entry.key;
                    const dimmed = activeKey != null && !isActive;
                    return (
                      <Cell
                        key={entry.key}
                        fill={colorFor(entry, index)}
                        stroke={theme.background.isDark ? theme.background.panel : '#fff'}
                        strokeWidth={isActive ? 2 : 1}
                        fillOpacity={dimmed ? 0.35 : 1}
                        style={{ cursor: 'pointer', outline: 'none', transition: 'fill-opacity 120ms ease' }}
                      />
                    );
                  })}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul
            className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 border-t pt-3 text-base sm:grid-cols-2"
            style={{ borderColor: theme.background.border, color: theme.background.text }}
          >
            {legendData.map((entry, index) => {
              const isActive = activeKey === entry.key;
              const dimmed = activeKey != null && !isActive;
              const isRest =
                entry.key === '__rest_of_world__' || entry.key === '__others__';
              return (
                <li key={entry.key}>
                  <button
                    type="button"
                    className={`flex w-full min-w-0 items-center gap-2 rounded px-1.5 py-1.5 text-left transition ${
                      dimmed ? 'opacity-45' : ''
                    } ${isRest ? 'font-semibold' : ''}`}
                    style={{
                      color: theme.background.text,
                      background: isActive ? theme.background.activeSurface : 'transparent',
                      boxShadow: isActive
                        ? `inset 0 0 0 1px ${theme.background.accent}`
                        : undefined,
                    }}
                    onMouseEnter={(e) => {
                      setHoveredKey(entry.key);
                      if (!isActive) e.currentTarget.style.background = theme.background.hoverSurface;
                    }}
                    onMouseLeave={(e) => {
                      setHoveredKey(null);
                      e.currentTarget.style.background = isActive
                        ? theme.background.activeSurface
                        : 'transparent';
                    }}
                    onFocus={() => setHoveredKey(entry.key)}
                    onBlur={() => setHoveredKey(null)}
                    onClick={() => toggleSelect(entry.key)}
                  >
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-sm"
                      style={{
                        backgroundColor: colorFor(entry, index),
                        boxShadow: theme.background.isDark
                          ? 'inset 0 0 0 1px rgba(255,255,255,0.45)'
                          : 'inset 0 0 0 1px rgba(0,0,0,0.15)',
                      }}
                      aria-hidden
                    />
                    <span
                      className="truncate text-base"
                      style={{ color: theme.background.text }}
                      title={`${entry.label}: ${formatMetricValue(sliceValue(entry))} (${entry.percent}%)`}
                    >
                      {legendValueMode === 'count' ? (
                        <>
                          {entry.label}{' '}
                          <span className="font-bold" style={{ color: theme.background.text }}>
                            {formatMetricValue(entry.value)}
                          </span>
                        </>
                      ) : (
                        <>
                          {entry.label} ({entry.percent}%){' '}
                          <span className="font-bold" style={{ color: theme.background.text }}>
                            {formatMetricValue(entry.value)}
                          </span>
                        </>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

type VerticalCountryBarsProps = {
  rows: Array<{
    country: string;
    byKind: Record<StatsUserKind, number>;
    byKindIncome?: Record<StatsUserKind, number>;
    total: number;
    totalIncome?: number;
  }>;
  /** If set, only render that kind's bar */
  onlyKind?: StatsUserKind | 'all' | 'except_groups';
  /** Fired when a country bar is clicked (single-type mode). null when cleared. */
  onCountrySelect?: (country: string | null) => void;
  /**
   * Fired when a bar/legend is clicked in “Each type of users” mode —
   * parent should set the Type of user dropdown to this kind.
   */
  onKindSelect?: (kind: StatsUserKind) => void;
  /**
   * Open the admin/all list for the users counted in this bar.
   * When set, bar clicks navigate to that list (legend still uses onKindSelect).
   */
  onOpenBarList?: (country: string, kind: StatsUserKind) => void;
};

type BarFocus = { country?: string; kind?: string };

const SIDE_TABLE_LABELS: Record<StatsUserKind, string> = {
  single: 'Athletes',
  coaches: 'Coaches',
  teams: 'Teams',
  clubs: 'Clubs',
  groups: 'Groups',
};

export function StatisticsVerticalCountryBars({
  rows,
  onlyKind = 'all',
  onCountrySelect,
  onKindSelect,
  onOpenBarList,
}: VerticalCountryBarsProps) {
  const theme = useStatisticsGraphTheme();
  const { metric, formatMetricValue, isIncome } = useStatisticsMetric();
  const kinds =
    onlyKind === 'all' || onlyKind === 'except_groups'
      ? onlyKind === 'except_groups'
        ? STATS_USER_KINDS.filter((k) => k !== 'groups')
        : STATS_USER_KINDS
      : STATS_USER_KINDS.filter((k) => k === onlyKind);

  const singleKindMode = kinds.length === 1;
  const colorFor = (k: StatsUserKind) => theme.kindColor(k);
  const labelFor = (k: StatsUserKind) => SIDE_TABLE_LABELS[k];
  const cellValue = (
    row: VerticalCountryBarsProps['rows'][number],
    k: StatsUserKind,
  ) =>
    metric === 'income'
      ? Number(row.byKindIncome?.[k] ?? 0)
      : Number(row.byKind[k] ?? 0);

  const [hovered, setHovered] = useState<BarFocus | null>(null);
  const [selected, setSelected] = useState<BarFocus | null>(null);
  const active = hovered ?? selected;

  const showTotals = !singleKindMode;
  const colCount = kinds.length + (showTotals ? 1 : 0);
  const headerH = 28;
  const axisBottomH = 28;
  /** Tall enough for thick bars while keeping chart rows = side-table rows. */
  const barTrackH = singleKindMode ? 32 : 14;
  const barGap = singleKindMode ? 0 : 4;
  const rowPadY = singleKindMode ? 8 : 10;
  const rowHeight =
    rowPadY * 2 +
    kinds.length * barTrackH +
    Math.max(0, kinds.length - 1) * barGap;
  const labelColW = 120;
  const sideColWidth = Math.max(
    showTotals ? 280 : 200,
    colCount * (showTotals ? 52 : 56) + 8,
  );

  const maxValue = useMemo(() => {
    let max = 1;
    for (const row of rows) {
      for (const k of kinds) {
        max = Math.max(max, cellValue(row, k));
      }
    }
    return max;
  }, [rows, kinds, metric]);

  const axisTicks = useMemo(() => {
    const nice = Math.ceil(maxValue);
    const step = Math.max(1, Math.ceil(nice / 4));
    const ticks: number[] = [];
    for (let v = 0; v <= nice; v += step) ticks.push(v);
    if (ticks[ticks.length - 1] !== nice) ticks.push(nice);
    return ticks;
  }, [maxValue]);

  const rowTotal = (row: VerticalCountryBarsProps['rows'][number]) =>
    kinds.reduce((s, k) => s + cellValue(row, k), 0) ||
    (metric === 'income' ? Number(row.totalIncome ?? 0) : row.total);

  const isCellActive = (country: string, kind: string) => {
    if (!active) return false;
    if (active.country && active.kind) return active.country === country && active.kind === kind;
    if (active.country) return active.country === country;
    if (active.kind) return active.kind === kind;
    return false;
  };

  const isCellDimmed = (country: string, kind: string) => {
    if (!active) return false;
    return !isCellActive(country, kind);
  };

  const handleBarClick = (country: string, kind: StatsUserKind) => {
    if (!country) return;
    if (!singleKindMode) {
      onKindSelect?.(kind);
      onOpenBarList?.(country, kind);
      return;
    }
    setSelected((prev) => {
      const cleared =
        prev?.country === country && prev?.kind === kind ? null : { country, kind };
      onCountrySelect?.(cleared?.country ?? null);
      if (cleared) onOpenBarList?.(country, kind);
      return cleared;
    });
  };

  if (rows.length === 0) {
    return (
      <div className="border p-8 text-center" style={{ ...theme.panelStyle, color: theme.background.muted }}>
        No data
      </div>
    );
  }

  return (
    <div className="border p-3 overflow-x-auto" style={theme.panelStyle}>
      <div className="flex gap-3 items-start min-w-[720px]">
        <div className="flex-1 min-w-[420px]">
          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] font-semibold border-b box-border"
            style={{ height: headerH, borderColor: theme.background.border }}
          >
            {kinds.map((k) => (
              <button
                key={k}
                type="button"
                className="inline-flex items-center gap-1.5 hover:opacity-80"
                onMouseEnter={() => setHovered({ kind: k })}
                onMouseLeave={() => setHovered(null)}
                onClick={() => {
                  if (!singleKindMode) onKindSelect?.(k);
                  else
                    setSelected((prev) =>
                      prev?.kind === k && !prev.country ? null : { kind: k },
                    );
                }}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: colorFor(k) }}
                  aria-hidden
                />
                <span style={{ color: colorFor(k) }}>{labelFor(k)}</span>
              </button>
            ))}
          </div>

          <div>
            {rows.map((row) => {
              const rowActive = active?.country === row.country;
              return (
                <div
                  key={row.country}
                  className="flex items-stretch border-b box-border"
                  style={{
                    height: rowHeight,
                    borderColor: theme.background.border,
                    background: rowActive
                      ? theme.background.activeSurface
                      : 'transparent',
                  }}
                  onMouseEnter={() => setHovered({ country: row.country })}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div
                    className="shrink-0 flex items-center truncate text-[11px] px-1.5"
                    style={{ width: labelColW, color: theme.background.text }}
                    title={row.country}
                  >
                    {row.country}
                  </div>
                  <div
                    className="relative flex-1 min-w-0 px-1 flex flex-col justify-center"
                    style={{ gap: barGap, paddingTop: rowPadY, paddingBottom: rowPadY }}
                  >
                    <div
                      className="pointer-events-none absolute left-1 right-1"
                      style={{ top: rowPadY, bottom: rowPadY }}
                    >
                      {axisTicks.map((t) => (
                        <div
                          key={`g-${row.country}-${t}`}
                          className="absolute top-0 bottom-0 w-px"
                          style={{
                            left: `${(t / maxValue) * 100}%`,
                            background: theme.background.border,
                          }}
                        />
                      ))}
                    </div>
                    {kinds.map((k) => {
                      const value = cellValue(row, k);
                      const pct = Math.max(0, Math.min(100, (value / maxValue) * 100));
                      const dimmed = isCellDimmed(row.country, k);
                      const cellActive = isCellActive(row.country, k);
                      return (
                        <button
                          key={k}
                          type="button"
                          className="relative z-[1] flex items-center gap-1.5 w-full text-left shrink-0"
                          style={{ height: barTrackH }}
                          title={`${row.country} · ${labelFor(k)}: ${formatMetricValue(value)}`}
                          onMouseEnter={() => setHovered({ country: row.country, kind: k })}
                          onMouseLeave={() => setHovered({ country: row.country })}
                          onClick={() => handleBarClick(row.country, k)}
                        >
                          <div
                            className="relative flex-1 h-full min-w-0 rounded-sm"
                            style={{
                              background: theme.background.isDark
                                ? 'rgba(255,255,255,0.12)'
                                : '#ececec',
                            }}
                          >
                            <div
                              className="h-full rounded-sm transition-[width,opacity] duration-150"
                              style={{
                                width: `${pct}%`,
                                minWidth: value > 0 ? 4 : 0,
                                backgroundColor: colorFor(k),
                                opacity: dimmed ? 0.28 : 1,
                                boxShadow: cellActive
                                  ? `inset 0 0 0 2px ${colorFor(k)}`
                                  : undefined,
                              }}
                            />
                          </div>
                          {singleKindMode ? (
                            <span
                              className="w-12 shrink-0 text-right text-[10px] font-bold tabular-nums"
                              style={{ color: theme.background.text }}
                            >
                              {formatMetricValue(value)}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="flex border-t text-[10px] tabular-nums"
            style={{
              height: axisBottomH,
              borderColor: theme.background.border,
              color: theme.background.muted,
            }}
          >
            <div className="shrink-0" style={{ width: labelColW }} />
            <div className="relative flex-1 min-w-0 px-1">
              {axisTicks.map((t) => (
                <span
                  key={`tick-${t}`}
                  className="absolute top-1.5 -translate-x-1/2"
                  style={{ left: `${(t / maxValue) * 100}%` }}
                >
                  {t}
                </span>
              ))}
            </div>
            {singleKindMode ? <div className="w-8 shrink-0" /> : null}
          </div>
        </div>

        <div
          className="shrink-0 border overflow-hidden"
          style={{
            width: sideColWidth,
            borderColor: theme.background.border,
            background: theme.background.isDark
              ? 'rgba(255,255,255,0.04)'
              : 'rgba(250,250,250,0.9)',
          }}
        >
          <div
            className="grid border-b text-[10px] font-semibold uppercase tracking-wide box-border"
            style={{
              gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
              height: headerH,
              borderColor: theme.background.border,
              background: theme.background.isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f0',
              color: theme.background.text,
            }}
          >
            {kinds.map((k) => (
              <button
                key={k}
                type="button"
                className="flex items-center justify-center px-0.5 text-center border-l first:border-l-0"
                style={{
                  color: colorFor(k),
                  borderColor: theme.background.border,
                }}
                title={singleKindMode ? labelFor(k) : `Show only ${labelFor(k)}`}
                onClick={() => {
                  if (!singleKindMode) onKindSelect?.(k);
                }}
              >
                {labelFor(k)}
              </button>
            ))}
            {showTotals ? (
              <div
                className="flex items-center justify-center px-0.5 text-center border-l font-bold"
                style={{ color: '#dc2626', borderColor: theme.background.border }}
                title={isIncome ? 'Total income in country' : 'Total users in country'}
              >
                Totals
              </div>
            ) : null}
          </div>
          <div className="flex flex-col">
            {rows.map((row) => {
              const rowActive = active?.country === row.country;
              const total = rowTotal(row);
              return (
                <div
                  key={row.country}
                  className="grid shrink-0 border-b text-xs box-border"
                  style={{
                    gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
                    height: rowHeight,
                    borderColor: theme.background.border,
                    background: rowActive ? theme.background.activeSurface : 'transparent',
                    color: theme.background.text,
                  }}
                  onMouseEnter={() => setHovered({ country: row.country })}
                  onMouseLeave={() => setHovered(null)}
                >
                  {kinds.map((k) => {
                    const value = cellValue(row, k);
                    const cellActive = isCellActive(row.country, k);
                    return (
                      <button
                        key={k}
                        type="button"
                        className="flex items-center justify-center border-l first:border-l-0 font-semibold tabular-nums text-[10px]"
                        style={{
                          color: value > 0 ? colorFor(k) : theme.background.muted,
                          borderColor: theme.background.border,
                          background: cellActive ? theme.background.activeSurface : undefined,
                          boxShadow: cellActive
                            ? `inset 0 0 0 1px ${theme.background.accent}`
                            : undefined,
                        }}
                        title={`${row.country} · ${labelFor(k)}: ${formatMetricValue(value)}`}
                        onClick={() => handleBarClick(row.country, k)}
                      >
                        {formatMetricValue(value)}
                      </button>
                    );
                  })}
                  {showTotals ? (
                    <div
                      className="flex items-center justify-center border-l font-bold tabular-nums text-[10px]"
                      style={{ color: '#dc2626', borderColor: theme.background.border }}
                      title={`${row.country} · Total: ${formatMetricValue(total)}`}
                    >
                      {formatMetricValue(total)}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div
            style={{
              height: axisBottomH,
              background: theme.background.isDark ? 'rgba(255,255,255,0.04)' : '#fafafa',
              borderTop: `1px solid ${theme.background.border}`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

type VersionsBarsProps = {
  rows: Array<{ version: StatsVersionBucket; count: number; income?: number }>;
  onVersionSelect?: (version: StatsVersionBucket | null) => void;
  /** Open admin/all for users counted in this version bar. */
  onOpenBarList?: (version: StatsVersionBucket) => void;
  height?: number;
  className?: string;
  /** Override fill for all bars (e.g. selected user-type accent). */
  fillColor?: string;
};

function VersionAxisTick({
  x = 0,
  y = 0,
  payload,
  counts,
  countColor,
  labelColor,
  formatValue,
}: {
  x?: number | string;
  y?: number | string;
  payload?: { value?: string };
  counts: Record<string, number>;
  countColor: string;
  labelColor: string;
  formatValue: (value: number) => string;
}) {
  const version = String(payload?.value ?? '');
  const count = counts[version] ?? 0;
  const tx = typeof x === 'number' ? x : Number(x) || 0;
  const ty = typeof y === 'number' ? y : Number(y) || 0;
  return (
    <g transform={`translate(${tx},${ty})`}>
      <text dy={14} textAnchor="middle" fill={labelColor} fontSize={12} fontWeight={600}>
        {version}
      </text>
      <text dy={34} textAnchor="middle" fill={countColor} fontSize={14} fontWeight={800}>
        {formatValue(count)}
      </text>
    </g>
  );
}

export function StatisticsVersionsBars({
  rows,
  onVersionSelect,
  onOpenBarList,
  height = 360,
  className,
  fillColor,
}: VersionsBarsProps) {
  const theme = useStatisticsGraphTheme();
  const { metric, metricLabel, formatMetricValue } = useStatisticsMetric();
  const chartHeight = Math.max(height, 200);
  const hostRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const update = () => {
      const next = Math.floor(el.getBoundingClientRect().width);
      if (next > 0) setWidth(next);
    };
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  const data = rows.map((r) => ({
    version: r.version,
    count: metric === 'income' ? Number(r.income ?? 0) : r.count,
    fill: fillColor ?? theme.versionColor(r.version),
  }));

  const countsByVersion = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of rows) {
      map[r.version] = metric === 'income' ? Number(r.income ?? 0) : r.count;
    }
    return map;
  }, [rows, metric]);

  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const activeKey = hoveredKey ?? selectedKey;

  const toggleSelect = (key: string) => {
    setSelectedKey((prev) => {
      const next = prev === key ? null : key;
      onVersionSelect?.(next as StatsVersionBucket | null);
      if (next) onOpenBarList?.(next as StatsVersionBucket);
      return next;
    });
  };

  if (data.every((d) => d.count === 0)) {
    return (
      <div
        className={`border p-8 text-center ${className ?? ''}`}
        style={{ ...theme.panelStyle, color: theme.background.muted }}
      >
        No data
      </div>
    );
  }

  return (
    <div className={`border p-3 ${className ?? ''}`} style={theme.panelStyle}>
      <div ref={hostRef} className="w-full overflow-hidden" style={{ height: chartHeight }}>
        <BarChart
          width={Math.max(width, 280)}
          height={chartHeight}
          data={data}
          margin={{ top: 28, right: 24, left: 8, bottom: 56 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={theme.background.isDark ? 'rgba(148,163,184,0.25)' : '#e5e5e5'}
          />
          <XAxis
            dataKey="version"
            interval={0}
            tick={(props) => (
              <VersionAxisTick
                {...props}
                counts={countsByVersion}
                countColor={theme.background.accentAlt}
                labelColor={theme.background.text}
                formatValue={formatMetricValue}
              />
            )}
            height={58}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: theme.background.muted, fontSize: 12 }}
            stroke={theme.background.border}
            tickFormatter={(v) => formatMetricValue(Number(v))}
          />
          <Tooltip
            formatter={(value) => [formatMetricValue(Number(value)), metricLabel]}
            labelFormatter={(label) => String(label)}
            contentStyle={{
              background: theme.background.panel,
              borderColor: theme.background.border,
              color: theme.background.text,
            }}
          />
          <Bar
            dataKey="count"
            name={metricLabel}
            maxBarSize={64}
            cursor="pointer"
            onMouseEnter={(entry) => {
              const version = String((entry as { version?: string }).version ?? '');
              if (version) setHoveredKey(version);
            }}
            onMouseLeave={() => setHoveredKey(null)}
            onClick={(entry) => {
              const version = String((entry as { version?: string }).version ?? '');
              if (version) toggleSelect(version);
            }}
          >
            <LabelList
              dataKey="count"
              position="top"
              fill={theme.background.text}
              fontSize={12}
              fontWeight={700}
              formatter={(value) => formatMetricValue(Number(value ?? 0))}
            />
            {data.map((entry) => {
              const isActive = activeKey === entry.version;
              const dimmed = activeKey != null && !isActive;
              return (
                <Cell
                  key={entry.version}
                  fill={entry.fill}
                  fillOpacity={dimmed ? 0.28 : 1}
                  stroke={isActive ? entry.fill : 'transparent'}
                  strokeWidth={isActive ? 4 : 0}
                  strokeOpacity={isActive ? 1 : 0}
                  style={{ transition: 'fill-opacity 120ms ease' }}
                />
              );
            })}
          </Bar>
        </BarChart>
      </div>
    </div>
  );
}
