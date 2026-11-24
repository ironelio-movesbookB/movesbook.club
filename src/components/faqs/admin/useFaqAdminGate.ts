'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getFaqAdminToken } from '@/lib/faqs/faqClient';

/** Admin pages: wait for the token in localStorage, otherwise go to the admin login. */
export function useFaqAdminGate(): boolean {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!getFaqAdminToken()) {
      router.replace('/admin/login');
      return;
    }
    setReady(true);
  }, [router]);
  return ready;
}
