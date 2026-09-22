import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import {
  removeEntityLogoForOwner,
  saveEntityLogoForOwner,
} from '@/lib/entity/saveEntityLogoFile';
import type { ManagedEntityLogoKind } from '@/lib/entity/entityLogo';

export async function handleEntityLogoPost(
  request: NextRequest,
  kind: ManagedEntityLogoKind,
  entityId: string,
): Promise<NextResponse> {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const decoded = verifyToken(token);
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    const assetRaw = String(formData.get('asset') ?? 'logo').trim().toLowerCase();
    const asset = assetRaw === 'banner' ? 'banner' : 'logo';

    const result = await saveEntityLogoForOwner(
      kind,
      entityId,
      decoded.userId as string,
      file as File,
      asset,
    );
    if (asset === 'banner') {
      return NextResponse.json({
        success: true,
        bannerUrl: result.bannerUrl ?? result.logoUrl,
        logoUrl: result.logoUrl,
      });
    }
    return NextResponse.json({
      success: true,
      logoUrl: result.logoUrl,
      bannerUrl: result.bannerUrl,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal server error';
    const status =
      message.includes('not found') || message.includes('access denied')
        ? 404
        : message.includes('limit') || message.includes('Invalid file')
          ? 400
          : 500;
    if (status === 500) console.error(`POST entity logo (${kind}):`, e);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function handleEntityLogoDelete(
  request: NextRequest,
  kind: ManagedEntityLogoKind,
  entityId: string,
): Promise<NextResponse> {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const decoded = verifyToken(token);
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const assetRaw = request.nextUrl.searchParams.get('asset')?.trim().toLowerCase();
    const asset = assetRaw === 'banner' ? 'banner' : 'logo';
    await removeEntityLogoForOwner(kind, entityId, decoded.userId as string, asset);
    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal server error';
    const status =
      message.includes('not found') || message.includes('access denied') ? 404 : 500;
    if (status === 500) console.error(`DELETE entity logo (${kind}):`, e);
    return NextResponse.json({ error: message }, { status });
  }
}
