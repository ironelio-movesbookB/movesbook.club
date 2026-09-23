import { NextRequest, NextResponse } from 'next/server';
import { requireMessageAuth } from '@/lib/messages/messageAuth';
import {
  bulkDeleteSupportThreadsByDate,
  createThreadWithFirstMessage,
  countUserSupportThreads,
  listSupportFeed,
  listThreadsForUser,
  type SupportCategory,
  type ThreadListSort,
} from '@/lib/messages/userThreads';

export const dynamic = 'force-dynamic';

const CATEGORIES: SupportCategory[] = ['feedback', 'question', 'suggestion', 'problem'];

function parseCategory(raw: string | null): SupportCategory | '' {
  if (!raw) return '';
  return CATEGORIES.includes(raw as SupportCategory) ? (raw as SupportCategory) : '';
}

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

export async function GET(request: NextRequest) {
  const auth = await requireMessageAuth(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const feed = searchParams.get('feed') === '1';

  try {
    if (searchParams.get('countOnly') === '1' && searchParams.get('mine') === '1') {
      const count = await countUserSupportThreads(auth.userId);
      return NextResponse.json({ count });
    }

    if (feed) {
      const inappropriate = parseInappropriateFlags(searchParams);
      const result = await listSupportFeed(auth.userId, {
        category: parseCategory(searchParams.get('category')),
        languageCode: searchParams.get('lang') || '',
        mineOnly: searchParams.get('mine') === '1',
        recentOnly: searchParams.get('recent') === '1',
        currentPageOnly: searchParams.get('currentPage') === '1',
        currentPath: searchParams.get('path') || '',
        bugsOnly: searchParams.get('bugs') === '1',
        excludeBugs: searchParams.get('excludeBugs') === '1',
        searchQuery: searchParams.get('q') || '',
        status: searchParams.get('status') || '',
        fromDate: searchParams.get('from') || '',
        toDate: searchParams.get('to') || '',
        sort: parseSort(searchParams.get('sort')),
        ...inappropriate,
        page: Number(searchParams.get('page') || '1'),
        pageSize: Number(searchParams.get('pageSize') || '5'),
      });
      if (searchParams.get('countOnly') === '1') {
        return NextResponse.json({ count: result.total });
      }
      return NextResponse.json(result);
    }

    const items = await listThreadsForUser(auth.userId, 'SUPPORT');
    return NextResponse.json({ items });
  } catch (e) {
    console.error('GET /api/messages/support', e);
    return NextResponse.json({ error: 'Failed to load support' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireMessageAuth(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const text = typeof body?.body === 'string' ? body.body.trim() : '';
    if (!text) return NextResponse.json({ error: 'Message body required' }, { status: 400 });

    const category = parseCategory(body?.supportCategory ?? 'feedback') || 'feedback';
    const imageUrls = Array.isArray(body?.imageUrls) ? body.imageUrls : [];

    const thread = await createThreadWithFirstMessage({
      userId: auth.userId,
      kind: 'SUPPORT',
      subject: typeof body?.subject === 'string' ? body.subject : '',
      body: text,
      languageCode: typeof body?.languageCode === 'string' ? body.languageCode : undefined,
      pathStaff: typeof body?.pathStaff === 'string' ? body.pathStaff : undefined,
      realPath: typeof body?.realPath === 'string' ? body.realPath : undefined,
      errorMessage: typeof body?.errorMessage === 'string' ? body.errorMessage : undefined,
      supportCategory: category,
      imageUrls,
    });

    return NextResponse.json({ id: thread.id });
  } catch (e) {
    console.error('POST /api/messages/support', e);
    return NextResponse.json({ error: 'Failed to create support thread' }, { status: 500 });
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
    const deleted = await bulkDeleteSupportThreadsByDate({
      fromDate: from,
      toDate: to,
      category: parseCategory(searchParams.get('category')),
      bugsOnly: searchParams.get('bugs') === '1',
      excludeBugs: searchParams.get('excludeBugs') === '1',
    });
    return NextResponse.json({ deleted });
  } catch (e) {
    console.error('DELETE /api/messages/support', e);
    return NextResponse.json({ error: 'Failed to bulk delete' }, { status: 500 });
  }
}
