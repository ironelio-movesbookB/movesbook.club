export const SHOP_SECTORS = ['Shop', 'Restaurant', 'Bar', 'Hardware'] as const;
export const SELLING_SECTORS = ['Bar', 'Restaurant', 'Shop'] as const;

export type ShopSector = (typeof SHOP_SECTORS)[number];
export type ProductListScope = ShopSector | 'All';

const SECTOR_SLUG: Record<ShopSector, string> = {
  Shop: 'shop',
  Restaurant: 'restaurant',
  Bar: 'bar',
  Hardware: 'hardware',
};

export const SHOP_SECTOR_TITLE: Record<ProductListScope, string> = {
  All: 'ALL products',
  Shop: 'Product of the Shop',
  Restaurant: 'Product of the Restaurant',
  Bar: 'Product of the Bar',
  Hardware: 'List of hardware purchasable',
};

export function shopSector(value: string | null | undefined): ShopSector {
  const found = SHOP_SECTORS.find(
    (sector) => sector.toLowerCase() === String(value ?? '').trim().toLowerCase(),
  );
  return found ?? 'Shop';
}

export function shopSectorFromPath(pathname: string): ProductListScope {
  if (pathname.includes('/products/hardware')) return 'Hardware';
  if (pathname.includes('/products/restaurant')) return 'Restaurant';
  if (pathname.includes('/products/bar')) return 'Bar';
  if (pathname.includes('/products/all')) return 'All';
  return 'Shop';
}

export function shopProductListPath(sector: string) {
  if (String(sector).trim().toLowerCase() === 'all') return '/clubs/shop/products/all';
  return `/clubs/shop/products/${SECTOR_SLUG[shopSector(sector)]}`;
}

export function isHardwareProductSector(value: string | null | undefined) {
  return shopSector(value) === 'Hardware';
}

export function sellingPerformedBy(source: string | null | undefined) {
  return String(source ?? '').trim().toLowerCase() === 'online' ? 'Member' : 'Operator';
}

export function sellingArchiveSector(source: string | null | undefined, sector: string | null | undefined) {
  if (String(source ?? '').trim().toLowerCase() === 'online') return 'Shop online';
  const raw = String(sector ?? '').trim();
  if (!raw) return 'Shop';
  if (raw.includes(' - ')) return raw;
  return shopSector(raw);
}
