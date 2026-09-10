'use client';

import { isTeamAccountUserType } from '@/utils/dashboardRouting';
import { OrgNotificationPageShell } from '@/components/notifications/OrgNotificationPageShell';

export default function TeamNotificationPage() {
  return (
    <OrgNotificationPageShell kind="team" allow={isTeamAccountUserType} />
  );
}
