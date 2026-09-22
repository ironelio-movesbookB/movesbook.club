import { NextRequest, NextResponse } from 'next/server';
import { requireMessageAuth } from '@/lib/messages/messageAuth';
import {
  bulkDeleteReviewThreadsByDate,
  createThreadWithFirstMessage,
  listAllReviews,
  type ThreadListSort,
} from '@/lib/messages/userThreads';

const SORT_VALUES: ThreadListSort[] = ['date_asc', 'date_desc', 'like', 'dislike'];

function parseSort(raw: string | null): ThreadListSort | '' {
  if (!raw) return '';
  return SORT_VALUES.includes(raw as ThreadListSort) ? (raw as ThreadListSort) : '';
}

function parseInappropriateFlags(searchParams: URLSearchParams) {
  const raw = searchParams.get('inappropriate');
  if (raw === '1') return { inappropriateOnly: true, excludeInappropriate: false };
  if (raw === '0') return { inappropriateOnly: false, excludeInappropriate: true };
  return { inappropriateOnly: false, excludeInappropriate: false };
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireMessageAuth(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);

  try {
    const community = searchParams.get('community') === '1';
    const mine = searchParams.get('mine') === '1';
    const adminAll = auth.isStaff && searchParams.get('admin') === '1';
    const inappropriate = parseInappropriateFlags(searchParams);
    const result = await listAllReviews({
      searchQuery: searchParams.get('q') || '',
      page: Number(searchParams.get('page') || '1'),
      pageSize: Number(searchParams.get('pageSize') || '5'),
      userId: mine
        ? auth.userId
        : community || adminAll
          ? undefined
          : auth.userId,
      viewerId: auth.userId,
      fromDate: searchParams.get('from') || '',
      toDate: searchParams.get('to') || '',
      languageCode: searchParams.get('lang') || '',
      recentOnly: searchParams.get('recent') === '1',
      currentPageOnly: searchParams.get('currentPage') === '1',
      currentPath: searchParams.get('path') || '',
      sort: parseSort(searchParams.get('sort')),
      ...inappropriate,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error('GET /api/messages/reviews', e);
    return NextResponse.json({ error: 'Failed to load reviews' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireMessageAuth(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const text = typeof body?.body === 'string' ? body.body.trim() : '';
    if (!text) return NextResponse.json({ error: 'Message body required' }, { status: 400 });

    const thread = await createThreadWithFirstMessage({
      userId: auth.userId,
      kind: 'REVIEW',
      subject: typeof body?.subject === 'string' ? body.subject : '',
      body: text,
      languageCode: typeof body?.languageCode === 'string' ? body.languageCode : undefined,
      pathStaff: typeof body?.pathStaff === 'string' ? body.pathStaff : undefined,
      realPath: typeof body?.realPath === 'string' ? body.realPath : undefined,
    });

    return NextResponse.json({ id: thread.id });
  } catch (e) {
    console.error('POST /api/messages/reviews', e);
    return NextResponse.json({ error: 'Failed to create review' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireMessageAuth(request);
  if (!auth?.isStaff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  if (!from.trim() || !to.trim()) {
    return NextResponse.json({ error: 'from and to dates required' }, { status: 400 });
  }

  try {
    const deleted = await bulkDeleteReviewThreadsByDate({ fromDate: from, toDate: to });
    return NextResponse.json({ deleted });
  } catch (e) {
    console.error('DELETE /api/messages/reviews', e);
    return NextResponse.json({ error: 'Failed to bulk delete' }, { status: 500 });
  }
}
