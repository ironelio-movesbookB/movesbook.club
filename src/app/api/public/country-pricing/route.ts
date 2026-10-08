import { NextRequest, NextResponse } from 'next/server';
import { getCountryPriceInfo } from '@/lib/countries/countryPricingDb';

export const dynamic = 'force-dynamic';

/** Registration form: price multiplier and currency of the selected country. */
export async function GET(request: NextRequest) {
  const country = request.nextUrl.searchParams.get('country')?.trim() ?? '';
  try {
    const info = await getCountryPriceInfo(country);
    return NextResponse.json({ ...info, coefficient: info.factor });
  } catch (e) {
    console.error('public country-pricing GET:', e);
    return NextResponse.json({
      country,
      factor: 1,
      coefficient: 1,
      currencyCode: 'EUR',
      currencyDescription: '',
      eurToLocal: 1,
    });
  }
}
