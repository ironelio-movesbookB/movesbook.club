'use client';

import PromocodesTabs from '@/components/promocodes/PromocodesTabs';
import PromocodeStatisticsInteractivePanel from '@/components/promocodes/PromocodeStatisticsInteractivePanel';
import { usePromocodesAdminAuth } from '@/components/promocodes/usePromocodesAdminAuth';
import '@/components/promocodes/promocodes.css';

/** Super Admin / promocode admin statistics — interactive pie/bar drill-downs. */
export default function PromocodeStatisticsPage() {
  const ready = usePromocodesAdminAuth();
  if (!ready) return null;

  return (
    <div className="promocodes-page max-w-[1400px] mx-auto">
      <div className="reddish_row1 mtop10">Promocode Statistics</div>
      <PromocodesTabs active="statistics" />
      <div className="mt-4">
        <PromocodeStatisticsInteractivePanel title="" />
      </div>
    </div>
  );
}
