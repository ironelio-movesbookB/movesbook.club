'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import CheckoutClient from '@/components/our-shop/CheckoutClient';

function CheckoutPageContent() {
  const params = useParams<{ slug: string }>();
  const slug = typeof params?.slug === 'string' ? params.slug : '';

  if (!slug) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb] px-4">
        <p className="text-sm text-gray-500">Shop not found.</p>
      </main>
    );
  }

  return <CheckoutClient slug={slug} />;
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb] px-4">
          <p className="text-sm text-gray-500">Loading checkout...</p>
        </main>
      }
    >
      <CheckoutPageContent />
    </Suspense>
  );
}
