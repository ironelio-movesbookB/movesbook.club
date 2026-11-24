import { loadReceiptPdfData } from '@/lib/procedures/receiptPdfMail';
import { receiptForShareToken } from '@/lib/procedures/receiptShares';
import { formatClubMoney } from '@/lib/club/clubCurrency';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ token: string }> };

/** Public read-only receipt opened from a shared link. */
export default async function PublicClubReceiptPage({ params }: Props) {
  const { token } = await params;
  const share = await receiptForShareToken(token).catch(() => null);
  const data = share ? await loadReceiptPdfData(share.receiptId, share.clubId).catch(() => null) : null;

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold text-red-700">Receipt not found</h1>
          <p className="mt-2 text-gray-700">This link is not valid or the receipt was removed.</p>
        </div>
      </main>
    );
  }

  const rows: Array<[string, string]> = [
    ['Document', `${data.documentType}${data.documentNumber ? ` n. ${data.documentNumber}` : ''}`],
    ['Date', data.receiptDate],
    ['Received from', data.memberName],
    ['Detail', data.detail],
    ['Total', formatClubMoney(data.total, data.currency)],
    ['Paid', formatClubMoney(data.paid, data.currency)],
    ['Residual', formatClubMoney(data.residual, data.currency)],
    ...(data.payMode ? ([['Payment mode', data.payMode]] as Array<[string, string]>) : []),
    ...(data.operatorName ? ([['Operator', data.operatorName]] as Array<[string, string]>) : []),
    ...(data.annotations ? ([['Notes', data.annotations]] as Array<[string, string]>) : []),
  ];

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="mx-auto max-w-xl rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="rounded-t-xl bg-[#8B0000] px-5 py-4 text-white">
          <div className="text-sm uppercase tracking-wide text-red-100">{data.clubName}</div>
          <h1 className="text-2xl font-bold">{data.documentType}</h1>
        </div>
        <dl className="divide-y divide-gray-100 px-5">
          {rows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[140px_1fr] gap-3 py-2.5 text-sm">
              <dt className="font-semibold text-gray-600">{label}</dt>
              <dd className="whitespace-pre-wrap text-gray-900">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex justify-end border-t border-gray-100 px-5 py-4">
          <a
            href={`/api/public/club-receipts/${encodeURIComponent(token)}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Download PDF
          </a>
        </div>
      </div>
    </main>
  );
}
