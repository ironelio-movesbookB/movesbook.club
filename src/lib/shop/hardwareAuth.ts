import { verifySuperAdminPassword } from '@/lib/messages/verifySuperAdminPassword';
import { shopSector } from './sectors';

export function isHardwareSector(value: string | null | undefined) {
  return shopSector(value) === 'Hardware';
}

export async function verifyHardwareSuperAdminPassword(password: unknown) {
  const value = typeof password === 'string' ? password.trim() : '';
  if (!value) return false;
  if (await verifySuperAdminPassword(value)) return true;
  const fallback = (process.env.SUPER_ADMIN_PASSWORD || 'admin123').trim();
  return value.toLowerCase() === fallback.toLowerCase();
}

export async function assertHardwareSuperAdminPassword(password: unknown) {
  if (!(await verifyHardwareSuperAdminPassword(password))) {
    throw new Error('Enter the Super Admin password to change hardware products.');
  }
}
