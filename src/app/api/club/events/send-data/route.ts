import { NextRequest, NextResponse } from 'next/server';
import { eventErrorResponse, resolveEventWorkspace } from '@/lib/club/events/eventApi';
import { ClubEventError, listClubEvents } from '@/lib/club/events/eventService';
import { formatEventEuro } from '@/lib/club/events/eventConstants';
import { clubEventSelectionPath } from '@/lib/club/events/eventPaths';
import { sendIonosEmail } from '@/lib/ionosEmail';
import { getSiteOrigin } from '@/lib/siteUrl';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dmy(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return y && m && d ? `${d}/${m}/${y}` : ymd;
}

/** POST { eventIds: string[], email: string } — mail the checked events grid. */
export async function POST(request: NextRequest) {
  const auth = await resolveEventWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email || '').trim();
    if (!EMAIL_RE.test(email)) throw new ClubEventError('Enter a valid email address');
    const ids = new Set<string>(Array.isArray(body?.eventIds) ? body.eventIds.map(String) : []);
    const events = (await listClubEvents(auth.ws)).filter((e) => ids.has(e.id));
    if (!events.length) throw new ClubEventError('Check one or more events');

    const link = `${getSiteOrigin()}${clubEventSelectionPath(
      auth.ws.id,
      events.map((e) => e.publicToken),
    )}`;
    const cell = 'style="border:1px solid #d1d5db;padding:6px 8px;text-align:left"';
    const rows = events
      .map(
        (e) => `<tr>
<td ${cell}><strong>${esc(e.name)}</strong></td>
<td ${cell}>${esc(e.location || '—')}</td>
<td ${cell}>${esc(dmy(e.startDate))}</td>
<td ${cell}>${esc(dmy(e.endDate))}</td>
<td ${cell}>${esc(e.eventType)}</td>
<td ${cell}>${e.subeventCount}</td>
<td ${cell}>${esc(e.cost > 0 ? formatEventEuro(e.cost) : 'Free')}</td>
<td ${cell}>${e.seats > 0 ? e.seats : '∞'}</td>
<td ${cell}>${e.registered}</td>
</tr>`,
      )
      .join('');
    const head = ['Title', 'Location', 'Start', 'End', 'Type', 'No.', 'Cost', 'Allowed', 'Registered']
      .map((h) => `<th ${cell}>${h}</th>`)
      .join('');
    await sendIonosEmail({
      to: email,
      subject: events.length === 1 ? `Event: ${events[0].name}` : `Events (${events.length})`,
      html: `<p>Events data:</p>
<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px">
<thead style="background:#f3f4f6"><tr>${head}</tr></thead><tbody>${rows}</tbody></table>
<p>Presentation page: <a href="${esc(link)}">${esc(link)}</a></p>`,
    });
    return NextResponse.json({ ok: true, sent: events.length });
  } catch (error) {
    return eventErrorResponse(error, 'POST /api/club/events/send-data');
  }
}
