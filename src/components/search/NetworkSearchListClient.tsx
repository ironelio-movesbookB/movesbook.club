'use client';
import Image from 'next/image';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Bike, Star, UserPlus } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { isClubAccountUserType } from '@/utils/dashboardRouting';

export type LegendKey =
  | 'single_user'
  | 'coach'
  | 'group'
  | 'team'
  | 'club'
  | 'public_figure';

export type ListRow = {
  legendKey: LegendKey;
  resultType: 'user' | 'group' | 'team' | 'club';
  id: string;
  title: string;
  username: string | null;
  image: string | null;
  country: string | null;
  roleLine: string;
  mutualLine: string | null;
  subscribedSince: string | null;
  isClubMember: boolean;
};

const ALL_LEGEND_KEYS: LegendKey[] = [
  'single_user',
  'coach',
  'group',
  'team',
  'club',
  'public_figure',
];

const SWATCH: Record<LegendKey, string> = {
  single_user: 'bg-blue-600',
  coach: 'bg-green-600',
  group: 'bg-purple-600',
  team: 'bg-rose-950',
  club: 'bg-red-600',
  public_figure: 'bg-orange-500',
};

function countryBadge(country: string | null): string {
  if (!country?.trim()) return '—';
  const t = country.trim();
  if (t.length <= 3) return t.toUpperCase();
  return t.slice(0, 2).toUpperCase();
}

function formatSubscribedSince(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return format(new Date(iso), 'MMM d, yyyy');
  } catch {
    return '—';
  }
}

function viewerCanManageMembers(userType: string | undefined): boolean {
  if (!userType) return false;
  return (
    isClubAccountUserType(userType) ||
    userType === 'TEAM_MANAGER' ||
    userType === 'COACH' ||
    userType === 'GROUP_ADMIN'
  );
}

function targetIsInvitableMember(legendKey: LegendKey): boolean {
  return legendKey === 'single_user' || legendKey === 'public_figure';
}

type Props = {
  initialQuery: string;
  initialSource: 'mypage' | 'myclub';
  /** Legend kinds offered (and searchable). Defaults to all kinds. */
  legendKeys?: LegendKey[];
  /** Kinds enabled on first render (subset of legendKeys). */
  initialEnabledKinds?: LegendKey[];
  /** Hide the "Request Friendship" button on each result (e.g. super admin News from clubs). */
  hideRequestFriendship?: boolean;
  /** When set, clicking a result (image / title) selects it instead of only visiting its page. */
  onSelectRow?: (row: ListRow) => void;
  /** Overrides the page heading. */
  title?: string;
  /** Hide the "mypage / myclub" source tag next to the query. */
  hideSourceTag?: boolean;
  /** localStorage keys tried (in order) for the Bearer token. Super admin pages use 'adminToken'. */
  tokenStorageKeys?: string[];
};

const DEFAULT_TOKEN_KEYS = ['token'];

export function NetworkSearchListClient({
  initialQuery,
  initialSource,
  legendKeys = ALL_LEGEND_KEYS,
  initialEnabledKinds,
  hideRequestFriendship = false,
  onSelectRow,
  title,
  hideSourceTag = false,
  tokenStorageKeys = DEFAULT_TOKEN_KEYS,
}: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [rows, setRows] = useState<ListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enabledKinds, setEnabledKinds] = useState<Set<LegendKey>>(() => {
    if (initialEnabledKinds?.length) return new Set<LegendKey>(initialEnabledKinds);
    if (initialSource === 'myclub') return new Set<LegendKey>(['club']);
    return new Set(legendKeys);
  });

  const load = useCallback(async () => {
    const q = initialQuery.trim();
    if (!q) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let token: string | null = null;
      if (typeof window !== 'undefined') {
        for (const key of tokenStorageKeys) {
          token = localStorage.getItem(key);
          if (token) break;
        }
      }
      const headers: HeadersInit = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(
        `/api/network-search-list?q=${encodeURIComponent(q)}&source=${encodeURIComponent(initialSource)}`,
        { headers }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : t('searchlist_error'));
        setRows([]);
        return;
      }
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch {
      setError(t('searchlist_error'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [initialQuery, initialSource, t, tokenStorageKeys]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(
    () => rows.filter((r) => enabledKinds.has(r.legendKey)),
    [rows, enabledKinds]
  );

  const toggleKind = (kind: LegendKey) => {
    setEnabledKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      if (next.size === 0) return new Set(legendKeys);
      return next;
    });
  };

  const resetLegend = () => setEnabledKinds(new Set(legendKeys));

  const legendItems: { key: LegendKey; label: string }[] = (
    [
      { key: 'single_user', label: t('searchlist_legend_single_user') },
      { key: 'coach', label: t('searchlist_legend_coach') },
      { key: 'group', label: t('searchlist_legend_group') },
      { key: 'team', label: t('searchlist_legend_team') },
      { key: 'club', label: t('searchlist_legend_club') },
      { key: 'public_figure', label: t('searchlist_legend_public_figure') },
    ] as { key: LegendKey; label: string }[]
  ).filter((item) => legendKeys.includes(item.key));

  const viewerUserType = user?.userType;
  const isClubViewer = isClubAccountUserType(viewerUserType ?? '');

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-6 sm:px-4 lg:px-6">
      <h1 className="mb-1 text-lg font-semibold text-zinc-900 sm:text-xl">
        {title ?? t('searchlist_title')}
      </h1>
      <p className="mb-4 text-sm text-zinc-600">
        {t('searchlist_query_heading')}
        <span className="font-medium text-zinc-800">&ldquo;{initialQuery}&rdquo;</span>
        {hideSourceTag ? null : (
          <>
            <span className="text-zinc-400"> · </span>
            <span className="text-xs uppercase tracking-wide text-zinc-500">
              {initialSource === 'myclub' ? 'myclub' : 'mypage'}
            </span>
          </>
        )}
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-xs text-zinc-700 shadow-sm sm:text-sm">
        {legendItems.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => toggleKind(key)}
            className={`inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors hover:bg-zinc-100 ${
              enabledKinds.has(key) ? 'opacity-100' : 'opacity-40 line-through'
            }`}
          >
            <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${SWATCH[key]}`} aria-hidden />
            <span>{label}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={resetLegend}
          className="ml-auto text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline sm:text-sm"
        >
          {t('searchlist_reset_all')}
        </button>
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-zinc-500">{t('searchlist_loading')}</p>
      ) : error ? (
        <p className="py-12 text-center text-sm text-red-600">{error}</p>
      ) : filteredRows.length === 0 ? (
        <p className="py-16 text-center text-sm text-zinc-500">{t('searchlist_empty')}</p>
      ) : (
        <ul className="space-y-4">
          {filteredRows.map((row) => (
            <SearchResultCard
              key={`${row.resultType}-${row.id}`}
              row={row}
              t={t}
              viewerUserType={viewerUserType}
              isClubViewer={isClubViewer}
              hideRequestFriendship={hideRequestFriendship}
              onSelect={onSelectRow}
            />
          ))}
        </ul>
      )}
    </main>
  );
}

function SearchResultCard({
  row,
  t,
  viewerUserType,
  isClubViewer,
  hideRequestFriendship = false,
  onSelect,
}: {
  row: ListRow;
  t: (key: string) => string;
  viewerUserType: string | undefined;
  isClubViewer: boolean;
  hideRequestFriendship?: boolean;
  onSelect?: (row: ListRow) => void;
}) {
  const isUser = row.resultType === 'user';
  const subscribedLabel = t('searchlist_user_since').replace(
    '{date}',
    formatSubscribedSince(row.subscribedSince)
  );

  const showInviteActions =
    viewerCanManageMembers(viewerUserType) &&
    isUser &&
    targetIsInvitableMember(row.legendKey) &&
    !row.isClubMember;

  const showAlreadyMember = isClubViewer && isUser && row.isClubMember;

  return (
    <li className="rounded-lg border border-zinc-300 bg-white shadow-sm">
      <div className="grid gap-4 p-4 sm:grid-cols-12 sm:items-start">
        <div className="flex flex-col gap-2 sm:col-span-3 lg:col-span-2">
          <div className="flex gap-2">
            <div
              className={`relative h-20 w-20 shrink-0 overflow-hidden rounded border border-zinc-200 bg-zinc-100 ${
                onSelect ? 'cursor-pointer hover:ring-2 hover:ring-cyan-400' : ''
              }`}
              onClick={onSelect ? () => onSelect(row) : undefined}
            >
              {row.image ? (
                <Image src={row.image} alt="" className="h-full w-full object-cover" width={56} height={80} unoptimized />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] font-medium text-zinc-400">
                  —
                </div>
              )}
            </div>
            <div className="relative flex h-20 w-14 shrink-0 flex-col items-center justify-center overflow-hidden rounded border border-dashed border-zinc-300 bg-zinc-50 text-[8px] font-semibold uppercase leading-tight text-zinc-400">
              {t('searchlist_no_image')}
            </div>
          </div>
          {isUser ? (
            <p className="w-full rounded border border-zinc-200 bg-zinc-100 px-2 py-1.5 text-center text-[10px] font-medium leading-snug text-zinc-700 sm:text-[11px]">
              {subscribedLabel}
            </p>
          ) : null}
        </div>

        <div className="min-w-0 sm:col-span-6 lg:col-span-7">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className="flex h-8 w-10 items-center justify-center rounded border border-zinc-200 bg-zinc-50 text-xs font-bold text-zinc-700"
              title={row.country ?? ''}
            >
              {countryBadge(row.country)}
            </span>
            <Bike className="h-5 w-5 text-zinc-500" aria-hidden />
            <Star className="h-5 w-5 fill-amber-400 text-amber-500" aria-hidden />
            <span
              className={`inline-block h-2.5 w-2.5 rounded-sm ${SWATCH[row.legendKey]}`}
              aria-hidden
            />
          </div>
          <p className="text-base font-semibold text-blue-700">
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(row)}
                className="text-left hover:text-blue-900 hover:underline"
              >
                {row.title}
              </button>
            ) : (
              row.title
            )}
            {isUser && row.username ? (
              <span className="block text-sm font-normal text-zinc-600 sm:inline sm:pl-2">
                ({row.username})
              </span>
            ) : null}
          </p>
          {row.country ? (
            <p className="text-sm text-zinc-700">{row.country}</p>
          ) : (
            <p className="text-sm text-zinc-400">—</p>
          )}
          <p className="mt-1 text-sm text-zinc-600">{row.roleLine}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {row.mutualLine ?? t('searchlist_mutuals_placeholder')}
          </p>

          {showInviteActions ? (
            <div className="mt-3 flex max-w-md flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="flex-1 rounded bg-red-600 px-3 py-2 text-center text-xs font-semibold text-white shadow-sm hover:bg-red-700"
              >
                {t('searchlist_btn_send_register')}
              </button>
              <button
                type="button"
                className="flex-1 rounded bg-red-600 px-3 py-2 text-center text-xs font-semibold text-white shadow-sm hover:bg-red-700"
              >
                {t('searchlist_btn_invite')}
              </button>
            </div>
          ) : null}

          {showAlreadyMember ? (
            <button
              type="button"
              className="mt-3 w-full max-w-xs rounded bg-emerald-600 px-3 py-2 text-center text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 sm:block"
            >
              {t('searchlist_btn_member')}
            </button>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:col-span-3">
          {hideRequestFriendship ? null : (
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 sm:text-sm"
            >
              <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
              {t('searchlist_btn_request_friend')}
            </button>
          )}
          <Link
            href={`/searchresults/search/${encodeURIComponent(
              isUser ? (row.username || '').trim() || row.id : row.title
            )}`}
            className="inline-flex items-center justify-center rounded bg-zinc-700 px-3 py-2 text-center text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 sm:text-sm"
          >
            {isUser
              ? t('searchlist_btn_visit_user')
              : row.resultType === 'club'
                ? t('searchlist_btn_visit_club')
                : t('searchlist_btn_visit_entity')}
          </Link>
        </div>
      </div>
    </li>
  );
}
