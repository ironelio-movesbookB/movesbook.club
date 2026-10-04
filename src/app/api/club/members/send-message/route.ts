import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClubAuthContext } from '@/lib/procedures';
import { sendIonosEmail } from '@/lib/ionosEmail';
import {
  MEMBER_ARCHIVE_ACTION_LIMIT,
  escapeHtml,
  isValidEmail,
  loadMemberArchiveRowsForIds,
  parseMemberIds,
  parseMembershipStatus,
} from '@/lib/club/memberArchiveActions';

export const dynamic = 'force-dynamic';

const MAX_EMAIL_RECIPIENTS = 500;

/**
 * Sends a message to the selected / filtered Archive of Users rows:
 * in-app via the Club Channel (visible only to those members) and optionally by email.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getClubAuthContext(request, { allowCoach: true });
    if ('error' in auth) return auth.error;
    const { ctx } = auth;

    const body = await request.json().catch(() => ({}));
    const memberIds = parseMemberIds(body.memberIds);
    if (memberIds.length === 0) {
      return NextResponse.json({ error: 'No members to message.' }, { status: 400 });
    }
    if (memberIds.length > MEMBER_ARCHIVE_ACTION_LIMIT) {
      return NextResponse.json(
        { error: `Too many members (max ${MEMBER_ARCHIVE_ACTION_LIMIT}).` },
        { status: 400 },
      );
    }

    const content = typeof body.content === 'string' ? body.content.trim().slice(0, 5000) : '';
    if (!content) {
      return NextResponse.json({ error: 'Write a message.' }, { status: 400 });
    }

    // The in-app Club Channel exists only for clubs; teams and coaches send by email.
    const isTeam = ctx.workspaceKind === 'team' || ctx.workspaceKind === 'coach';
    const inApp = body.inApp !== false && !isTeam;
    const byEmail = body.byEmail === true;
    if (!inApp && !byEmail) {
      return NextResponse.json(
        {
          error: isTeam
            ? `${ctx.workspaceKind === 'coach' ? 'Coach' : 'Team'} messages can be sent by email only.`
            : 'Choose how to send the message.',
        },
        { status: 400 },
      );
    }

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
      ctx.club.name ||
      'Club admin';
    const clubName = ctx.club.name || 'Club';

    // Club Channel is readable only by club members, so staff-only rows can't receive it.
    const channelRecipientIds = inApp
      ? rows
          .filter((r) => !r.isStaffOnly)
          .map((r) => String(r.memberId ?? r.id))
          .filter(Boolean)
      : [];
    if (inApp && channelRecipientIds.length === 0 && !byEmail) {
      return NextResponse.json(
        { error: 'None of these users is a club member, so they cannot see the Club Channel. Use email.' },
        { status: 400 },
      );
    }

    let inAppCount = 0;
    if (channelRecipientIds.length > 0) {
      await prisma.chatBroadcastMessage.create({
        data: {
          content,
          mode: 'subscribers',
          senderName,
          clubId: ctx.club.id,
          recipientIds: JSON.stringify(channelRecipientIds),
        },
      });
      inAppCount = channelRecipientIds.length;
    }

    let emailed = 0;
    let emailFailed = 0;
    let noEmail = 0;
    if (byEmail) {
      const emails = Array.from(
        new Set(
          rows
            .map((r) => String(r.email ?? '').trim())
            .filter((e) => isValidEmail(e)),
        ),
      );
      noEmail = rows.length - emails.length;
      if (emails.length > MAX_EMAIL_RECIPIENTS) {
        return NextResponse.json(
          { error: `Too many email recipients (max ${MAX_EMAIL_RECIPIENTS}).` },
          { status: 400 },
        );
      }
      const html =
        `<p><strong>${escapeHtml(senderName)}</strong> (${escapeHtml(clubName)}) wrote:</p>` +
        `<p style="white-space:pre-wrap">${escapeHtml(content)}</p>`;
      const text = `${senderName} (${clubName}) wrote:\n\n${content}`;
      for (const to of emails) {
        try {
          await sendIonosEmail({
            to,
            subject: `Message from ${clubName}`,
            html,
            text,
            replyTo: sender?.email || undefined,
          });
          emailed += 1;
        } catch (error) {
          emailFailed += 1;
          console.error('club members send-message email failed:', to, error);
        }
      }
    }

    return NextResponse.json({
      recipients: rows.length,
      channelUsed: inApp,
      inApp: inAppCount,
      emailed,
      emailFailed,
      noEmail: byEmail ? noEmail : 0,
    });
  } catch (error) {
    console.error('POST club members send-message:', error);
    return NextResponse.json({ error: 'Failed to send the message.' }, { status: 500 });
  }
}
