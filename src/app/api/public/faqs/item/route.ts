import { NextRequest, NextResponse } from 'next/server';
import { getPublicFaqById } from '@/lib/faqs/faqService';
import { isFaqLanguage } from '@/lib/faqs/faqConstants';

export const dynamic = 'force-dynamic';

/** One FAQ at full page (PHP FaqPage/faq_doubleclick/{id}): ?id=&lang= */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const id = (sp.get('id') ?? '').trim();
  const lang = sp.get('lang');
  if (!/^[\w-]{1,36}$/.test(id)) {
    return NextResponse.json({ success: false, error: 'Invalid FAQ id' }, { status: 400 });
  }
  try {
    const data = await getPublicFaqById(id, isFaqLanguage(lang) ? lang : 'en');
    if (!data) return NextResponse.json({ success: false, error: 'FAQ not found' }, { status: 404 });
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error('[faqs] public item:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
