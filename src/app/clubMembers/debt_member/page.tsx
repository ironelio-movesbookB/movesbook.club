'use client';

import DebtMemberForm from '@/components/club/debts/DebtMemberForm';

export default function DebtMemberPage() {
  return (
    <div className="min-h-full w-full bg-[#ececec] py-2">
      <div className="w-full border border-gray-300 bg-white shadow-sm">
        <div className="bg-black px-4 py-3">
          <h1 className="text-[18px] font-bold leading-none text-white">Add a credit</h1>
        </div>
        <p className="border-b border-gray-200 px-4 py-3 text-center text-[13px] font-bold text-black">
          How you can add a debt beside the &apos;classic&apos; debts of subscription and purchasest
        </p>
        <DebtMemberForm />
      </div>
    </div>
  );
}
