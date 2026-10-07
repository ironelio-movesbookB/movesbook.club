import { NextRequest, NextResponse } from 'next/server';
import { addRoom } from '@/lib/club/clubWorkGroupService';
import { workGroupAuth, workGroupErrorResponse } from '@/lib/club/clubWorkGroupApi';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await workGroupAuth(request);
    if ('error' in auth) return auth.error;
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({ room: await addRoom(auth.ws, body.name) }, { status: 201 });
  } catch (error) {
    return workGroupErrorResponse(error, 'POST /api/club/work-groups/rooms:');
  }
}
