'use client';

import { useParams } from 'next/navigation';
import ProductForm from '@/components/our-shop/ProductForm';

export default function EditShopProductPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === 'string' ? decodeURIComponent(params.id) : '';
  return <ProductForm productId={id} />;
}
