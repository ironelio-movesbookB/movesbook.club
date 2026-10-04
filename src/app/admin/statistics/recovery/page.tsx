'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAdminBearerToken } from '@/lib/admin/clientAdminAuth';
import {
  COST_RECOVERY_LANGUAGES,
  COST_RECOVERY_TYPES,
  COST_RECOVERY_VERSIONS,
  type CostRecoveryPayload,
  type CostRecoveryPlan,
  type CostRecoveryType,
  type CostRecoveryVersion,
} from '@/lib/admin/costRecoveryTypes';
import CostRecoveryGrid from '@/components/admin/statistics/costRecovery/CostRecoveryGrid';
import CostRecoveryChartModal, {
  type CostRecoveryChartRow,
} from '@/components/admin/statistics/costRecovery/CostRecoveryChartModal';

type ChartTarget = { kind: 'type'; type: CostRecoveryType } | { kind: 'language'; language: string };

export default function CostRecoveryPlanPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CostRecoveryPayload | null>(null);
  /** Unsaved edits per version (Apply saves the version on screen). */
  const [drafts, setDrafts] = useState<Partial<Record<CostRecoveryVersion, CostRecoveryPlan>>>({});
  const [version, setVersion] = useState<CostRecoveryVersion>('base');
  const [saving, setSaving] = useState(false);
  const [chart, setChart] = useState<ChartTarget | null>(null);

  useEffect(() => {
    if (!localStorage.getItem('adminUser')) {
      router.push('/');
      return;
    }
    setAuthChecked(true);
  }, [router]);

  const load = useCallback(async () => {
    const token = getAdminBearerToken();
    if (!token) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/statistics/cost-recovery', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Failed (${res.status})`);
      setData(body as CostRecoveryPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the cost recovery plan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authChecked) void load();
  }, [authChecked, load]);

  const plan = drafts[version] ?? data?.plans[version] ?? null;
  const real = data?.real[version] ?? null;
  const dirty = Boolean(drafts[version]);

  const editPlan = (update: (p: CostRecoveryPlan) => CostRecoveryPlan) => {
    if (!plan) return;
    setDrafts((prev) => ({ ...prev, [version]: update(plan) }));
  };

  const apply = async () => {
    const draft = drafts[version];
    const token = getAdminBearerToken();
    if (!draft || !token) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/statistics/cost-recovery', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ version, plan: draft }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Failed (${res.status})`);
      setData((prev) => (prev ? { ...prev, plans: { ...prev.plans, [version]: body.plan } } : prev));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[version];
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const chartView = useMemo<{ title: string; rows: CostRecoveryChartRow[] } | null>(() => {
    if (!chart || !plan || !real) return null;
    const versionLabel = COST_RECOVERY_VERSIONS.find((v) => v.id === version)?.label ?? '';
    const cell = (lang: string, type: CostRecoveryType) => {
      const planN = plan.planN[lang]?.[type] ?? 0;
      const r = real[lang]?.[type] ?? { n: 0, eur: 0 };
      return {
        planN,
        planEur: Math.round(plan.costs[type] * planN * 100) / 100,
        realN: r.n,
        realEur: r.eur,
      };
    };
    if (chart.kind === 'type') {
      const t = COST_RECOVERY_TYPES.find((x) => x.id === chart.type)!;
      return {
        title: `${t.label} — all languages · Version ${versionLabel}`,
        rows: COST_RECOVERY_LANGUAGES.map((l) => ({
          key: l.code,
          label: l.label,
          plannedColor: t.color,
          pieColor: l.color,
          ...cell(l.code, t.id),
        })),
      };
    }
    const l = COST_RECOVERY_LANGUAGES.find((x) => x.code === chart.language)!;
    return {
      title: `${l.label} — all types of users · Version ${versionLabel}`,
      rows: COST_RECOVERY_TYPES.map((t) => ({
        key: t.id,
        label: t.label,
        plannedColor: t.color,
        pieColor: t.color,
        ...cell(l.code, t.id),
      })),
    };
  }, [chart, plan, real, version]);

  if (!authChecked) return null;

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-white p-3 md:p-4">
      <div className="mb-4 bg-gradient-to-b from-[#0b2f4a] to-[#06192a] px-4 py-2.5 text-center shadow">
        <h1 className="inline text-lg font-semibold text-[#d9e04a]">
          Cost recovery plan &amp; Subscription revenue
        </h1>
        <span className="ml-2 text-xs text-[#d9e04a]">
          – scanning of subscriptions and payments done for each typology of users
        </span>
      </div>

      <div className="mb-4 flex flex-wrap justify-center gap-6 md:gap-10">
        {COST_RECOVERY_VERSIONS.map((v) => {
          const active = v.id === version;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setVersion(v.id)}
              aria-pressed={active}
              className={`min-w-[10rem] border px-6 py-2 text-sm text-white shadow transition ${
                active
                  ? 'border-[#ffe600] bg-[#3a3a3a] ring-2 ring-[#ffe600]'
                  : 'border-gray-600 bg-[#5a5a5a] hover:bg-[#4a4a4a]'
              }`}
            >
              Version{' '}
              <b style={{ color: v.accent }}>{v.label}</b>
              {drafts[v.id] ? <span className="ml-1 text-[#ff8a80]">*</span> : null}
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="mb-3 border border-[#e0a0a0] bg-[#fde8e8] px-4 py-2.5 text-sm text-[#8a1f1f]">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading…</div>
      ) : plan && real ? (
        <CostRecoveryGrid
          key={version}
          plan={plan}
          real={real}
          dirty={dirty}
          saving={saving}
          onCostChange={(type, cost) =>
            editPlan((p) => ({ ...p, costs: { ...p.costs, [type]: cost } }))
          }
          onPlanChange={(language, type, n) =>
            editPlan((p) => ({
              ...p,
              planN: { ...p.planN, [language]: { ...p.planN[language]!, [type]: n } },
            }))
          }
          onApply={() => void apply()}
          onChartTrend={(type) => setChart({ kind: 'type', type })}
          onLanguageOpen={(language) => setChart({ kind: 'language', language })}
        />
      ) : null}

      {chartView ? (
        <CostRecoveryChartModal
          title={chartView.title}
          rows={chartView.rows}
          onClose={() => setChart(null)}
        />
      ) : null}
    </div>
  );
}
