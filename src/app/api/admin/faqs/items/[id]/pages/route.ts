import { NextRequest, NextResponse } from 'next/server';
import { faqAdminGuard, faqServerError } from '@/lib/faqs/faqApiAuth';
import { saveFaqPages } from '@/lib/faqs/faqService';

export const dynamic = 'force-dynamic';

/** "Movesbook FAQ-related pages": replace the pages linked to the FAQ. Body { pages: string[] }. */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await faqAdminGuard(request);
  if (denied) return denied;
  try {
    const ok = await saveFaqPages(params.id, await request.json().catch(() => null));
    if (!ok) return NextResponse.json({ success: false, error: 'FAQ not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return faqServerError('pages', error);
  }
}
