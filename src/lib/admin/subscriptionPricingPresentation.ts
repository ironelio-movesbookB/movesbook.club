import type { SubscriptionGeneralSettings } from '@/types/adminSubscriptionSettings';

export type SubscriptionPricingScenario = 'first' | 'renewal';

export type SubscriptionScenarioPricing = {
  scenario: SubscriptionPricingScenario;
  title: string;
  days: number;
  price: number;
  promoDiscount: number;
  priceAfterPromo: number;
};

export type TripleSubscriptionPricing = {
  days: number;
  price: number;
  discountPercent: number;
  standardTriplePrice: number;
  priceAfterPromo: number;
};

export function formatSubscriptionPrice(price: number): string {
  if (price === 0) return 'Free';
  return `€ ${Number.isInteger(price) ? price : price.toFixed(2)}`;
}

/** (price ÷ durationDays) × 31 — monthly equivalent for registration display. */
export function calculateMonthlyCost(price: number, durationDays: number): number | null {
  if (!Number.isFinite(price) || !Number.isFinite(durationDays) || durationDays <= 0) {
    return null;
  }
  return Math.round((price / durationDays) * 31 * 100) / 100;
}

/** e.g. Monthly cost : € 15.50 */
export function formatMonthlyCostExpression(price: number, durationDays: number): string | null {
  const monthly = calculateMonthlyCost(price, durationDays);
  if (monthly === null) return null;
  const result = monthly === 0 ? 'Free' : formatSubscriptionPrice(monthly);
  return `Monthly cost : ${result}`;
}

export function applyPromoDiscount(price: number, discountPercent: number): number {
  if (!Number.isFinite(price) || !Number.isFinite(discountPercent)) return price;
  return Math.round(price * (1 - discountPercent / 100) * 100) / 100;
}

export function getScenarioPricing(
  general: SubscriptionGeneralSettings,
  scenario: SubscriptionPricingScenario,
): SubscriptionScenarioPricing {
  const isFirst = scenario === 'first';

  return {
    scenario,
    title: isFirst ? `1th subscription ${general.name}` : 'Standard or renewal',
    days: isFirst ? general.firstSubscriptionDays : general.renewalDays,
    price: isFirst ? general.firstSubscriptionPrice : general.renewalPrice,
    promoDiscount: isFirst
      ? general.firstSubscriptionPromoDiscount
      : general.renewalPromoDiscount,
    priceAfterPromo: applyPromoDiscount(
      isFirst ? general.firstSubscriptionPrice : general.renewalPrice,
      isFirst ? general.firstSubscriptionPromoDiscount : general.renewalPromoDiscount,
    ),
  };
}

export function getTripleSubscriptionPricing(
  general: SubscriptionGeneralSettings,
  baseScenario: SubscriptionPricingScenario,
): TripleSubscriptionPricing {
  const base = getScenarioPricing(general, baseScenario);
  const tripleDays = base.days * 3;
  const standardTriplePrice = base.price * 3;

  return {
    days: tripleDays,
    price: general.tripleDurationPrice,
    discountPercent: general.tripleDurationDiscount,
    standardTriplePrice,
    priceAfterPromo: applyPromoDiscount(general.tripleDurationPrice, base.promoDiscount),
  };
}
