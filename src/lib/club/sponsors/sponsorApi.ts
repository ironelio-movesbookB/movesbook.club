import { NextRequest, NextResponse } from 'next/server';
import { getClubAuthContext } from '@/lib/procedures/clubAuth';
import { SponsorError, type SponsorWorkspace } from '@/lib/club/sponsors/sponsorService';

/** Club / team owner of the selected workspace (`?clubId=`). */
export async function resolveSponsorWorkspace(
  request: NextRequest,
): Promise<{ ws: SponsorWorkspace } | { error: NextResponse }> {
  const auth = await getClubAuthContext(request);
  if ('error' in auth) return { error: auth.error };
  const { ctx } = auth;
  if (ctx.workspaceKind !== 'club' && ctx.workspaceKind !== 'team') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ws: { kind: ctx.workspaceKind, id: ctx.club.id } };
}

export function sponsorErrorResponse(error: unknown, label: string): NextResponse {
  if (error instanceof SponsorError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(label, error);
  return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
}

export async function readUploadedFile(
  request: NextRequest,
): Promise<{ form: FormData; file: Blob | null; fileName: string }> {
  const form = await request.formData();
  const value = form.get('file');
  if (value && typeof value === 'object' && 'arrayBuffer' in value) {
    const fileName = 'name' in value && typeof value.name === 'string' ? value.name : '';
    return { form, file: value as Blob, fileName };
  }
  return { form, file: null, fileName: '' };
}
