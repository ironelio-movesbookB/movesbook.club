import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClubAuthContext } from '@/lib/procedures';
import { sendIonosEmail } from '@/lib/ionosEmail';
import {
  MEMBER_ARCHIVE_ACTION_LIMIT,
  buildMemberArchiveCsv,
  buildMemberArchiveXlsx,
  escapeHtml,
  isValidEmail,
  loadMemberArchiveRowsForIds,
  parseMemberIds,
  parseMembershipStatus,
} from '@/lib/club/memberArchiveActions';

export const dynamic = 'force-dynamic';

/** Emails the selected / filtered Archive of Users rows as Excel + CSV attachments. */
export async function POST(request: NextRequest) {
  try {
    const auth = await getClubAuthContext(request, { allowCoach: true });
    if ('error' in auth) return auth.error;
    const { ctx } = auth;

    const body = await request.json().catch(() => ({}));
    const memberIds = parseMemberIds(body.memberIds);
    if (memberIds.length === 0) {
      return NextResponse.json({ error: 'No members to send.' }, { status: 400 });
    }
    if (memberIds.length > MEMBER_ARCHIVE_ACTION_LIMIT) {
      return NextResponse.json(
        { error: `Too many members (max ${MEMBER_ARCHIVE_ACTION_LIMIT}).` },
        { status: 400 },
      );
    }

    const email = typeof body.email === 'string' ? body.email.trim() : '';
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 2000) : '';

    const rows = await loadMemberArchiveRowsForIds(
      ctx,
      memberIds,
      parseMembershipStatus(body.membershipStatus),
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No members of this club match the selection.' }, { status: 400 });
    }

    const sender = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { email: true, firstName: true, surname: true, name: true },
    });
    const senderName =
      [sender?.firstName, sender?.surname].filter(Boolean).join(' ').trim() ||
      sender?.name ||
      ctx.club.name;

    const stamp = new Date().toISOString().slice(0, 10);
    const baseName = `members-${stamp}`;
    const clubName = ctx.club.name || 'Club';
    const noteHtml = note
      ? `<p style="white-space:pre-wrap">${escapeHtml(note)}</p>`
      : '';

    await sendIonosEmail({
      to: email,
      subject: `${clubName} - Archive of Users (${rows.length})`,
      html:
        `<p>${escapeHtml(senderName)} sent you the list of ${rows.length} user(s) of ` +
        `<strong>${escapeHtml(clubName)}</strong>.</p>${noteHtml}` +
        `<p>The data is attached as Excel (.xlsx) and CSV.</p>`,
      text:
        `${senderName} sent you the list of ${rows.length} user(s) of ${clubName}.\n` +
        (note ? `\n${note}\n` : '') +
        '\nThe data is attached as Excel (.xlsx) and CSV.',
      replyTo: sender?.email || undefined,
      attachments: [
        {
          filename: `${baseName}.xlsx`,
          content: buildMemberArchiveXlsx(rows),
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
        {
          filename: `${baseName}.csv`,
          content: buildMemberArchiveCsv(rows),
          contentType: 'text/csv; charset=utf-8',
        },
      ],
    });

    return NextResponse.json({ sent: rows.length, email });
  } catch (error) {
    console.error('POST club members send-data:', error);
    return NextResponse.json({ error: 'Failed to send the data email.' }, { status: 500 });
  }
}
