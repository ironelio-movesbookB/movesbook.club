import { NextRequest, NextResponse } from 'next/server';
import { faqAdminGuard, faqServerError } from '@/lib/faqs/faqApiAuth';
import { getFaqDetail, parseFaqMetaInput, updateFaqMeta } from '@/lib/faqs/faqService';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

/** One FAQ with all languages and linked pages (content editor, edit popup, eye preview). */
export async function GET(request: NextRequest, { params }: Ctx) {
  const denied = await faqAdminGuard(request);
  if (denied) return denied;
  try {
    const faq = await getFaqDetail(params.id);
    if (!faq) return NextResponse.json({ success: false, error: 'FAQ not found' }, { status: 404 });
    return NextResponse.json({ success: true, faq });
  } catch (error) {
    return faqServerError('detail', error);
  }
}

/** ⋮ → Edit: FAQ parameters only (not the content). */
export async function PUT(request: NextRequest, { params }: Ctx) {
  const denied = await faqAdminGuard(request);
  if (denied) return denied;
  try {
    const parsed = parseFaqMetaInput(await request.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    const ok = await updateFaqMeta(params.id, parsed.value);
    if (!ok) return NextResponse.json({ success: false, error: 'FAQ not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return faqServerError('update', error);
  }
}
