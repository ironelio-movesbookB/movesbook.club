import { getCountryPriceInfo } from '@/lib/countries/countryPricingDb';

/** Version price multiplier from Countries → income ratio and slider. */
export async function getCountryPriceCoefficient(countryName: string): Promise<number> {
  if (!countryName.trim()) return 1;
  try {
    return (await getCountryPriceInfo(countryName)).factor;
  } catch (e) {
    console.error('Country price coefficient', e);
    return 1;
  }
}
