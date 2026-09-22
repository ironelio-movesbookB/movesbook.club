'use client';

import { useEffect, useRef } from 'react';
import { StatisticsPieBlock } from '@/components/admin/statistics/StatisticsCharts';
import { useStatisticsGraphTheme } from '@/components/admin/statistics/StatisticsGraphTheme';
import { useStatisticsMetric } from '@/components/admin/statistics/StatisticsMetricToggle';
import type { StatsSlice } from '@/lib/admin/buildStatistics';

type UserTypeDistributionDrilldownProps = {
  title: string;
  subtitle?: string;
  total: number;
  totalIncome?: number;
  slices: StatsSlice[];
  onClear?: () => void;
};

/** User-type pie after clicking a version bar (uses Athletes/Coaches/… colors). */
export default function UserTypeDistributionDrilldown({
  title,
  subtitle,
  total,
  totalIncome = 0,
  slices,
  onClear,
}: UserTypeDistributionDrilldownProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const theme = useStatisticsGraphTheme();
  const { isIncome, formatMetricValue, metricLabel } = useStatisticsMetric();
  const metricTotal = isIncome ? totalIncome : total;

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const id = window.requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(id);
  }, [title, subtitle, total]);

  return (
    <div ref={sectionRef} className="mt-4 scroll-mt-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: theme.background.accentAlt }}
          >
            Distribution among types of users
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
            Total {metricLabel.toLowerCase()}: {formatMetricValue(metricTotal)}
          </p>
        </div>
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 text-sm px-3 py-1.5 border"
            style={theme.panelStyle}
          >
            Clear selection
          </button>
        ) : null}
      </div>
      <div className="max-w-xl">
        <StatisticsPieBlock
          title={title}
          subtitle={`Total ${metricLabel.toLowerCase()}: ${formatMetricValue(metricTotal)}`}
          slices={slices}
          kindColors
          height={300}
          legendValueMode="count"
        />
      </div>
    </div>
  );
}
