import Link from 'next/link';
import { confirmEventRegistration } from '@/lib/club/events/eventSubscriptionPayments';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ token: string }> };

export default async function ClubEventConfirmPage({ params }: Props) {
  const { token } = await params;
  const result = await confirmEventRegistration(token).catch(() => ({ ok: false as const }));
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-xl shadow-sm p-6 text-center">
        {result.ok ? (
          <>
            <div className="text-4xl mb-2 text-green-600">✓</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              {result.alreadyConfirmed ? 'Subscription already confirmed' : 'Subscription confirmed'}
            </h1>
            <p className="text-gray-700 mb-4">
              {result.fullName}, your subscription to <strong>{result.eventName}</strong> is confirmed.
            </p>
            <Link href={result.eventUrl} className="inline-block px-4 py-2 rounded bg-blue-600 text-white font-semibold">
              Open event page
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-red-700 mb-2">Link not valid</h1>
            <p className="text-gray-700">This confirmation link is not valid or the subscription was cancelled.</p>
          </>
        )}
      </div>
    </main>
  );
}
