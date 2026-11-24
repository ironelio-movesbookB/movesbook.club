import { NextRequest, NextResponse } from 'next/server';
import { buildContext, fetchPackagesTable, readShareToken } from '@/lib/clubSubscriptionPackages.server';

export const dynamic = 'force-dynamic';

/** Read-only packages table behind a "Get link" URL. Legacy: shared_subscription_packages. */
export async function GET(request: NextRequest) {
  try {
    const shared = readShareToken(
      request.nextUrl.searchParams.get('data') ?? '',
      request.nextUrl.searchParams.get('token') ?? ''
    );
    if (!shared) return NextResponse.json({ error: 'Invalid or expired link.' }, { status: 403 });

    const context = await buildContext(shared.userId, shared.clubId);
    const { services, packages } = await fetchPackagesTable(context);
    return NextResponse.json({ club: context.club, services, packages });
  } catch (error) {
    console.error('GET public shared-subscription-packages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
