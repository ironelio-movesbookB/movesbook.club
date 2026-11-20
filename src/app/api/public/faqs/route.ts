import { NextRequest, NextResponse } from 'next/server';
import { getPublicFaqsBySection } from '@/lib/faqs/faqService';
import { isFaqLanguage, isFaqSection, isFaqSubsection, isValidFaqPair } from '@/lib/faqs/faqConstants';

export const dynamic = 'force-dynamic';

/** FAQ display page (PHP FaqPage/display_faq): ?section=&subsection=&lang= */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const section = sp.get('section');
  const subsection = sp.get('subsection');
  const lang = sp.get('lang');
  if (!isFaqSection(section) || !isFaqSubsection(subsection) || !isValidFaqPair(section, subsection)) {
    return NextResponse.json({ success: false, error: 'Invalid section or subsection' }, { status: 400 });
  }
  try {
    const data = await getPublicFaqsBySection(section, subsection, isFaqLanguage(lang) ? lang : 'en');
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error('[faqs] public section:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
