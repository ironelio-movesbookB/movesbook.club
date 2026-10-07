import { NextRequest, NextResponse } from 'next/server';
import {
  addStaffGroupLink,
  assertStaffInWorkspace,
  listStaffGroupLinks,
  listStaffGroupOptions,
} from '@/lib/club/clubStaffAdminService';
import { staffAdminAuth, staffAdminErrorResponse } from '@/lib/club/clubStaffAdminApi';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await staffAdminAuth(request);
    if ('error' in auth) return auth.error;
    await assertStaffInWorkspace(auth.ws, params.id);
    const [items, groups] = await Promise.all([
      listStaffGroupLinks(auth.ws, params.id),
      listStaffGroupOptions(auth.ws),
    ]);
    return NextResponse.json({ items, groups });
  } catch (error) {
    return staffAdminErrorResponse(error, 'GET /api/club/staff/[id]/groups:');
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await staffAdminAuth(request);
    if ('error' in auth) return auth.error;
    const body = await request.json().catch(() => ({}));
    const id = await addStaffGroupLink(auth.ws, params.id, body);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return staffAdminErrorResponse(error, 'POST /api/club/staff/[id]/groups:');
  }
}
