'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { SELLING_SECTORS, shopSector } from '@/lib/shop/sectors';
import { displaySellingNumber } from '@/lib/shop/sellingNumber';

type CatalogProduct = {
  id: string;
  name: string;
  cost: number;
  sector: string;
  allowMultipleUnits: boolean;
};

type ProductFormOptions = {
  products: CatalogProduct[];
  members: { id: string; name: string }[];
  operators: { id: string; name: string }[];
  companies: { id: string; name: string }[];
  currentOperatorId: string | null;
  nextSellingNumber?: string;
};

type TaggedLine = {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  allowMultipleUnits: boolean;
  sector: string;
};

function ProductPurchaseFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawSector = String(searchParams?.get('sector') ?? '').trim().toLowerCase();
  const lockedSector = SELLING_SECTORS.find((sector) => sector.toLowerCase() === rawSector) ?? '';
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
  const [sectorFilter, setSectorFilter] = useState(lockedSector);
  const [lines, setLines] = useState<TaggedLine[]>([]);
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
  const selectedCompany = companies.find((c) => c.id === companyId);
  const visibleProducts = useMemo(() => {
    const catalog = options?.products ?? [];
    if (!sectorFilter) return catalog;
    return catalog.filter((product) => shopSector(product.sector) === sectorFilter);
  }, [options, sectorFilter]);

  const taggedTotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.price * line.quantity, 0),
    [lines],
  );

  useEffect(() => {
    setValue(taggedTotal ? String(Math.round(taggedTotal * 100) / 100) : '');
  }, [taggedTotal]);

  const total = Number(value) || 0;
  const paid = pay === '' ? 0 : Number(pay);
  const rest = Math.max(0, total - paid);
  const sectorName = [...new Set(lines.map((line) => shopSector(line.sector)))].join(' - ') || 'Shop';

  function tagProduct(product: CatalogProduct) {
    setLines((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (existing) {
        if (!existing.allowMultipleUnits) return current;
        return current.map((line) =>
          line.productId === product.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          quantity: 1,
          price: product.cost,
          allowMultipleUnits: product.allowMultipleUnits,
          sector: shopSector(product.sector),
        },
      ];
    });
  }

  function setQuantity(productId: string, quantity: number) {
    setLines((current) =>
      current
        .map((line) => {
          if (line.productId !== productId) return line;
          const next = Math.max(0, Math.floor(quantity));
          if (!line.allowMultipleUnits) return { ...line, quantity: next > 0 ? 1 : 0 };
          return { ...line, quantity: next };
        })
        .filter((line) => line.quantity > 0),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!memberId) return setError('Please select a user.');
    if (lines.length === 0) return setError('Tag at least one product.');
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
        productId: lines[0]?.productId,
        productName: lines.map((line) => line.name).join(', '),
        sectorName,
        sellingNumber: options?.nextSellingNumber,
        products: lines.map((line) => ({
          productId: line.productId,
          name: line.name,
          quantity: line.quantity,
          price: line.price,
        })),
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
            <ProcedureFormCell label="Selling No.">
              <input
                className={`${procedureReadonlyInputClass} font-semibold`}
                value={displaySellingNumber(options?.nextSellingNumber) || '-'}
                readOnly
              />
            </ProcedureFormCell>
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
            <ProcedureFormCell label="Sector">
              <select
                className={procedureInputClass}
                value={sectorFilter}
                disabled={Boolean(lockedSector)}
                onChange={(e) => setSectorFilter(e.target.value)}
              >
                <option value="">All</option>
                {SELLING_SECTORS.map((sector) => (
                  <option key={sector} value={sector}>{sector}</option>
                ))}
              </select>
            </ProcedureFormCell>
            <ProcedureFormCell label="Products">
              <div className="max-h-48 space-y-1 overflow-y-auto rounded border border-gray-200 bg-white p-2">
                {visibleProducts.length === 0 && (
                  <p className="px-1 py-2 text-sm text-gray-500">No products in this sector.</p>
                )}
                {visibleProducts.map((product) => {
                  const tagged = lines.some((line) => line.productId === product.id);
                  return (
                    <label key={product.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={tagged}
                        onChange={() => {
                          if (tagged) setQuantity(product.id, 0);
                          else tagProduct(product);
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate">{product.name}</span>
                      <span className="shrink-0 text-xs text-gray-500">{product.sector}</span>
                      <span className="shrink-0 font-medium">€{product.cost.toFixed(2)}</span>
                    </label>
                  );
                })}
              </div>
            </ProcedureFormCell>
            <ProcedureFormCell label="Value">
              <input
                type="number"
                min="0"
                step="0.01"
                className={procedureInputClass}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </ProcedureFormCell>
            <ProcedureFormCell label="Pay">
              <input
                type="number"
                min="0"
                step="0.01"
                className={procedureHighlightInputClass}
                style={{ backgroundColor: '#fff984' }}
                value={pay}
                onChange={(e) => setPay(e.target.value)}
              />
            </ProcedureFormCell>
            <ProcedureFormCell label="Date">
              <input type="date" readOnly className={procedureReadonlyInputClass} value={paydate} />
            </ProcedureFormCell>
            <ProcedureFormCell label="Causal">
              <input type="text" className={procedureInputClass} value={causal} onChange={(e) => setCausal(e.target.value)} />
            </ProcedureFormCell>
          </ProcedureFormGrid>

          {lines.length > 0 && (
            <div className="mt-4 overflow-hidden rounded border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Tagged product</th>
                    <th className="px-3 py-2">Qty</th>
                    <th className="px-3 py-2">Price</th>
                    <th className="px-3 py-2">Line</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.productId} className="border-t border-gray-100">
                      <td className="px-3 py-2">{line.name}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={1}
                          className="w-20 rounded border border-gray-200 px-2 py-1"
                          value={line.quantity}
                          onChange={(e) => setQuantity(line.productId, Number(e.target.value))}
                        />
                      </td>
                      <td className="px-3 py-2">€{line.price.toFixed(2)}</td>
                      <td className="px-3 py-2">€{(line.price * line.quantity).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

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

export default function ProductPurchaseForm() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-600">Loading form...</div>}>
      <ProductPurchaseFormInner />
    </Suspense>
  );
}
