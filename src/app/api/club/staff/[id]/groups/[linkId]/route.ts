import { NextRequest, NextResponse } from 'next/server';
import { removeStaffGroupLink, updateStaffGroupLink } from '@/lib/club/clubStaffAdminService';
import { staffAdminAuth, staffAdminErrorResponse } from '@/lib/club/clubStaffAdminApi';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string; linkId: string } };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await staffAdminAuth(request);
    if ('error' in auth) return auth.error;
    const body = await request.json().catch(() => ({}));
    await updateStaffGroupLink(auth.ws, params.id, params.linkId, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return staffAdminErrorResponse(error, 'PATCH /api/club/staff/[id]/groups/[linkId]:');
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await staffAdminAuth(request);
    if ('error' in auth) return auth.error;
    await removeStaffGroupLink(auth.ws, params.id, params.linkId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return staffAdminErrorResponse(error, 'DELETE /api/club/staff/[id]/groups/[linkId]:');
  }
}
