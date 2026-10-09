import { NextRequest, NextResponse } from 'next/server';
import {
  deleteParty,
  getParty,
  listPartyDocuments,
  parsePartyInput,
  updateParty,
} from '@/lib/club/clubBillingService';
import { billingAuth, billingErrorResponse } from '@/lib/club/clubBillingApi';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const auth = await billingAuth(request);
    if ('error' in auth) return auth.error;
    const { id } = ctx.params;
    const withDocs = request.nextUrl.searchParams.get('docs') === '1';
    if (withDocs) {
      const party = await getParty(auth.ws, id);
      const docs = await listPartyDocuments(auth.ws, id);
      return NextResponse.json({ party, ...docs });
    }
    return NextResponse.json({ party: await getParty(auth.ws, id) });
  } catch (error) {
    return billingErrorResponse(error, 'GET /api/club/billing/parties/[id]:');
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const auth = await billingAuth(request);
    if ('error' in auth) return auth.error;
    const { id } = ctx.params;
    const body = await request.json().catch(() => ({}));
    const party = await updateParty(auth.ws, id, parsePartyInput(body));
    return NextResponse.json({ party });
  } catch (error) {
    return billingErrorResponse(error, 'PATCH /api/club/billing/parties/[id]:');
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  try {
    const auth = await billingAuth(request);
    if ('error' in auth) return auth.error;
    const { id } = ctx.params;
    await deleteParty(auth.ws, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return billingErrorResponse(error, 'DELETE /api/club/billing/parties/[id]:');
  }
}
