'use client';

import { Suspense } from 'react';
import FaqAdminListClient from '@/components/faqs/admin/FaqAdminListClient';

/** Management Of FAQS → Management of the FAQS (PHP admins/faq_pages_manage). */
export default function AdminFaqsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading…</div>}>
      <FaqAdminListClient />
    </Suspense>
  );
}
