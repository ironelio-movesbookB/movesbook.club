import { NextRequest } from 'next/server';
import { getSharingSummary } from '@/lib/sharing/sharingService';
import { withSharingViewer } from '@/lib/sharing/sharingApi';

export const dynamic = 'force-dynamic';

/** GET — Communities lists: limits (from the PCU), accepted sharings, companies and company quota. */
export async function GET(request: NextRequest) {
  return withSharingViewer(request, async ({ userId, userType }) => ({
    summary: await getSharingSummary(userId, userType),
  }));
}
