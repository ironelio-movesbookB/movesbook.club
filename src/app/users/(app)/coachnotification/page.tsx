'use client';

import { OrgNotificationPageShell } from '@/components/notifications/OrgNotificationPageShell';

export default function CoachNotificationPage() {
  return (
    <OrgNotificationPageShell kind="coach" allow={(t) => t === 'COACH'} />
  );
}
