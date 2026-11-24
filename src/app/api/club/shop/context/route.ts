import { NextRequest, NextResponse } from 'next/server';
import { getShopAccess } from '@/lib/shop/auth';
import { ensureShopSettings } from '@/lib/shop/service';

export async function GET(request: NextRequest) {
  const auth = await getShopAccess(request);
  if ('error' in auth) return auth.error;
  const workspace = auth.access.workspace;
  let publicPath: string | null = null;
  if (workspace) {
    const settings = await ensureShopSettings(workspace);
    publicPath = `/our-shop/shop/${settings.slug}`;
  }
  return NextResponse.json({
    canManage: Boolean(workspace?.canManage),
    role: workspace?.canManage ? 'manager' : auth.access.memberShops.length ? 'member' : 'customer',
    userType: auth.access.userType,
    workspace: workspace
      ? {
          kind: workspace.kind,
          id: workspace.id,
          name: workspace.name,
          publicPath,
        }
      : null,
    memberShops: auth.access.memberShops,
  });
}
