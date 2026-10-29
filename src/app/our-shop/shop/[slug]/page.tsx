import ShopClient from '@/components/our-shop/ShopClient';

export default function PublicShopPage({ params }: { params: { slug: string } }) {
  return <ShopClient slug={params.slug} />;
}
