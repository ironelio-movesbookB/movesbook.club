'use client';

import {
  formatEventEuro,
  registrationPaymentLabel,
  type ClubEventRegistration,
} from '@/lib/club/events/eventConstants';

type Props = {
  registrations: ClubEventRegistration[];
  className?: string;
};

/**
 * Subscribers rows: name (member profile link), email, member / not member, attached files,
 * Confirmed / Not confirmed, amount and Paid (black) / In pending (red, opens the deadline payment).
 */
export default function EventSubscribersList({ registrations, className = '' }: Props) {
  return (
    <ul className={`divide-y divide-gray-100 rounded-md border border-gray-200 ${className}`}>
      {registrations.map((r) => {
        const files = Object.values(r.textFiles || {});
        const pay = registrationPaymentLabel(r);
        const confirmed = r.status === 'confirmed';
        return (
          <li key={r.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-3 py-2 text-sm">
            <span className="min-w-0">
              {r.profilePath ? (
                <a
                  href={r.profilePath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-700 hover:underline"
                >
                  {r.fullName}
                </a>
              ) : (
                <span className="font-medium">{r.fullName}</span>
              )}
              <span className="text-gray-500"> · {r.email}</span>
              {files.length ? (
                <span className="mt-0.5 block text-xs">
                  {files.map((f) => (
                    <a
                      key={f.url}
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mr-3 text-blue-700 underline"
                    >
                      {f.name}
                    </a>
                  ))}
                </span>
              ) : null}
            </span>
            <span className={r.isMember ? 'text-gray-900' : 'text-red-600'}>
              {r.isMember ? 'member' : 'not member'}
            </span>
            <span className={confirmed ? 'font-semibold text-emerald-700' : 'text-orange-600'}>
              {confirmed ? 'Confirmed' : r.status === 'cancelled' ? 'Cancelled' : 'Not confirmed'}
            </span>
            <span className="whitespace-nowrap text-right">
              <span className="text-gray-700">{formatEventEuro(r.amountDue, r.currency)}</span>
              <span className="mx-1 text-gray-300">·</span>
              {!pay.paid && r.procedureRecordId ? (
                <a
                  href={`/clubs/events/payment_detail/${encodeURIComponent(r.procedureRecordId)}`}
                  className="font-semibold text-red-600 hover:underline"
                  title="Open the deadline payment"
                >
                  {pay.text}
                </a>
              ) : (
                <span className={pay.paid ? 'font-semibold text-gray-900' : 'font-semibold text-red-600'}>
                  {pay.text}
                </span>
              )}
            </span>
          </li>
        );
      })}
      {!registrations.length ? <li className="px-3 py-4 text-center text-gray-500">No subscribers yet.</li> : null}
    </ul>
  );
}
