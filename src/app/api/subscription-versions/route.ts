import { NextResponse } from 'next/server';
import {
  listSavedVersionEditData,
  listSeededVersionIds,
  seedVersionSettingsFromDefaults,
} from '@/lib/admin/versionSettingsStore';

export const dynamic = 'force-dynamic';

/** GET — version settings stored in the database (public: shown during registration). */
export async function GET() {
  try {
    let versions = await listSavedVersionEditData();
    if (versions.length === 0) {
      await seedVersionSettingsFromDefaults();
      versions = await listSavedVersionEditData();
    }
    const seededIds = await listSeededVersionIds();
    return NextResponse.json({ versions, seededIds });
  } catch (error) {
    console.error('subscription-versions GET', error);
    return NextResponse.json({ error: 'Could not load version settings' }, { status: 500 });
  }
}
