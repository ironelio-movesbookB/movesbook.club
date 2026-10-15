import { NextRequest } from 'next/server';
import {
  SharingError,
  createShareRequest,
  listShareRequests,
  type ShareScope,
} from '@/lib/sharing/sharingService';
import { withSharingViewer } from '@/lib/sharing/sharingApi';
import { isSharePartyKind } from '@/lib/sharing/sharingTypes';

export const dynamic = 'force-dynamic';

/** GET ?scope=mypage | ?scope=party&kind=&id= — sharing notifications for the central frame. */
export async function GET(request: NextRequest) {
  return withSharingViewer(request, async ({ userId }) => {
    const sp = request.nextUrl.searchParams;
    let scope: ShareScope = { type: 'mypage' };
    if (sp.get('scope') === 'party') {
      const kind = sp.get('kind');
      const id = sp.get('id');
      if (!isSharePartyKind(kind) || !id) throw new SharingError('kind and id are required');
      scope = { type: 'party', kind, id };
    }
    return { requests: await listShareRequests(userId, scope) };
  });
}

/** POST — send a sharing request (requires the admin password). */
export async function POST(request: NextRequest) {
  return withSharingViewer(request, async ({ userId, userType }) => {
    const body = ((await request.json().catch(() => null)) ?? {}) as {
      sender?: { kind?: unknown; id?: unknown };
      recipient?: { kind?: unknown; id?: unknown };
      senderSections?: unknown;
      password?: unknown;
    };
    const senderKind = body.sender?.kind;
    const recipientKind = body.recipient?.kind;
    if (
      !isSharePartyKind(senderKind) ||
      !isSharePartyKind(recipientKind) ||
      typeof body.sender?.id !== 'string' ||
      typeof body.recipient?.id !== 'string'
    ) {
      throw new SharingError('Sender and recipient are required');
    }
    const created = await createShareRequest({
      userId,
      userType,
      sender: { kind: senderKind, id: body.sender.id },
      recipient: { kind: recipientKind, id: body.recipient.id },
      senderSections: body.senderSections,
      password: body.password,
    });
    return { request: created };
  });
}
