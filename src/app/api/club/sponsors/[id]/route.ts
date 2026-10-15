import { NextRequest, NextResponse } from 'next/server';
import { resolveSponsorWorkspace, sponsorErrorResponse } from '@/lib/club/sponsors/sponsorApi';
import { deleteSponsor, getSponsor, updateSponsor } from '@/lib/club/sponsors/sponsorService';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await resolveSponsorWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    const { id } = await params;
    return NextResponse.json({ sponsor: await getSponsor(auth.ws, id) });
  } catch (error) {
    return sponsorErrorResponse(error, 'GET /api/club/sponsors/[id]');
  }
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await resolveSponsorWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const sponsor = await updateSponsor(auth.ws, id, {
      profile: body?.profile && typeof body.profile === 'object' ? body.profile : undefined,
      placements: body?.placements && typeof body.placements === 'object' ? body.placements : undefined,
    });
    return NextResponse.json({ sponsor });
  } catch (error) {
    return sponsorErrorResponse(error, 'PATCH /api/club/sponsors/[id]');
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const auth = await resolveSponsorWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    const { id } = await params;
    await deleteSponsor(auth.ws, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return sponsorErrorResponse(error, 'DELETE /api/club/sponsors/[id]');
  }
}
