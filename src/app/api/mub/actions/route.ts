import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/auth';
import { prisma, prismaConnect } from '@/lib/prisma';
import {
  importStaffMubTemplate,
  removeImportedMubButtons,
  resetMubPage,
  resolveImportRoleTemplate,
} from '@/lib/mub/mubService';
import {
  getMubTokenUserId,
  parseMubPageRequest,
  resolveMubPageQuery,
} from '@/lib/mub/mubApiHelpers';

export const dynamic = 'force-dynamic';

async function requirePersonalPassword(userId: string, password: string | undefined) {
  if (!password?.trim()) {
    return { ok: false as const, status: 400, error: 'Personal password is required' };
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  });
  if (!user?.password) {
    return { ok: false as const, status: 404, error: 'User not found' };
  }
  const valid = await verifyPassword(password.trim(), user.password);
  if (!valid) {
    return { ok: false as const, status: 403, error: 'Invalid password' };
  }
  return { ok: true as const };
}

export async function POST(request: NextRequest) {
  try {
    const userId = getMubTokenUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prismaConnect();
    const parsed = parseMubPageRequest(request);
    const resolved = await resolveMubPageQuery(parsed, userId, 'write');
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const query = resolved.query;

    const body = (await request.json()) as {
      action?: string;
      password?: string;
    };

    switch (body.action) {
      case 'reset': {
        // Client answer #4 — requires personal user password; removes ALL buttons.
        const auth = await requirePersonalPassword(userId, body.password);
        if (!auth.ok) {
          return NextResponse.json({ error: auth.error }, { status: auth.status });
        }
        const page = await resetMubPage(query, parsed.lang);
        return NextResponse.json({ page });
      }
      case 'remove_default': {
        // Client answer #4 — requires personal user password; removes only imported buttons.
        const auth = await requirePersonalPassword(userId, body.password);
        if (!auth.ok) {
          return NextResponse.json({ error: auth.error }, { status: auth.status });
        }
        const page = await removeImportedMubButtons(query, parsed.lang);
        return NextResponse.json({ page });
      }
      case 'import': {
        // Client answer #3 — template chosen from the account's stored userType,
        // never from the request body; language filtered in the service.
        const roleTemplate = await resolveImportRoleTemplate(userId);
        const result = await importStaffMubTemplate(query, roleTemplate, parsed.lang);
        return NextResponse.json({
          page: result.page,
          importedCount: result.importedCount,
          roleTemplate,
        });
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('POST /api/mub/actions failed:', error);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}
