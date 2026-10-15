import { NextRequest } from 'next/server';
import {
  SharingError,
  getDefaultSections,
  resolveParty,
  saveDefaultSections,
} from '@/lib/sharing/sharingService';
import { withSharingViewer } from '@/lib/sharing/sharingApi';
import { isSharePartyKind } from '@/lib/sharing/sharingTypes';

export const dynamic = 'force-dynamic';

function readKeys(sp: URLSearchParams | Record<string, unknown>) {
  const get = (k: string) => (sp instanceof URLSearchParams ? sp.get(k) : (sp[k] as string | undefined));
  const ownerKind = get('ownerKind');
  const ownerId = get('ownerId');
  const recipientKind = get('recipientKind');
  if (!isSharePartyKind(ownerKind) || !ownerId || !isSharePartyKind(recipientKind)) {
    throw new SharingError('ownerKind, ownerId and recipientKind are required');
  }
  return { ownerKind, ownerId: String(ownerId), recipientKind };
}

/** GET — default sections a company/user shares with one recipient type (any party, read-only). */
export async function GET(request: NextRequest) {
  return withSharingViewer(request, async () => {
    const { ownerKind, ownerId, recipientKind } = readKeys(request.nextUrl.searchParams);
    if (!(await resolveParty(ownerKind, ownerId))) throw new SharingError('Not found', 404);
    return { sections: await getDefaultSections(ownerKind, ownerId, recipientKind) };
  });
}

/** PUT — save own default sections (gear icon / own logo in a notification). */
export async function PUT(request: NextRequest) {
  return withSharingViewer(request, async ({ userId }) => {
    const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const { ownerKind, ownerId, recipientKind } = readKeys(body);
    return { sections: await saveDefaultSections(userId, ownerKind, ownerId, recipientKind, body.sections) };
  });
}
