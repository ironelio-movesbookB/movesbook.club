import { NextRequest, NextResponse } from 'next/server';
import { createParty, listParties, parsePartyInput } from '@/lib/club/clubBillingService';
import { billingAuth, billingErrorResponse } from '@/lib/club/clubBillingApi';
import type { BillingPartyKind } from '@/lib/club/clubBilling.constants';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await billingAuth(request);
    if ('error' in auth) return auth.error;
    const kind = (request.nextUrl.searchParams.get('kind') || 'all') as BillingPartyKind | 'all';
    const q = request.nextUrl.searchParams.get('q') || '';
    return NextResponse.json({ items: await listParties(auth.ws, { kind, q }) });
  } catch (error) {
    return billingErrorResponse(error, 'GET /api/club/billing/parties:');
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await billingAuth(request);
    if ('error' in auth) return auth.error;
    const body = await request.json().catch(() => ({}));
    const party = await createParty(auth.ws, parsePartyInput(body));
    return NextResponse.json({ party }, { status: 201 });
  } catch (error) {
    return billingErrorResponse(error, 'POST /api/club/billing/parties:');
  }
}
