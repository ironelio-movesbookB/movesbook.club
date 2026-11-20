'use client';

import { useRouter } from 'next/navigation';
import FaqMetaForm from '@/components/faqs/admin/FaqMetaForm';
import { useFaqAdminGate } from '@/components/faqs/admin/useFaqAdminGate';
import { faqAdminFetch } from '@/lib/faqs/faqClient';

/** Management Of FAQS → Editor (PHP admins/add_faq_page). */
export default function AdminFaqNewPage() {
  const router = useRouter();
  const ready = useFaqAdminGate();
  if (!ready) return null;

  return (
    <div className="p-4">
      <div className="border border-gray-300 bg-white">
        <h1 className="border-b border-gray-300 bg-[#e3e3e3] px-3 py-1.5 text-base font-bold text-gray-900">
          Create a New FAQ
        </h1>
        <div className="p-4">
          <FaqMetaForm
            onCancel={() => router.push('/admin/faqs')}
            onSubmit={async (values) => {
              await faqAdminFetch('/api/admin/faqs', { method: 'POST', json: values });
              router.push('/admin/faqs?added=1');
            }}
          />
        </div>
      </div>
    </div>
  );
}
