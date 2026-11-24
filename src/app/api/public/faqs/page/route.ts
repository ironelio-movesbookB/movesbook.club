import { NextRequest, NextResponse } from 'next/server';
import { getPublicFaqsForPage } from '@/lib/faqs/faqService';
import { isFaqLanguage } from '@/lib/faqs/faqConstants';

export const dynamic = 'force-dynamic';

/** "FAQs of the Page" (PHP FaqPage/current_page_faqs): ?url=/users/club_user_faccess&lang=en */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const url = (sp.get('url') ?? '').slice(0, 1000);
  const lang = sp.get('lang');
  try {
    const data = await getPublicFaqsForPage(url, isFaqLanguage(lang) ? lang : 'en');
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error('[faqs] public page:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
