import { NextRequest, NextResponse } from 'next/server';
import { faqAdminGuard, faqServerError } from '@/lib/faqs/faqApiAuth';
import { saveFaqTranslations } from '@/lib/faqs/faqService';

export const dynamic = 'force-dynamic';

/** Save title, subtitle and content of every language at once: body { translations: [...] }. */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await faqAdminGuard(request);
  if (denied) return denied;
  try {
    const ok = await saveFaqTranslations(params.id, await request.json().catch(() => null));
    if (!ok) return NextResponse.json({ success: false, error: 'FAQ not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return faqServerError('translations', error);
  }
}
