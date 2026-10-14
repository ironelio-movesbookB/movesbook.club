import { NextRequest, NextResponse } from 'next/server';
import { getSponsorReport } from '@/lib/club/sponsors/sponsorPublicService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const sp = request.nextUrl.searchParams;
    const data = await getSponsorReport(token, sp.get('lang'), sp.get('from'), sp.get('to'));
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('GET /api/public/sponsor-report', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
