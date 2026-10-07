import { NextRequest, NextResponse } from 'next/server';
import { listAnnouncements, parseAnnouncementInput, sendAnnouncement } from '@/lib/club/clubWorkGroupService';
import { workGroupAuth, workGroupErrorResponse } from '@/lib/club/clubWorkGroupApi';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await workGroupAuth(request);
    if ('error' in auth) return auth.error;
    return NextResponse.json({ items: await listAnnouncements(auth.ws, params.id) });
  } catch (error) {
    return workGroupErrorResponse(error, 'GET /api/club/work-groups/[id]/announcements:');
  }
}

/** Sends by mail to athletes and parents and/or posts it in each member's "Alert posted". */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await workGroupAuth(request);
    if ('error' in auth) return auth.error;
    const body = await request.json().catch(() => ({}));
    const announcement = await sendAnnouncement(auth.ws, params.id, parseAnnouncementInput(body), auth.userId);
    return NextResponse.json({ announcement }, { status: 201 });
  } catch (error) {
    return workGroupErrorResponse(error, 'POST /api/club/work-groups/[id]/announcements:');
  }
}
