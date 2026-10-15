import { NextRequest, NextResponse } from 'next/server';
import { resolveSponsorWorkspace, sponsorErrorResponse } from '@/lib/club/sponsors/sponsorApi';
import { getSponsorReportToken, getSponsorStats } from '@/lib/club/sponsors/sponsorService';
import { addDaysYmd, todayYmd } from '@/lib/club/sponsors/sponsorConstants';

export const dynamic = 'force-dynamic';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveSponsorWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    const { id } = await params;
    const sp = request.nextUrl.searchParams;
    const to = YMD.test(sp.get('to') ?? '') ? String(sp.get('to')) : todayYmd();
    const from = YMD.test(sp.get('from') ?? '') ? String(sp.get('from')) : addDaysYmd(to, -30);
    const [stats, reportToken] = await Promise.all([
      getSponsorStats(auth.ws, id, from <= to ? from : to, from <= to ? to : from),
      getSponsorReportToken(auth.ws, id),
    ]);
    return NextResponse.json({ stats, reportToken });
  } catch (error) {
    return sponsorErrorResponse(error, 'GET /api/club/sponsors/[id]/stats');
  }
}
