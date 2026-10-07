import { NextRequest, NextResponse } from 'next/server';
import {
  deleteStaffRemuneration,
  parseRemunerationInput,
  updateStaffRemuneration,
} from '@/lib/club/clubStaffAdminService';
import { staffAdminAuth, staffAdminErrorResponse } from '@/lib/club/clubStaffAdminApi';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string; remunerationId: string } };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await staffAdminAuth(request);
    if ('error' in auth) return auth.error;
    const body = await request.json().catch(() => ({}));
    await updateStaffRemuneration(auth.ws, params.id, params.remunerationId, parseRemunerationInput(body));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return staffAdminErrorResponse(error, 'PATCH /api/club/staff/[id]/remunerations/[remunerationId]:');
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await staffAdminAuth(request);
    if ('error' in auth) return auth.error;
    await deleteStaffRemuneration(auth.ws, params.id, params.remunerationId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return staffAdminErrorResponse(error, 'DELETE /api/club/staff/[id]/remunerations/[remunerationId]:');
  }
}
