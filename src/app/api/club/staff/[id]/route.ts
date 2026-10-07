import { NextRequest, NextResponse } from 'next/server';
import { getClubAuthContext } from '@/lib/procedures';
import { StaffAdminError } from '@/lib/club/clubStaffAdminService';
import { deleteClubStaff, getClubStaffById, updateClubStaff } from '@/lib/club/clubStaffService';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;

    const staff = await getClubStaffById(auth.ctx, params.id);
    if (!staff) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }
    return NextResponse.json({ staff });
  } catch (error) {
    console.error('GET /api/club/staff/[id]:', error);
    return NextResponse.json({ error: 'Failed to load club staff' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;

    const body = await request.json().catch(() => ({}));
    const staff = await updateClubStaff(auth.ctx, params.id, body);
    return NextResponse.json({ staff });
  } catch (error) {
    if (error instanceof StaffAdminError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Failed to update club staff';
    const status =
      message.includes('required') ||
      message.includes('Select') ||
      message.includes('Password') ||
      message.includes('not found')
        ? message.includes('not found')
          ? 404
          : 400
        : 500;
    if (status === 500) console.error('PATCH /api/club/staff/[id]:', error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;

    const result = await deleteClubStaff(auth.ctx, [params.id]);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete club staff';
    const status = message.includes('not found') || message.includes('Select') ? 400 : 500;
    if (status === 500) console.error('DELETE /api/club/staff/[id]:', error);
    return NextResponse.json({ error: message }, { status });
  }
}
