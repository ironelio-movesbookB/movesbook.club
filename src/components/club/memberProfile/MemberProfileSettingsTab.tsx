"use client";

import { useSportT } from "@/components/sport/useSportT";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckRow,
  Field,
  Row2,
  Row4,
  SectionCard,
  TextInput,
  TextSelect,
} from "@/components/club/memberProfile/FormBits";
import PaymentInfoModal from "@/components/club/memberProfile/PaymentInfoModal";
import type {
  ClubMemberScopedData,
  MemberSettingsInstallmentKey,
  OwnerProfileData,
} from "@/lib/club/memberProfileTypes";
import {
  CREATE_DEADLINES_PAYMENT_STATUS,
  DEFAULT_REGISTRATION_TYPE_OPTIONS,
  emptyMemberSettingsDeadlines,
  MEMBER_SETTINGS_INSTALLMENT_KEYS,
  ATHLETIC_LEVEL_OPTIONS,
  FOLLOW_UP_NOTIFICATION_OPTIONS,
  MAIN_SPORTS,
  SHARING_DEFAULT_OPTIONS,
  TEAM_ATHLETE_STATUS_OPTIONS,
  TEAM_REGISTRATION_STATUS_OPTIONS,
} from "@/lib/club/memberProfileTypes";
import { teamMemberSportFields } from "@/lib/sport/teamMemberSportFields";
import {
  athleteSportExtraFields,
  athleteSportProfile,
} from "@/lib/sport/athleteSportProfiles";
import {
  decodeMultiSportValues,
  encodeMultiSportValues,
} from "@/lib/sport/sportProfileTypes";
import { renewMembershipDates } from "@/lib/club/memberMembershipDates";
import {
  formatDate,
  getAuthHeaders,
  withSelectedClubId,
} from "@/lib/club/servicePurchasesClient";
import {
  ENTITY_SPORT_OPTIONS,
  normalizeEntitySport,
} from "@/lib/sport/entitySportOptions";
import {
  emptySportDropdownCatalog,
  normalizeSportDropdownCatalog,
  optionsForSportParameter,
  parameterLabelForLanguage,
  type SportDropdownCatalog,
} from "@/lib/sport/sportDropdownParameters";
import {
  MAX_DEFAULT_PAYMENT_METHODS,
  normalizePaymentTypeValue,
  PAID_AT_FIRST_DEADLINE_METHODS,
  PAYMENT_STATUS_OPTIONS,
  PAYMENT_TYPE_OPTIONS,
  paymentMethodIn,
  payModeLabel,
  sanitizeDefaultPaymentMethods,
  SEND_PAYMENT_MODULE_METHODS,
  TO_BE_VERIFIED_METHODS,
} from "@/lib/procedures/payModes";
import { useClubEnabledPaymentMethods } from "@/lib/club/useClubEnabledPaymentMethods";
import { useLanguage } from "@/contexts/LanguageContext";

type MemberTypeOption = {
  id: string;
  name: string;
  discountSubscription: string;
  discountServices: string;
  discountRest: string;
  discountSupplement: string;
  discountClothing: string;
  discountOutfit: string;
};

type Props = {
  clubId: string;
  /** Member whose dossier is open (Send payment module recipient). */
  memberUserId: string;
  entitySportDefault: string;
  /** Club archive vs Team archive — drives TEAM fields labels. */
  workspaceKind?: "club" | "team";
  /** Owner's administrative data, shown read-only in the TEAM fields of some sports. */
  ownerAdministrative?: OwnerProfileData["administrative"];
  club: ClubMemberScopedData;
  setClub: (
    next:
      | ClubMemberScopedData
      | ((prev: ClubMemberScopedData) => ClubMemberScopedData),
  ) => void;
  readOnlyClub: boolean;
  showVisibility: boolean;
  canEditPaymentDefaults: boolean;
  saving: boolean;
  message: string;
  onSave: () => void;
  /**
   * `full` — entire Settings tab.
   * `subscription` — Administration page: visibility + Current subscription / Payments only.
   */
  variant?: "full" | "subscription";
  /** Member profile language (Other references → Language) for Info popups. */
  memberLanguage?: string | null;
};

type InstallmentKey = MemberSettingsInstallmentKey;

const INSTALLMENT_KEYS = MEMBER_SETTINGS_INSTALLMENT_KEYS;
const AUTO_DAYS = 30;

function localIsoDate(date = new Date()): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
export default function MemberProfileSettingsTab({
  clubId,
  memberUserId,
  entitySportDefault,
  workspaceKind = "club",
  ownerAdministrative,
  club,
  setClub,
  readOnlyClub,
  showVisibility,
  canEditPaymentDefaults,
  saving,
  message,
  onSave,
  variant = "full",
  memberLanguage,
}: Props) {
  const subscriptionOnly = variant === "subscription";
  const clubEnabledPayments = useClubEnabledPaymentMethods();
  const { currentLanguage } = useLanguage();
  const lang = (currentLanguage || "en").toLowerCase().split("-")[0] || "en";
  const s = club.settings;
  const od = club.otherDetails;
  const ac = s.accessControl;
  const ss = s.secondaryScreen;
  const [membershipBusy, setMembershipBusy] = useState(false);
  const [membershipHint, setMembershipHint] = useState("");
  const [sportDropdownCatalog, setSportDropdownCatalog] =
    useState<SportDropdownCatalog>(emptySportDropdownCatalog());

  const loadMembershipFromArchive = async () => {
    if (!clubId || !memberUserId) {
      setMembershipHint("Select a club member first.");
      return;
    }
    setMembershipBusy(true);
    setMembershipHint("");
    try {
      const res = await fetch(
        withSelectedClubId(
          `/api/clubs/${encodeURIComponent(clubId)}/members/${encodeURIComponent(memberUserId)}/profile/membership-dates`,
        ),
        { headers: getAuthHeaders() },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to load membership dates");
      const dates = json.dates as { from?: string; to?: string } | null;
      if (!dates) {
        setMembershipHint("No membership archive record found.");
        return;
      }
      setClub((c) => ({
        ...c,
        otherDetails: {
          ...c.otherDetails,
          membershipFrom: dates.from || c.otherDetails.membershipFrom,
          membershipTo: dates.to || c.otherDetails.membershipTo,
        },
      }));
      setMembershipHint("Loaded from archive. Click Save to persist.");
    } catch (e: unknown) {
      setMembershipHint(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setMembershipBusy(false);
    }
  };

  const renewMembership = () => {
    const next = renewMembershipDates(od.membershipFrom, od.membershipTo);
    setClub((c) => ({
      ...c,
      otherDetails: {
        ...c.otherDetails,
        membershipFrom: next.from,
        membershipTo: next.to,
      },
    }));
    setMembershipHint("Membership renewed (+1 year). Click Save to persist.");
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/sport-dropdown-parameters", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) {
          setSportDropdownCatalog(normalizeSportDropdownCatalog(json.catalog));
        }
      } catch {
        /* keep empty catalog */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const teamSportKey = normalizeEntitySport(
    s.teamSport || entitySportDefault || "Football",
  );

  const categoryOptions = useMemo(
    () =>
      optionsForSportParameter(
        sportDropdownCatalog,
        teamSportKey,
        "category",
        lang,
      ),
    [sportDropdownCatalog, teamSportKey, lang],
  );
  const positionOptions = useMemo(
    () =>
      optionsForSportParameter(
        sportDropdownCatalog,
        teamSportKey,
        "position",
        lang,
      ),
    [sportDropdownCatalog, teamSportKey, lang],
  );
  const specialtyOptions = useMemo(
    () =>
      optionsForSportParameter(
        sportDropdownCatalog,
        teamSportKey,
        "specialty",
        lang,
      ),
    [sportDropdownCatalog, teamSportKey, lang],
  );

  const categoryLabel = parameterLabelForLanguage(
    sportDropdownCatalog,
    teamSportKey,
    "category",
    lang,
    "Category",
  );
  const positionLabel = parameterLabelForLanguage(
    sportDropdownCatalog,
    teamSportKey,
    "position",
    lang,
    "Position",
  );
  const specialtyLabel = parameterLabelForLanguage(
    sportDropdownCatalog,
    teamSportKey,
    "specialty",
    lang,
    "Specialty",
  );
  const registrationTypeOptions = useMemo(() => {
    const fromCatalog = optionsForSportParameter(
      sportDropdownCatalog,
      teamSportKey,
      "registration_type",
      lang,
    ).map((o) => o.label);
    return fromCatalog.length > 0
      ? fromCatalog
      : [...DEFAULT_REGISTRATION_TYPE_OPTIONS];
  }, [sportDropdownCatalog, teamSportKey, lang]);
  const [memberTypes, setMemberTypes] = useState<MemberTypeOption[]>([]);
  const [memberTypesLoading, setMemberTypesLoading] = useState(true);
  const [defaultPaymentMethods, setDefaultPaymentMethods] = useState<string[]>(
    [],
  );
  const [defaultsMessage, setDefaultsMessage] = useState("");
  const [paymentInfoOpen, setPaymentInfoOpen] = useState(false);

  useEffect(() => {
    if (!clubId) {
      setMemberTypes([]);
      setMemberTypesLoading(false);
      return;
    }
    let cancelled = false;
    async function loadMemberTypes() {
      setMemberTypesLoading(true);
      try {
        const res = await fetch(
          withSelectedClubId(
            `/api/club/settings/tables/member-types?scope=profile&clubId=${encodeURIComponent(clubId)}`,
          ),
          {
            headers: getAuthHeaders(),
          },
        );
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        const items = Array.isArray(json.items) ? json.items : [];
        setMemberTypes(
          items
            .map(
              (row: {
                id?: string;
                name?: string;
                discountSubscription?: string;
                discountServices?: string;
                discountRest?: string;
                discountSupplement?: string;
                discountClothing?: string;
                discountOutfit?: string;
              }) => ({
                id: String(row.id || ""),
                name: String(row.name || "").trim(),
                discountSubscription: String(row.discountSubscription || ""),
                discountServices: String(row.discountServices || ""),
                discountRest: String(row.discountRest || ""),
                discountSupplement: String(row.discountSupplement || ""),
                discountClothing: String(row.discountClothing || ""),
                discountOutfit: String(row.discountOutfit || ""),
              }),
            )
            .filter((row: MemberTypeOption) => row.id && row.name),
        );
      } catch {
        if (!cancelled) setMemberTypes([]);
      } finally {
        if (!cancelled) setMemberTypesLoading(false);
      }
    }
    void loadMemberTypes();
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  useEffect(() => {
    if (!clubId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/clubs/${encodeURIComponent(clubId)}/payment-method-defaults`,
          { headers: getAuthHeaders() },
        );
        const json = await res.json().catch(() => ({}));
        if (cancelled || !res.ok) return;
        setDefaultPaymentMethods(
          sanitizeDefaultPaymentMethods(json.defaultPaymentMethods),
        );
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  const patchSettings = (
    patch: (
      prev: ClubMemberScopedData["settings"],
    ) => ClubMemberScopedData["settings"],
  ) => {
    setClub((c) => ({ ...c, settings: patch(c.settings) }));
  };

  const patchInstallment = (
    key: InstallmentKey,
    field: "amount" | "date" | "status",
    value: string,
  ) => {
    patchSettings((prev) => ({
      ...prev,
      football: {
        ...prev.football,
        [key]: { ...prev.football[key], [field]: value },
      },
    }));
  };

  /** Later dates still on their automatic value (empty or +30 days) follow the changed one. */
  const setInstallmentDate = (key: InstallmentKey, value: string) => {
    patchSettings((prev) => {
      const football = { ...prev.football };
      const filed = football.deadlines?.generated ?? [];
      let previousOld = football[key].date;
      let previousNew = value;
      football[key] = { ...football[key], date: value };
      for (const next of INSTALLMENT_KEYS.slice(
        INSTALLMENT_KEYS.indexOf(key) + 1,
      )) {
        const current = football[next].date;
        const followsAuto =
          !current ||
          (previousOld !== "" &&
            current === addDaysIso(previousOld, AUTO_DAYS));
        if (filed.includes(next) || !followsAuto || !previousNew) break;
        const updated = addDaysIso(previousNew, AUTO_DAYS);
        previousOld = current;
        previousNew = updated;
        football[next] = { ...football[next], date: updated };
      }
      return { ...prev, football };
    });
  };

  const autoInstallmentDate = (key: InstallmentKey): string => {
    const index = INSTALLMENT_KEYS.indexOf(key);
    if (index === 0) return localIsoDate();
    const before = s.football[INSTALLMENT_KEYS[index - 1]].date;
    return addDaysIso(before || localIsoDate(), AUTO_DAYS);
  };

  const toggleDefaultPaymentMethod = (methodId: string) => {
    setDefaultPaymentMethods((prev) => {
      if (prev.includes(methodId)) return prev.filter((id) => id !== methodId);
      if (prev.length >= MAX_DEFAULT_PAYMENT_METHODS) return prev;
      return [...prev, methodId];
    });
    setDefaultsMessage("");
  };

  const sportMode =
    s.sportMode ??
    (s.teamFootballEnabled && !s.clubGymEnabled ? "TEAM-FOOTBALL" : "CLUB-GYM");
  const memberSettingKind: "club" | "team" =
    s.memberSettingKind ?? (sportMode === "TEAM-FOOTBALL" ? "team" : "club");
  const accessFunctionsEnabled = Boolean(s.accessFunctionsEnabled);
  const accessFieldsDisabled = readOnlyClub || !accessFunctionsEnabled;
  const selectedTeamSport = normalizeEntitySport(
    s.teamSport || entitySportDefault || "Football",
  );
  const sportFields =
    memberSettingKind === "team"
      ? teamMemberSportFields(selectedTeamSport)
      : null;
  const showTeamFields = sportFields !== null;
  const st = useSportT();
  const athleteProfile = athleteSportProfile(selectedTeamSport);
  const athleteSportValues = s.sportFields?.[selectedTeamSport] ?? {};
  const athleteExtraFields = athleteSportExtraFields(
    athleteProfile,
    athleteSportValues,
  );
  const setAthleteSportValue = (key: string, value: string) =>
    patchSettings((prev) => ({
      ...prev,
      sportFields: {
        ...prev.sportFields,
        [selectedTeamSport]: {
          ...(prev.sportFields?.[selectedTeamSport] ?? {}),
          [key]: value,
        },
      },
    }));
  const roleLabel =
    athleteProfile.role === false
      ? null
      : (athleteProfile.role ?? sportFields?.labels.position ?? positionLabel);
  const subRoleLabel =
    athleteProfile.subRole === false
      ? null
      : (athleteProfile.subRole ?? specialtyLabel);
  const roleChoices =
    positionOptions.length > 0
      ? positionOptions.map((o) => o.label)
      : athleteProfile.roleOptions;
  const subRoleChoices =
    specialtyOptions.length > 0
      ? specialtyOptions.map((o) => o.label)
      : athleteProfile.subRoleOptions;
  const catalogHint = (
    <p className="mt-1 text-xs text-gray-500">
      Options from Super Admin → Sport settings → Tools Settings → Dropdown
      parameters for sport ({teamSportKey}).
    </p>
  );

  const deadlines = s.football.deadlines ?? emptyMemberSettingsDeadlines();
  const isFiled = (key: InstallmentKey) => deadlines.generated.includes(key);

  const autoDatesAppliedRef = useRef(false);
  useEffect(() => {
    if (!showTeamFields || readOnlyClub || autoDatesAppliedRef.current) return;
    autoDatesAppliedRef.current = true;
    const f = s.football;
    if (f.firstPayment.date || f.secondPayment.date || f.thirdPayment.date)
      return;
    const first = localIsoDate();
    const second = addDaysIso(first, AUTO_DAYS);
    const third = addDaysIso(second, AUTO_DAYS);
    patchSettings((prev) => ({
      ...prev,
      football: {
        ...prev.football,
        firstPayment: { ...prev.football.firstPayment, date: first },
        secondPayment: { ...prev.football.secondPayment, date: second },
        thirdPayment: { ...prev.football.thirdPayment, date: third },
      },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time defaults per mount
  }, [showTeamFields, readOnlyClub]);

  const applyMemberType = (memberTypeId: string) => {
    const selected = memberTypes.find((item) => item.id === memberTypeId);
    patchSettings((prev) => ({
      ...prev,
      memberTypeId,
      discounts: selected
        ? {
            subscript: selected.discountSubscription,
            service: selected.discountServices,
            barRest: selected.discountRest,
            supply: selected.discountSupplement,
            clothing: selected.discountClothing,
            outfit: selected.discountOutfit,
          }
        : prev.discounts,
    }));
  };

  const handleSave = async () => {
    if (canEditPaymentDefaults && clubId) {
      try {
        const res = await fetch(
          `/api/clubs/${encodeURIComponent(clubId)}/payment-method-defaults`,
          {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({ defaultPaymentMethods }),
          },
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setDefaultsMessage(
            json.error || "Failed to save payment method defaults",
          );
        } else {
          setDefaultPaymentMethods(
            sanitizeDefaultPaymentMethods(
              json.defaultPaymentMethods ?? defaultPaymentMethods,
            ),
          );
          setDefaultsMessage("");
        }
      } catch {
        setDefaultsMessage("Failed to save payment method defaults");
      }
    }
    onSave();
  };

  /** After patchSettings, save once the parent has the new club state. */
  const saveAfterPatchRef = useRef(false);
  useEffect(() => {
    if (!saveAfterPatchRef.current) return;
    saveAfterPatchRef.current = false;
    void handleSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run after club patch lands
  }, [club]);

  const installmentRows: Array<{ key: InstallmentKey; label: string }> = [
    { key: "firstPayment", label: "First payment" },
    { key: "secondPayment", label: "Second payment" },
    { key: "thirdPayment", label: "Third payment" },
  ];

  const installmentAmount = (key: InstallmentKey): number => {
    const raw = String(s.football[key]?.amount ?? "")
      .replace(/[^\d.,-]/g, "")
      .replace(",", ".");
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  };
  const installmentsTotal = installmentRows.reduce(
    (sum, { key }) => sum + installmentAmount(key),
    0,
  );

  const paymentMethod = normalizePaymentTypeValue(s.football.paymentMethod);
  const canSendPaymentModule = paymentMethodIn(
    SEND_PAYMENT_MODULE_METHODS,
    paymentMethod,
  );
  const canBeVerified = paymentMethodIn(TO_BE_VERIFIED_METHODS, paymentMethod);
  const canMarkPaid = paymentMethodIn(
    PAID_AT_FIRST_DEADLINE_METHODS,
    paymentMethod,
  );
  const paidKeys = deadlines.paidKeys ?? [];
  const isFullyPaid = (key: InstallmentKey) => paidKeys.includes(key);
  /** Next open deadline that can receive the Paid tick (previous ones must be fully paid). */
  const nextPayableKey =
    installmentRows.find(({ key }) => !isFullyPaid(key) && installmentAmount(key) > 0)
      ?.key ?? null;
  const paymentMethodChoices = useMemo(() => {
    const tagged = sanitizeDefaultPaymentMethods(defaultPaymentMethods);
    const catalog = clubEnabledPayments
      ? PAYMENT_TYPE_OPTIONS.filter((o) => clubEnabledPayments.includes(o.value))
      : PAYMENT_TYPE_OPTIONS;
    const list =
      tagged.length > 0
        ? catalog.filter((o) => tagged.includes(o.value))
        : [...catalog];
    return list.map((o) => ({ value: o.value as string, label: o.label }));
  }, [clubEnabledPayments, defaultPaymentMethods]);
  const savedMethodOutsideDefaults =
    paymentMethod !== "" &&
    !paymentMethodChoices.some((o) => o.value === paymentMethod);

  const setPaymentMethod = (value: string) => {
    patchSettings((prev) => {
      const recordedPaid = prev.football.deadlines?.paidKeys ?? [];
      const methodAllows = paymentMethodIn(PAID_AT_FIRST_DEADLINE_METHODS, value);
      const nextFootball = { ...prev.football, paymentMethod: value };
      for (const key of INSTALLMENT_KEYS) {
        const fullyPaid = recordedPaid.includes(key);
        if (fullyPaid || methodAllows) continue;
        nextFootball[key] = { ...nextFootball[key], status: "" };
      }
      return {
        ...prev,
        football: {
          ...nextFootball,
          paymentToBeVerified:
            prev.football.paymentToBeVerified &&
            paymentMethodIn(TO_BE_VERIFIED_METHODS, value),
        },
      };
    });
  };

  const [sendingModule, setSendingModule] = useState(false);
  const [moduleMessage, setModuleMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const sendPaymentModule = async () => {
    if (!canSendPaymentModule || !clubId || !memberUserId) return;
    setSendingModule(true);
    setModuleMessage(null);
    try {
      const res = await fetch(
        `/api/clubs/${encodeURIComponent(clubId)}/members/${encodeURIComponent(memberUserId)}/send-payment-module`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            paymentMethod,
            annualMembershipFee: s.football.annualMembershipFee,
            installments: installmentRows.map(({ key, label }) => ({
              label,
              date: s.football[key].date,
              amount: s.football[key].amount,
            })),
          }),
        },
      );
      const json = await res.json().catch(() => ({}));
      setModuleMessage(
        res.ok
          ? {
              ok: true,
              text: json.payUrl
                ? `Payment module sent. ${
                    json.emailed
                      ? "An email with the link was sent."
                      : "No email was sent because this member has no email address."
                  } The member pays here: ${json.payUrl}`
                : "Payment module sent to the member in Messages.",
            }
          : {
              ok: false,
              text: json.error || "Could not send the payment module.",
            },
      );
    } catch {
      setModuleMessage({
        ok: false,
        text: "Could not send the payment module.",
      });
    } finally {
      setSendingModule(false);
    }
  };

  const newlyPaidKeys = installmentRows
    .map(({ key }) => key)
    .filter(
      (key) =>
        s.football[key].status === "Paid" &&
        canMarkPaid &&
        !isFullyPaid(key) &&
        installmentAmount(key) > 0,
    );
  const paidMissingAmount =
    canMarkPaid &&
    nextPayableKey != null &&
    s.football[nextPayableKey].status === "Paid" &&
    !isFullyPaid(nextPayableKey) &&
    installmentAmount(nextPayableKey) <= 0;
  const pendingFiling =
    (s.football.paymentStatus === CREATE_DEADLINES_PAYMENT_STATUS &&
      installmentRows.some(
        ({ key }) => !isFiled(key) && installmentAmount(key) > 0,
      )) ||
    newlyPaidKeys.length > 0;
  const installmentsTotalLabel = Number.isInteger(installmentsTotal)
    ? String(installmentsTotal)
    : installmentsTotal.toFixed(2);

  const unfiledWithAmount = installmentRows.some(
    ({ key }) => !isFiled(key) && installmentAmount(key) > 0,
  );

  /** Files installment rows into Archive of the Deadlines. */
  const createDeadlinesNow = () => {
    if (readOnlyClub || saving) return;
    if (!unfiledWithAmount) {
      window.alert(
        deadlines.recordId
          ? "All payment deadlines are already in the Archive of the Deadlines."
          : "Enter at least one payment amount before creating deadlines.",
      );
      return;
    }
    saveAfterPatchRef.current = true;
    patchSettings((prev) => ({
      ...prev,
      football: {
        ...prev.football,
        paymentStatus: CREATE_DEADLINES_PAYMENT_STATUS,
      },
    }));
  };

  /** Paid tick → save so archives update and the Paid box jumps to the next deadline. */
  const markInstallmentPaidAndSave = (key: InstallmentKey, paid: boolean) => {
    if (paid) {
      if (!canMarkPaid || installmentAmount(key) <= 0) {
        if (installmentAmount(key) <= 0) {
          window.alert("Enter the payment amount before marking it as Paid.");
        }
        return;
      }
      saveAfterPatchRef.current = true;
    }
    patchInstallment(key, "status", paid ? "Paid" : "");
  };

  return (
    <div>
      {showVisibility ? (
        <SectionCard title="Member visibility" tone="purple">
          <CheckRow
            label="Allow member to read Settings"
            checked={club.visibility.settings}
            disabled={readOnlyClub}
            onChange={(v) =>
              setClub((c) => ({
                ...c,
                visibility: { ...c.visibility, settings: v },
              }))
            }
          />
        </SectionCard>
      ) : null}

      {!subscriptionOnly ? (
      <>
      <SectionCard title="Type of payments — method default" tone="red">
        <div className="mb-3 flex items-start justify-between gap-3">
          <p className="text-xs text-gray-600">
            Tag up to {MAX_DEFAULT_PAYMENT_METHODS} payment types shown first on
            payment forms. Operators can choose <strong>Others</strong> to see
            the remaining types.
          </p>
          <button
            type="button"
            onClick={() => setPaymentInfoOpen(true)}
            className="shrink-0 text-sm font-semibold text-red-600 hover:text-red-800 hover:underline"
          >
            Info
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(clubEnabledPayments
            ? PAYMENT_TYPE_OPTIONS.filter((method) => clubEnabledPayments.includes(method.value))
            : PAYMENT_TYPE_OPTIONS
          ).map((method) => {
            const checked = defaultPaymentMethods.includes(method.value);
            const disableNew =
              !checked &&
              defaultPaymentMethods.length >= MAX_DEFAULT_PAYMENT_METHODS;
            return (
              <label
                key={method.value}
                className={`inline-flex items-center gap-2 text-sm ${
                  disableNew ? "text-gray-400" : "text-gray-800"
                }`}
              >
                <input
                  type="checkbox"
                  disabled={
                    !canEditPaymentDefaults || readOnlyClub || disableNew
                  }
                  checked={checked}
                  onChange={() => toggleDefaultPaymentMethod(method.value)}
                />
                <span>{method.label}</span>
              </label>
            );
          })}
        </div>
        {defaultsMessage ? (
          <p className="mt-2 text-xs text-red-600">{defaultsMessage}</p>
        ) : (
          <p className="mt-2 text-xs text-gray-500">
            Selected: {defaultPaymentMethods.length}/
            {MAX_DEFAULT_PAYMENT_METHODS}
          </p>
        )}
      </SectionCard>
      <PaymentInfoModal
        open={paymentInfoOpen}
        onClose={() => setPaymentInfoOpen(false)}
        memberLanguage={memberLanguage}
      />

      <SectionCard title="Other settings">
        <Row2>
          <Field label="Heart rate">
            <TextInput
              disabled={readOnlyClub}
              inputMode="numeric"
              maxLength={3}
              value={s.heartRate}
              placeholder="heart rate min"
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
                if (digits === "") {
                  patchSettings((prev) => ({ ...prev, heartRate: "" }));
                  return;
                }
                let n = Number.parseInt(digits, 10);
                if (!Number.isFinite(n)) {
                  patchSettings((prev) => ({ ...prev, heartRate: "" }));
                  return;
                }
                if (n > 199) n = 199;
                // Allow typing below 30 until the value is complete (3 digits).
                if (digits.length >= 3 && n < 30) n = 30;
                patchSettings((prev) => ({
                  ...prev,
                  heartRate: String(n),
                }));
              }}
              onBlur={() => {
                const raw = String(s.heartRate || "").replace(/\D/g, "");
                if (!raw) return;
                let n = Number.parseInt(raw, 10);
                if (!Number.isFinite(n)) return;
                n = Math.min(199, Math.max(30, n));
                if (String(n) !== s.heartRate) {
                  patchSettings((prev) => ({ ...prev, heartRate: String(n) }));
                }
              }}
            />
          </Field>
          <Field label="Athletic level">
            <TextSelect
              disabled={readOnlyClub}
              value={s.athleticLevel}
              onChange={(e) =>
                patchSettings((prev) => ({
                  ...prev,
                  athleticLevel: e.target.value,
                }))
              }
            >
              <option value="">—</option>
              {ATHLETIC_LEVEL_OPTIONS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </TextSelect>
          </Field>
          <Field label="Sharing default">
            <TextSelect
              disabled={readOnlyClub}
              value={s.sharingDefault}
              onChange={(e) =>
                patchSettings((prev) => ({
                  ...prev,
                  sharingDefault: e.target.value,
                }))
              }
            >
              {SHARING_DEFAULT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </TextSelect>
          </Field>
          <Field label="Receive follow ups notifications and mails">
            <TextSelect
              disabled={readOnlyClub}
              value={s.followUpNotifications}
              onChange={(e) =>
                patchSettings((prev) => ({
                  ...prev,
                  followUpNotifications: e.target.value,
                }))
              }
            >
              {FOLLOW_UP_NOTIFICATION_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </TextSelect>
          </Field>
        </Row2>
        <div className="mt-3 flex flex-wrap gap-4">
          <CheckRow
            label="Information and updates"
            disabled={readOnlyClub}
            checked={s.informationUpdates}
            onChange={(v) =>
              patchSettings((prev) => ({ ...prev, informationUpdates: v }))
            }
          />
          <CheckRow
            label="Receipt issued"
            disabled={readOnlyClub}
            checked={s.football.receiptIssued}
            onChange={(v) =>
              patchSettings((prev) => ({
                ...prev,
                football: { ...prev.football, receiptIssued: v },
              }))
            }
          />
          <CheckRow
            label="Image release"
            disabled={readOnlyClub}
            checked={s.football.imageRelease}
            onChange={(v) =>
              patchSettings((prev) => ({
                ...prev,
                football: { ...prev.football, imageRelease: v },
              }))
            }
          />
          <CheckRow
            label="Travel authorization"
            disabled={readOnlyClub}
            checked={s.football.travelAuthorization}
            onChange={(v) =>
              patchSettings((prev) => ({
                ...prev,
                football: { ...prev.football, travelAuthorization: v },
              }))
            }
          />
        </div>
      </SectionCard>

      <SectionCard title="Label Settings" tone="red">
        <div className="mb-2 flex items-start justify-end">
          <button
            type="button"
            onClick={() => setPaymentInfoOpen(true)}
            className="shrink-0 text-sm font-semibold text-red-600 hover:text-red-800 hover:underline"
          >
            Info
          </button>
        </div>
        <div className="space-y-3 text-sm text-gray-800">
          <label className="flex items-start gap-2">
            <input
              type="radio"
              name="member-setting-kind"
              disabled={readOnlyClub}
              checked={memberSettingKind === "club"}
              onChange={() =>
                patchSettings((prev) => ({
                  ...prev,
                  memberSettingKind: "club",
                  clubGymEnabled: true,
                  teamFootballEnabled: false,
                  sportMode: "CLUB-GYM",
                }))
              }
              className="mt-1"
            />
            <span>
              These settings if the member is member of a{" "}
              <strong>CLUB-GYM</strong>
            </span>
          </label>

          <label className="flex items-start gap-2">
            <input
              type="radio"
              name="member-setting-kind"
              disabled={readOnlyClub}
              checked={memberSettingKind === "team"}
              onChange={() =>
                patchSettings((prev) => ({
                  ...prev,
                  memberSettingKind: "team",
                  clubGymEnabled: false,
                  teamFootballEnabled: true,
                  sportMode: "TEAM-FOOTBALL",
                  teamSport: normalizeEntitySport(
                    prev.teamSport || entitySportDefault || "Football",
                  ),
                }))
              }
              className="mt-1"
            />
            <span>
              These settings if the member is member of a <strong>Team</strong>
            </span>
          </label>

          {memberSettingKind === "team" ? (
            <Field label="Type of team">
              <TextSelect
                disabled={readOnlyClub}
                value={normalizeEntitySport(s.teamSport || entitySportDefault)}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    teamSport: e.target.value,
                  }))
                }
              >
                {ENTITY_SPORT_OPTIONS.map((sport) => (
                  <option key={sport} value={sport}>
                    {st(sport)}
                  </option>
                ))}
              </TextSelect>
              <p className="mt-1 text-xs text-gray-500">
                Default from Team/Club profile:{" "}
                {entitySportDefault || "Football"}
              </p>
            </Field>
          ) : null}
        </div>
      </SectionCard>

      {memberSettingKind === "team" ? (
        <SectionCard title="Team and roles">
          <Row2 className="md:items-end">
            {athleteProfile.currentTeam !== false ? (
              <Field
                label={st(
                  athleteProfile.currentTeam ||
                    (workspaceKind === "team" ? "Team names" : "Club names"),
                )}
                labelClassName="text-lg"
              >
                <TextInput
                  className="h-9"
                  disabled={readOnlyClub}
                  value={s.football.teamNames}
                  onChange={(e) =>
                    patchSettings((prev) => ({
                      ...prev,
                      football: { ...prev.football, teamNames: e.target.value },
                    }))
                  }
                />
              </Field>
            ) : null}
            <Field label="Previous club">
              <TextInput
                className="h-9"
                disabled={readOnlyClub}
                value={s.football.previousClub}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: {
                      ...prev.football,
                      previousClub: e.target.value,
                    },
                  }))
                }
              />
            </Field>
            <Field label="Release date">
              <TextInput
                className="h-9"
                type="date"
                disabled={readOnlyClub}
                value={s.football.releaseDate}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, releaseDate: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Player registration">
              <TextSelect
                className="h-9"
                disabled={readOnlyClub}
                value={s.football.playerRegistration}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: {
                      ...prev.football,
                      playerRegistration: e.target.value,
                    },
                  }))
                }
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </TextSelect>
            </Field>
            {sportFields?.registrationType ? (
              <Field label="Registration type">
                <TextSelect
                  className="h-9"
                  disabled={readOnlyClub}
                  value={s.football.registrationType}
                  onChange={(e) =>
                    patchSettings((prev) => ({
                      ...prev,
                      football: {
                        ...prev.football,
                        registrationType: e.target.value,
                      },
                    }))
                  }
                >
                  <option value="">—</option>
                  {registrationTypeOptions.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                  {s.football.registrationType &&
                  !registrationTypeOptions.includes(
                    s.football.registrationType,
                  ) ? (
                    <option value={s.football.registrationType}>
                      {s.football.registrationType}
                    </option>
                  ) : null}
                </TextSelect>
              </Field>
            ) : null}
            <Field label="Sports season">
              <TextInput
                className="h-9"
                disabled={readOnlyClub}
                value={s.football.sportsSeason}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: {
                      ...prev.football,
                      sportsSeason: e.target.value,
                    },
                  }))
                }
              />
            </Field>
          </Row2>

          <Row2>
            <Field label={`${sportFields?.labels.category ?? categoryLabel} **`}>
              <TextSelect
                disabled={readOnlyClub || categoryOptions.length === 0}
                value={s.football.category}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, category: e.target.value },
                  }))
                }
              >
                <option value="">—</option>
                {categoryOptions.map((o) => (
                  <option key={o.id} value={o.label}>
                    {o.label}
                  </option>
                ))}
                {s.football.category &&
                !categoryOptions.some(
                  (o) => o.label === s.football.category,
                ) ? (
                  <option value={s.football.category}>
                    {s.football.category}
                  </option>
                ) : null}
              </TextSelect>
              {categoryOptions.length === 0 ? (
                <p className="mt-1 text-xs text-gray-500">
                  Options from Super Admin → Sport settings → Tools Settings →
                  Dropdown parameters for sport ({teamSportKey}).
                </p>
              ) : null}
            </Field>
            {roleLabel ? (
              <SportChoiceField
                label={`${roleLabel} **`}
                value={s.football.position}
                choices={roleChoices}
                disabled={readOnlyClub}
                hint={roleChoices?.length ? null : catalogHint}
                onChange={(value) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, position: value },
                  }))
                }
              />
            ) : null}
            {subRoleLabel ? (
              <SportChoiceField
                label={`${subRoleLabel} **`}
                value={s.football.specialty}
                choices={subRoleChoices}
                disabled={readOnlyClub}
                hint={subRoleChoices?.length ? null : catalogHint}
                onChange={(value) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, specialty: value },
                  }))
                }
              />
            ) : null}
          </Row2>
        </SectionCard>
      ) : null}

      {memberSettingKind === "team" && athleteExtraFields.length > 0 ? (
        <SectionCard title="Details about sport selected">
          <div
            className="rounded border border-gray-200 bg-gray-50 p-3"
            data-testid="athlete-sport-fields"
          >
            <p className="mb-2 text-sm font-semibold text-gray-800">
              {st(selectedTeamSport)} {st("fields")}
            </p>
            <Row2>
              {athleteExtraFields.map((def) => {
                if (def.multi && def.options && def.options.length > 0) {
                  const selected = decodeMultiSportValues(
                    athleteSportValues[def.key] ?? "",
                  );
                  return (
                    <div
                      key={def.key}
                      className="col-span-full flex flex-col justify-end sm:col-span-2"
                    >
                      <Field label={`${st(def.label)} (multicheck)`}>
                        <div className="flex flex-wrap gap-x-4 gap-y-2 rounded border border-gray-200 bg-white px-3 py-2">
                          {def.options.map((choice) => {
                            const checked = selected.includes(choice);
                            return (
                              <CheckRow
                                key={choice}
                                label={st(choice)}
                                disabled={readOnlyClub}
                                checked={checked}
                                onChange={(on) => {
                                  const next = on
                                    ? [...selected, choice]
                                    : selected.filter((v) => v !== choice);
                                  setAthleteSportValue(
                                    def.key,
                                    encodeMultiSportValues(next),
                                  );
                                }}
                              />
                            );
                          })}
                        </div>
                      </Field>
                    </div>
                  );
                }
                return (
                  <div key={def.key} className="flex flex-col justify-end">
                    <SportChoiceField
                      label={def.label}
                      value={athleteSportValues[def.key] ?? ""}
                      choices={def.options}
                      disabled={readOnlyClub}
                      onChange={(value) => setAthleteSportValue(def.key, value)}
                    />
                  </div>
                );
              })}
            </Row2>
          </div>
        </SectionCard>
      ) : null}

      {memberSettingKind === "team" ? (
        <SectionCard title="Physical parameters">
          <Row2>
            {athleteProfile.footHand !== false ? (
              <SportChoiceField
                label={
                  athleteProfile.footHand ??
                  sportFields?.labels.footHand ??
                  "Foot/Hand"
                }
                value={s.football.footHand}
                choices={
                  athleteProfile.footHandOptions ?? [
                    "Right",
                    "Left",
                    "Ambidextrous",
                  ]
                }
                disabled={readOnlyClub}
                onChange={(value) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, footHand: value },
                  }))
                }
              />
            ) : null}
            {athleteProfile.jersey !== false ? (
              <Field label={st(athleteProfile.jersey || "Jersey number")}>
                <TextInput
                  disabled={readOnlyClub}
                  value={s.football.jerseyNumber}
                  onChange={(e) =>
                    patchSettings((prev) => ({
                      ...prev,
                      football: {
                        ...prev.football,
                        jerseyNumber: e.target.value,
                      },
                    }))
                  }
                />
              </Field>
            ) : null}
            <Field label="Jersey size (alphanumeric, max 5)">
              <TextInput
                disabled={readOnlyClub}
                maxLength={5}
                inputMode="text"
                autoComplete="off"
                value={s.football.jerseySize}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: {
                      ...prev.football,
                      jerseySize: e.target.value
                        .replace(/[^a-zA-Z0-9]/g, "")
                        .slice(0, 5),
                    },
                  }))
                }
              />
            </Field>
            <Field label="Shorts size (alphanumeric, max 5)">
              <TextInput
                disabled={readOnlyClub}
                maxLength={5}
                inputMode="text"
                autoComplete="off"
                value={s.football.shortsSize}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: {
                      ...prev.football,
                      shortsSize: e.target.value
                        .replace(/[^a-zA-Z0-9]/g, "")
                        .slice(0, 5),
                    },
                  }))
                }
              />
            </Field>
            <Field label="Shoe size (00.0)">
              <TextInput
                disabled={readOnlyClub}
                inputMode="decimal"
                autoComplete="off"
                placeholder="00.0"
                value={s.football.shoeSize}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^\d.]/g, "");
                  const parts = cleaned.split(".");
                  const whole = (parts[0] || "").slice(0, 2);
                  const frac = (parts[1] || "").slice(0, 1);
                  const shoeSize =
                    parts.length > 1 ? `${whole}.${frac}` : whole;
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, shoeSize },
                  }));
                }}
              />
            </Field>
          </Row2>

          <Row2>
            <Field label="Shoes number">
              <TextSelect
                disabled={readOnlyClub}
                value={s.football.shoesNumber}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, shoesNumber: e.target.value },
                  }))
                }
              >
                <option value="">—</option>
                {Array.from({ length: 21 }, (_, i) => String(30 + i)).map(
                  (n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ),
                )}
              </TextSelect>
            </Field>
            <div />
          </Row2>

          <Row4>
            <Field label="Weight">
              <TextInput
                disabled={readOnlyClub}
                value={s.football.weight}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, weight: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Height">
              <TextInput
                disabled={readOnlyClub}
                value={s.football.height}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, height: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Reaction time">
              <TextInput
                disabled={readOnlyClub}
                value={s.football.reactionTime}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: {
                      ...prev.football,
                      reactionTime: e.target.value,
                    },
                  }))
                }
              />
            </Field>
            <Field label={st(athleteProfile.verticalJumpLabel ?? "Vertical jump")}>
              <TextInput
                disabled={readOnlyClub}
                value={s.football.verticalJump}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: {
                      ...prev.football,
                      verticalJump: e.target.value,
                    },
                  }))
                }
              />
            </Field>
          </Row4>
        </SectionCard>
      ) : null}

      {memberSettingKind === "team" ? (
        <SectionCard title="Sport played and current coach">
          <Field label="Sports played">
            <div className="flex flex-wrap gap-3">
              {MAIN_SPORTS.map((sp) => (
                <CheckRow
                  key={sp}
                  label={sp}
                  disabled={readOnlyClub}
                  checked={s.football.sportsPlayed.includes(sp)}
                  onChange={(v) =>
                    patchSettings((prev) => ({
                      ...prev,
                      football: {
                        ...prev.football,
                        sportsPlayed: v
                          ? [...prev.football.sportsPlayed, sp]
                          : prev.football.sportsPlayed.filter((x) => x !== sp),
                      },
                    }))
                  }
                />
              ))}
            </div>
          </Field>
          <Row2>
            <Field label="Coach">
              <TextInput
                disabled={readOnlyClub}
                value={s.football.coach}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, coach: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Start date with this team">
              <TextInput
                type="date"
                disabled={readOnlyClub}
                value={s.football.startDateWithTeam}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: {
                      ...prev.football,
                      startDateWithTeam: e.target.value,
                    },
                  }))
                }
              />
            </Field>
          </Row2>
        </SectionCard>
      ) : null}

      {memberSettingKind === "club" ? (
        <>
          <SectionCard title="Last Membership to the Club (managed by the Club Admin)">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm text-blue-800">
              <span>Edit dates below</span>
              <div className="flex flex-wrap gap-2">
                {!readOnlyClub ? (
                  <button
                    type="button"
                    disabled={saving || membershipBusy}
                    onClick={() => void loadMembershipFromArchive()}
                    className="rounded border border-blue-700 px-2 py-1 text-xs font-semibold hover:bg-blue-50"
                  >
                    Load from archive
                  </button>
                ) : null}
                {!readOnlyClub ? (
                  <button
                    type="button"
                    disabled={saving || membershipBusy}
                    onClick={renewMembership}
                    className="rounded bg-blue-800 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-900"
                  >
                    Renew (+1 year)
                  </button>
                ) : (
                  <span>Renew</span>
                )}
              </div>
            </div>
            <Row2>
              <Field label="Membership from">
                <TextInput
                  type="date"
                  disabled={readOnlyClub}
                  value={od.membershipFrom}
                  onChange={(e) =>
                    setClub((c) => ({
                      ...c,
                      otherDetails: {
                        ...c.otherDetails,
                        membershipFrom: e.target.value,
                      },
                    }))
                  }
                />
              </Field>
              <Field label="Membership to (expiration)">
                <TextInput
                  type="date"
                  disabled={readOnlyClub}
                  value={od.membershipTo}
                  onChange={(e) =>
                    setClub((c) => ({
                      ...c,
                      otherDetails: {
                        ...c.otherDetails,
                        membershipTo: e.target.value,
                      },
                    }))
                  }
                />
              </Field>
            </Row2>
            <p className="mt-2 text-xs text-red-700">
              Last membership can also be loaded from the Archive of Memberships.
              Editing these dates may update membership archive data. Renew updates
              these dates.
            </p>
            {membershipHint ? (
              <p className="mt-2 text-xs font-medium text-gray-700">{membershipHint}</p>
            ) : null}
          </SectionCard>

          <SectionCard title="Preferences">
            <p className="mb-3 text-sm font-semibold text-gray-800">
              Default assigned
            </p>
            <Field label="Member type">
              <TextSelect
                disabled={readOnlyClub || memberTypesLoading}
                value={s.memberTypeId}
                onChange={(e) => applyMemberType(e.target.value)}
              >
                <option value="">
                  {memberTypesLoading
                    ? "Loading…"
                    : memberTypes.length === 0
                      ? "No member types yet"
                      : "Select"}
                </option>
                {memberTypes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
                {s.memberTypeId &&
                !memberTypes.some((item) => item.id === s.memberTypeId) ? (
                  <option value={s.memberTypeId}>
                    Saved type #{s.memberTypeId}
                  </option>
                ) : null}
              </TextSelect>
              {!memberTypesLoading && memberTypes.length === 0 ? (
                <p className="mt-1 text-xs text-gray-500">
                  Add types under{" "}
                  <a
                    href="/club/settings/tables/member_type"
                    className="text-blue-800 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Club management → Administration → General settings → Tables →
                    Member type
                  </a>
                  . Choosing a type fills Discount % automatically.
                </p>
              ) : null}
            </Field>
            <p className="mb-2 mt-3 text-sm font-semibold text-gray-800">
              Discount %
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] border border-gray-300 text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    {(
                      [
                        ["subscript", "Subscript"],
                        ["service", "Service"],
                        ["barRest", "Bar/Rest"],
                        ["supply", "Supply"],
                        ["clothing", "Clothing"],
                        ["outfit", "Outfit"],
                      ] as const
                    ).map(([key, label]) => (
                      <th
                        key={key}
                        className="border border-gray-300 px-2 py-1.5 text-left"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {(
                      [
                        "subscript",
                        "service",
                        "barRest",
                        "supply",
                        "clothing",
                        "outfit",
                      ] as const
                    ).map((key) => (
                      <td key={key} className="border border-gray-300 p-1">
                        <TextInput
                          disabled={readOnlyClub}
                          value={s.discounts[key]}
                          maxLength={2}
                          onChange={(e) =>
                            patchSettings((prev) => ({
                              ...prev,
                              discounts: {
                                ...prev.discounts,
                                [key]: e.target.value,
                              },
                            }))
                          }
                          className="bg-[#fffde7]"
                        />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="Maximum permitted total debt at the time of the purchases">
            <Field label="Debt purchases">
              <TextInput
                disabled={readOnlyClub}
                inputMode="numeric"
                maxLength={4}
                value={s.debtPurchases}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
                  if (digits === "") {
                    patchSettings((prev) => ({ ...prev, debtPurchases: "" }));
                    return;
                  }
                  const n = Math.min(
                    9999,
                    Math.max(0, Number.parseInt(digits, 10)),
                  );
                  patchSettings((prev) => ({
                    ...prev,
                    debtPurchases: Number.isFinite(n) ? String(n) : "",
                  }));
                }}
              />
            </Field>
          </SectionCard>

          <SectionCard title="Access & display functions">
            <CheckRow
              label="Enable Access control, debt at access, and secondary screen functions"
              disabled={readOnlyClub}
              checked={accessFunctionsEnabled}
              onChange={(v) =>
                patchSettings((prev) => ({
                  ...prev,
                  accessFunctionsEnabled: v,
                }))
              }
            />
            {!accessFunctionsEnabled ? (
              <p className="mt-2 text-xs text-gray-500">
                Uncheck to disable access control, debt-at-access, and secondary
                screen for this club member.
              </p>
            ) : null}
          </SectionCard>

          <SectionCard title="Access control about the member">
            <p className="mb-2 text-sm font-semibold text-gray-800">
              Type of control enabled on this member
            </p>
            <div
              className={`space-y-3 text-sm ${accessFieldsDisabled ? "opacity-60" : ""}`}
            >
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  disabled={accessFieldsDisabled}
                  checked={ac.activeBlockAccess === "analyzes_all"}
                  onChange={() =>
                    patchSettings((prev) => ({
                      ...prev,
                      accessControl: {
                        ...prev.accessControl,
                        activeBlockAccess: "analyzes_all",
                      },
                    }))
                  }
                  className="mt-1"
                />
                <span>
                  <strong>Analyzes all the parameters for the access</strong>{" "}
                  (default status)
                </span>
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    disabled={accessFieldsDisabled}
                    checked={ac.activeBlockAccess === "free_access"}
                    onChange={() =>
                      patchSettings((prev) => ({
                        ...prev,
                        accessControl: {
                          ...prev.accessControl,
                          activeBlockAccess: "free_access",
                        },
                      }))
                    }
                  />
                  <strong>
                    Authorized to{" "}
                    <span className="text-green-700">free access</span> until
                  </strong>
                </label>
                <TextInput
                  type="date"
                  disabled={
                    accessFieldsDisabled ||
                    ac.activeBlockAccess !== "free_access"
                  }
                  value={ac.freeAccessDate}
                  onChange={(e) =>
                    patchSettings((prev) => ({
                      ...prev,
                      accessControl: {
                        ...prev.accessControl,
                        freeAccessDate: e.target.value,
                      },
                    }))
                  }
                  className="max-w-[11rem]"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    disabled={accessFieldsDisabled}
                    checked={ac.activeBlockAccess === "access_from"}
                    onChange={() =>
                      patchSettings((prev) => ({
                        ...prev,
                        accessControl: {
                          ...prev.accessControl,
                          activeBlockAccess: "access_from",
                        },
                      }))
                    }
                  />
                  <strong className="text-red-700">
                    Active block access from
                  </strong>
                </label>
                <TextInput
                  type="date"
                  disabled={
                    accessFieldsDisabled ||
                    ac.activeBlockAccess !== "access_from"
                  }
                  value={ac.activeBlockAccessFrom}
                  onChange={(e) =>
                    patchSettings((prev) => ({
                      ...prev,
                      accessControl: {
                        ...prev.accessControl,
                        activeBlockAccessFrom: e.target.value,
                      },
                    }))
                  }
                  className="max-w-[11rem]"
                />
                <strong className="text-red-700">to</strong>
                <TextInput
                  type="date"
                  disabled={
                    accessFieldsDisabled ||
                    ac.activeBlockAccess !== "access_from"
                  }
                  value={ac.activeBlockAccessTo}
                  onChange={(e) =>
                    patchSettings((prev) => ({
                      ...prev,
                      accessControl: {
                        ...prev.accessControl,
                        activeBlockAccessTo: e.target.value,
                      },
                    }))
                  }
                  className="max-w-[11rem]"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Maximum permitted total debt at the time of access">
            <Field label="Debt max">
              <TextInput
                disabled={accessFieldsDisabled}
                value={ac.debtMax}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    accessControl: {
                      ...prev.accessControl,
                      debtMax: e.target.value,
                    },
                  }))
                }
              />
            </Field>
          </SectionCard>

          <SectionCard title="Personal setting for secondary screen">
            <CheckRow
              label="Personal setting for secondary screen"
              disabled={accessFieldsDisabled}
              checked={ss.enabled}
              onChange={(v) =>
                patchSettings((prev) => ({
                  ...prev,
                  secondaryScreen: { ...prev.secondaryScreen, enabled: v },
                }))
              }
            />
            <p className="mb-2 text-sm text-gray-700">
              Permission to display &amp; playback in the access control
            </p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {(
                [
                  ["memberName", "Member's name"],
                  ["expSubscription", "Expiration of subscription"],
                  ["memberPhoto", "Member's photo"],
                  ["outcomeAccess", "Outcome of the access"],
                  ["residualDebt", "Residual debt"],
                  ["audioMessages", "Audio messages by club's staff"],
                  ["birthDay", "Birth day"],
                  ["otherManagementData", "Other management data"],
                  ["msgFromOtherMember", "Messages from other members"],
                ] as const
              ).map(([key, label]) => (
                <CheckRow
                  key={key}
                  label={label}
                  disabled={accessFieldsDisabled || !ss.enabled}
                  checked={ss[key]}
                  onChange={(v) =>
                    patchSettings((prev) => ({
                      ...prev,
                      secondaryScreen: { ...prev.secondaryScreen, [key]: v },
                    }))
                  }
                />
              ))}
            </div>
          </SectionCard>
        </>
      ) : null}

      </>
      ) : null}

      {subscriptionOnly ? (
        <SectionCard title="Current subscription">
          <Field label={sportFields?.labels.athleteStatus ?? "Athlete status"}>
            <div className="flex flex-wrap gap-4">
              {TEAM_ATHLETE_STATUS_OPTIONS.map((status) => (
                <label
                  key={status}
                  className="inline-flex items-center gap-2 text-sm text-gray-800"
                >
                  <input
                    type="radio"
                    name="settingsAthleteStatus"
                    disabled={readOnlyClub}
                    checked={s.football.athleteStatus === status}
                    onChange={() =>
                      patchSettings((prev) => ({
                        ...prev,
                        football: { ...prev.football, athleteStatus: status },
                      }))
                    }
                    className="border-gray-400"
                  />
                  {status}
                </label>
              ))}
            </div>
          </Field>

          {sportFields?.registrationStatus ? (
            <Field label="Status">
              <div className="flex flex-wrap gap-4">
                {TEAM_REGISTRATION_STATUS_OPTIONS.map((status) => (
                  <label
                    key={status}
                    className="inline-flex items-center gap-2 text-sm text-gray-800"
                  >
                    <input
                      type="radio"
                      name="settingsRegistrationStatus"
                      disabled={readOnlyClub}
                      checked={s.football.registrationStatus === status}
                      onChange={() =>
                        patchSettings((prev) => ({
                          ...prev,
                          football: {
                            ...prev.football,
                            registrationStatus: status,
                          },
                        }))
                      }
                      className="border-gray-400"
                    />
                    {status}
                  </label>
                ))}
              </div>
            </Field>
          ) : null}

          {sportFields?.administrativeSummary ? (
            <div className="mt-3">
              <Row4>
                <Field label="Fiscal code">
                  <TextInput
                    disabled
                    value={ownerAdministrative?.fiscalCode ?? ""}
                  />
                </Field>
                <Field label="Citizenship">
                  <TextInput
                    disabled
                    value={ownerAdministrative?.citizenship ?? ""}
                  />
                </Field>
                <Field label="IBAN">
                  <TextInput disabled value={ownerAdministrative?.iban ?? ""} />
                </Field>
                <div />
              </Row4>
              <p className="mt-1 text-xs text-gray-500">
                From the member&apos;s Owner profile → Administrative data.
              </p>
            </div>
          ) : null}

          {/* Settings: Administration frame (like Payments), from Membership Registration → fee.
              Administration tab (subscriptionOnly) keeps a flat Current-subscription layout. */}
          {!subscriptionOnly ? (
            <div
              className="mt-3 space-y-3 rounded border border-slate-300 bg-slate-50 p-3"
              data-testid="administration-frame"
            >
              <p className="text-sm font-semibold text-gray-800">Administration</p>

              <Field label="Membership Registration to">
                <TextInput
                  disabled={readOnlyClub}
                  placeholder="Registered at.."
                  value={club.otherDetails.membershipRegistrationTo}
                  onChange={(e) =>
                    setClub((c) => ({
                      ...c,
                      otherDetails: {
                        ...c.otherDetails,
                        membershipRegistrationTo: e.target.value,
                      },
                    }))
                  }
                />
              </Field>

              <Row2>
                <Field label={sportFields?.labels.membershipNumber ?? "Membership number"}>
                  <TextInput
                    disabled={readOnlyClub}
                    value={s.football.membershipNumber}
                    onChange={(e) =>
                      patchSettings((prev) => ({
                        ...prev,
                        football: {
                          ...prev.football,
                          membershipNumber: e.target.value,
                        },
                      }))
                    }
                  />
                </Field>
                <Field label={sportFields?.labels.expiringDate ?? "Expiring date"}>
                  <TextInput
                    type="date"
                    disabled={readOnlyClub}
                    value={s.football.expiringDate}
                    onChange={(e) =>
                      patchSettings((prev) => ({
                        ...prev,
                        football: {
                          ...prev.football,
                          expiringDate: e.target.value,
                        },
                      }))
                    }
                  />
                </Field>
              </Row2>

              <Field label="Annual membership fee">
                <TextInput
                  disabled={readOnlyClub}
                  value={s.football.annualMembershipFee}
                  onChange={(e) =>
                    patchSettings((prev) => ({
                      ...prev,
                      football: {
                        ...prev.football,
                        annualMembershipFee: e.target.value,
                      },
                    }))
                  }
                />
              </Field>
            </div>
          ) : (
            <>
              <Row2>
                <Field label={sportFields?.labels.membershipNumber ?? "Membership number"}>
                  <TextInput
                    disabled={readOnlyClub}
                    value={s.football.membershipNumber}
                    onChange={(e) =>
                      patchSettings((prev) => ({
                        ...prev,
                        football: {
                          ...prev.football,
                          membershipNumber: e.target.value,
                        },
                      }))
                    }
                  />
                </Field>
                <Field label={sportFields?.labels.expiringDate ?? "Expiring date"}>
                  <TextInput
                    type="date"
                    disabled={readOnlyClub}
                    value={s.football.expiringDate}
                    onChange={(e) =>
                      patchSettings((prev) => ({
                        ...prev,
                        football: {
                          ...prev.football,
                          expiringDate: e.target.value,
                        },
                      }))
                    }
                  />
                </Field>
              </Row2>
              <Field label="Annual membership fee">
                <TextInput
                  disabled={readOnlyClub}
                  value={s.football.annualMembershipFee}
                  onChange={(e) =>
                    patchSettings((prev) => ({
                      ...prev,
                      football: {
                        ...prev.football,
                        annualMembershipFee: e.target.value,
                      },
                    }))
                  }
                />
              </Field>
            </>
          )}

          <div
            className="mt-3 space-y-3 rounded border border-emerald-200 bg-[#E2FFF2] p-3"
            data-testid="payments-frame"
          >
            <p className="text-sm font-semibold text-gray-800">Payments</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:items-end">
              <Field
                label="Payment method"
                labelExtra={
                  canBeVerified ? (
                    <label
                      className="inline-flex items-center gap-1 text-xs font-semibold text-red-600"
                      title="The payment is stored in grey in the Archive of the Payments until you confirm it was really received."
                    >
                      <input
                        type="checkbox"
                        disabled={readOnlyClub || paidKeys.length > 0}
                        checked={s.football.paymentToBeVerified}
                        onChange={(e) =>
                          patchSettings((prev) => ({
                            ...prev,
                            football: {
                              ...prev.football,
                              paymentToBeVerified: e.target.checked,
                            },
                          }))
                        }
                        className="h-3.5 w-3.5 border-red-400 accent-red-600"
                      />
                      To be verified
                    </label>
                  ) : null
                }
              >
                <TextSelect
                  disabled={readOnlyClub}
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="">—</option>
                  {paymentMethodChoices.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                  {savedMethodOutsideDefaults ? (
                    <option value={paymentMethod}>
                      {payModeLabel(paymentMethod)}
                    </option>
                  ) : null}
                </TextSelect>
              </Field>
              <div className="flex flex-col items-start gap-1 md:items-end">
                <button
                  type="button"
                  disabled={
                    readOnlyClub || !canSendPaymentModule || sendingModule
                  }
                  onClick={() => void sendPaymentModule()}
                  title={
                    canSendPaymentModule
                      ? "Sends the member a message with the payment request"
                      : "Available for Credit card, Debit card, PayPal, Satispay, MultisafePay, Apple Pay, Google Pay, Bank transfer, SEPA, CBILL and MAV"
                  }
                  className="h-9 rounded border border-red-800 bg-red-600 px-4 text-sm font-bold text-white shadow hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {sendingModule ? "Sending…" : "Send payment module"}
                </button>
                {moduleMessage ? (
                  <p
                    className={`text-xs ${moduleMessage.ok ? "text-emerald-700" : "text-red-600"}`}
                  >
                    {moduleMessage.text}
                  </p>
                ) : null}
              </div>
            </div>
            {installmentRows.map(({ key, label }, index) => {
              const filed = isFiled(key);
              const fullyPaid = isFullyPaid(key);
              const isNextPayable = nextPayableKey === key;
              const showPaidBox = fullyPaid || isNextPayable;
              const locked = readOnlyClub || filed;
              return (
                <div
                  key={key}
                  className="grid grid-cols-1 gap-2 md:grid-cols-2 md:items-end"
                >
                  <Field
                    label={`${label} date`}
                    labelExtra={
                      <>
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() =>
                            setInstallmentDate(key, autoInstallmentDate(key))
                          }
                          title={
                            index === 0
                              ? "Current day"
                              : `${AUTO_DAYS} days after the ${installmentRows[index - 1].label.toLowerCase()}`
                          }
                          className="rounded border border-red-300 px-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Auto
                        </button>
                        {showPaidBox ? (
                          <label
                            className={`inline-flex items-center gap-1 text-xs font-semibold ${
                              fullyPaid
                                ? "text-gray-400"
                                : canMarkPaid
                                  ? "text-red-600"
                                  : "text-gray-400"
                            }`}
                            title={
                              fullyPaid
                                ? "Fully paid — checkbox locked."
                                : canMarkPaid
                                  ? index === 0
                                    ? "Marks this deadline paid in the Archive of the Deadlines, adds the payment to the Archive of Payments, then moves Paid to the next deadline."
                                    : "Marks this deadline paid in the Archive of the Deadlines and adds the payment to the Archive of Payments."
                                  : "Choose Cash, Cheque, Payment slip or Bank transfer as payment method to mark as paid."
                            }
                          >
                            <input
                              type="checkbox"
                              disabled={
                                readOnlyClub || fullyPaid || !canMarkPaid
                              }
                              checked={
                                fullyPaid ||
                                (s.football[key].status === "Paid" && canMarkPaid)
                              }
                              onChange={(e) =>
                                markInstallmentPaidAndSave(
                                  key,
                                  e.target.checked,
                                )
                              }
                              className="h-3.5 w-3.5 border-red-400 accent-red-600 disabled:opacity-60"
                            />
                            Paid
                          </label>
                        ) : null}
                      </>
                    }
                    hint={
                      fullyPaid
                        ? "Paid — in the Archive of the Deadlines and the Archive of the Payments"
                        : filed
                          ? "In the Archive of the Deadlines"
                          : undefined
                    }
                  >
                    <TextInput
                      type="date"
                      disabled={locked}
                      value={s.football[key].date}
                      onChange={(e) => setInstallmentDate(key, e.target.value)}
                    />
                  </Field>
                  <Field
                    label={`${label} amount`}
                    hint={filed ? "\u00a0" : undefined}
                  >
                    <TextInput
                      disabled={locked}
                      value={s.football[key].amount}
                      onChange={(e) =>
                        patchInstallment(key, "amount", e.target.value)
                      }
                    />
                  </Field>
                </div>
              );
            })}
            <p className="text-right text-sm font-semibold text-red-600">
              Total : {installmentsTotalLabel}
            </p>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:items-end">
              <div className="flex flex-col gap-2 md:items-start">
                <button
                  type="button"
                  disabled={readOnlyClub || saving || !unfiledWithAmount}
                  onClick={createDeadlinesNow}
                  title="Generate the deadlines of payment in the Archive of the Deadlines"
                  className="h-9 rounded border border-red-800 bg-red-600 px-4 text-sm font-bold text-white shadow hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving &&
                  s.football.paymentStatus === CREATE_DEADLINES_PAYMENT_STATUS
                    ? "Creating…"
                    : "Create Deadlines"}
                </button>
                <p className="text-xs text-gray-600">
                  Creates all payment deadlines in the{" "}
                  <Link
                    href="/clubs/archive_deadlines"
                    className="font-semibold text-red-600 underline"
                  >
                    Archive of the Deadlines
                  </Link>
                  .
                </p>
              </div>
              <Field label="Payment status">
                <TextSelect
                  disabled={readOnlyClub}
                  value={
                    s.football.paymentStatus === CREATE_DEADLINES_PAYMENT_STATUS
                      ? "Pending"
                      : s.football.paymentStatus
                  }
                  onChange={(e) =>
                    patchSettings((prev) => ({
                      ...prev,
                      football: {
                        ...prev.football,
                        paymentStatus: e.target.value,
                      },
                    }))
                  }
                >
                  <option value="">—</option>
                  {PAYMENT_STATUS_OPTIONS.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </TextSelect>
              </Field>
            </div>
            {deadlines.recordId ||
            s.football.paymentStatus === CREATE_DEADLINES_PAYMENT_STATUS ||
            newlyPaidKeys.length > 0 ? (
              <p className="text-right text-xs text-gray-600">
                {deadlines.recordId ? (
                  <>
                    {deadlines.generated.length} deadline
                    {deadlines.generated.length === 1 ? "" : "s"} created
                    {deadlines.generatedAt
                      ? ` on ${formatDate(deadlines.generatedAt)}`
                      : ""}{" "}
                    in the{" "}
                    <Link
                      href="/clubs/archive_deadlines"
                      className="font-semibold text-red-600 underline"
                    >
                      Archive of the Deadlines
                    </Link>
                    .{" "}
                  </>
                ) : null}
                {pendingFiling && !saving
                  ? "Saving to update the archives… "
                  : null}
                {paidMissingAmount ? (
                  <span className="font-semibold text-red-600">
                    Enter the payment amount to record it as paid.
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>

        </SectionCard>
      ) : null}

      {!readOnlyClub ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="rounded bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {message ? (
            <span className="text-sm text-gray-700">{message}</span>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-xs text-gray-500">
          View only for your role on this section.
        </p>
      )}
    </div>
  );
}

/** Select when the sport gives choices, free text otherwise; keeps a saved value outside the list. */
function SportChoiceField({
  label,
  value,
  choices,
  disabled,
  hint,
  onChange,
}: {
  label: string;
  value: string;
  choices?: readonly string[];
  disabled: boolean;
  hint?: React.ReactNode;
  onChange: (value: string) => void;
}) {
  const st = useSportT();
  const required = label.endsWith(" **");
  const baseLabel = required ? label.slice(0, -3) : label;
  return (
    <Field label={required ? `${st(baseLabel)} **` : st(baseLabel)}>
      {choices && choices.length > 0 ? (
        <TextSelect
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">—</option>
          {choices.map((choice) => (
            <option key={choice} value={choice}>
              {st(choice)}
            </option>
          ))}
          {value && !choices.includes(value) ? (
            <option value={value}>{value}</option>
          ) : null}
        </TextSelect>
      ) : (
        <TextInput
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {hint}
    </Field>
  );
}
