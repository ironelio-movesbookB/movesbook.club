'use client';

import AdminCustomerFeedbackPanel from '@/components/admin/AdminCustomerFeedbackPanel';
import AdminRelationshipAuthShell from '@/components/admin/AdminRelationshipAuthShell';

/**
 * Super Admin moderation: all posts marked inappropriate across reviews/support.
 */
export default function AdminCommentsInappropriatePage() {
  return (
    <AdminRelationshipAuthShell>
      <AdminCustomerFeedbackPanel
        kind="review"
        aggregateInappropriate
        title="Comments inappropriate"
        description="Posts marked as inappropriate across Reviews, Feedbacks, Questions, Suggestions, and Problems. Remove or untag them here."
        emptyMessage="No inappropriate posts."
      />
    </AdminRelationshipAuthShell>
  );
}
