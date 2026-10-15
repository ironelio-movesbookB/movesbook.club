import { NextResponse } from 'next/server';
import { loadVersionSettings } from '@/lib/subscriptions/versionSettingsStore';

export const dynamic = 'force-dynamic';

/** Public: admin-saved version settings used by the registration page. */
export async function GET() {
  try {
    return NextResponse.json({ versions: await loadVersionSettings() });
  } catch (e) {
    console.error('GET version settings', e);
    return NextResponse.json({ versions: {} });
  }
}
