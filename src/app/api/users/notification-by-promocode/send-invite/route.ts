import { NextRequest, NextResponse } from 'next/server';
import { sendIonosEmail } from '@/lib/ionosEmail';
import { sendNotificationByPromocodeInvite } from '@/lib/promocodes/notificationByPromocodeService';
import { resolvePromocodeSessionUser } from '@/lib/promocodes/promocodeSessionAuth';
import { resolvePublicOrigin } from '@/lib/siteUrl';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await resolvePromocodeSessionUser(request);
  if (!session.ok) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  let body: {
    receiverEmail?: string;
    promocodeId?: number | string;
    introMessage?: string;
    inviteMode?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const receiverEmail = body.receiverEmail?.trim() ?? '';
  const promocodeId = Number(body.promocodeId);
  if (!receiverEmail) {
    return NextResponse.json(
      { status: 'error', message: 'Please enter the mail address for recipient.' },
      { status: 400 }
    );
  }
  if (!Number.isFinite(promocodeId) || promocodeId <= 0) {
    return NextResponse.json(
      { status: 'error', message: 'Please select a promocode to use for the invite.' },
      { status: 400 }
    );
  }

  try {
    const result = await sendNotificationByPromocodeInvite({
      legacyUserId: session.user.legacyUserId,
      senderEmail: session.user.email,
      senderUsername: session.user.username,
      receiverEmail,
      promocodeId,
      introMessage: body.introMessage,
      inviteMode: body.inviteMode,
      origin: resolvePublicOrigin(request),
      sendEmail: async ({ to, subject, html, replyTo }) => {
        await sendIonosEmail({
          to,
          subject,
          html,
          replyTo,
        });
      },
    });

    const status = result.status === 'success' ? 200 : 400;
    return NextResponse.json(result, { status });
  } catch (err) {
    console.error('notification-by-promocode send-invite POST:', err);
    const message = err instanceof Error ? err.message : 'Unable to send the invitation email. Please try again later.';
    return NextResponse.json({ status: 'error', message }, { status: 500 });
  }
}
