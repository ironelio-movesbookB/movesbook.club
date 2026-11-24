import { NextRequest, NextResponse } from 'next/server';
import { buildReceiptPdf, loadReceiptPdfData, receiptPdfFilename } from '@/lib/procedures/receiptPdfMail';
import { receiptForShareToken } from '@/lib/procedures/receiptShares';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const share = await receiptForShareToken(token);
    const data = share ? await loadReceiptPdfData(share.receiptId, share.clubId) : null;
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const pdf = await buildReceiptPdf(data);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${receiptPdfFilename(data)}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('GET /api/public/club-receipts/[token]/pdf', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
