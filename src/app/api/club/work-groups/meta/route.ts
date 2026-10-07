import { NextRequest, NextResponse } from 'next/server';
import { workGroupMeta } from '@/lib/club/clubWorkGroupService';
import { workGroupAuth, workGroupErrorResponse } from '@/lib/club/clubWorkGroupApi';

export const dynamic = 'force-dynamic';

/** Workspace, active coaches and rooms for the group screens. */
export async function GET(request: NextRequest) {
  try {
    const auth = await workGroupAuth(request);
    if ('error' in auth) return auth.error;
    return NextResponse.json(await workGroupMeta(auth.ws));
  } catch (error) {
    return workGroupErrorResponse(error, 'GET /api/club/work-groups/meta:');
  }
}
