import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthForNews } from '../auth';
import { requireCategory } from '../category';

export async function GET(request: NextRequest) {
  const auth = await requireAuthForNews(request);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { searchParams } = new URL(request.url);
  const category = requireCategory(searchParams.get('category'));
  if (category instanceof NextResponse) return category;

  try {
    const list = await prisma.exerciseTypedArticle.findMany({
      where: { userId, category },
      orderBy: { createdAt: 'desc' },
    });
    const articles = list.map((a) => ({
      id: a.id,
      category: a.category,
      description: a.description,
      createdAt: a.createdAt.toISOString(),
    }));
    return NextResponse.json(articles);
  } catch (e) {
    console.error('GET /api/exercises/typed', e);
    return NextResponse.json({ error: 'Failed to load typed articles' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthForNews(request);
  if (auth instanceof NextResponse) return auth;
  const { userId, userType } = auth;

  if ((userType ?? '').toUpperCase() === 'ATHLETE') {
    return NextResponse.json(
      { error: 'Athletes cannot create OGP exercises' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const category = requireCategory(body.category);
    if (category instanceof NextResponse) return category;
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    if (!description) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }
    const created = await prisma.exerciseTypedArticle.create({
      data: { userId, category, description },
    });
    return NextResponse.json({
      id: created.id,
      category: created.category,
      description: created.description,
      createdAt: created.createdAt.toISOString(),
    });
  } catch (e) {
    console.error('POST /api/exercises/typed', e);
    return NextResponse.json({ error: 'Failed to create typed article' }, { status: 500 });
  }
}
