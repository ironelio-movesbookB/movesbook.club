import { NextRequest, NextResponse } from 'next/server';
import { getPublicSpecialOffer } from '@/lib/subscriptions/specialOffers';

export const dynamic = 'force-dynamic';

/** Public: active special offer of a version (?versionId=&lang=), or `offer: null`. */
export async function GET(request: NextRequest) {
  const versionId = Number(request.nextUrl.searchParams.get('versionId'));
  const lang = (request.nextUrl.searchParams.get('lang') || 'en').trim().toLowerCase();
  if (!Number.isInteger(versionId) || versionId <= 0) {
    return NextResponse.json({ offer: null });
  }
  try {
    return NextResponse.json({ offer: await getPublicSpecialOffer(versionId, lang) });
  } catch (e) {
    console.error('GET public special offer', e);
    return NextResponse.json({ offer: null });
  }
}
