import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { verifyToken } from '@/lib/auth';
import { getServerPublicDir } from '@/lib/serverPublicDir';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const decoded = token ? verifyToken(token) : null;
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File size exceeds 5MB limit' }, { status: 400 });
    }

    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only images are allowed' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const extFromName = file.name.split('.').pop()?.toLowerCase();
    const ext =
      extFromName && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extFromName)
        ? extFromName === 'jpeg'
          ? 'jpg'
          : extFromName
        : 'jpg';

    const fileName = `mub_${decoded.userId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const uploadDir = join(getServerPublicDir(), 'uploads', 'mub_icons');
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    await writeFile(join(uploadDir, fileName), buffer);
    const publicPath = `/uploads/mub_icons/${fileName}`;

    return NextResponse.json({ success: true, path: publicPath, fileName: file.name });
  } catch (error) {
    console.error('POST /api/mub/icon-upload failed:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
