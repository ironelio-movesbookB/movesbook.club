import { NextRequest, NextResponse } from 'next/server';
import {
  createCreditNote,
  listCreditNotes,
  parseCreditNoteInput,
} from '@/lib/club/clubBillingService';
import { billingAuth, billingErrorResponse } from '@/lib/club/clubBillingApi';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await billingAuth(request);
    if ('error' in auth) return auth.error;
    const sp = request.nextUrl.searchParams;
    const year = Number(sp.get('year') || '');
    return NextResponse.json({
      items: await listCreditNotes(auth.ws, {
        direction: sp.get('direction') || undefined,
        year: Number.isFinite(year) ? year : undefined,
        q: sp.get('q') || undefined,
        from: sp.get('from') || undefined,
        to: sp.get('to') || undefined,
      }),
    });
  } catch (error) {
    return billingErrorResponse(error, 'GET /api/club/billing/credit-notes:');
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await billingAuth(request);
    if ('error' in auth) return auth.error;
    const body = await request.json().catch(() => ({}));
    const creditNote = await createCreditNote(auth.ws, parseCreditNoteInput(body), auth.userId);
    return NextResponse.json({ creditNote }, { status: 201 });
  } catch (error) {
    return billingErrorResponse(error, 'POST /api/club/billing/credit-notes:');
  }
}
