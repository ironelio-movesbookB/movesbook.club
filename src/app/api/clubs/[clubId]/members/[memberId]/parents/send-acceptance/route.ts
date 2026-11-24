import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { sendIonosEmail } from '@/lib/ionosEmail';
import { resolvePublicOrigin } from '@/lib/siteUrl';
import { loadMemberProfileBundle } from '@/lib/club/memberProfileService';
import { getClubLegalDocuments } from '@/lib/club/clubLegalDocuments';
import { readEntityDescription, sanitizeClubDocumentHtml } from '@/lib/club/clubDocuments';
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

/** Relative `/api/media/...` image URLs would be broken inside an attached file. */
function absolutizeUrls(html: string, origin: string): string {
  return html.replace(/(\s(?:src|href)\s*=\s*["'])(\/[^/"'][^"']*)/gi, `$1${origin}$2`);
}

function buildDocumentFile(title: string, entityName: string, bodyHtml: string, origin: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)} - ${escapeHtml(entityName)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #222; max-width: 860px; margin: 32px auto; padding: 0 20px; line-height: 1.5; }
  h1.doc-title { margin-bottom: 4px; }
  p.doc-entity { margin-top: 0; color: #666; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #ccc; padding: 6px 8px; }
  img { max-width: 100%; height: auto; }
</style>
</head>
<body>
<h1 class="doc-title">${escapeHtml(title)}</h1>
<p class="doc-entity">${escapeHtml(entityName)}</p>
<hr>
${absolutizeUrls(sanitizeClubDocumentHtml(bodyHtml), origin)}
</body>
</html>`;
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
  const origin = resolvePublicOrigin(request);
  const attachments = [
    {
      filename: `Rules - ${safeFileName(entityName)}.html`,
      content: buildDocumentFile('Rules', entityName, docs.rulesHtml, origin),
      contentType: 'text/html; charset=utf-8',
    },
    {
      filename: `Privacy policy - ${safeFileName(entityName)}.html`,
      content: buildDocumentFile('Privacy policy', entityName, docs.privacyPolicyHtml, origin),
      contentType: 'text/html; charset=utf-8',
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
