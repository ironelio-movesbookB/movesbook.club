import { NextRequest, NextResponse } from 'next/server';
import { listMemberCandidates, partyForMember } from '@/lib/club/clubBillingService';
import { billingAuth, billingErrorResponse } from '@/lib/club/clubBillingApi';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await billingAuth(request);
    if ('error' in auth) return auth.error;
    return NextResponse.json({ items: await listMemberCandidates(auth.ws) });
  } catch (error) {
    return billingErrorResponse(error, 'GET /api/club/billing/members:');
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await billingAuth(request);
    if ('error' in auth) return auth.error;
    const body = await request.json().catch(() => ({}));
    const party = await partyForMember(auth.ws, String(body?.userId ?? ''));
    return NextResponse.json({ party });
  } catch (error) {
    return billingErrorResponse(error, 'POST /api/club/billing/members:');
  }
}
