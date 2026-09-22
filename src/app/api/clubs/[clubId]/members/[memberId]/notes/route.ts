import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import {
  createMemberNote,
  deleteMemberNotes,
  getClubMemberVisibility,
  getMemberNoteById,
} from '@/lib/club/memberProfileService';
import { normalizeSupportImageUrls } from '@/lib/messages/supportImages';

export const dynamic = 'force-dynamic';

function getUserId(request: NextRequest): string | null {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded?.userId ?? null;
}

async function assertAccess(clubId: string, memberId: string, viewerUserId: string) {
  const club = await prisma.club.findUnique({
    where: { id: clubId },
    select: { adminId: true },
  });
  if (!club) return { error: 'Club not found', status: 404 as const };
  const membership = await prisma.clubMember.findUnique({
    where: { clubId_memberId: { clubId, memberId } },
    select: { id: true },
  });
  if (!membership) return { error: 'Member not found', status: 404 as const };
  const isAdmin = club.adminId === viewerUserId;
  const isSelf = memberId === viewerUserId;
  if (!isAdmin && !isSelf) return { error: 'Access denied', status: 403 as const };
  return { membership, isAdmin, isSelf };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { clubId: string; memberId: string } },
) {
  const viewerUserId = getUserId(request);
  if (!viewerUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await assertAccess(params.clubId, params.memberId, viewerUserId);
  if ('error' in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = await request.json().catch(() => ({}));
  const kind = String(body.kind || '').trim();
  const title = String(body.title || '').trim();
  const noteBody = String(body.body || '').trim();
  const parentId = body.parentId ? String(body.parentId) : null;
  const imageUrls = normalizeSupportImageUrls(body.imageUrls);

  if (!noteBody) {
    return NextResponse.json({ error: 'Message body is required' }, { status: 400 });
  }

  if (parentId) {
    const parent = await getMemberNoteById(access.membership.id, parentId);
    if (!parent) {
      return NextResponse.json({ error: 'Parent note not found' }, { status: 404 });
    }
    if (parent.parentId) {
      return NextResponse.json({ error: 'Replies must target a root reflection' }, { status: 400 });
    }

    const noteKind = parent.kind === 'coach' ? 'coach' : 'staff';

    if (!access.isAdmin) {
      const visibility = await getClubMemberVisibility(access.membership.id);

      if (noteKind === 'coach') {
        if (!visibility.notesCoach) {
          return NextResponse.json({ error: 'Coach reflections are not visible to the member' }, { status: 403 });
        }
        if (!visibility.notesCoachComments) {
          return NextResponse.json({ error: 'Comments are not enabled for the member' }, { status: 403 });
        }
        if (!parent.visibleToMember) {
          return NextResponse.json({ error: 'This reflection is not visible to the member' }, { status: 403 });
        }
        if (!parent.commentsEnabled) {
          return NextResponse.json({ error: 'Comments are disabled for this reflection' }, { status: 403 });
        }
      } else if (noteKind === 'staff') {
        // Member info → Messages → Comments: UI allows reply when messagesStaff is on.
        if (!visibility.messagesStaff) {
          return NextResponse.json({ error: 'Staff messages are not visible to the member' }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: 'Members may only reply to staff or coach notes' }, { status: 403 });
      }
    }

    const note = await createMemberNote({
      clubMemberId: access.membership.id,
      kind: noteKind,
      title: '',
      body: noteBody,
      authorId: viewerUserId,
      parentId,
      visibleToMember: true,
    });
    return NextResponse.json({ success: true, note });
  }

  if (!access.isAdmin) {
    return NextResponse.json({ error: 'Only club admin can post root notes' }, { status: 403 });
  }
  if (kind !== 'staff' && kind !== 'coach') {
    return NextResponse.json({ error: 'kind must be staff or coach' }, { status: 400 });
  }

function parseDateOnly(value: unknown): Date | null {
  const raw = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

  const note = await createMemberNote({
    clubMemberId: access.membership.id,
    kind,
    title,
    body: noteBody,
    authorId: viewerUserId,
    visibleToMember: Boolean(body.visibleToMember),
    commentsEnabled: Boolean(body.commentsEnabled),
    imageUrls,
    enableFrom: parseDateOnly(body.enableFrom),
    enableTo: parseDateOnly(body.enableTo),
    showAtLogin: Boolean(body.showAtLogin),
    showAtLogout: Boolean(body.showAtLogout),
  });

  return NextResponse.json({ success: true, note });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { clubId: string; memberId: string } },
) {
  const viewerUserId = getUserId(request);
  if (!viewerUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await assertAccess(params.clubId, params.memberId, viewerUserId);
  if ('error' in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  if (!access.isAdmin) {
    return NextResponse.json({ error: 'Only club admin can delete notes' }, { status: 403 });
  }

  const url = new URL(request.url);
  const noteId = url.searchParams.get('noteId') || undefined;
  const resetKind = url.searchParams.get('resetKind') || undefined;

  await deleteMemberNotes({
    clubMemberId: access.membership.id,
    noteId,
    resetKind,
  });

  return NextResponse.json({ success: true });
}
