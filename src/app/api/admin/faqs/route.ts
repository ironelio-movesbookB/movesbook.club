import { NextRequest, NextResponse } from 'next/server';
import { faqAdminGuard, faqServerError } from '@/lib/faqs/faqApiAuth';
import { createFaq, deleteFaqs, listFaqsForAdmin, parseFaqMetaInput } from '@/lib/faqs/faqService';
import { isFaqLanguage, isFaqSection, isFaqSubsection } from '@/lib/faqs/faqConstants';

export const dynamic = 'force-dynamic';

/** FAQ LIST (PHP admins/faq_pages_manage). */
export async function GET(request: NextRequest) {
  const denied = await faqAdminGuard(request);
  if (denied) return denied;
  try {
    const sp = request.nextUrl.searchParams;
    const section = sp.get('section');
    const subsection = sp.get('subsection');
    const lang = sp.get('lang');
    const sort = sp.get('sort');
    const searchField = sp.get('searchField');
    const entries = await listFaqsForAdmin({
      section: isFaqSection(section) ? section : null,
      subsection: isFaqSubsection(subsection) ? subsection : null,
      lang: isFaqLanguage(lang) ? lang : null,
      search: (sp.get('search') ?? '').slice(0, 200),
      searchField: searchField === 'title' ? 'title' : 'code',
      sort: sort === 'date' || sort === 'code' || sort === 'title' ? sort : 'manual',
    });
    return NextResponse.json({ success: true, entries });
  } catch (error) {
    return faqServerError('list', error);
  }
}

/** Create a New FAQ (PHP admins/add_faq_page). */
export async function POST(request: NextRequest) {
  const denied = await faqAdminGuard(request);
  if (denied) return denied;
  try {
    const parsed = parseFaqMetaInput(await request.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    const id = await createFaq(parsed.value);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return faqServerError('create', error);
  }
}

/** Delete the selected FAQs: body { ids: string[] }. */
export async function DELETE(request: NextRequest) {
  const denied = await faqAdminGuard(request);
  if (denied) return denied;
  try {
    const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
    const ids = Array.isArray(body?.ids) ? body!.ids.filter((i): i is string => typeof i === 'string') : [];
    if (!ids.length) return NextResponse.json({ success: false, error: 'No FAQ selected' }, { status: 400 });
    const deleted = await deleteFaqs(ids);
    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    return faqServerError('delete', error);
  }
}
