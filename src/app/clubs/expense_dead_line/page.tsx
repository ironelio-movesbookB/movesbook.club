'use client';

import ProcedureDeadlinesArchive from '@/components/procedures/archives/ProcedureDeadlinesArchive';
import { PROCEDURE_TYPE_CODES } from '@/lib/procedures/types';

export default function ExpenseDeadLinePage() {
  return (
    <ProcedureDeadlinesArchive procedureCode={PROCEDURE_TYPE_CODES.EXPENSE} activeTab="deadlines" />
  );
}
