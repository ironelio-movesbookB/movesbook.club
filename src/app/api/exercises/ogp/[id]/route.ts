import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthWithUser } from '../../auth';
import { isClubAccountUserType } from '@/utils/dashboardRouting';

function parseJsonArray(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.filter((x): x is string => typeof x === 'string');
  if (typeof value === 'string') {
    try {
      const a = JSON.parse(value);
      return Array.isArray(a) ? a.filter((x: unknown): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function ensureSharedInMovesbookLibraryColumn(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE exercise_ogp_articles ADD COLUMN sharedInMovesbookLibrary BOOLEAN NOT NULL DEFAULT false'
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/Duplicate column/i.test(msg)) throw e;
  }
}

async function setSharedInMovesbookLibrary(id: string, value: boolean): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE exercise_ogp_articles
      SET sharedInMovesbookLibrary = ${value}
      WHERE id = ${id}
    `;
  } catch (e) {
    await ensureSharedInMovesbookLibraryColumn();
    await prisma.$executeRaw`
      UPDATE exercise_ogp_articles
      SET sharedInMovesbookLibrary = ${value}
      WHERE id = ${id}
    `;
  }
}

/** Only super admin, admin, or the article creator can delete. Admin/super_admin: permanent delete. Creator: soft delete. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthWithUser(request);
  if (auth instanceof NextResponse) return auth;
  const { userId, isAdmin } = auth;
  const { id } = await params;

  try {
    const existing = await prisma.exerciseOgpArticle.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const isCreator = existing.userId === userId;
    const canDelete = isAdmin || isCreator;
    if (!canDelete) {
      return NextResponse.json(
        { error: 'Only super admin, admin, or the article creator can delete OGP articles' },
        { status: 403 }
      );
    }

    if (isAdmin) {
      await prisma.exerciseOgpArticle.delete({ where: { id } });
    } else {
      await prisma.exerciseOgpArticle.update({
        where: { id },
        data: { deletedAt: new Date(), deletedByUserId: userId },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/exercises/ogp/[id]', e);
    return NextResponse.json({ error: 'Failed to delete article' }, { status: 500 });
  }
}

/** Only super admin, admin, or the article creator can update OGP visibility settings. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthWithUser(request);
  if (auth instanceof NextResponse) return auth;
  const { userId, userType, isAdmin } = auth;
  const { id } = await params;

  try {
    const existing = await prisma.exerciseOgpArticle.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const isCreator = existing.userId === userId;
    const canUpdate = isAdmin || isCreator;
    if (!canUpdate) {
      return NextResponse.json(
        { error: 'Only super admin, admin, or the article creator can update OGP settings' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const data: {
      topic?: string;
      typology?: string | null;
      sportEquipment?: string | null;
      customDescription?: string | null;
      visibilityUserTypes?: string;
      visibilityCountries?: string;
      visibilityLanguages?: string;
      visibilitySports?: string;
      expiresAt?: Date | null;
    } = {};

    if (body.topic !== undefined && typeof body.topic === 'string' && body.topic.trim()) {
      data.topic = body.topic.trim();
    }
    if (body.typology !== undefined) {
      data.typology =
        typeof body.typology === 'string' && body.typology.trim() ? body.typology.trim() : null;
    }
    if (body.sportEquipment !== undefined) {
      data.sportEquipment =
        typeof body.sportEquipment === 'string' && body.sportEquipment.trim()
          ? body.sportEquipment.trim()
          : null;
    }
    if (body.customDescription !== undefined) {
      data.customDescription = typeof body.customDescription === 'string'
        ? (body.customDescription.trim() || null)
        : null;
    }
    if (body.visibilityUserTypes !== undefined) {
      data.visibilityUserTypes = JSON.stringify(parseJsonArray(body.visibilityUserTypes));
    }
    if (body.visibilityCountries !== undefined) {
      data.visibilityCountries = JSON.stringify(parseJsonArray(body.visibilityCountries));
    }
    if (body.visibilityLanguages !== undefined) {
      data.visibilityLanguages = JSON.stringify(parseJsonArray(body.visibilityLanguages));
    }
    if (body.visibilitySports !== undefined) {
      data.visibilitySports = JSON.stringify(parseJsonArray(body.visibilitySports));
    }
    if (body.expiresAt !== undefined) {
      data.expiresAt = body.expiresAt != null && body.expiresAt !== ''
        ? new Date(body.expiresAt)
        : null;
    }

    const wantsSharedLibraryUpdate = typeof body.sharedInMovesbookLibrary === 'boolean';
    if (wantsSharedLibraryUpdate) {
      // Club admin/trainer creators (or admins) may share into the Movesbook library.
      if (!isAdmin && !(isCreator && isClubAccountUserType(userType))) {
        return NextResponse.json(
          { error: 'Only the club admin creator can share an OGP exercise in the Movesbook library' },
          { status: 403 }
        );
      }
    }

    if (Object.keys(data).length === 0 && !wantsSharedLibraryUpdate) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    if (Object.keys(data).length > 0) {
      try {
        await prisma.exerciseOgpArticle.update({
          where: { id },
          data,
        });
      } catch (e) {
        // Stale Prisma client may reject unknown sportEquipment — update other fields, then raw-set it.
        const { sportEquipment: sportEquipmentValue, ...rest } = data;
        if (Object.keys(rest).length > 0) {
          await prisma.exerciseOgpArticle.update({ where: { id }, data: rest });
        }
        if (sportEquipmentValue !== undefined) {
          try {
            await prisma.$executeRaw`
              UPDATE exercise_ogp_articles SET sportEquipment = ${sportEquipmentValue} WHERE id = ${id}
            `;
          } catch (rawErr) {
            console.warn('PATCH /api/exercises/ogp/[id]: sportEquipment update failed', rawErr);
            throw e;
          }
        } else {
          throw e;
        }
      }
    }

    if (wantsSharedLibraryUpdate) {
      await setSharedInMovesbookLibrary(id, body.sharedInMovesbookLibrary);
      return NextResponse.json({
        ok: true,
        sharedInMovesbookLibrary: body.sharedInMovesbookLibrary,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('PATCH /api/exercises/ogp/[id]', e);
    return NextResponse.json({ error: 'Failed to update article settings' }, { status: 500 });
  }
}
