import { NextRequest, NextResponse } from 'next/server';
import {
  createWorkGroup,
  deleteWorkGroups,
  listWorkGroups,
  parseWorkGroupInput,
} from '@/lib/club/clubWorkGroupService';
import { workGroupAuth, workGroupErrorResponse } from '@/lib/club/clubWorkGroupApi';
import { idsFromBody } from '@/lib/club/clubCoachApi';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await workGroupAuth(request);
    if ('error' in auth) return auth.error;
    return NextResponse.json({ items: await listWorkGroups(auth.ws) });
  } catch (error) {
    return workGroupErrorResponse(error, 'GET /api/club/work-groups:');
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await workGroupAuth(request);
    if ('error' in auth) return auth.error;
    const body = await request.json().catch(() => ({}));
    const group = await createWorkGroup(auth.ws, parseWorkGroupInput(body));
    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    return workGroupErrorResponse(error, 'POST /api/club/work-groups:');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await workGroupAuth(request);
    if ('error' in auth) return auth.error;
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await deleteWorkGroups(auth.ws, idsFromBody(body)));
  } catch (error) {
    return workGroupErrorResponse(error, 'DELETE /api/club/work-groups:');
  }
}
