'use client';

import { Suspense } from 'react';
import AdminClubsNewsContent from '@/components/admin/AdminClubsNewsContent';

export default function AdminClubsNewsPage() {
  return (
    <Suspense fallback={null}>
      <AdminClubsNewsContent />
    </Suspense>
  );
}
