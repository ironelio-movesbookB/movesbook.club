import { Suspense } from 'react';
import ModernNavbar from '@/components/ModernNavbar';
import ModernFooter from '@/components/ModernFooter';
import FaqBrowseClient from '@/components/faqs/FaqBrowseClient';

/** FAQ display page (PHP FaqPage/display_faq): choose Section + Sub Section + language, then Search. */
export default function FAQsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <ModernNavbar />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6">
        <Suspense fallback={<div className="h-64 rounded bg-[#e59a09]/40" />}>
          <FaqBrowseClient />
        </Suspense>
      </main>
      <ModernFooter />
    </div>
  );
}
