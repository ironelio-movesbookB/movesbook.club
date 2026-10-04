import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { buildCostRecoveryReal } from '@/lib/admin/buildStatistics';
import { loadCostRecoveryPlans, saveCostRecoveryPlan } from '@/lib/admin/costRecoveryPlanStore';
import { isCostRecoveryVersion, type CostRecoveryPayload } from '@/lib/admin/costRecoveryTypes';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const [real, plans] = await Promise.all([buildCostRecoveryReal(), loadCostRecoveryPlans()]);
    const payload: CostRecoveryPayload = { real, plans };
    return NextResponse.json(payload);
  } catch (err) {
    console.error('cost recovery load failed', err);
    return NextResponse.json({ error: 'Failed to load the cost recovery plan' }, { status: 500 });
  }
}

/** Body: { version: 'base' | 'premium' | 'professional', plan: { costs, planN } } */
export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = (await request.json().catch(() => null)) as { version?: unknown; plan?: unknown } | null;
  if (!body || !isCostRecoveryVersion(body.version)) {
    return NextResponse.json({ error: 'Invalid version' }, { status: 400 });
  }
  try {
    const plan = await saveCostRecoveryPlan(body.version, body.plan);
    return NextResponse.json({ version: body.version, plan });
  } catch (err) {
    console.error('cost recovery save failed', err);
    return NextResponse.json({ error: 'Failed to save the cost recovery plan' }, { status: 500 });
  }
}
