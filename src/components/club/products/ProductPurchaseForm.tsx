'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import ProcedureFormSection, {
  ProcedureFormCell,
  ProcedureFormGrid,
  procedureHighlightInputClass,
  procedureInputClass,
  procedureReadonlyInputClass,
} from '@/components/procedures/ProcedureFormLayout';
import TaxDocumentModal, { type TaxDocumentFormValues } from '@/components/procedures/TaxDocumentModal';
import { createProcedureClient } from '@/lib/club/procedureClient';
import { fetchCompanies } from '@/lib/club/archives/clubArchiveClient';
import PaymentModeSelect from '@/components/club/PaymentModeSelect';
import { useClubDefaultPaymentMethods } from '@/hooks/useClubDefaultPaymentMethods';
import { getProcedureDefinition } from '@/lib/procedures/registry';
import { PROCEDURE_TYPE_CODES } from '@/lib/procedures/types';

type ProductFormOptions = {
  products: { id: string; name: string; cost: number }[];
  members: { id: string; name: string }[];
  operators: { id: string; name: string }[];
  companies: { id: string; name: string }[];
  currentOperatorId: string | null;
};

export default function ProductPurchaseForm() {
  const router = useRouter();
  const def = getProcedureDefinition(PROCEDURE_TYPE_CODES.PRODUCT_SALE)!;
  const client = useMemo(() => createProcedureClient(PROCEDURE_TYPE_CODES.PRODUCT_SALE), []);
  const defaultPaymentMethods = useClubDefaultPaymentMethods();

  const [options, setOptions] = useState<ProductFormOptions | null>(null);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [taxModalOpen, setTaxModalOpen] = useState(false);

  const [memberId, setMemberId] = useState('');
  const [productId, setProductId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [operatorPassword, setOperatorPassword] = useState('');
  const [value, setValue] = useState('');
  const [pay, setPay] = useState('');
  const [movementDate, setMovementDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [movementTime, setMovementTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [paydate] = useState(() => new Date().toISOString().slice(0, 10));
  const [causal, setCausal] = useState('');
  const [payMode, setPayMode] = useState('cash');
  const [taxDoc, setTaxDoc] = useState(true);
  const [taxDocument, setTaxDocument] = useState<TaxDocumentFormValues | null>(null);

  useEffect(() => {
    Promise.all([client.fetchFormOptions<ProductFormOptions>(), fetchCompanies()])
      .then(([opts, co]) => {
        setOptions(opts);
        setCompanies(co.length ? co : opts.companies);
        if (opts.currentOperatorId) setOperatorId(opts.currentOperatorId);
        else if (opts.operators[0]?.id) setOperatorId(opts.operators[0].id);
        if (co[0]?.id) setCompanyId(co[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Load failed'))
      .finally(() => setLoading(false));
  }, [client]);

  const selectedMember = options?.members.find((m) => m.id === memberId);
  const selectedProduct = options?.products.find((p) => p.id === productId);
  const selectedCompany = companies.find((c) => c.id === companyId);
  const total = Number(value) || 0;
  const paid = pay === '' ? 0 : Number(pay);
  const rest = Math.max(0, total - paid);

  useEffect(() => {
    if (selectedProduct) setValue(String(selectedProduct.cost));
  }, [selectedProduct]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!memberId) return setError('Please select a user.');
    if (!productId) return setError('Please select a product.');
    if (!operatorId) return setError('Please select an operator.');
    if (!operatorPassword.trim()) return setError('Operator password is required.');
    if (paid > total) return setError('Payment cannot exceed total.');

    setSaving(true);
    try {
      await client.createRecord({
        memberId,
        totalAmount: total,
        initialPayment: paid,
        recordDate: movementDate,
        paymentDate: paydate,
        causal,
        notes: causal,
        productId,
        productName: selectedProduct?.name,
        operatorId,
        operatorPassword,
        payMode,
        movementTime,
        taxDoc,
        taxDocument: taxDocument ?? undefined,
        companyId,
        companyName: selectedCompany?.name,
        createReceipt: Boolean(taxDoc && taxDocument && paid > 0),
        receiptNumber: taxDocument?.documentNumber,
        receiptAnnotations: taxDocument?.causal || undefined,
      });
      router.push(def.routes.records);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-gray-600">Loading form...</div>;

  return (
    <>
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto p-6 space-y-6">
        <ProcedureFormSection title="Movement data">
          <ProcedureFormGrid>
            <ProcedureFormCell label="User Selected">
              <select className={procedureInputClass} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                <option value="">Select user</option>
                {options?.members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </ProcedureFormCell>
            <ProcedureFormCell label="Date">
              <input type="date" className={procedureInputClass} value={movementDate} onChange={(e) => setMovementDate(e.target.value)} />
            </ProcedureFormCell>
            <ProcedureFormCell label="Hour">
              <input type="time" className={procedureInputClass} value={movementTime} onChange={(e) => setMovementTime(e.target.value)} />
            </ProcedureFormCell>
          </ProcedureFormGrid>
        </ProcedureFormSection>

        <ProcedureFormSection title="Payment">
          <ProcedureFormGrid>
            <ProcedureFormCell label="Product">
              <select className={procedureInputClass} value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Select product</option>
                {options?.products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </ProcedureFormCell>
            <ProcedureFormCell label="Value">
              <input type="number" min="0" step="0.01" className={procedureInputClass} value={value} onChange={(e) => setValue(e.target.value)} />
            </ProcedureFormCell>
            <ProcedureFormCell label="Pay">
              <input type="number" min="0" step="0.01" className={procedureHighlightInputClass} value={pay} onChange={(e) => setPay(e.target.value)} />
            </ProcedureFormCell>
            <ProcedureFormCell label="Date">
              <input type="date" readOnly className={procedureReadonlyInputClass} value={paydate} />
            </ProcedureFormCell>
            <ProcedureFormCell label="Causal">
              <input type="text" className={procedureInputClass} value={causal} onChange={(e) => setCausal(e.target.value)} />
            </ProcedureFormCell>
          </ProcedureFormGrid>
          <div className="mt-4 grid grid-cols-3 gap-2 text-sm bg-gray-50 p-3 rounded">
            <div>Total: <strong>€{total.toFixed(2)}</strong></div>
            <div>Paid: <strong>€{paid.toFixed(2)}</strong></div>
            <div>Rest: <strong className="text-red-600">€{rest.toFixed(2)}</strong></div>
          </div>
        </ProcedureFormSection>

        <ProcedureFormSection title="Type of payment">
          <ProcedureFormGrid>
            <ProcedureFormCell label="Payment method">
              <PaymentModeSelect
                className={procedureInputClass}
                value={payMode}
                onChange={setPayMode}
                defaultPaymentMethods={defaultPaymentMethods}
                allowEmpty={false}
              />
            </ProcedureFormCell>
            <ProcedureFormCell label="Tax document">
              <div className="flex items-center gap-3 mt-1">
                <input type="checkbox" checked={taxDoc} onChange={(e) => setTaxDoc(e.target.checked)} />
                <button type="button" onClick={() => setTaxModalOpen(true)} className="px-3 py-1.5 text-sm bg-gray-200 rounded">Open form</button>
              </div>
            </ProcedureFormCell>
            <ProcedureFormCell label="Operator">
              <select className={procedureInputClass} value={operatorId} onChange={(e) => setOperatorId(e.target.value)}>
                {options?.operators.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </ProcedureFormCell>
            <ProcedureFormCell label="Password">
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} className={procedureInputClass} value={operatorPassword} onChange={(e) => setOperatorPassword(e.target.value)} />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </ProcedureFormCell>
          </ProcedureFormGrid>
        </ProcedureFormSection>

        <ProcedureFormSection title="Company" titleClassName="text-green-800">
          <ProcedureFormGrid>
            <ProcedureFormCell label="Company">
              <select className={procedureInputClass} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </ProcedureFormCell>
          </ProcedureFormGrid>
        </ProcedureFormSection>

        {error && <div className="text-red-600 bg-red-50 border border-red-200 rounded px-4 py-2 text-sm">{error}</div>}

        <div className="flex justify-center gap-3">
          <button type="submit" disabled={saving} className="px-6 py-2 bg-red-700 text-white rounded disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button type="button" onClick={() => router.push(def.routes.records)} className="px-6 py-2 bg-gray-200 rounded">Cancel</button>
        </div>
      </form>

      <TaxDocumentModal
        open={taxModalOpen}
        memberName={selectedMember?.name ?? ''}
        defaultCausal={causal}
        defaultTotal={total}
        defaultResidual={rest}
        initial={taxDocument ?? undefined}
        onClose={() => setTaxModalOpen(false)}
        onSave={(v) => { setTaxDocument(v); setTaxDoc(true); }}
      />
    </>
  );
}
