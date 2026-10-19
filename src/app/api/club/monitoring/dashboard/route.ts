import { NextRequest, NextResponse } from 'next/server';
import { getClubAuthContext } from '@/lib/procedures';
import {
  isArchiveSectionId,
  isSummaryTileId,
} from '@/lib/club/monitoring/dashboardCatalog';
import { getDashboardPreview, getDashboardSnapshot } from '@/lib/club/monitoring/dashboardSummary';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;

    const sp = request.nextUrl.searchParams;
    const section = sp.get('section');
    if (section && (isArchiveSectionId(section) || isSummaryTileId(section))) {
      const preview = await getDashboardPreview(auth.ctx, section);
      return NextResponse.json(preview);
    }

    const series = sp.get('series') ?? 'subscriptions';
    const archiveId = isArchiveSectionId(series) ? series : 'subscriptions';
    const courseId = sp.get('courseId');
    const snapshot = await getDashboardSnapshot(auth.ctx, archiveId, courseId);
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error('GET club monitoring dashboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
