import { NextRequest, NextResponse } from 'next/server';
import { resolveSponsorWorkspace, sponsorErrorResponse } from '@/lib/club/sponsors/sponsorApi';
import { generateDeadlines } from '@/lib/club/sponsors/sponsorService';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await resolveSponsorWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const sponsor = await generateDeadlines(auth.ws, id, {
      count: Number(body?.count) || 0,
      firstAmount: Number(body?.firstAmount) || 0,
      firstDate: String(body?.firstDate || ''),
      intervalDays: Number(body?.intervalDays) || 30,
    });
    return NextResponse.json({ sponsor });
  } catch (error) {
    return sponsorErrorResponse(error, 'POST /api/club/sponsors/[id]/payments/generate');
  }
}
