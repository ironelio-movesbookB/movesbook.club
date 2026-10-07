import { NextRequest, NextResponse } from 'next/server';
import {
  addStaffRemuneration,
  listStaffRemunerations,
  parseRemunerationInput,
} from '@/lib/club/clubStaffAdminService';
import { staffAdminAuth, staffAdminErrorResponse } from '@/lib/club/clubStaffAdminApi';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await staffAdminAuth(request);
    if ('error' in auth) return auth.error;
    return NextResponse.json({ items: await listStaffRemunerations(auth.ws, params.id) });
  } catch (error) {
    return staffAdminErrorResponse(error, 'GET /api/club/staff/[id]/remunerations:');
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await staffAdminAuth(request);
    if ('error' in auth) return auth.error;
    const body = await request.json().catch(() => ({}));
    const id = await addStaffRemuneration(auth.ws, params.id, parseRemunerationInput(body));
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return staffAdminErrorResponse(error, 'POST /api/club/staff/[id]/remunerations:');
  }
}
