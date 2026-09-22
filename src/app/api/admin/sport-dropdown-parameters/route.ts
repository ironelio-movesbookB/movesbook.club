import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdminAccess } from '@/lib/adminPanelAuth';
import {
  emptySportDropdownCatalog,
  normalizeSportDropdownCatalog,
  SPORT_DROPDOWN_TOOLS_DEFAULTS_LANG,
  type SportDropdownCatalog,
} from '@/lib/sport/sportDropdownParameters';

export const dynamic = 'force-dynamic';

function parseToolsDefaultsData(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * GET — global Teams parameter catalog (readable by clubs later).
 * Stored in tools_defaults under a dedicated language key (not per UI language).
 */
export async function GET() {
  try {
    const row = await prisma.toolsDefaults.findUnique({
      where: { language: SPORT_DROPDOWN_TOOLS_DEFAULTS_LANG },
    });
    const data = parseToolsDefaultsData(row?.data);
    const catalog = normalizeSportDropdownCatalog(
      data.sportDropdownParameters ?? data,
    );
    return NextResponse.json({ success: true, catalog });
  } catch (e) {
    console.error('sport-dropdown-parameters GET:', e);
    return NextResponse.json(
      { success: false, error: 'Failed to load catalog', catalog: emptySportDropdownCatalog() },
      { status: 500 },
    );
  }
}

/**
 * PUT — Super Admin only. Replaces the global sport dropdown catalog.
 */
export async function PUT(request: NextRequest) {
  const auth = await requireSuperAdminAccess(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const catalog: SportDropdownCatalog = normalizeSportDropdownCatalog(
      body?.catalog ?? body?.sportDropdownParameters ?? body,
    );

    const payload = JSON.stringify({
      version: 1,
      sportDropdownParameters: catalog,
    });

    await prisma.toolsDefaults.upsert({
      where: { language: SPORT_DROPDOWN_TOOLS_DEFAULTS_LANG },
      update: { data: payload, updatedAt: new Date() },
      create: {
        language: SPORT_DROPDOWN_TOOLS_DEFAULTS_LANG,
        data: payload,
      },
    });

    return NextResponse.json({ success: true, catalog });
  } catch (e) {
    console.error('sport-dropdown-parameters PUT:', e);
    return NextResponse.json(
      { success: false, error: 'Failed to save catalog' },
      { status: 500 },
    );
  }
}
