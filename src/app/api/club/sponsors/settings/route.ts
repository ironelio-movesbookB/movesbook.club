import { NextRequest, NextResponse } from 'next/server';
import { resolveSponsorWorkspace, sponsorErrorResponse } from '@/lib/club/sponsors/sponsorApi';
import { getSponsorKitSettings, saveSponsorKitSettings } from '@/lib/club/sponsors/sponsorKitSettingsService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await resolveSponsorWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    return NextResponse.json({ settings: await getSponsorKitSettings(auth.ws) });
  } catch (error) {
    return sponsorErrorResponse(error, 'GET /api/club/sponsors/settings');
  }
}

export async function PUT(request: NextRequest) {
  const auth = await resolveSponsorWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({ settings: await saveSponsorKitSettings(auth.ws, body?.settings ?? {}) });
  } catch (error) {
    return sponsorErrorResponse(error, 'PUT /api/club/sponsors/settings');
  }
}
