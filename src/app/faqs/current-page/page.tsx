import { Suspense } from 'react';
import ModernNavbar from '@/components/ModernNavbar';
import ModernFooter from '@/components/ModernFooter';
import FaqCurrentPageClient from '@/components/faqs/FaqCurrentPageClient';

/** "FAQs of the Page" (PHP FaqPage/current_page_faqs?url=...), opened from the HELP toolbar. */
export default function FaqCurrentPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <ModernNavbar />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6">
        <Suspense fallback={<div className="h-40" />}>
          <FaqCurrentPageClient />
        </Suspense>
      </main>
      <ModernFooter />
    </div>
  );
}
