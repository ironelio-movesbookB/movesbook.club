import { NextRequest, NextResponse } from 'next/server';
import { buildRegister, parseRegisterCategories } from '@/lib/club/clubRegisterService';
import { staffAdminAuth, staffAdminErrorResponse } from '@/lib/club/clubStaffAdminApi';

export const dynamic = 'force-dynamic';

/** Register of members and volunteers: people of the selected categories (the PDF is built by the browser). */
export async function POST(request: NextRequest) {
  try {
    const auth = await staffAdminAuth(request);
    if ('error' in auth) return auth.error;
    const body = await request.json().catch(() => ({}));
    const categories = parseRegisterCategories(body.categories);
    if (categories.length === 0) {
      return NextResponse.json({ error: 'Select at least one type of profile' }, { status: 400 });
    }
    const sections = await buildRegister(auth.ws, categories);
    return NextResponse.json({ workspace: { kind: auth.ws.kind, name: auth.ws.name }, sections });
  } catch (error) {
    return staffAdminErrorResponse(error, 'POST /api/club/register-members:');
  }
}
