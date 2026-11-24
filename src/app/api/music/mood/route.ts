import { NextRequest, NextResponse } from 'next/server';
import { requireAuthForNews } from '../auth';
import { listMoodMusic, updateMoodMusicOrder } from '@/lib/music/moodMusicStore';

/** GET — list mood music rows (legacy clubs/mood_music). */
export async function GET(request: NextRequest) {
  const auth = await requireAuthForNews(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const items = await listMoodMusic();
    return NextResponse.json({ items });
  } catch (e) {
    console.error('GET /api/music/mood', e);
    return NextResponse.json({ error: 'Failed to load mood music' }, { status: 500 });
  }
}

/** PUT — persist drag order. Body: { order: number[] } (ids top → bottom). */
export async function PUT(request: NextRequest) {
  const auth = await requireAuthForNews(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => null);
    const order = Array.isArray(body?.order) ? body.order : null;
    if (!order) {
      return NextResponse.json({ error: 'order array is required' }, { status: 400 });
    }
    const ids = order
      .map((v: unknown) => Number(v))
      .filter((n: number) => Number.isInteger(n) && n > 0);
    await updateMoodMusicOrder(ids);
    const items = await listMoodMusic();
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    console.error('PUT /api/music/mood', e);
    return NextResponse.json({ error: 'Failed to update mood music order' }, { status: 500 });
  }
}
