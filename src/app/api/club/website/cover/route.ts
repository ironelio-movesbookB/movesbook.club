import { NextRequest, NextResponse } from 'next/server';
import { readUploadedFile, resolveSponsorWorkspace } from '@/lib/club/sponsors/sponsorApi';
import { WebsiteError, setWebsiteCover } from '@/lib/club/website/websiteService';

export const dynamic = 'force-dynamic';

function errorResponse(error: unknown, label: string) {
  if (error instanceof WebsiteError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error(label, error);
  return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
}

export async function POST(request: NextRequest) {
  const auth = await resolveSponsorWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    const { file, fileName } = await readUploadedFile(request);
    if (!file) throw new WebsiteError('Choose an image', 400);
    return NextResponse.json({ settings: await setWebsiteCover(auth.ws, file, fileName) });
  } catch (error) {
    return errorResponse(error, 'POST /api/club/website/cover');
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await resolveSponsorWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    return NextResponse.json({ settings: await setWebsiteCover(auth.ws, null) });
  } catch (error) {
    return errorResponse(error, 'DELETE /api/club/website/cover');
  }
}
