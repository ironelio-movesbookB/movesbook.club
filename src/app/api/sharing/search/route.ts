import { NextRequest } from 'next/server';
import { SharingError, searchShareRecipients } from '@/lib/sharing/sharingService';
import { withSharingViewer } from '@/lib/sharing/sharingApi';
import { isSharePartyKind } from '@/lib/sharing/sharingTypes';

export const dynamic = 'force-dynamic';

/** GET ?kind=club|team|group|coach|user&q= — recipients of one type only. */
export async function GET(request: NextRequest) {
  return withSharingViewer(request, async ({ userId }) => {
    const kind = request.nextUrl.searchParams.get('kind');
    if (!isSharePartyKind(kind)) throw new SharingError('Invalid recipient type');
    const q = request.nextUrl.searchParams.get('q') ?? '';
    return { rows: await searchShareRecipients(userId, kind, q) };
  });
}
