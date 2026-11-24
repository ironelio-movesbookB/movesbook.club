'use client';

import DebtMemberForm from '@/components/club/debts/DebtMemberForm';
import { getProcedureDefinition } from '@/lib/procedures/registry';
import { PROCEDURE_TYPE_CODES } from '@/lib/procedures/types';

export default function DebtMemberPage() {
  const def = getProcedureDefinition(PROCEDURE_TYPE_CODES.MEMBER_DEBT)!;

  return (
    <div className="min-h-full bg-gray-50">
      <div className="bg-teal-800 px-6 py-4 text-white">
        <h1 className="text-xl font-semibold">{def.form.title}</h1>
        <p className="mt-1 text-sm text-teal-100">{def.form.subtitle}</p>
      </div>
      <DebtMemberForm />
    </div>
  );
}
