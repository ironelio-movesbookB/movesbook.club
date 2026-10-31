'use client';

import { useParams } from 'next/navigation';
import GoTo from '@/components/our-shop/GoTo';

export default function OrderRedirect() {
  const params = useParams<{ orderId: string }>();
  const id = typeof params?.orderId === 'string' ? params.orderId : '';
  return <GoTo href={id ? `/clubs/shop/orders/${id}` : '/clubs/shop/orders'} />;
}
