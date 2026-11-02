export const SHOP_SECTORS = ['Shop', 'Restaurant', 'Bar', 'Hardware'] as const;

export type ShopSector = (typeof SHOP_SECTORS)[number];

const SECTOR_SLUG: Record<ShopSector, string> = {
  Shop: 'shop',
  Restaurant: 'restaurant',
  Bar: 'bar',
  Hardware: 'hardware',
};

export const SHOP_SECTOR_TITLE: Record<ShopSector, string> = {
  Shop: 'Product of the Shop',
  Restaurant: 'Product of the Restaurant',
  Bar: 'Products of the Bar',
  Hardware: 'List of hardware purchasable',
};

export function shopSector(value: string | null | undefined): ShopSector {
  const found = SHOP_SECTORS.find(
    (sector) => sector.toLowerCase() === String(value ?? '').trim().toLowerCase(),
  );
  return found ?? 'Shop';
}

export function shopSectorFromPath(pathname: string): ShopSector {
  if (pathname.includes('/products/hardware')) return 'Hardware';
  if (pathname.includes('/products/restaurant')) return 'Restaurant';
  if (pathname.includes('/products/bar')) return 'Bar';
  return 'Shop';
}

export function shopProductListPath(sector: string) {
  return `/clubs/shop/products/${SECTOR_SLUG[shopSector(sector)]}`;
}
