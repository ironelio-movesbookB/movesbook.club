import { NextRequest } from 'next/server';
import {
  SharingError,
  getSharedPartyDetails,
  updateShareRequest,
  type ShareAction,
} from '@/lib/sharing/sharingService';
import { withSharingViewer } from '@/lib/sharing/sharingApi';

export const dynamic = 'force-dynamic';

/** GET — read-only details of the other party of an accepted sharing. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return withSharingViewer(request, async ({ userId }) => ({
    details: await getSharedPartyDetails(userId, params.id),
  }));
}

const ACTIONS = new Set(['accept', 'reject', 'hide', 'remove', 'update_sections']);

/** PATCH — accept / reject / hide notification / remove (password) / update own sections. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  return withSharingViewer(request, async ({ userId }) => {
    const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    if (typeof body.action !== 'string' || !ACTIONS.has(body.action)) {
      throw new SharingError('Unknown action');
    }
    return { request: await updateShareRequest(userId, params.id, body as unknown as ShareAction) };
  });
}
