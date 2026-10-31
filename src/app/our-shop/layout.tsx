'use client';

import { usePathname } from 'next/navigation';

function isPublicShop(pathname: string | null) {
  return Boolean(pathname?.startsWith('/our-shop/shop/'));
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isPublicShop(pathname)) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }
  return <>{children}</>;
}
