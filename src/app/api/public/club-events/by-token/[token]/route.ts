import { NextRequest, NextResponse } from 'next/server';
import { getClubEventByToken, storeRegistrationTextFile } from '@/lib/club/events/eventService';
import {
  findMemberByCredentials,
  findMemberByFiscalCode,
  quoteEventRegistration,
  registerForEvent,
} from '@/lib/club/events/eventRegistrationService';
import { ClubEventError } from '@/lib/club/events/eventService';
import { findPublicOrg, publicOrgCard } from '@/lib/club/publicOrg';
import { getSponsor } from '@/lib/club/sponsors/sponsorService';
import { eventsOnlineProviders } from '@/lib/club/events/eventSubscriptionPayments';
import { resolvePublicOrigin } from '@/lib/siteUrl';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_request: NextRequest, context: Ctx) {
  try {
    const { token } = await context.params;
    const event = await getClubEventByToken(token);
    if (!event || event.hideFromShare) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const org = await findPublicOrg(event.workspaceId);
    let sponsor: { name: string; logoUrl: string | null; bannerUrl: string | null; landingUrl: string } | null =
      null;
    if (event.sponsorId && org) {
      try {
        const s = await getSponsor(
          { kind: event.workspaceKind === 'team' ? 'team' : 'club', id: event.workspaceId },
          event.sponsorId,
        );
        if (s) {
          sponsor = { name: s.name, logoUrl: s.logoUrl, bannerUrl: s.bannerUrl, landingUrl: s.landingUrl };
        }
      } catch {
        /* ignore */
      }
    }
    return NextResponse.json({
      org: org ? publicOrgCard(org) : null,
      event,
      sponsor,
      onlineProviders: await eventsOnlineProviders(event.workspaceId),
    });
  } catch (error) {
    console.error('GET /api/public/club-events/by-token/[token]', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: Ctx) {
  try {
    const { token } = await context.params;
    if ((request.headers.get('content-type') || '').includes('multipart/form-data')) {
      return await uploadTextFile(request, token);
    }
    const body = await request.json().catch(() => ({}));
    if (body?.action === 'quote') {
      return NextResponse.json({ quote: await quoteEventRegistration(token, body ?? {}) });
    }
    if (body?.action === 'lookup-member') {
      const event = await getClubEventByToken(token);
      if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const ws = { kind: event.workspaceKind === 'team' ? 'team' : 'club', id: event.workspaceId } as const;
      if (body.username || body.password) {
        const member = await findMemberByCredentials(ws, String(body.username || ''), String(body.password || ''));
        return NextResponse.json({ member });
      }
      const member = await findMemberByFiscalCode(ws, String(body.fiscalCode || ''));
      return NextResponse.json({ member });
    }
    const result = await registerForEvent(token, body ?? {}, { origin: resolvePublicOrigin(request) });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ClubEventError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('POST /api/public/club-events/by-token/[token]', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

async function uploadTextFile(request: NextRequest, token: string): Promise<NextResponse> {
  const event = await getClubEventByToken(token);
  if (!event || event.hideFromShare) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const form = await request.formData();
  const textId = String(form.get('textId') || '');
  const text = event.texts.find((t) => t.id === textId && t.enabled && t.fileUploadEnabled);
  if (!text) return NextResponse.json({ error: 'This text does not accept files' }, { status: 400 });
  const file = form.get('file');
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'File is required' }, { status: 400 });
  const name = file instanceof File ? file.name : 'file';
  const path = await storeRegistrationTextFile(file, name);
  return NextResponse.json({ file: { name, path } }, { status: 201 });
}
