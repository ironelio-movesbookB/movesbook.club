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

/** Shop, Bar and Restaurant can be combined. Hardware is always stored alone. */
export function productSectors(value: string | null | undefined): ShopSector[] {
  const parts = String(value ?? '')
    .split(/\s*(?:,|\||;|\s-\s)\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  const found = SHOP_SECTORS.filter((sector) =>
    parts.some((part) => part.toLowerCase() === sector.toLowerCase()),
  );
  if (found.includes('Hardware')) return ['Hardware'];
  if (found.length === 0) return ['Shop'];
  return found;
}

export function formatProductSectors(value: string | readonly string[] | null | undefined) {
  const raw = Array.isArray(value) ? value.join(',') : value;
  return productSectors(raw).join(',');
}

export function productSectorLabel(value: string | null | undefined) {
  return productSectors(value).join(', ');
}

export function productInSector(value: string | null | undefined, sector: string) {
  return productSectors(value).includes(shopSector(sector));
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
  return productSectors(value).includes('Hardware');
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
