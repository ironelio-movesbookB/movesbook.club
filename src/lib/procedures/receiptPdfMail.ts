import { prisma } from '@/lib/prisma';
import { sendIonosEmail } from '@/lib/ionosEmail';
import { findPublicOrg } from '@/lib/club/publicOrg';
import { payModeLabel } from '@/lib/procedures/payModes';
import { procedureSubscriber } from '@/lib/procedures/subscriberOverride';

function recordCurrency(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return 'EUR';
  return String((metadata as Record<string, unknown>).currency ?? '').trim().toUpperCase() || 'EUR';
}

export type ReceiptPdfData = {
  id: string;
  clubId: string;
  clubName: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  currency: string;
  documentType: string;
  documentNumber: string;
  receiptDate: string;
  detail: string;
  annotations: string;
  total: number;
  paid: number;
  residual: number;
  payMode: string;
  operatorName: string;
};

function pdfSafeText(value: string): string {
  return value.replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function personName(user: { firstName?: string | null; surname?: string | null; name?: string | null } | null): string {
  if (!user) return '';
  const full = [user.firstName, user.surname].map((part) => (part ?? '').trim()).filter(Boolean).join(' ');
  return full || (user.name ?? '').trim();
}

function money(value: number, currency = 'EUR'): string {
  return `${currency || 'EUR'} ${value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function recordDetail(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return '';
  const meta = metadata as Record<string, unknown>;
  for (const key of ['serviceName', 'productName', 'expenseName', 'debtLabel', 'membershipName', 'courseName', 'eventName']) {
    const value = String(meta[key] ?? '').trim();
    if (value) return value;
  }
  return '';
}

export async function loadReceiptPdfData(receiptId: string, clubId?: string): Promise<ReceiptPdfData | null> {
  const receipt = await prisma.procedureReceipt.findFirst({
    where: { id: receiptId, ...(clubId ? { clubId } : {}) },
    include: {
      member: { select: { firstName: true, surname: true, name: true, email: true } },
      operator: { select: { firstName: true, surname: true, name: true } },
      procedureRecord: { select: { totalAmount: true, balanceAmount: true, metadata: true } },
      procedurePayment: { select: { payMode: true, balanceAfter: true } },
    },
  });
  if (!receipt) return null;
  const org = await findPublicOrg(receipt.clubId).catch(() => null);
  const total = Number(receipt.amount) || Number(receipt.procedureRecord?.totalAmount ?? 0);
  const paid = Number(receipt.paymentAmount) || 0;
  const residual =
    receipt.procedurePayment?.balanceAfter != null
      ? Number(receipt.procedurePayment.balanceAfter)
      : Math.max(0, Number(receipt.procedureRecord?.balanceAmount ?? total - paid));
  const payMode = receipt.procedurePayment?.payMode ?? '';
  const subscriber = procedureSubscriber(receipt.procedureRecord?.metadata);
  return {
    id: receipt.id,
    clubId: receipt.clubId,
    clubName: org?.name ?? 'Club',
    memberId: receipt.memberId,
    memberName: subscriber?.name || personName(receipt.member) || 'Member',
    memberEmail: subscriber ? subscriber.email : receipt.member?.email?.trim() ?? '',
    currency: subscriber?.currency || recordCurrency(receipt.procedureRecord?.metadata),
    documentType: receipt.documentType?.trim() || 'Receipt',
    documentNumber: receipt.documentNumber?.trim() ?? '',
    receiptDate: receipt.receiptDate.toISOString().slice(0, 10),
    detail: receipt.serviceName?.trim() || recordDetail(receipt.procedureRecord?.metadata) || '-',
    annotations: receipt.annotations?.trim() ?? '',
    total,
    paid,
    residual,
    payMode: payMode ? payModeLabel(payMode) : '',
    operatorName: personName(receipt.operator),
  };
}

export function receiptPdfFilename(data: ReceiptPdfData): string {
  const base = `${data.documentType}-${data.documentNumber || data.id}`.replace(/[^A-Za-z0-9._-]+/g, '_');
  return `${base}.pdf`;
}

export async function buildReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const left = 18;
  let y = 22;

  doc.setFontSize(18);
  doc.text(pdfSafeText(data.clubName), left, y);
  y += 10;
  doc.setFontSize(14);
  const title = data.documentNumber ? `${data.documentType} n. ${data.documentNumber}` : data.documentType;
  doc.text(pdfSafeText(title), left, y);
  y += 7;
  doc.setFontSize(10);
  doc.text(pdfSafeText(`Date: ${data.receiptDate}`), left, y);
  y += 12;

  const rows: Array<[string, string]> = [
    ['Member', data.memberName],
    ['Detail', data.detail],
    ['Total', money(data.total, data.currency)],
    ['Paid', money(data.paid, data.currency)],
    ['Residual', money(data.residual, data.currency)],
  ];
  if (data.payMode) rows.push(['Pay mode', data.payMode]);
  if (data.operatorName) rows.push(['Operator', data.operatorName]);

  doc.setFontSize(11);
  for (const [label, value] of rows) {
    doc.setFont('helvetica', 'bold');
    doc.text(pdfSafeText(label), left, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(pdfSafeText(value || '-'), 130) as string[];
    doc.text(lines, left + 40, y);
    y += 7 * Math.max(1, lines.length);
  }

  if (data.annotations) {
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('Annotations', left, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(pdfSafeText(data.annotations), 170) as string[];
    doc.text(lines, left, y);
  }

  return Buffer.from(doc.output('arraybuffer'));
}

/** Mails the PDF of one or more receipts of the same club. Returns the address used. */
export async function emailReceiptPdfs(input: {
  receiptIds: string[];
  clubId?: string;
  to?: string;
}): Promise<{ to: string; sent: number }> {
  const receipts: ReceiptPdfData[] = [];
  for (const id of input.receiptIds) {
    const data = await loadReceiptPdfData(id, input.clubId);
    if (data) receipts.push(data);
  }
  if (receipts.length === 0) throw new Error('Receipt not found');
  const to = (input.to ?? '').trim() || receipts[0]!.memberEmail;
  if (!to) throw new Error('The member has no email address');

  const attachments = await Promise.all(
    receipts.map(async (data) => ({
      filename: receiptPdfFilename(data),
      content: await buildReceiptPdf(data),
      contentType: 'application/pdf',
    })),
  );
  const first = receipts[0]!;
  const subject =
    receipts.length === 1
      ? `${first.documentType}${first.documentNumber ? ` n. ${first.documentNumber}` : ''} - ${first.clubName}`
      : `${receipts.length} receipts - ${first.clubName}`;
  const listText = receipts
    .map((r) => `${r.documentType} ${r.documentNumber} (${r.receiptDate}): ${money(r.paid, r.currency)}`)
    .join('\n');
  await sendIonosEmail({
    to,
    subject,
    text: `${first.clubName} sends you the attached document.\n\n${listText}`,
    html: `<p>${escapeHtml(first.clubName)} sends you the attached document.</p><ul>${receipts
      .map(
        (r) =>
          `<li>${escapeHtml(r.documentType)} ${escapeHtml(r.documentNumber)} (${escapeHtml(r.receiptDate)}): ${escapeHtml(
            money(r.paid, r.currency),
          )}</li>`,
      )
      .join('')}</ul>`,
    attachments,
  });
  return { to, sent: receipts.length };
}

/** Best-effort: a missing email or SMTP error must never undo the saved payment. */
export function mailReceiptPdfInBackground(receiptId: string | null | undefined): void {
  if (!receiptId) return;
  void emailReceiptPdfs({ receiptIds: [receiptId] }).catch((error) => {
    console.error('receipt PDF email failed:', receiptId, error);
  });
}
