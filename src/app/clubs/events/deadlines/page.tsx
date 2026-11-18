'use client';

import ProcedureDeadlinesArchive from '@/components/procedures/archives/ProcedureDeadlinesArchive';
import { PROCEDURE_TYPE_CODES } from '@/lib/procedures/types';

export default function EventDeadlinesPage() {
  return (
    <ProcedureDeadlinesArchive
      procedureCode={PROCEDURE_TYPE_CODES.EVENT_SUBSCRIPTION}
      activeTab="deadlines"
    />
  );
}
