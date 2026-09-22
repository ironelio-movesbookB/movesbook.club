'use client';

import { useEffect, useRef } from 'react';
import { StatisticsPieBlock, StatisticsVersionsBars } from '@/components/admin/statistics/StatisticsCharts';
import { useStatisticsGraphTheme } from '@/components/admin/statistics/StatisticsGraphTheme';
import { useStatisticsMetric } from '@/components/admin/statistics/StatisticsMetricToggle';
import type { StatsSlice, VersionBar } from '@/lib/admin/buildStatistics';
import {
  STATS_USER_KINDS,
  type StatsUserKind,
  type StatsVersionBucket,
} from '@/lib/admin/statisticsKinds';

type VersionDistributionDrilldownProps = {
  title: string;
  subtitle?: string;
  total: number;
  totalIncome?: number;
  bars: VersionBar[];
  slices: StatsSlice[];
  /**
   * When the drill-down is scoped to one user type, paint bar + pie
   * with that type’s color (Athletes blue, Clubs red, …).
   */
  userKind?: StatsUserKind | null;
  onClear?: () => void;
  /** Open admin/all for a specific version bar. */
  onOpenBarList?: (version: StatsVersionBucket) => void;
  /** Open admin/all for the whole drill-down selection. */
  onOpenUsersList?: () => void;
};

/** Shared chart area height so bar + pie cards match. */
const DRILLDOWN_CHART_HEIGHT = 300;

/** Bar (counts) + pie (%) for version distribution after a drill-down click. */
export default function VersionDistributionDrilldown({
  title,
  subtitle,
  total,
  totalIncome = 0,
  bars,
  slices,
  userKind,
  onClear,
  onOpenBarList,
  onOpenUsersList,
}: VersionDistributionDrilldownProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const theme = useStatisticsGraphTheme();
  const { isIncome, formatMetricValue, metricLabel } = useStatisticsMetric();
  const accent =
    userKind && STATS_USER_KINDS.includes(userKind) ? theme.kindColor(userKind) : undefined;
  const metricTotal = isIncome ? totalIncome : total;

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const id = window.requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(id);
  }, [title, subtitle, total, userKind]);

  return (
    <div ref={sectionRef} className="mt-4 scroll-mt-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: theme.background.accentAlt }}
          >
            Distribution of the versions
          </p>
          <h2 className="text-lg font-bold mt-0.5" style={{ color: theme.background.text }}>
            {title}
          </h2>
          {subtitle ? (
            <p className="text-sm mt-0.5" style={{ color: theme.background.muted }}>
              {subtitle}
            </p>
          ) : null}
          <p className="text-sm mt-1" style={{ color: theme.background.muted }}>
            {metricLabel} in selection: {formatMetricValue(metricTotal)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {onOpenUsersList ? (
            <button
              type="button"
              onClick={onOpenUsersList}
              className="text-sm px-3 py-1.5 border font-semibold"
              style={{
                borderColor: theme.background.accent,
                background: theme.background.panel,
                color: theme.background.accent,
              }}
            >
              Open users list
            </button>
          ) : null}
          {onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="text-sm px-3 py-1.5 border"
              style={theme.panelStyle}
            >
              Clear selection
            </button>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <div className="flex flex-col min-h-0">
          <p
            className="text-xs font-semibold mb-2 shrink-0"
            style={{ color: theme.background.text }}
          >
            Bar — {isIncome ? 'income (€)' : 'number of users'}
          </p>
          <StatisticsVersionsBars
            rows={bars}
            height={DRILLDOWN_CHART_HEIGHT}
            className="h-full min-h-[360px]"
            fillColor={accent}
            onOpenBarList={onOpenBarList}
          />
        </div>
        <div className="flex flex-col min-h-0">
          <p
            className="text-xs font-semibold mb-2 shrink-0"
            style={{ color: theme.background.text }}
          >
            Pie — % of versions
          </p>
          <StatisticsPieBlock
            title="Versions share"
            subtitle={`${formatMetricValue(metricTotal)} ${isIncome ? 'income' : 'users'}`}
            slices={slices}
            versionColors={!accent}
            uniformColor={accent}
            height={DRILLDOWN_CHART_HEIGHT}
            className="h-full min-h-[360px]"
          />
        </div>
      </div>
    </div>
  );
}
