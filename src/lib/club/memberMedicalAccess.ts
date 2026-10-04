import { copyFile, mkdir } from 'fs/promises';
import { basename, join } from 'path';
import { prisma } from '@/lib/prisma';
import { getServerPublicDir, verifyPublicFile } from '@/lib/serverPublicDir';
import { toMediaApiPath } from '@/lib/uploadMediaUrl';

/** Upload folder holding member medical image / PDF / ECG: `uploads/member-medical/{memberUserId}/…`. */
export const MEMBER_MEDICAL_FOLDER = 'member-medical';

/**
 * Who may open a member's medical files: the member, a super admin, or the admin of a
 * club / team the member belongs to (same rule as editing the member profile).
 */
export async function canViewMemberMedical(opts: {
  viewerUserId: string;
  viewerUserType?: string | null;
  memberUserId: string;
}): Promise<boolean> {
  const { viewerUserId, viewerUserType, memberUserId } = opts;
  if (!viewerUserId || !memberUserId) return false;
  if (viewerUserId === memberUserId) return true;
  if (viewerUserType === 'ADMIN') return true;

  const clubMembership = await prisma.clubMember.findFirst({
    where: { memberId: memberUserId, club: { adminId: viewerUserId } },
    select: { id: true },
  });
  if (clubMembership) return true;

  const teamMembership = await prisma.teamMember.findFirst({
    where: { athleteId: memberUserId, team: { adminId: viewerUserId } },
    select: { id: true },
  });
  return Boolean(teamMembership);
}

/**
 * Medical files are readable only by their owner (and admins), so a duplicated profile must
 * get its own copy in the target member's folder instead of a link into the source folder.
 * Returns the new URL, or the original one when it is not a medical file of the source member.
 */
export async function copyMemberMedicalFile(
  url: string,
  sourceMemberUserId: string,
  targetMemberUserId: string,
): Promise<string> {
  const apiPath = toMediaApiPath(url);
  if (!apiPath) return url;
  const prefix = `/api/media/uploads/${MEMBER_MEDICAL_FOLDER}/${sourceMemberUserId}/`;
  if (!apiPath.startsWith(prefix)) return url;
  const fileName = basename(apiPath.slice(prefix.length));
  if (!fileName || fileName.includes('..')) return url;

  const root = join(getServerPublicDir(), 'uploads', MEMBER_MEDICAL_FOLDER);
  const sourcePath = join(root, sourceMemberUserId, fileName);
  if (!(await verifyPublicFile(sourcePath))) return '';

  const targetDir = join(root, targetMemberUserId);
  await mkdir(targetDir, { recursive: true });
  const newName = `copy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${fileName}`;
  await copyFile(sourcePath, join(targetDir, newName));
  return `/api/media/uploads/${MEMBER_MEDICAL_FOLDER}/${targetMemberUserId}/${newName}`;
}
