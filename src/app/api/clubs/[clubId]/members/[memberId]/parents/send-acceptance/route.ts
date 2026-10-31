import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { sendIonosEmail } from '@/lib/ionosEmail';
import { loadMemberProfileBundle } from '@/lib/club/memberProfileService';
import { getClubLegalDocuments } from '@/lib/club/clubLegalDocuments';
import { readEntityDescription } from '@/lib/club/clubDocuments';
import { buildPdfBufferFromHtmlContent } from '@/lib/club/clubDocumentsGenerate';
import { isMemberUnderage } from '@/lib/club/memberProfileDefaults';
import { escapeHtml, isValidEmail } from '@/lib/club/memberArchiveActions';
import type { ParentData } from '@/lib/club/memberProfileTypes';

export const dynamic = 'force-dynamic';

type Recipient = { key: 'parent1' | 'parent2'; name: string; email: string };

function parentRecipient(key: Recipient['key'], parent: ParentData | undefined): Recipient | null {
  if (!parent) return null;
  const email = [parent.mainEmail, parent.alternativeMail]
    .map((v) => String(v ?? '').trim())
    .find((v) => isValidEmail(v));
  if (!email) return null;
  const name = [parent.name, parent.surname].map((v) => String(v ?? '').trim()).filter(Boolean).join(' ');
  return { key, name, email };
}

function safeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Document';
}

export async function POST(
  request: NextRequest,
  { params }: { params: { clubId: string; memberId: string } },
) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const viewerUserId = token ? verifyToken(token)?.userId : null;
  if (!viewerUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const bundle = await loadMemberProfileBundle({
    clubId: params.clubId,
    memberUserId: params.memberId,
    viewerUserId: String(viewerUserId),
  });
  if ('error' in bundle) {
    return NextResponse.json({ error: bundle.error }, { status: bundle.status });
  }
  if (!bundle.viewer.canEditClubScoped || bundle.viewer.isSelf) {
    return NextResponse.json({ error: 'Only the club/team staff can send this email.' }, { status: 403 });
  }

  const kind = bundle.workspaceKind === 'team' ? 'team' : 'club';
  if (!isMemberUnderage(bundle.owner.personal.dateOfBirth || bundle.user.birthdate || '')) {
    return NextResponse.json(
      { error: 'Parents are available only for underage members (under 18).' },
      { status: 400 },
    );
  }
  const parents = bundle.club.parents;
  if (!parents.acceptanceRules || !parents.privacyPolicyRead) {
    return NextResponse.json(
      { error: 'Tick "Acceptance of the rules" and "I have read Privacy policy" and save before sending.' },
      { status: 400 },
    );
  }

  const recipients = [parentRecipient('parent1', parents.parent1), parentRecipient('parent2', parents.parent2)]
    .filter((r): r is Recipient => r !== null)
    .filter((r, i, all) => all.findIndex((o) => o.email.toLowerCase() === r.email.toLowerCase()) === i);
  if (recipients.length === 0) {
    return NextResponse.json({ error: 'No parent has a valid email address.' }, { status: 400 });
  }

  const docs = getClubLegalDocuments(await readEntityDescription(kind, bundle.clubId));
  if (!docs.rulesHtml || !docs.privacyPolicyHtml) {
    return NextResponse.json(
      { error: `Write the Rules and the Privacy policy in General settings → Documents before sending.` },
      { status: 400 },
    );
  }

  const owner =
    kind === 'team'
      ? await prisma.team.findUnique({ where: { id: bundle.clubId }, select: { admin: { select: { email: true } } } })
      : await prisma.club.findUnique({ where: { id: bundle.clubId }, select: { admin: { select: { email: true } } } });
  const ownerEmail = owner?.admin?.email?.trim() ?? '';
  const replyTo = isValidEmail(ownerEmail) ? ownerEmail : undefined;

  const entityName = bundle.clubName.trim() || (kind === 'team' ? 'Team' : 'Club');
  let rulesPdf: Buffer;
  let privacyPdf: Buffer;
  try {
    [rulesPdf, privacyPdf] = await Promise.all([
      buildPdfBufferFromHtmlContent({
        title: 'Rules',
        entityName,
        html: docs.rulesHtml,
        orientation: 'portrait',
      }),
      buildPdfBufferFromHtmlContent({
        title: 'Privacy policy',
        entityName,
        html: docs.privacyPolicyHtml,
        orientation: 'portrait',
      }),
    ]);
  } catch (error) {
    console.error('[parents/send-acceptance] PDF build failed', error);
    return NextResponse.json(
      { error: 'Could not build the PDF attachments. Please try again.' },
      { status: 500 },
    );
  }

  if (
    rulesPdf.length < 5 ||
    privacyPdf.length < 5 ||
    rulesPdf.subarray(0, 5).toString() !== '%PDF-' ||
    privacyPdf.subarray(0, 5).toString() !== '%PDF-'
  ) {
    return NextResponse.json(
      { error: 'PDF attachments were invalid. Please try again.' },
      { status: 500 },
    );
  }

  const attachments = [
    {
      filename: `Rules - ${safeFileName(entityName)}.pdf`,
      content: rulesPdf,
      contentType: 'application/pdf',
    },
    {
      filename: `Privacy policy - ${safeFileName(entityName)}.pdf`,
      content: privacyPdf,
      contentType: 'application/pdf',
    },
  ];

  const sentence = `We hereby inform you that you have read and accepted the rules and regulations of our ${kind}.`;
  const text = `${sentence}\n\nBest regards,\n${entityName}`;
  const html = `<p>${escapeHtml(sentence)}</p><p>Best regards,<br>${escapeHtml(entityName)}</p>`;
  const subject = `Acceptance of the rules and regulations - ${entityName}`;

  const sent: string[] = [];
  const failed: string[] = [];
  for (const r of recipients) {
    try {
      await sendIonosEmail({ to: r.email, subject, html, text, replyTo, attachments });
      sent.push(r.email);
    } catch (error) {
      console.error('[parents/send-acceptance] send failed', r.email, error);
      failed.push(r.email);
    }
  }

  if (sent.length === 0) {
    return NextResponse.json({ error: 'The email could not be sent. Please try again later.', failed }, { status: 502 });
  }
  return NextResponse.json({ success: true, sent, failed });
}
