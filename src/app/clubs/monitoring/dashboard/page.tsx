'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import ClubMonitoringDashboard from '@/components/club/monitoring/ClubMonitoringDashboard';

function MonitoringDashboardPageInner() {
  const searchParams = useSearchParams();
  return <ClubMonitoringDashboard initialSettingsOpen={searchParams?.get('settings') === '1'} />;
}

export default function MonitoringDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
        </div>
      }
    >
      <MonitoringDashboardPageInner />
    </Suspense>
  );
}
