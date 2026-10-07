import { NextRequest, NextResponse } from 'next/server';
import { getClubAuthContext } from '@/lib/procedures';
import { StaffAdminError } from '@/lib/club/clubStaffAdminService';
import { createClubStaff, deleteClubStaff, listClubStaff } from '@/lib/club/clubStaffService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;

    const items = await listClubStaff(auth.ctx);
    return NextResponse.json({ items });
  } catch (error) {
    console.error('GET /api/club/staff:', error);
    return NextResponse.json({ error: 'Failed to load club staff' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;

    const body = await request.json().catch(() => ({}));
    const staff = await createClubStaff(auth.ctx, body);
    return NextResponse.json({ staff }, { status: 201 });
  } catch (error) {
    if (error instanceof StaffAdminError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Failed to create club staff';
    const status =
      message.includes('required') ||
      message.includes('Select') ||
      message.includes('Password') ||
      message.includes('already exists')
        ? message.includes('already exists')
          ? 409
          : 400
        : 500;
    if (status === 500) console.error('POST /api/club/staff:', error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;

    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown) => typeof id === 'string') : [];
    const result = await deleteClubStaff(auth.ctx, ids);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete club staff';
    const status = message.includes('Select') || message.includes('not found') ? 400 : 500;
    if (status === 500) console.error('DELETE /api/club/staff:', error);
    return NextResponse.json({ error: message }, { status });
  }
}
