import { NextRequest, NextResponse } from 'next/server';
import {
  deleteInvoice,
  getInvoice,
  parseInvoiceInput,
  updateInvoice,
} from '@/lib/club/clubBillingService';
import { billingAuth, billingErrorResponse } from '@/lib/club/clubBillingApi';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const auth = await billingAuth(request);
    if ('error' in auth) return auth.error;
    const { id } = ctx.params;
    return NextResponse.json({ invoice: await getInvoice(auth.ws, id) });
  } catch (error) {
    return billingErrorResponse(error, 'GET /api/club/billing/invoices/[id]:');
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const auth = await billingAuth(request);
    if ('error' in auth) return auth.error;
    const { id } = ctx.params;
    const body = await request.json().catch(() => ({}));
    const invoice = await updateInvoice(auth.ws, id, parseInvoiceInput(body));
    return NextResponse.json({ invoice });
  } catch (error) {
    return billingErrorResponse(error, 'PATCH /api/club/billing/invoices/[id]:');
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  try {
    const auth = await billingAuth(request);
    if ('error' in auth) return auth.error;
    const { id } = ctx.params;
    await deleteInvoice(auth.ws, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return billingErrorResponse(error, 'DELETE /api/club/billing/invoices/[id]:');
  }
}
