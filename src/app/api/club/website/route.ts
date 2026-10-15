import { NextRequest, NextResponse } from 'next/server';
import { resolveSponsorWorkspace } from '@/lib/club/sponsors/sponsorApi';
import { WebsiteError, getWebsiteSettings, saveWebsiteSettings } from '@/lib/club/website/websiteService';

export const dynamic = 'force-dynamic';

function errorResponse(error: unknown, label: string) {
  if (error instanceof WebsiteError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error(label, error);
  return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
}

export async function GET(request: NextRequest) {
  const auth = await resolveSponsorWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    return NextResponse.json(await getWebsiteSettings(auth.ws));
  } catch (error) {
    return errorResponse(error, 'GET /api/club/website');
  }
}

export async function PUT(request: NextRequest) {
  const auth = await resolveSponsorWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    const body = await request.json().catch(() => ({}));
    const settings = await saveWebsiteSettings(auth.ws, body?.settings ?? {});
    return NextResponse.json({ settings, saved: true });
  } catch (error) {
    return errorResponse(error, 'PUT /api/club/website');
  }
}
