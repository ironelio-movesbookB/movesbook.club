import { verifySuperAdminPassword } from '@/lib/messages/verifySuperAdminPassword';
import { isHardwareProductSector } from './sectors';

export function isHardwareSector(value: string | null | undefined) {
  return isHardwareProductSector(value);
}

export async function verifyHardwareSuperAdminPassword(password: unknown) {
  const value = typeof password === 'string' ? password.trim() : '';
  if (!value) return false;
  const configured = process.env.SUPER_ADMIN_PASSWORD?.trim();
  // Do not accept the hardcoded admin123 default when the env password is unset.
  if (!configured && value.toLowerCase() === 'admin123') return false;
  if (await verifySuperAdminPassword(value)) return true;
  return Boolean(configured) && value === configured;
}

export async function assertHardwareSuperAdminPassword(password: unknown) {
  if (!(await verifyHardwareSuperAdminPassword(password))) {
    throw new Error('Enter the Super Admin password to change hardware products.');
  }
}
