import { NextRequest, NextResponse } from 'next/server';
import { getClubAuthContext } from '@/lib/procedures/clubAuth';
import { emailReceiptPdfs, loadReceiptPdfData } from '@/lib/procedures/receiptPdfMail';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/** Default address for "Send data": the member of the first selected receipt. */
export async function GET(request: NextRequest) {
  const auth = await getClubAuthContext(request);
  if ('error' in auth) return auth.error;
  const receiptId = String(request.nextUrl.searchParams.get('receiptId') ?? '').trim();
  if (!receiptId) return NextResponse.json({ error: 'Receipt is required' }, { status: 400 });
  const data = await loadReceiptPdfData(receiptId, auth.ctx.club.id);
  if (!data) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
  return NextResponse.json({ email: data.memberEmail, memberName: data.memberName });
}

/** Mails the PDF of the selected receipts to the address typed by the operator. */
export async function POST(request: NextRequest) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;
    const body = (await request.json().catch(() => ({}))) as { receiptIds?: unknown; to?: unknown };
    const receiptIds = Array.isArray(body.receiptIds)
      ? Array.from(new Set(body.receiptIds.map((id) => String(id ?? '').trim()).filter(Boolean))).slice(0, 50)
      : [];
    const to = String(body.to ?? '').trim();
    if (receiptIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one receipt.' }, { status: 400 });
    }
    if (!EMAIL_RE.test(to)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }
    const result = await emailReceiptPdfs({ receiptIds, clubId: auth.ctx.club.id, to });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('POST receipts send-pdf:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not send the receipts' },
      { status: 500 },
    );
  }
}
