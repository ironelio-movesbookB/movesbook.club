import { NextRequest, NextResponse } from 'next/server';
import { faqAdminGuard, faqServerError } from '@/lib/faqs/faqApiAuth';
import { getViewSettings, saveViewSettings } from '@/lib/faqs/faqService';

export const dynamic = 'force-dynamic';

/** "Modality Of View" (PHP admins/faq_settings). */
export async function GET(request: NextRequest) {
  const denied = await faqAdminGuard(request);
  if (denied) return denied;
  try {
    return NextResponse.json({ success: true, settings: await getViewSettings() });
  } catch (error) {
    return faqServerError('settings get', error);
  }
}

export async function PUT(request: NextRequest) {
  const denied = await faqAdminGuard(request);
  if (denied) return denied;
  try {
    const settings = await saveViewSettings(await request.json().catch(() => null));
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    return faqServerError('settings save', error);
  }
}
