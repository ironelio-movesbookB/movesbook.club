import { NextRequest } from 'next/server';
import { requireAdmin, getBearerToken, type AdminAuthContext } from '@/lib/adminAuth';
import { verifyToken } from '@/lib/auth';
import { isStaffUserType } from '@/lib/panelAuth';

/** Payment keys: super admin / admin account only, never staff (co-admins, operators). */
export async function requirePaymentSettingsAdmin(request: NextRequest): Promise<AdminAuthContext> {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth;
  const token = getBearerToken(request);
  const decoded = token ? verifyToken(token) : null;
  if (isStaffUserType(decoded?.userType)) {
    return { ok: false, status: 403, error: 'Only the Super Admin can manage payment settings' };
  }
  return auth;
}
