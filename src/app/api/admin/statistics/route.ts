import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { buildStatisticsPayload } from '@/lib/admin/buildStatistics';
import {
  isStatsTypeKindFilter,
  STATS_USER_KINDS,
  type StatsTypeKindFilter,
  type StatsUserKind,
} from '@/lib/admin/statisticsKinds';

export const dynamic = 'force-dynamic';

function parseKind(raw: string | null): StatsUserKind | 'all' | 'except_groups' {
  if (!raw || raw === 'all') return 'all';
  if (raw === 'except_groups') return 'except_groups';
  return STATS_USER_KINDS.includes(raw as StatsUserKind) ? (raw as StatsUserKind) : 'all';
}

function parseTypeKind(raw: string | null): StatsTypeKindFilter {
  if (raw && isStatsTypeKindFilter(raw)) return raw;
  return 'single';
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = request.nextUrl;
  const country = url.searchParams.get('country');
  const userType = parseKind(url.searchParams.get('userType'));
  const typeKind = parseTypeKind(url.searchParams.get('typeKind'));
  const topCountriesN = Number(url.searchParams.get('topCountriesN') || '8');
  const typeCountriesN = Number(url.searchParams.get('typeCountriesN') || '15');

  try {
    const payload = await buildStatisticsPayload({
      country,
      userType,
      typeKind,
      topCountriesN: Number.isFinite(topCountriesN) ? topCountriesN : 8,
      typeCountriesN: Number.isFinite(typeCountriesN) ? typeCountriesN : 15,
      specialOffersOnly: url.searchParams.get('offers') === 'special',
    });
    return NextResponse.json(payload);
  } catch (err) {
    console.error('admin statistics failed', err);
    return NextResponse.json({ error: 'Failed to load statistics' }, { status: 500 });
  }
}
