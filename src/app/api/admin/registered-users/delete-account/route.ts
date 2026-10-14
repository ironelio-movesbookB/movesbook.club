import { NextRequest, NextResponse } from 'next/server';
import { UserType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { verifyAdminActionPassword } from '@/lib/admin/verifyAdminActionPassword';
import { deleteRegisteredUserAccount } from '@/lib/admin/deleteRegisteredUserAccount';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DELETABLE_TYPES: UserType[] = [
  UserType.ATHLETE,
  UserType.COACH,
  UserType.GROUP,
  UserType.GROUP_ADMIN,
  UserType.TEAM,
  UserType.TEAM_MANAGER,
  UserType.CLUB,
  UserType.CLUB_TRAINER,
];

/** POST — Permanently delete user accounts (requires super admin password). */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { userIds?: unknown; superAdminPassword?: unknown; adminUsername?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const superAdminPassword = String(body.superAdminPassword ?? '').trim();
  if (!superAdminPassword) {
    return NextResponse.json({ error: 'Super admin password is required' }, { status: 400 });
  }
  const adminUsername = String(body.adminUsername ?? '').trim();
  const passwordOk = await verifyAdminActionPassword(
    superAdminPassword,
    auth,
    adminUsername || undefined,
  );
  if (!passwordOk) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const requested = Array.isArray(body.userIds)
    ? Array.from(new Set(body.userIds.map((id) => String(id).trim()).filter(Boolean)))
    : [];
  if (requested.length === 0) {
    return NextResponse.json({ error: 'No users selected' }, { status: 400 });
  }

  const users = await prisma.user.findMany({
    where: { id: { in: requested }, userType: { in: DELETABLE_TYPES } },
    select: { id: true },
  });
  if (users.length === 0) {
    return NextResponse.json({ error: 'No matching users found' }, { status: 404 });
  }

  const results = [];
  for (const user of users) {
    results.push(await deleteRegisteredUserAccount(user.id));
  }
  const failed = results.filter((r) => !r.ok);

  return NextResponse.json({
    deleted: results.length - failed.length,
    failed,
  });
}
