import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { SharingError } from '@/lib/sharing/sharingService';

export type SharingViewer = { userId: string; userType: string };

export function getSharingViewer(request: NextRequest): SharingViewer | null {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.userId || !decoded.userType) return null;
  return { userId: String(decoded.userId), userType: String(decoded.userType) };
}

export async function withSharingViewer(
  request: NextRequest,
  handler: (viewer: SharingViewer) => Promise<unknown>,
): Promise<NextResponse> {
  const viewer = getSharingViewer(request);
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await handler(viewer));
  } catch (error) {
    if (error instanceof SharingError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('sharing api', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
