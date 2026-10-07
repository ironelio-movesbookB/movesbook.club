import { NextRequest, NextResponse } from 'next/server';
import { deleteMeeting, getMeeting, parseMeetingInput, updateMeeting } from '@/lib/club/clubMeetingService';
import { staffAdminAuth, staffAdminErrorResponse } from '@/lib/club/clubStaffAdminApi';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await staffAdminAuth(request);
    if ('error' in auth) return auth.error;
    return NextResponse.json({ meeting: await getMeeting(auth.ws, params.id) });
  } catch (error) {
    return staffAdminErrorResponse(error, 'GET /api/club/meetings/[id]:');
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await staffAdminAuth(request);
    if ('error' in auth) return auth.error;
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({ meeting: await updateMeeting(auth.ws, params.id, parseMeetingInput(body)) });
  } catch (error) {
    return staffAdminErrorResponse(error, 'PATCH /api/club/meetings/[id]:');
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await staffAdminAuth(request);
    if ('error' in auth) return auth.error;
    await deleteMeeting(auth.ws, params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return staffAdminErrorResponse(error, 'DELETE /api/club/meetings/[id]:');
  }
}
