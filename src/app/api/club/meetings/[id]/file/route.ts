import { NextRequest, NextResponse } from 'next/server';
import { attachMeetingFile, removeMeetingFile } from '@/lib/club/clubMeetingService';
import { staffAdminAuth, staffAdminErrorResponse } from '@/lib/club/clubStaffAdminApi';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

/** Uploads or replaces the file attached to the meeting (multipart field `file`). */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await staffAdminAuth(request);
    if ('error' in auth) return auth.error;
    const form = await request.formData().catch(() => null);
    const file = form?.get('file');
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    const name = file instanceof File ? file.name : 'attachment';
    return NextResponse.json({ meeting: await attachMeetingFile(auth.ws, params.id, file, name) });
  } catch (error) {
    return staffAdminErrorResponse(error, 'POST /api/club/meetings/[id]/file:');
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await staffAdminAuth(request);
    if ('error' in auth) return auth.error;
    return NextResponse.json({ meeting: await removeMeetingFile(auth.ws, params.id) });
  } catch (error) {
    return staffAdminErrorResponse(error, 'DELETE /api/club/meetings/[id]/file:');
  }
}
