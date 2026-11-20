import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getPublicShop } from '@/lib/shop/service';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const slug = typeof params?.slug === 'string' ? params.slug : '';
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    const decoded = token ? verifyToken(token) : null;
    const viewerUserId = decoded?.userId ? String(decoded.userId) : null;
    const shop = await getPublicShop(slug, viewerUserId);
    if (!shop) return NextResponse.json({ error: 'Shop not found.' }, { status: 404 });
    return NextResponse.json(shop);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not open this shop.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
