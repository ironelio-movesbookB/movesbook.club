import { NextRequest, NextResponse } from 'next/server';
import { requireShopManager } from '@/lib/shop/auth';
import { issueOrderDocument } from '@/lib/shop/service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireShopManager(request);
  if ('error' in auth) return auth.error;
  const body = await request.json().catch(() => ({}));
  const kind = body.kind === 'invoice' ? 'invoice' : 'receipt';
  try {
    const document = await issueOrderDocument(auth.workspace, params.id, kind);
    return NextResponse.json(document);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create the document.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
