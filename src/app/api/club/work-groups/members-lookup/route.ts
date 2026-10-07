import { NextRequest, NextResponse } from 'next/server';
import { searchWorkspaceMembers } from '@/lib/club/clubWorkGroupService';
import { workGroupAuth, workGroupErrorResponse } from '@/lib/club/clubWorkGroupApi';

export const dynamic = 'force-dynamic';

/** Athletes for a group: members of the current club or team. */
export async function GET(request: NextRequest) {
  try {
    const auth = await workGroupAuth(request);
    if ('error' in auth) return auth.error;
    const items = await searchWorkspaceMembers(auth.ws, request.nextUrl.searchParams.get('q') ?? '');
    return NextResponse.json({ items });
  } catch (error) {
    return workGroupErrorResponse(error, 'GET /api/club/work-groups/members-lookup:');
  }
}
