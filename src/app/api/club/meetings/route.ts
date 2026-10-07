import { NextRequest, NextResponse } from 'next/server';
import { createMeeting, listMeetings, parseMeetingInput } from '@/lib/club/clubMeetingService';
import { staffAdminAuth, staffAdminErrorResponse } from '@/lib/club/clubStaffAdminApi';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await staffAdminAuth(request);
    if ('error' in auth) return auth.error;
    return NextResponse.json({ items: await listMeetings(auth.ws) });
  } catch (error) {
    return staffAdminErrorResponse(error, 'GET /api/club/meetings:');
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await staffAdminAuth(request);
    if ('error' in auth) return auth.error;
    const body = await request.json().catch(() => ({}));
    const meeting = await createMeeting(auth.ws, parseMeetingInput(body), auth.userId);
    return NextResponse.json({ meeting }, { status: 201 });
  } catch (error) {
    return staffAdminErrorResponse(error, 'POST /api/club/meetings:');
  }
}
