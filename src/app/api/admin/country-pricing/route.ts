import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import {
  getCountryPricingHeader,
  listCountryPricing,
  saveCountryPricingHeader,
  saveCountryPricingSettings,
} from '@/lib/countries/countryPricingDb';
import type { CountryPricingSettings } from '@/lib/countries/countryPriceFormula';

export const dynamic = 'force-dynamic';

/** Countries page: header values + pricing of every country (saved or imported from PHP). */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const [header, countries] = await Promise.all([getCountryPricingHeader(), listCountryPricing()]);
    return NextResponse.json({ header, countries: Object.fromEntries(countries) });
  } catch (e) {
    console.error('country-pricing GET:', e);
    return NextResponse.json({ error: 'Failed to load country pricing' }, { status: 500 });
  }
}

/** Body `{ header }` saves the header fields; `{ country }` saves one country. */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const body = await request.json().catch(() => ({}));
    if (body.header && typeof body.header === 'object') {
      return NextResponse.json({ header: await saveCountryPricingHeader(body.header) });
    }
    const country = body.country as Partial<CountryPricingSettings> | undefined;
    if (!country || typeof country.countryName !== 'string' || !country.countryName.trim()) {
      return NextResponse.json({ error: 'Country name is required' }, { status: 400 });
    }
    const saved = await saveCountryPricingSettings({
      countryName: country.countryName,
      annualIncome: Number(country.annualIncome) || null,
      incomeCurrency: country.incomeCurrency === 'USD' ? 'USD' : 'EUR',
      sliderPercent: Number(country.sliderPercent) || 0,
      currencyCode: String(country.currencyCode ?? ''),
      currencyDescription: String(country.currencyDescription ?? ''),
      eurToLocal: Number(country.eurToLocal) || null,
      usdToLocal: Number(country.usdToLocal) || null,
    });
    return NextResponse.json({ country: saved });
  } catch (e) {
    console.error('country-pricing POST:', e);
    return NextResponse.json({ error: 'Failed to save country pricing' }, { status: 500 });
  }
}
