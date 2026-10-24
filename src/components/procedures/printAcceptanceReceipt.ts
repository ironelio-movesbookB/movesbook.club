import { formatDate, formatEuro } from '@/lib/club/servicePurchasesClient';

/**
 * Receipt for an OUT payment (expense, member credit): the person receiving the money
 * signs it to accept the payment. Printed in two copies — one kept by the club, one for the recipient.
 */
export type AcceptanceReceiptData = {
  clubName?: string | null;
  recipientName: string;
  amount: number;
  paymentDate?: string | null;
  /** What is being paid, e.g. the expense name. */
  detail?: string | null;
  notes?: string | null;
  payMode?: string | null;
  operatorName?: string | null;
  documentType?: string | null;
  documentNumber?: string | null;
  /** Total of the expense and what is still to pay after this payment. */
  totalAmount?: number | null;
  residualAmount?: number | null;
  typology?: string | null;
};

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function row(label: string, value: string): string {
  return value && value !== '-'
    ? `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`
    : '';
}

function receiptCopy(data: AcceptanceReceiptData, copyLabel: string): string {
  const club = data.clubName?.trim() || 'the club';
  const date = data.paymentDate ? formatDate(data.paymentDate) : formatDate(new Date());
  const docLabel = [data.documentType, data.documentNumber].filter(Boolean).join(' n. ');
  const hasResidual = data.residualAmount != null && data.residualAmount > 0.005;

  return `
  <section class="copy">
    <header>
      <div>
        <div class="club">${escapeHtml(club)}</div>
        <div class="title">Receipt of payment</div>
        <div class="subtitle">Signature for acceptance of the payment</div>
      </div>
      <div class="meta">
        <div>${escapeHtml(copyLabel)}</div>
        ${docLabel ? `<div>${escapeHtml(docLabel)}</div>` : ''}
        <div>Date: ${escapeHtml(date)}</div>
      </div>
    </header>

    <p class="statement">
      The undersigned <strong>${escapeHtml(data.recipientName || '________________')}</strong>
      declares to have received from <strong>${escapeHtml(club)}</strong>
      the sum of <strong class="amount">${escapeHtml(formatEuro(data.amount))}</strong>
      ${data.detail && data.detail !== '-' ? `as payment for <strong>${escapeHtml(data.detail)}</strong>` : ''}
      and accepts it.
    </p>

    <table>
      ${row('Typology', data.typology ?? '')}
      ${row('Reason', data.notes ?? '')}
      ${row('Payment method', data.payMode ?? '')}
      ${data.totalAmount != null ? row('Total amount', formatEuro(data.totalAmount)) : ''}
      ${row('Amount of this payment', formatEuro(data.amount))}
      ${hasResidual ? row('Still to be paid', formatEuro(data.residualAmount)) : ''}
      ${row('Operator', data.operatorName ?? '')}
    </table>

    <div class="signatures">
      <div>
        <div class="line"></div>
        <div>Signature of the recipient for acceptance</div>
      </div>
      <div>
        <div class="line"></div>
        <div>Signature of the operator${data.operatorName ? ` (${escapeHtml(data.operatorName)})` : ''}</div>
      </div>
    </div>
  </section>`;
}

/** Opens a print window with the receipt. Returns false when the popup was blocked. */
export function printAcceptanceReceipt(data: AcceptanceReceiptData): boolean {
  const win = window.open('', '_blank', 'width=820,height=960');
  if (!win) return false;

  win.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt of payment - ${escapeHtml(data.recipientName)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; padding: 24px; font-size: 13px; }
    .copy { border: 1px solid #333; padding: 20px 24px; page-break-inside: avoid; }
    .cut { border-top: 1px dashed #777; margin: 28px 0; text-align: center; font-size: 10px; color: #777; }
    .cut span { position: relative; top: -8px; background: #fff; padding: 0 8px; }
    header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 14px; }
    .club { font-size: 16px; font-weight: bold; }
    .title { font-size: 18px; font-weight: bold; text-transform: uppercase; margin-top: 4px; }
    .subtitle { font-size: 12px; color: #444; }
    .meta { text-align: right; font-size: 12px; line-height: 1.6; }
    .statement { line-height: 1.7; margin: 0 0 14px; }
    .amount { font-size: 15px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 36px; }
    th, td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #ddd; vertical-align: top; }
    th { width: 34%; color: #444; font-weight: normal; }
    .signatures { display: flex; gap: 48px; }
    .signatures > div { flex: 1; text-align: center; font-size: 11px; color: #444; }
    .line { border-bottom: 1px solid #111; height: 40px; margin-bottom: 6px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  ${receiptCopy(data, 'Copy for the club')}
  <div class="cut"><span>cut here</span></div>
  ${receiptCopy(data, 'Copy for the recipient')}
  <script>window.onload = function () { window.focus(); window.print(); };</script>
</body>
</html>`);
  win.document.close();
  return true;
}
