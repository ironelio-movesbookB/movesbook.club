'use client';

import { useParams } from 'next/navigation';
import GoTo from '@/components/our-shop/GoTo';

export default function ProductRedirect() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === 'string' ? params.id : '';
  return <GoTo href={id ? `/clubs/shop/products/${id}` : '/clubs/shop/products/shop'} />;
}
