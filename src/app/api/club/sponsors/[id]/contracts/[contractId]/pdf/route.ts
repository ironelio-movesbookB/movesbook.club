import { NextRequest, NextResponse } from 'next/server';
import { readUploadedFile, resolveSponsorWorkspace, sponsorErrorResponse } from '@/lib/club/sponsors/sponsorApi';
import { SponsorError, setContractPdf } from '@/lib/club/sponsors/sponsorService';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string; contractId: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await resolveSponsorWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    const { id, contractId } = await params;
    const { file, fileName } = await readUploadedFile(request);
    if (!file) throw new SponsorError('Choose the signed PDF', 400);
    return NextResponse.json({ sponsor: await setContractPdf(auth.ws, id, contractId, file, fileName) });
  } catch (error) {
    return sponsorErrorResponse(error, 'POST /api/club/sponsors/[id]/contracts/[contractId]/pdf');
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const auth = await resolveSponsorWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    const { id, contractId } = await params;
    return NextResponse.json({ sponsor: await setContractPdf(auth.ws, id, contractId, null) });
  } catch (error) {
    return sponsorErrorResponse(error, 'DELETE /api/club/sponsors/[id]/contracts/[contractId]/pdf');
  }
}
