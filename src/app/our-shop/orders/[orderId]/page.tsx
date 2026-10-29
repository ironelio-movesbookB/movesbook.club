'use client';

import { useParams } from 'next/navigation';
import OrderEditor from '@/components/our-shop/OrderEditor';

export default function OrderPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = typeof params?.orderId === 'string' ? decodeURIComponent(params.orderId) : '';

  if (!orderId) {
    return <p className="text-sm text-slate-500">Order not found.</p>;
  }

  return <OrderEditor orderId={orderId} />;
}
