import { NextRequest, NextResponse } from 'next/server';
import {
  deleteWorkGroups,
  getWorkGroup,
  parseWorkGroupInput,
  updateWorkGroup,
} from '@/lib/club/clubWorkGroupService';
import { workGroupAuth, workGroupErrorResponse } from '@/lib/club/clubWorkGroupApi';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await workGroupAuth(request);
    if ('error' in auth) return auth.error;
    return NextResponse.json({ group: await getWorkGroup(auth.ws, params.id) });
  } catch (error) {
    return workGroupErrorResponse(error, 'GET /api/club/work-groups/[id]:');
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await workGroupAuth(request);
    if ('error' in auth) return auth.error;
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({ group: await updateWorkGroup(auth.ws, params.id, parseWorkGroupInput(body)) });
  } catch (error) {
    return workGroupErrorResponse(error, 'PATCH /api/club/work-groups/[id]:');
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await workGroupAuth(request);
    if ('error' in auth) return auth.error;
    const result = await deleteWorkGroups(auth.ws, [params.id]);
    if (!result.deleted) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    return workGroupErrorResponse(error, 'DELETE /api/club/work-groups/[id]:');
  }
}
