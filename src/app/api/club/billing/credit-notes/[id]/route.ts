import { NextRequest, NextResponse } from 'next/server';
import {
  deleteCreditNote,
  getCreditNote,
  parseCreditNoteInput,
  updateCreditNote,
} from '@/lib/club/clubBillingService';
import { billingAuth, billingErrorResponse } from '@/lib/club/clubBillingApi';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const auth = await billingAuth(request);
    if ('error' in auth) return auth.error;
    const { id } = ctx.params;
    return NextResponse.json({ creditNote: await getCreditNote(auth.ws, id) });
  } catch (error) {
    return billingErrorResponse(error, 'GET /api/club/billing/credit-notes/[id]:');
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const auth = await billingAuth(request);
    if ('error' in auth) return auth.error;
    const { id } = ctx.params;
    const body = await request.json().catch(() => ({}));
    const creditNote = await updateCreditNote(auth.ws, id, parseCreditNoteInput(body));
    return NextResponse.json({ creditNote });
  } catch (error) {
    return billingErrorResponse(error, 'PATCH /api/club/billing/credit-notes/[id]:');
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  try {
    const auth = await billingAuth(request);
    if ('error' in auth) return auth.error;
    const { id } = ctx.params;
    await deleteCreditNote(auth.ws, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return billingErrorResponse(error, 'DELETE /api/club/billing/credit-notes/[id]:');
  }
}
