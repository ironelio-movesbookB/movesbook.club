/** Product types a club can buy from Movesbook. Descriptions are filled from the purchase. */

export const PURCHASE_PRODUCTS = [
  { code: 'desk', letter: 'A', label: 'Subscription Desk' },
  { code: 'mobile', letter: 'B', label: 'Subscription Mobile' },
  { code: 'module', letter: 'C', label: 'Optional modules' },
  { code: 'slots', letter: 'D', label: 'New members slots' },
  { code: 'accounts', letter: 'E', label: 'Accounts' },
  { code: 'cards', letter: 'F', label: 'Identification cards' },
  { code: 'hardware', letter: 'G', label: 'Hardware' },
] as const;

export type PurchaseProductCode = (typeof PURCHASE_PRODUCTS)[number]['code'];

export function purchaseProductLabel(code: PurchaseProductCode): string {
  return PURCHASE_PRODUCTS.find((item) => item.code === code)?.label ?? code;
}

/** Recorded network memberships are Subscription Desk purchases. */
export const RECORDED_MEMBERSHIP_PRODUCT: PurchaseProductCode = 'desk';

export function buyerTypeLabel(userType: string | null | undefined): string {
  const value = (userType ?? '').toUpperCase();
  if (value.includes('COACH')) return 'Coach';
  if (value.includes('TEAM')) return 'Team';
  if (value.includes('CLUB')) return 'Club';
  if (value.includes('GROUP')) return 'Group';
  return 'Single User';
}

export function versionTierLabel(version: string | null | undefined): string {
  const value = (version ?? '').toLowerCase();
  if (!value.trim()) return '—';
  if (value.includes('enterprise')) return 'Enterprise';
  if (value.includes('professional') || /\bpro\b/.test(value)) return 'Professional';
  if (value.includes('premium')) return 'Premium';
  if (value.includes('trial')) return 'Trial';
  if (value.includes('base')) return 'Base';
  const cleaned = version!
    .replace(/^(single user|coach|team|club|group)\s*[—-]?\s*/i, '')
    .trim();
  return cleaned || version!.trim();
}

/** Example: "Club - Premium - Qty 1". */
export function subscriptionPurchaseDescription(
  userType: string | null | undefined,
  version: string | null | undefined,
  quantity = 1,
): string {
  const qty = Number.isFinite(quantity) && quantity > 0 ? Math.round(quantity) : 1;
  return `${buyerTypeLabel(userType)} - ${versionTierLabel(version)} - Qty ${qty}`;
}
