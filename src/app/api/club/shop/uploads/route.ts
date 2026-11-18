import { randomBytes } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { requireShopManager } from '@/lib/shop/auth';
import { getServerPublicDir } from '@/lib/serverPublicDir';
import { toMediaApiPath } from '@/lib/uploadMediaUrl';

const TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export async function POST(request: NextRequest) {
  const auth = await requireShopManager(request);
  if ('error' in auth) return auth.error;

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Choose an image.' }, { status: 400 });
  }
  const ext = TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ error: 'Choose a JPG, PNG, WEBP or GIF image.' }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'The image must be no larger than 5 MB.' }, { status: 400 });
  }

  const fileName = `${Date.now()}-${randomBytes(6).toString('hex')}.${ext}`;
  const uploadDir = join(getServerPublicDir(), 'uploads', 'shop');
  await mkdir(uploadDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(uploadDir, fileName), buffer);
  const publicPath = `/uploads/shop/${fileName}`;
  return NextResponse.json({ imageUrl: toMediaApiPath(publicPath) ?? publicPath });
}
