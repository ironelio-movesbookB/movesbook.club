import { Suspense } from 'react';
import ModernNavbar from '@/components/ModernNavbar';
import ModernFooter from '@/components/ModernFooter';
import FaqFullPageClient from '@/components/faqs/FaqFullPageClient';

/** One FAQ at full page, opened by the 👁 button (PHP FaqPage/faq_doubleclick/{id}). */
export default function FaqFullPage({ params }: { params: { id: string } }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <ModernNavbar />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6">
        <Suspense fallback={<div className="h-40" />}>
          <FaqFullPageClient id={params.id} />
        </Suspense>
      </main>
      <ModernFooter />
    </div>
  );
}
