import { redirect } from 'next/navigation';

/** Product sellings pay on the same form as Services. */
export default function ProductPaymentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/clubs/payment_detail/${encodeURIComponent(params.id)}?type=product_sale`);
}
