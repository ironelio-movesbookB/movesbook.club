import { NextRequest, NextResponse } from 'next/server';
import { eventErrorResponse, resolveEventWorkspace } from '@/lib/club/events/eventApi';
import { setEventAttachment, setEventCover } from '@/lib/club/events/eventService';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  const auth = await resolveEventWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    const { id } = await context.params;
    const form = await request.formData();
    const kind = String(form.get('kind') || 'cover');
    const file = form.get('file');
    if (!(file instanceof Blob) || !file.size) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }
    const fileName = file instanceof File ? file.name : 'upload.bin';
    if (kind === 'cover') {
      return NextResponse.json({ event: await setEventCover(auth.ws, id, file, fileName) });
    }
    if (kind === 'attachment1' || kind === 'attachment2') {
      const slot = kind === 'attachment1' ? 1 : 2;
      const displayName = String(form.get('displayName') || fileName);
      return NextResponse.json({
        event: await setEventAttachment(auth.ws, id, slot, file, fileName, displayName),
      });
    }
    return NextResponse.json({ error: 'Unknown kind' }, { status: 400 });
  } catch (error) {
    return eventErrorResponse(error, 'POST /api/club/events/[id]/media');
  }
}

export async function DELETE(request: NextRequest, context: Ctx) {
  const auth = await resolveEventWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    const { id } = await context.params;
    const kind = request.nextUrl.searchParams.get('kind') || 'cover';
    if (kind === 'cover') {
      return NextResponse.json({ event: await setEventCover(auth.ws, id, null) });
    }
    if (kind === 'attachment1' || kind === 'attachment2') {
      const slot = kind === 'attachment1' ? 1 : 2;
      return NextResponse.json({ event: await setEventAttachment(auth.ws, id, slot, null) });
    }
    return NextResponse.json({ error: 'Unknown kind' }, { status: 400 });
  } catch (error) {
    return eventErrorResponse(error, 'DELETE /api/club/events/[id]/media');
  }
}
