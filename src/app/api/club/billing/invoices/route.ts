import { NextRequest, NextResponse } from 'next/server';
import {
  createInvoice,
  listInvoices,
  nextInvoiceNumber,
  parseInvoiceInput,
} from '@/lib/club/clubBillingService';
import { billingAuth, billingErrorResponse } from '@/lib/club/clubBillingApi';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await billingAuth(request);
    if ('error' in auth) return auth.error;
    const sp = request.nextUrl.searchParams;
    if (sp.get('nextNumber') === '1') {
      const direction = sp.get('direction') || 'outgoing';
      return NextResponse.json({ number: await nextInvoiceNumber(auth.ws, direction) });
    }
    const year = Number(sp.get('year') || '');
    return NextResponse.json({
      items: await listInvoices(auth.ws, {
        direction: sp.get('direction') || undefined,
        year: Number.isFinite(year) ? year : undefined,
        origin: sp.get('origin') || undefined,
        q: sp.get('q') || undefined,
        shopCtx: auth.ctx,
      }),
    });
  } catch (error) {
    return billingErrorResponse(error, 'GET /api/club/billing/invoices:');
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await billingAuth(request);
    if ('error' in auth) return auth.error;
    const body = await request.json().catch(() => ({}));
    const invoice = await createInvoice(auth.ws, parseInvoiceInput(body), auth.userId);
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    return billingErrorResponse(error, 'POST /api/club/billing/invoices:');
  }
}
