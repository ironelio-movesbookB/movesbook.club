'use client';

import { useEffect, useState } from 'react';
import { clubApiFetch } from '@/lib/club/servicePurchasesClient';
import type { PaymentTypeValue } from '@/lib/procedures/payModes';

/** Enabled member payment methods for the signed-in club or team. Null until loaded, or when this account has none. */
export function useClubEnabledPaymentMethods(): PaymentTypeValue[] | null {
  const [enabled, setEnabled] = useState<PaymentTypeValue[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const data = await clubApiFetch<{ settings?: { enabled?: PaymentTypeValue[] } }>(
          '/api/club/settings/member-payment-methods',
          { signal: controller.signal },
        );
        if (Array.isArray(data.settings?.enabled)) setEnabled(data.settings.enabled);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    })();
    return () => controller.abort();
  }, []);

  return enabled;
}
