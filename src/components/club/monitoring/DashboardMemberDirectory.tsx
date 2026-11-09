'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import type { PreviewRow } from '@/lib/club/monitoring/dashboardSummary';
import { resolvePublicImageUrl } from '@/lib/profileImageUrl';

export type BirthdayFilter = 'today' | 'week' | 'month' | 'next' | 'past';

const FILTERS: { id: BirthdayFilter; label: string }[] = [
  { id: 'today', label: 'Birthdays of today' },
  { id: 'week', label: 'Birthdays of the current week' },
  { id: 'month', label: 'Birthdays of the current month' },
  { id: 'next', label: 'Next birthdays' },
  { id: 'past', label: 'Past birthdays' },
];

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

function birthdayOnYear(iso: string, year: number): Date | null {
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  if (!month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (date.getMonth() !== month - 1) return null;
  return startOfDay(date);
}

function nextOccurrence(iso: string, today: Date): Date | null {
  const thisYear = birthdayOnYear(iso, today.getFullYear());
  if (!thisYear) return null;
  if (thisYear.getTime() < today.getTime()) return birthdayOnYear(iso, today.getFullYear() + 1);
  return thisYear;
}

function lastOccurrence(iso: string, today: Date): Date | null {
  const thisYear = birthdayOnYear(iso, today.getFullYear());
  if (!thisYear) return null;
  if (thisYear.getTime() > today.getTime()) return birthdayOnYear(iso, today.getFullYear() - 1);
  return thisYear;
}

function weekBounds(today: Date): { start: Date; end: Date } {
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = addDays(today, mondayOffset);
  return { start, end: addDays(start, 6) };
}

function inRange(date: Date, start: Date, end: Date): boolean {
  const time = date.getTime();
  return time >= start.getTime() && time <= end.getTime();
}

type Tone = 'past' | 'today' | 'future';

function toneOf(iso: string, today: Date): Tone {
  const date = birthdayOnYear(iso, today.getFullYear());
  if (!date) return 'future';
  if (date.getTime() === today.getTime()) return 'today';
  return date.getTime() < today.getTime() ? 'past' : 'future';
}

function matches(iso: string, filter: BirthdayFilter, today: Date): boolean {
  if (filter === 'today') return toneOf(iso, today) === 'today';
  if (filter === 'month') {
    const date = birthdayOnYear(iso, today.getFullYear());
    return Boolean(date && date.getMonth() === today.getMonth());
  }
  if (filter === 'week') {
    const { start, end } = weekBounds(today);
    const years = new Set([start.getFullYear(), end.getFullYear()]);
    for (const year of years) {
      const date = birthdayOnYear(iso, year);
      if (date && inRange(date, start, end)) return true;
    }
    return false;
  }
  if (filter === 'next') {
    const date = nextOccurrence(iso, today);
    if (!date || date.getTime() === today.getTime()) return false;
    return inRange(date, addDays(today, 1), addDays(today, 7));
  }
  const date = lastOccurrence(iso, today);
  if (!date || date.getTime() === today.getTime()) return false;
  return inRange(date, addDays(today, -6), addDays(today, -1));
}

function toneClass(tone: Tone, filter: BirthdayFilter): string {
  if (filter === 'next') return 'text-blue-700';
  if (filter === 'past') return 'text-gray-400';
  if (filter === 'today') return 'text-red-600';
  if (tone === 'past') return 'text-gray-400';
  if (tone === 'today') return 'text-red-600';
  return 'text-blue-700';
}

function dayName(iso: string): string {
  const date = birthdayOnYear(iso, 2000);
  if (!date) return '—';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

function birthLabel(iso: string): string {
  const date = birthdayOnYear(iso, Number(iso.slice(0, 4)) || 2000);
  if (!date) return '—';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${iso.slice(0, 4)}`;
}

type Props = {
  rows: PreviewRow[];
  mode: 'members' | 'birthdays' | 'name-days';
  clubId: string;
};

export default function DashboardMemberDirectory({ rows, mode, clubId }: Props) {
  const [filter, setFilter] = useState<BirthdayFilter>(mode === 'members' ? 'month' : 'month');
  const today = useMemo(() => startOfDay(new Date()), []);

  const visible = useMemo(() => {
    const withDates = rows.filter((row) => row.birthdate);
    const source = mode === 'members' ? rows : withDates.filter((row) => matches(row.birthdate || '', filter, today));
    return [...source].sort((a, b) => {
      if (mode === 'members') {
        return `${a.surname || ''} ${a.firstName || ''}`.localeCompare(`${b.surname || ''} ${b.firstName || ''}`);
      }
      return (a.birthdate || '').slice(5).localeCompare((b.birthdate || '').slice(5));
    });
  }, [rows, mode, filter, today]);

  const profileHref = (memberId: string) =>
    clubId && clubId !== 'default'
      ? `/clubMembers/memberProfile/${encodeURIComponent(memberId)}?clubId=${encodeURIComponent(clubId)}&mode=edit`
      : `/clubMembers/memberProfile/${encodeURIComponent(memberId)}?mode=edit`;

  return (
    <div>
      {mode !== 'members' ? (
        <label className="mb-3 flex items-center gap-2 text-sm text-gray-700">
          {mode === 'name-days' ? 'Day names' : 'Birth days'}
          <select
            className="rounded border border-gray-300 bg-white px-2 py-1"
            value={filter}
            onChange={(event) => setFilter(event.target.value as BirthdayFilter)}
          >
            {FILTERS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {visible.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-500">No records.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead className="bg-teal-800 text-white">
              <tr className="text-left">
                {['Image', 'Surname', 'Name', 'Gender', mode === 'name-days' ? 'Day Name' : 'Date of birth', 'Type of User', 'Member type', 'Local', 'Options'].map(
                  (header) => (
                    <th key={header} className="px-3 py-2 font-semibold whitespace-nowrap">
                      {header}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {visible.map((row, index) => {
                const iso = row.birthdate || '';
                const tone = iso ? toneOf(iso, today) : 'future';
                const dateText = mode === 'name-days' ? (iso ? dayName(iso) : '—') : iso ? birthLabel(iso) : '—';
                const photo = resolvePublicImageUrl(row.image);
                return (
                  <tr key={row.id} className={index % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="px-3 py-1.5">
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs text-gray-500">
                          {(row.firstName || row.surname || '?').slice(0, 1)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">{row.surname || '—'}</td>
                    <td className="px-3 py-1.5">{row.firstName || '—'}</td>
                    <td className="px-3 py-1.5">{row.gender && row.gender !== '-' ? row.gender : '—'}</td>
                    <td className={`px-3 py-1.5 font-medium ${mode === 'members' ? '' : toneClass(tone, filter)}`}>
                      {dateText}
                    </td>
                    <td className="px-3 py-1.5">{row.userType && row.userType !== '-' ? row.userType : '—'}</td>
                    <td className="px-3 py-1.5">{row.memberType && row.memberType !== '-' ? row.memberType : '—'}</td>
                    <td className="px-3 py-1.5">{row.locality && row.locality !== '-' ? row.locality : '—'}</td>
                    <td className="px-3 py-1.5">
                      {row.memberId ? (
                        <Link href={profileHref(row.memberId)} className="inline-flex text-teal-800 hover:text-teal-950" title="Open profile">
                          <Eye className="h-4 w-4" />
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
