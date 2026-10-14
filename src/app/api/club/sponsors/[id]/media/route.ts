import { NextRequest, NextResponse } from 'next/server';
import { readUploadedFile, resolveSponsorWorkspace, sponsorErrorResponse } from '@/lib/club/sponsors/sponsorApi';
import { SponsorError, setSponsorImage } from '@/lib/club/sponsors/sponsorService';
import type { SponsorMediaKind } from '@/lib/club/sponsors/sponsorConstants';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

function mediaKind(value: unknown): SponsorMediaKind {
  if (value === 'logo' || value === 'banner') return value;
  throw new SponsorError('Choose logo or banner', 400);
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await resolveSponsorWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    const { id } = await params;
    const { form, file, fileName } = await readUploadedFile(request);
    if (!file) throw new SponsorError('Choose an image', 400);
    const sponsor = await setSponsorImage(auth.ws, id, mediaKind(form.get('kind')), file, fileName);
    return NextResponse.json({ sponsor });
  } catch (error) {
    return sponsorErrorResponse(error, 'POST /api/club/sponsors/[id]/media');
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const auth = await resolveSponsorWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    const { id } = await params;
    const kind = mediaKind(request.nextUrl.searchParams.get('kind'));
    return NextResponse.json({ sponsor: await setSponsorImage(auth.ws, id, kind, null) });
  } catch (error) {
    return sponsorErrorResponse(error, 'DELETE /api/club/sponsors/[id]/media');
  }
}
