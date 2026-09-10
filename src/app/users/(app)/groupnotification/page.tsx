'use client';

import { isGroupAccountUserType } from '@/utils/dashboardRouting';
import { OrgNotificationPageShell } from '@/components/notifications/OrgNotificationPageShell';

export default function GroupNotificationPage() {
  return (
    <OrgNotificationPageShell kind="group" allow={isGroupAccountUserType} />
  );
}
