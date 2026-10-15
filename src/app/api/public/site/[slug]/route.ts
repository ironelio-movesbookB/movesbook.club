import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getPublicSite } from '@/lib/club/website/websiteService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const token = request.headers.get('authorization')?.replace('Bearer ', '').trim();
    const decoded = token ? verifyToken(token) : null;
    const viewerId = decoded?.userId ? String(decoded.userId) : null;
    const data = await getPublicSite(slug.toLowerCase(), request.nextUrl.searchParams.get('lang'), viewerId);
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('GET /api/public/site', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
