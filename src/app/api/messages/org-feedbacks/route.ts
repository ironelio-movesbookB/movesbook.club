import { NextRequest, NextResponse } from 'next/server';
import { requireMessageAuth } from '@/lib/messages/messageAuth';
import {
  countOrgFeedbacks,
  createOrgFeedback,
  listFeedbackOrgs,
  listOrgFeedbacks,
  type OrgKind,
} from '@/lib/messages/orgFeedbacks';

export const dynamic = 'force-dynamic';

const SUBJECT_MAX = 200;
const BODY_MAX = 10000;

/**
 * GET ?count=1 → { mine, awaiting }
 * GET ?orgs=1 → clubs/teams of the viewer
 * GET ?scope=mine|manage&org=club:<id>&page=1 → feedback threads
 */
export async function GET(request: NextRequest) {
  const auth = await requireMessageAuth(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  try {
    if (sp.get('count') === '1') {
      return NextResponse.json(await countOrgFeedbacks(auth.userId));
    }
    if (sp.get('orgs') === '1') {
      return NextResponse.json({ orgs: await listFeedbackOrgs(auth.userId) });
    }
    const scope = sp.get('scope') === 'manage' ? 'manage' : 'mine';
    const result = await listOrgFeedbacks({
      viewerId: auth.userId,
      scope,
      orgKey: sp.get('org') || null,
      page: Number(sp.get('page')) || 1,
      pageSize: Number(sp.get('pageSize')) || 10,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error('GET /api/messages/org-feedbacks', e);
    return NextResponse.json({ error: 'Failed to load feedbacks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireMessageAuth(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const kind: OrgKind | null = body?.orgKind === 'club' || body?.orgKind === 'team' ? body.orgKind : null;
    const orgId = typeof body?.orgId === 'string' ? body.orgId.trim() : '';
    const text = typeof body?.body === 'string' ? body.body.trim().slice(0, BODY_MAX) : '';
    const subject = typeof body?.subject === 'string' ? body.subject.trim().slice(0, SUBJECT_MAX) : '';
    if (!kind || !orgId) return NextResponse.json({ error: 'Choose a club or team' }, { status: 400 });
    if (!text) return NextResponse.json({ error: 'Write your feedback' }, { status: 400 });

    const thread = await createOrgFeedback({ userId: auth.userId, kind, orgId, subject, body: text });
    return NextResponse.json({ id: thread.id }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === 'Forbidden') {
      return NextResponse.json({ error: 'You are not a member of this club or team' }, { status: 403 });
    }
    console.error('POST /api/messages/org-feedbacks', e);
    return NextResponse.json({ error: 'Failed to send the feedback' }, { status: 500 });
  }
}
