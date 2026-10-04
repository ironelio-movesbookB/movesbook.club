import { STATS_CLUB_ACCOUNTS_COLOR, STATS_KIND_COLORS } from '@/lib/admin/statisticsKinds';

/** One grid per subscription version. */
export type CostRecoveryVersion = 'base' | 'premium' | 'professional';

export const COST_RECOVERY_VERSIONS: Array<{ id: CostRecoveryVersion; label: string; accent: string }> = [
  { id: 'base', label: 'Base', accent: '#ffffff' },
  { id: 'premium', label: 'Premium', accent: '#ffe600' },
  { id: 'professional', label: 'Professional', accent: '#ff9d00' },
];

/** Columns of the grid (types of users). */
export type CostRecoveryType = 'athletes' | 'coaches' | 'teams' | 'clubs' | 'clubAccounts';

export const COST_RECOVERY_TYPES: Array<{
  id: CostRecoveryType;
  label: string;
  color: string;
  text: string;
}> = [
  { id: 'athletes', label: 'Athletes', color: STATS_KIND_COLORS.single, text: '#ffe600' },
  { id: 'coaches', label: 'Coaches', color: STATS_KIND_COLORS.coaches, text: '#1f1f1f' },
  { id: 'teams', label: 'Teams', color: STATS_KIND_COLORS.teams, text: '#ffe600' },
  { id: 'clubs', label: 'Clubs', color: STATS_KIND_COLORS.clubs, text: '#ffe600' },
  { id: 'clubAccounts', label: 'Club accounts', color: STATS_CLUB_ACCOUNTS_COLOR, text: '#ffe600' },
];

/** Languages supported by Movesbook, in the order of the grid. */
export const COST_RECOVERY_LANGUAGES: Array<{ code: string; label: string; color: string }> = [
  { code: 'it', label: 'Italian', color: '#1f3f8f' },
  { code: 'en', label: 'English', color: '#33dd22' },
  { code: 'fr', label: 'French', color: '#3f6f1f' },
  { code: 'de', label: 'German', color: '#e03030' },
  { code: 'es', label: 'Spanish', color: '#2f8fe8' },
  { code: 'pt', label: 'Portuguese', color: '#e8d5bd' },
  { code: 'ru', label: 'Russian', color: '#ff8a1f' },
  { code: 'zh', label: 'Chinese', color: '#fff27a' },
  { code: 'hi', label: 'Hindi', color: '#9b3fe0' },
  { code: 'ar', label: 'Arab', color: '#1f2fe0' },
  { code: 'ja', label: 'Japanese', color: '#f03fd0' },
  { code: 'id', label: 'Indonesian', color: '#ffffff' },
];

export type CostRecoveryCell = { n: number; eur: number };

/** Real data: version → language → type. */
export type CostRecoveryReal = Record<
  CostRecoveryVersion,
  Record<string, Record<CostRecoveryType, CostRecoveryCell>>
>;

/** What the Super Admin types for one version: cost per subscription and planned N° per language. */
export type CostRecoveryPlan = {
  costs: Record<CostRecoveryType, number>;
  planN: Record<string, Record<CostRecoveryType, number>>;
};

export type CostRecoveryPayload = {
  real: CostRecoveryReal;
  plans: Record<CostRecoveryVersion, CostRecoveryPlan>;
};

export function isCostRecoveryVersion(value: unknown): value is CostRecoveryVersion {
  return value === 'base' || value === 'premium' || value === 'professional';
}

export function emptyTypeRecord<T>(make: () => T): Record<CostRecoveryType, T> {
  return Object.fromEntries(COST_RECOVERY_TYPES.map((t) => [t.id, make()])) as Record<
    CostRecoveryType,
    T
  >;
}

export function emptyCostRecoveryPlan(): CostRecoveryPlan {
  return {
    costs: emptyTypeRecord(() => 0),
    planN: Object.fromEntries(
      COST_RECOVERY_LANGUAGES.map((l) => [l.code, emptyTypeRecord(() => 0)]),
    ),
  };
}

/** Keeps only known languages/types; costs ≥ 0 (cents), planned N° whole numbers ≥ 0. */
export function sanitizeCostRecoveryPlan(raw: unknown): CostRecoveryPlan {
  const plan = emptyCostRecoveryPlan();
  const src = (raw && typeof raw === 'object' ? raw : {}) as Partial<{
    costs: Record<string, unknown>;
    planN: Record<string, Record<string, unknown>>;
  }>;
  for (const t of COST_RECOVERY_TYPES) {
    const cost = Number(src.costs?.[t.id]);
    plan.costs[t.id] = Number.isFinite(cost) && cost > 0 ? Math.round(cost * 100) / 100 : 0;
    for (const l of COST_RECOVERY_LANGUAGES) {
      const n = Number(src.planN?.[l.code]?.[t.id]);
      plan.planN[l.code]![t.id] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    }
  }
  return plan;
}
