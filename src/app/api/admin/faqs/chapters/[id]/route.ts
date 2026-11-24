import { NextRequest, NextResponse } from 'next/server';
import { faqAdminGuard, faqServerError } from '@/lib/faqs/faqApiAuth';
import { deleteChapter } from '@/lib/faqs/faqService';

export const dynamic = 'force-dynamic';

/** ✖ on a chapter/separator bar. */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await faqAdminGuard(request);
  if (denied) return denied;
  try {
    const ok = await deleteChapter(params.id);
    if (!ok) return NextResponse.json({ success: false, error: 'Chapter not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return faqServerError('chapter delete', error);
  }
}
