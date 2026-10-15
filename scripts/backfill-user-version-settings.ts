/**
 * Give each existing user (users_new) a PCU copy of the version they purchased
 * (user_version_settings), using the version settings saved by admins.
 * Users that already have a copy are left unchanged.
 *
 * Run: npm run db:backfill-user-version-settings
 */
import { prisma } from '@/lib/prisma';
import { backfillUserVersionSettings } from '@/lib/admin/versionSettingsStore';

async function main() {
  const users = await backfillUserVersionSettings();
  console.log(`PCU version settings copied: ${users} users`);
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
