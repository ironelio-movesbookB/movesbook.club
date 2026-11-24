import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { getServerPublicDir } from '@/lib/serverPublicDir';
import { faqAdminGuard, faqServerError } from '@/lib/faqs/faqApiAuth';

export const dynamic = 'force-dynamic';

const MAX_SIZE = 5 * 1024 * 1024;
const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

/** FAQ icon upload → /uploads/faqs/<file> (served through /api/media/uploads/faqs/...). */
export async function POST(request: NextRequest) {
  const denied = await faqAdminGuard(request);
  if (denied) return denied;
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }
    const ext = EXT_BY_TYPE[file.type];
    if (!ext) {
      return NextResponse.json(
        { success: false, error: 'Only JPEG, PNG, GIF or WebP images are allowed' },
        { status: 400 },
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: 'File size exceeds 5MB limit' }, { status: 400 });
    }
    const dir = join(getServerPublicDir(), 'uploads', 'faqs');
    await mkdir(dir, { recursive: true });
    const name = `faq_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`;
    await writeFile(join(dir, name), Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ success: true, path: `/uploads/faqs/${name}` });
  } catch (error) {
    return faqServerError('icon upload', error);
  }
}
