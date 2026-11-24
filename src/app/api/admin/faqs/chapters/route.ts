import { NextRequest, NextResponse } from 'next/server';
import { faqAdminGuard, faqServerError } from '@/lib/faqs/faqApiAuth';
import { createChapter } from '@/lib/faqs/faqService';
import { isHexColor } from '@/lib/faqs/faqConstants';

export const dynamic = 'force-dynamic';

/** Create Chapter / separator above the selected FAQ. Body { title, bg, fg, beforeFaqId? }. */
export async function POST(request: NextRequest) {
  const denied = await faqAdminGuard(request);
  if (denied) return denied;
  try {
    const b = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const title = typeof b.title === 'string' ? b.title.trim().slice(0, 255) : '';
    if (!title) return NextResponse.json({ success: false, error: 'Chapter title is required' }, { status: 400 });
    if (!isHexColor(b.bg) || !isHexColor(b.fg)) {
      return NextResponse.json({ success: false, error: 'Choose a background color' }, { status: 400 });
    }
    const id = await createChapter({
      title,
      bg: b.bg,
      fg: b.fg,
      beforeFaqId: typeof b.beforeFaqId === 'string' && b.beforeFaqId ? b.beforeFaqId : null,
    });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return faqServerError('chapter create', error);
  }
}
