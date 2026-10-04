'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  currentSportSeason,
  statValueKey,
  type SportSeasonStats,
  type SportStatGroup,
} from '@/lib/sport/sportProfileTypes';
import { useSportT } from '@/components/sport/useSportT';

type Props = {
  title?: string;
  groups: SportStatGroup[];
  values: SportSeasonStats;
  onChange: (next: SportSeasonStats) => void;
  readOnly?: boolean;
  emptyText?: string;
};

/** "Statistical options": group tabs + rounded stat buttons; a picked button edits its season value. */
export default function SportStatsBoard({
  title = 'Statistical options',
  groups,
  values,
  onChange,
  readOnly = false,
  emptyText = 'No statistics for this sport.',
}: Props) {
  const st = useSportT();
  const thisSeason = currentSportSeason();
  const seasons = useMemo(() => {
    const all = new Set([thisSeason, ...Object.keys(values)]);
    return [...all].sort().reverse();
  }, [values, thisSeason]);
  const [season, setSeason] = useState(thisSeason);
  const [newSeason, setNewSeason] = useState('');
  const [groupIndex, setGroupIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);

  const groupsKey = groups.map((g) => g.title).join('|');
  useEffect(() => {
    setGroupIndex(0);
    setPicked(null);
  }, [groupsKey]);

  if (groups.length === 0) {
    return <p className="text-sm text-gray-600">{st(emptyText)}</p>;
  }

  const group = groups[Math.min(groupIndex, groups.length - 1)];
  const seasonValues = values[season] ?? {};
  const pickedItem = group.items.find((item) => statValueKey(group, item) === picked) ?? null;

  const setValue = (key: string, value: string) => {
    onChange({ ...values, [season]: { ...seasonValues, [key]: value } });
  };

  const addSeason = () => {
    const label = newSeason.trim();
    if (!label) return;
    if (!values[label]) onChange({ ...values, [label]: {} });
    setSeason(label);
    setNewSeason('');
  };

  return (
    <div data-testid="sport-stats-board">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <h3 className="text-xl text-[#1f4e8c]">{st(title)}</h3>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="text-gray-700" htmlFor="sport-stats-season">
            {st('Season')}
          </label>
          <select
            id="sport-stats-season"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="rounded border border-gray-400 bg-white px-2 py-1"
          >
            {seasons.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {!readOnly ? (
            <>
              <input
                value={newSeason}
                onChange={(e) => setNewSeason(e.target.value)}
                placeholder="e.g. 2025/2026"
                className="w-28 rounded border border-gray-400 bg-white px-2 py-1"
              />
              <button
                type="button"
                onClick={addSeason}
                className="rounded border border-gray-500 bg-gray-100 px-2 py-1 text-gray-800 hover:bg-gray-200"
              >
                {st('Add season')}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b-2 border-black">
        {groups.map((g, i) => (
          <button
            key={g.title}
            type="button"
            onClick={() => {
              setGroupIndex(i);
              setPicked(null);
            }}
            className={`min-w-[7rem] rounded-t-md px-4 py-2 text-sm font-medium ${
              g === group
                ? 'bg-gradient-to-b from-gray-600 to-gray-800 text-white'
                : 'bg-gradient-to-b from-gray-100 to-gray-300 text-gray-800 hover:from-gray-200'
            }`}
          >
            {st(g.title)}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {group.items.map((item) => {
          const key = statValueKey(group, item);
          const value = seasonValues[key] ?? '';
          return (
            <button
              key={key}
              type="button"
              data-stat-key={key}
              onClick={() => setPicked(key === picked ? null : key)}
              className={`flex min-w-[9rem] flex-col items-center rounded-lg bg-gradient-to-b from-gray-600 to-gray-800 px-4 py-2 text-sm text-white shadow ${
                key === picked ? 'ring-2 ring-red-500 ring-offset-1' : ''
              }`}
            >
              <span className="font-medium">{st(item.label)}</span>
              <span className="text-xs text-gray-200">{value || '—'}</span>
            </button>
          );
        })}
      </div>

      {pickedItem ? (
        <div className="mt-4 max-w-md rounded border border-gray-300 bg-white p-3 text-sm">
          <label className="mb-1 block font-medium text-gray-800" htmlFor="sport-stat-value">
            {st(pickedItem.label)} — {st('Season')} {season}
          </label>
          {readOnly ? (
            <p className="text-gray-900">{seasonValues[statValueKey(group, pickedItem)] || '—'}</p>
          ) : (
            <input
              id="sport-stat-value"
              autoFocus
              value={seasonValues[statValueKey(group, pickedItem)] ?? ''}
              onChange={(e) => setValue(statValueKey(group, pickedItem), e.target.value)}
              className="w-full rounded border border-gray-400 bg-[#fffde7] px-2 py-1.5"
            />
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-gray-500">
          {st(
            readOnly
              ? 'Click a statistic to see its value.'
              : 'Click a statistic to record its value for the season.',
          )}
        </p>
      )}
    </div>
  );
}
