import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getEditHref, getSubscriptionListRows, getUserTypeLabel } from '@/lib/admin/subscriptionSettingsMock';
import {
  applyModalityPresetToVersion,
  getModalityPreset,
  saveModalityPreset,
} from '@/lib/subscriptions/modalityPresetStore';
import { getCountryPricingHeader, listCountryPricing } from '@/lib/countries/countryPricingDb';
import { loadVersionSettings } from '@/lib/subscriptions/versionSettingsStore';

export const dynamic = 'force-dynamic';

/** Preset + versions (for "Save for version") + country income data (for the simulations). */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    await loadVersionSettings();
    const [preset, header, countries] = await Promise.all([
      getModalityPreset(),
      getCountryPricingHeader(),
      listCountryPricing(),
    ]);
    const versions = getSubscriptionListRows()
      .filter((row) => row.name.trim())
      .map((row) => ({
        id: row.id,
        name: row.name,
        code: row.code,
        userType: row.userType,
        userTypeLabel: getUserTypeLabel(row.userType),
        editHref: getEditHref(row),
      }));
    return NextResponse.json({
      preset,
      versions,
      ourAnnualIncomeEur: header.ourAnnualIncomeEur,
      usdToEur: header.usdToEur,
      countries: Object.fromEntries(countries),
    });
  } catch (e) {
    console.error('modality-preset GET:', e);
    return NextResponse.json({ error: 'Failed to load the modality settings' }, { status: 500 });
  }
}

/** Save the preset. */
export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({ preset: await saveModalityPreset(body.preset) });
  } catch (e) {
    console.error('modality-preset PUT:', e);
    return NextResponse.json({ error: 'Failed to save the modality settings' }, { status: 500 });
  }
}

/** `{ action: 'apply', versionId, preset }` — save the preset and apply it to the version. */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const body = await request.json().catch(() => ({}));
    const versionId = Number(body.versionId);
    if (body.action !== 'apply' || !Number.isInteger(versionId) || versionId <= 0) {
      return NextResponse.json({ error: 'Select a version' }, { status: 400 });
    }
    const preset = await saveModalityPreset(body.preset);
    const result = await applyModalityPresetToVersion(versionId, preset);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const message = e instanceof Error && e.message === 'Unknown subscription version'
      ? 'Unknown subscription version'
      : 'Failed to apply the settings';
    console.error('modality-preset POST:', e);
    return NextResponse.json({ error: message }, { status: message.startsWith('Unknown') ? 404 : 500 });
  }
}
