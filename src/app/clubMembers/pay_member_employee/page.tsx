'use client';

import PayMemberCreditForm from '@/components/club/payments/PayMemberCreditForm';

export default function PayMemberEmployeePage() {
  return (
    <div className="min-h-full w-full bg-[#ececec] py-2">
      <div className="w-full border border-gray-300 bg-white shadow-sm">
        <div className="bg-black px-4 py-3">
          <h1 className="text-[18px] font-bold leading-none text-white">Add a credit</h1>
        </div>
        <p className="border-b border-gray-200 px-4 py-3 text-center text-[13px] font-bold text-black">
          Pay a member (or pay a employee) — amount is CREDIT earned.
        </p>
        <PayMemberCreditForm />
      </div>
    </div>
  );
}

