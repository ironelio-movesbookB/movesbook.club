import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

/** Super Admin / admin staff guard for the /api/admin/faqs/* routes. Returns a response on failure. */
export async function faqAdminGuard(request: NextRequest): Promise<NextResponse | null> {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }
  return null;
}

export function faqServerError(scope: string, error: unknown): NextResponse {
  console.error(`[faqs] ${scope}:`, error);
  return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
}
