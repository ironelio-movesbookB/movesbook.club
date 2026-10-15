import { NextRequest, NextResponse } from 'next/server';
import { resolveSponsorWorkspace, sponsorErrorResponse } from '@/lib/club/sponsors/sponsorApi';
import { deleteContract, saveContract } from '@/lib/club/sponsors/sponsorService';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string; contractId: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await resolveSponsorWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    const { id, contractId } = await params;
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({ sponsor: await saveContract(auth.ws, id, body ?? {}, contractId) });
  } catch (error) {
    return sponsorErrorResponse(error, 'PATCH /api/club/sponsors/[id]/contracts/[contractId]');
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const auth = await resolveSponsorWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    const { id, contractId } = await params;
    return NextResponse.json({ sponsor: await deleteContract(auth.ws, id, contractId) });
  } catch (error) {
    return sponsorErrorResponse(error, 'DELETE /api/club/sponsors/[id]/contracts/[contractId]');
  }
}
