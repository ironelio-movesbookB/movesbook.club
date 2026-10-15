import { NextRequest, NextResponse } from 'next/server';
import { getSponsorKit } from '@/lib/club/sponsors/sponsorPublicService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const data = await getSponsorKit(orgId, request.nextUrl.searchParams.get('lang'));
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (error) {
    console.error('GET /api/public/sponsor-kit', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
