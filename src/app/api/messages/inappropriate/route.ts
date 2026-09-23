import { NextRequest, NextResponse } from 'next/server';
import { requireMessageAuth } from '@/lib/messages/messageAuth';
import { listInappropriateFeed, type ThreadListSort } from '@/lib/messages/userThreads';

export const dynamic = 'force-dynamic';

const SORT_VALUES: ThreadListSort[] = ['date_asc', 'date_desc', 'like', 'dislike'];

function parseSort(raw: string | null): ThreadListSort | '' {
  if (!raw) return '';
  return SORT_VALUES.includes(raw as ThreadListSort) ? (raw as ThreadListSort) : '';
}

export async function GET(request: NextRequest) {
  const auth = await requireMessageAuth(request);
  if (!auth?.isStaff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);

  try {
    const result = await listInappropriateFeed({
      searchQuery: searchParams.get('q') || '',
      page: Number(searchParams.get('page') || '1'),
      pageSize: Number(searchParams.get('pageSize') || '50'),
      languageCode: searchParams.get('lang') || '',
      fromDate: searchParams.get('from') || '',
      toDate: searchParams.get('to') || '',
      recentOnly: searchParams.get('recent') === '1',
      sort: parseSort(searchParams.get('sort')),
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error('GET /api/messages/inappropriate', e);
    return NextResponse.json({ error: 'Failed to load inappropriate feed' }, { status: 500 });
  }
}
