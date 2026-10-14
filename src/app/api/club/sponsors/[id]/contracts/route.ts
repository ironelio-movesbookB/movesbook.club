import { NextRequest, NextResponse } from 'next/server';
import { resolveSponsorWorkspace, sponsorErrorResponse } from '@/lib/club/sponsors/sponsorApi';
import { saveContract } from '@/lib/club/sponsors/sponsorService';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveSponsorWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({ sponsor: await saveContract(auth.ws, id, body ?? {}) }, { status: 201 });
  } catch (error) {
    return sponsorErrorResponse(error, 'POST /api/club/sponsors/[id]/contracts');
  }
}
