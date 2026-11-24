import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getSidebarAccountSummary } from '@/lib/user/sidebarAccountSummary';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(authHeader.substring(7));
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const summary = await getSidebarAccountSummary(decoded.userId);
    return NextResponse.json(summary);
  } catch (error) {
    console.error('sidebar account summary failed:', error);
    return NextResponse.json({ error: 'Failed to load account summary' }, { status: 500 });
  }
}
