import { NextResponse } from 'next/server';
import { loadSerializedSponsorSettings } from '@/lib/news/ogpSponsorStore';

export const dynamic = 'force-dynamic';

/** GET /api/news/ogp-sponsors — public placement + sponsor groups for the OGP News grid. */
export async function GET() {
  try {
    return NextResponse.json(await loadSerializedSponsorSettings());
  } catch (e) {
    console.error('GET /api/news/ogp-sponsors', e);
    return NextResponse.json({ error: 'Failed to load sponsored news' }, { status: 500 });
  }
}
