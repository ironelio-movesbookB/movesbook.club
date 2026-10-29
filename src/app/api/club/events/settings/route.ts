import { NextRequest, NextResponse } from 'next/server';
import { eventErrorResponse, resolveEventWorkspace } from '@/lib/club/events/eventApi';
import {
  addDiscountRule,
  deleteDiscountRule,
  getEventSettings,
  saveEventSettings,
} from '@/lib/club/events/eventService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await resolveEventWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    return NextResponse.json(await getEventSettings(auth.ws));
  } catch (error) {
    return eventErrorResponse(error, 'GET /api/club/events/settings');
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await resolveEventWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    const body = await request.json().catch(() => ({}));
    if (body?.action === 'add-rule') {
      const discountRules = await addDiscountRule(auth.ws, body.minSubevents, body.discountPercent);
      return NextResponse.json({ discountRules });
    }
    if (body?.action === 'delete-rule') {
      const discountRules = await deleteDiscountRule(auth.ws, String(body.id || ''));
      return NextResponse.json({ discountRules });
    }
    const settings = await saveEventSettings(auth.ws, body?.settings ?? body ?? {});
    return NextResponse.json({ settings });
  } catch (error) {
    return eventErrorResponse(error, 'PATCH /api/club/events/settings');
  }
}
