'use client';

import PromocodesTabs from '@/components/promocodes/PromocodesTabs';
import PromocodeStatisticsInteractivePanel from '@/components/promocodes/PromocodeStatisticsInteractivePanel';
import { usePromocodesAdminAuth } from '@/components/promocodes/usePromocodesAdminAuth';
import '@/components/promocodes/promocodes.css';

export default function PromocodeStatisticsPage() {
  const ready = usePromocodesAdminAuth();
  if (!ready) return null;

  return (
    <div className="promocodes-page max-w-[1400px] mx-auto">
      <div className="reddish_row1 mtop10">Promocode Statistics</div>
      <PromocodesTabs active="statistics" />
      <PromocodeStatisticsInteractivePanel title="" className="mt-4" />
    </div>
  );
}
