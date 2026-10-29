import ProductForm from '@/components/our-shop/ProductForm';

type PageProps = {
  params: { id: string };
};

export default function EditProductPage({ params }: PageProps) {
  return <ProductForm productId={params.id} />;
}