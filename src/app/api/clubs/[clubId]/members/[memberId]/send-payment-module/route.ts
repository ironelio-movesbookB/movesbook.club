import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { sendTelegramMessage } from '@/lib/telegram';
import { resolveMessageDatabaseUserId } from '@/lib/messages/resolveMessageUserId';
import { loadMemberProfileBundle } from '@/lib/club/memberProfileService';
import {
  normalizePaymentTypeValue,
  payModeLabel,
  paymentMethodIn,
  SEND_PAYMENT_MODULE_METHODS,
} from '@/lib/procedures/payModes';

export const dynamic = 'force-dynamic';

type InstallmentInput = { label?: unknown; date?: unknown; amount?: unknown };

function clean(value: unknown, max = 60): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function displayDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Sends the member a chat message asking to pay with the chosen electronic method. */
export async function POST(
  request: NextRequest,
  { params }: { params: { clubId: string; memberId: string } },
) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const decoded = token ? verifyToken(token) : null;
  if (!decoded?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const bundle = await loadMemberProfileBundle({
    clubId: params.clubId,
    memberUserId: params.memberId,
    viewerUserId: String(decoded.userId),
  });
  if ('error' in bundle) {
    return NextResponse.json({ error: bundle.error }, { status: bundle.status });
  }
  if (!bundle.viewer.canEditClubScoped || bundle.viewer.isSelf) {
    return NextResponse.json(
      { error: 'Only the club/team staff can send the payment module.' },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    paymentMethod?: unknown;
    annualMembershipFee?: unknown;
    installments?: InstallmentInput[];
  };
  const method = normalizePaymentTypeValue(clean(body.paymentMethod));
  if (!paymentMethodIn(SEND_PAYMENT_MODULE_METHODS, method)) {
    return NextResponse.json(
      { error: 'The payment module can be sent only for electronic payment methods.' },
      { status: 400 },
    );
  }

  const installments = (Array.isArray(body.installments) ? body.installments : [])
    .slice(0, 3)
    .map((row) => ({
      label: clean(row.label, 40),
      date: clean(row.date, 10),
      amount: clean(row.amount, 20),
    }))
    .filter((row) => row.amount);
  const fee = clean(body.annualMembershipFee, 20);
  if (!fee && installments.length === 0) {
    return NextResponse.json(
      { error: 'Enter the annual membership fee or at least one payment amount first.' },
      { status: 400 },
    );
  }

  const senderId = await resolveMessageDatabaseUserId(String(decoded.userId), decoded.userType);
  if (!senderId) {
    return NextResponse.json({ error: 'User not found' }, { status: 401 });
  }
  if (senderId === params.memberId) {
    return NextResponse.json({ error: 'You cannot send the payment module to yourself.' }, { status: 400 });
  }

  const entityName = bundle.clubName.trim() || (bundle.workspaceKind === 'team' ? 'Team' : 'Club');
  const lines = [
    `Payment module — ${entityName}`,
    '',
    `Payment method: ${payModeLabel(method).replace(/\s*\*+$/, '')}`,
    ...(fee ? [`Annual membership fee: ${fee}`] : []),
    ...installments.map(
      (row) => `${row.label || 'Payment'}: ${row.amount}${row.date ? ` — due ${displayDate(row.date)}` : ''}`,
    ),
    '',
    'Please complete the payment with the method above. Reply to this message for any question.',
  ];
  const content = lines.join('\n');

  const [user1Id, user2Id] = [senderId, params.memberId].sort();
  const conversation = await prisma.chatConversation.upsert({
    where: { user1Id_user2Id: { user1Id, user2Id } },
    update: {},
    create: { user1Id, user2Id },
    select: { id: true },
  });
  const message = await prisma.chatMessage.create({
    data: { conversationId: conversation.id, senderId, content },
    include: { sender: { select: { name: true } } },
  });

  const recipient = await prisma.user.findUnique({
    where: { id: params.memberId },
    select: { telegramChatId: true },
  });
  if (recipient?.telegramChatId) {
    const sent = await sendTelegramMessage(recipient.telegramChatId, `${message.sender.name}: ${content}`).catch(
      () => null,
    );
    if (sent?.messageId) {
      await prisma.chatMessage.update({
        where: { id: message.id },
        data: { telegramMessageId: String(sent.messageId) },
      });
    }
  }

  return NextResponse.json({ ok: true, conversationId: conversation.id, messageId: message.id });
}
