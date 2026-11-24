import { NextRequest, NextResponse } from 'next/server';
import { getPublicSpecialUpgrade } from '@/lib/subscriptions/specialUpgrades';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const versionId = Number(request.nextUrl.searchParams.get('versionId'));
    const lang = String(request.nextUrl.searchParams.get('lang') || 'en');
    if (!Number.isFinite(versionId)) {
      return NextResponse.json({ error: 'versionId required' }, { status: 400 });
    }
    const offer = await getPublicSpecialUpgrade(versionId, lang);
    return NextResponse.json({ offer });
  } catch (error) {
    console.error('GET special-upgrade', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
