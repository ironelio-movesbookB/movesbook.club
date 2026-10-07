import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { requireAdmin } from '@/lib/adminAuth';
import { getServerPublicDir, verifyPublicFile } from '@/lib/serverPublicDir';
import { toMediaApiPath } from '@/lib/uploadMediaUrl';

export const dynamic = 'force-dynamic';

const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    const ext = ALLOWED[file.type];
    if (!ext) return NextResponse.json({ error: 'Only images are allowed' }, { status: 400 });
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'The logo must be smaller than 2MB' }, { status: 400 });
    }

    const uploadDir = join(getServerPublicDir(), 'uploads', 'special-offers');
    if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true });

    const fileName = `offer_${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const filePath = join(uploadDir, fileName);
    await writeFile(filePath, Buffer.from(await file.arrayBuffer()));
    if (!(await verifyPublicFile(filePath))) {
      return NextResponse.json({ error: 'Upload saved but file verification failed' }, { status: 500 });
    }

    const publicPath = `/uploads/special-offers/${fileName}`;
    return NextResponse.json({ path: toMediaApiPath(publicPath) ?? publicPath });
  } catch (e) {
    console.error('POST special offer logo', e);
    return NextResponse.json({ error: 'Failed to upload the logo' }, { status: 500 });
  }
}
