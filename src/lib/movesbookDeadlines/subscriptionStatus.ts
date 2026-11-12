import { prisma } from '@/lib/prisma';
import { getSubscriptionEditData } from '@/lib/admin/subscriptionSettingsMock';
import {
  mergeNetworkSubscriptionHistory,
  periodDisplayStatus,
  readNetworkSubscriptionHistory,
} from '@/lib/admin/networkSubscriptionHistory';
import { getCountryPriceInfo } from '@/lib/countries/countryPricingDb';
import { priceForCountry } from '@/lib/countries/countryPriceFormula';
import { hydrateVersionSettings } from '@/lib/subscriptions/versionSettingsStore';
import { addDaysYmd } from '@/lib/subscriptions/specialOffers';
import {
  MODALITY_SUBSCRIPTION_DAYS,
  PAYMENT_MODES,
  enabledModes,
  normalizePaymentModalities,
  quotePaymentMode,
  roundEuro,
  splitIntoDeadlines,
  type PaymentModeCode,
} from '@/lib/subscriptions/paymentModalities';
import {
  createRegistrationPayment,
  ensureRegistrationPaymentTables,
  getPaymentExtraData,
  getRegistrationPayment,
  type RegistrationPayment,
} from '@/lib/registration/registrationPayments';
import {
  addPaymentToPeriod,
  createDeadlinesForPayment,
  ensureMovesbookDeadlinesTable,
  getMovesbookDeadline,
  listMovesbookDeadlines,
  type MovesbookDeadlineRow,
} from '@/lib/movesbookDeadlines/movesbookDeadlines';

/**
 * What a logged-in user owes Movesbook: overdue deadlines (login is blocked), deadlines expiring
 * within a week (warning) and the renewal of a subscription that ends within a week.
 */

export const WARNING_DAYS = 7;

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(fromYmd: string, toYmd: string): number {
  return Math.round((Date.parse(`${toYmd}T00:00:00Z`) - Date.parse(`${fromYmd}T00:00:00Z`)) / 86_400_000);
}

async function openDeadlines(userId: string): Promise<MovesbookDeadlineRow[]> {
  const list = await listMovesbookDeadlines({ userId, order: 'due_asc', pageSize: 100 });
  return list.items;
}

/** First unpaid deadline whose expiration date has passed (blocks the login). */
export async function findOverdueDeadline(userId: string): Promise<MovesbookDeadlineRow | null> {
  return (await openDeadlines(userId)).find((d) => d.overdue) ?? null;
}

export type RenewalOption = {
  /** Payment modality (null = classic renewal price of the version). */
  code: PaymentModeCode | null;
  label: string;
  totalEur: number;
  monthlyEur: number;
  deadlines: number;
  firstDeadlineEur: number;
  days: number;
};

export type RenewalOffer = {
  versionId: number;
  versionName: string;
  currentDateEnd: string;
  daysLeft: number;
  dateStart: string;
  currencyCode: string;
  eurToLocal: number | null;
  renewalDiscountPercent: number;
  options: RenewalOption[];
};

/** Renewal prices of the user's version (renewal discount applied), when the subscription ends within a week. */
export async function getRenewalOffer(userId: string, opts?: { ignoreWindow?: boolean }): Promise<RenewalOffer | null> {
  const [settings, user] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId }, select: { adminSettings: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { country: true } }),
  ]);
  const periods = readNetworkSubscriptionHistory(settings?.adminSettings).filter((p) => p.dateEnd && !p.archivedAt);
  if (periods.length === 0) return null;
  const current = periods.reduce((a, b) => ((a.dateEnd ?? '') >= (b.dateEnd ?? '') ? a : b));
  const currentDateEnd = current.dateEnd as string;
  const daysLeft = daysBetween(todayYmd(), currentDateEnd);
  if (!opts?.ignoreWindow && daysLeft > WARNING_DAYS) return null;

  await ensureRegistrationPaymentTables();
  const last = await prisma.$queryRawUnsafe<{ version_id: number | null; version_name: string }[]>(
    `SELECT version_id, version_name FROM registration_payments
     WHERE user_id = ? AND version_id IS NOT NULL AND kind IN ('register', 'quick_register', 'renewal')
     ORDER BY created_at DESC LIMIT 1`,
    userId,
  );
  const versionId = last[0]?.version_id != null ? Number(last[0].version_id) : null;
  if (!versionId) return null;
  await hydrateVersionSettings();
  const edit = getSubscriptionEditData(versionId);
  if (!edit) return null;

  const country = await getCountryPriceInfo(user?.country ?? '');
  const scale = (eur: number) => priceForCountry(eur, country.factor);
  const raw = edit.general.paymentModalities;
  let options: RenewalOption[];
  let renewalDiscountPercent = 0;
  if (raw) {
    const modalities = normalizePaymentModalities(raw);
    renewalDiscountPercent = modalities.renewalDiscountEnabled ? modalities.renewalDiscountPercent : 0;
    options = enabledModes(modalities).map((code) => {
      const q = quotePaymentMode(modalities, code, { renewal: true });
      const total = scale(q.total);
      return {
        code,
        label: `${code} — ${PAYMENT_MODES[code].label}`,
        totalEur: total,
        monthlyEur: roundEuro(total / 12),
        deadlines: q.deadlines,
        firstDeadlineEur: splitIntoDeadlines(total, q.deadlines)[0],
        days: MODALITY_SUBSCRIPTION_DAYS,
      };
    });
  } else {
    const total = scale(edit.general.renewalPrice);
    const days = edit.general.renewalDays > 0 ? edit.general.renewalDays : 365;
    options = [
      { code: null, label: 'Renewal', totalEur: total, monthlyEur: roundEuro((total / days) * 30), deadlines: 1, firstDeadlineEur: total, days },
    ];
  }
  const today = todayYmd();
  return {
    versionId,
    versionName: edit.general.name || last[0]?.version_name || '',
    currentDateEnd,
    daysLeft,
    dateStart: currentDateEnd >= today ? currentDateEnd : today,
    currencyCode: country.currencyCode || 'EUR',
    eurToLocal: country.eurToLocal,
    renewalDiscountPercent,
    options,
  };
}

export async function getUserSubscriptionStatus(userId: string) {
  await ensureMovesbookDeadlinesTable();
  const deadlines = await openDeadlines(userId);
  const today = todayYmd();
  return {
    overdue: deadlines.filter((d) => d.overdue),
    upcoming: deadlines.filter((d) => !d.overdue && daysBetween(today, d.dueDate) <= WARNING_DAYS),
    renewal: await getRenewalOffer(userId),
  };
}

async function userLanguage(userId: string): Promise<string> {
  const s = await prisma.userSettings.findUnique({ where: { userId }, select: { language: true } });
  return s?.language || 'en';
}

function dmy(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

/** Payment page for one deadline (reuses a pending one for the same deadline and amount). */
export async function createDeadlinePayment(userId: string, deadlineId: string): Promise<string> {
  const deadline = await getMovesbookDeadline(deadlineId);
  if (!deadline || deadline.userId !== userId) throw new Error('Deadline not found');
  if (!(deadline.restEur > 0)) throw new Error('This deadline is already paid');
  await ensureRegistrationPaymentTables();
  const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM registration_payments
     WHERE kind = 'deadline' AND status = 'pending' AND user_id = ? AND pending_data = ? AND amount_eur = ?
     ORDER BY created_at DESC LIMIT 1`,
    userId,
    JSON.stringify({ deadlineId }),
    deadline.restEur,
  );
  if (existing[0]) return existing[0].id;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { country: true } });
  return createRegistrationPayment(
    prisma,
    {
      userId,
      status: 'pending',
      versionId: null,
      versionName: `${deadline.detail} — deadline of ${dmy(deadline.dueDate)}`,
      specialOffer: false,
      basePriceEur: deadline.restEur,
      amountEur: deadline.restEur,
      country: user?.country ?? '',
      currencyCode: 'EUR',
      eurToLocal: null,
      amountLocal: null,
      language: await userLanguage(userId),
      periodId: null,
    },
    { kind: 'deadline', pendingData: JSON.stringify({ deadlineId }) },
  );
}

/** Renewal payment: first deadline of the chosen modality (prices computed again on the server). */
export async function createRenewalPayment(userId: string, requested: unknown): Promise<string> {
  const offer = await getRenewalOffer(userId, { ignoreWindow: true });
  if (!offer) throw new Error('No subscription to renew');
  const option =
    offer.options.find((o) => o.code === requested) ??
    (requested == null || requested === '' ? offer.options.find((o) => o.code === 'A') ?? offer.options[0] : undefined);
  if (!option) throw new Error('This payment modality is not available for your version');

  await ensureRegistrationPaymentTables();
  await ensureMovesbookDeadlinesTable();
  const periodId = `renewal-${Date.now()}`;
  const dateEnd = addDaysYmd(offer.dateStart, option.days);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { country: true } });
  const free = !(option.firstDeadlineEur > 0);
  const id = await createRegistrationPayment(
    prisma,
    {
      userId,
      status: free ? 'free' : 'pending',
      versionId: offer.versionId,
      versionName: `${offer.versionName} — renewal`,
      specialOffer: false,
      basePriceEur: option.firstDeadlineEur,
      amountEur: option.firstDeadlineEur,
      country: user?.country ?? '',
      currencyCode: 'EUR',
      eurToLocal: null,
      amountLocal: null,
      language: await userLanguage(userId),
      periodId,
      paymentModality: option.code,
      modalityTotalEur: option.code ? option.totalEur : null,
      modalityDeadlines: option.code ? option.deadlines : null,
    },
    {
      kind: 'renewal',
      pendingData: JSON.stringify({ versionId: offer.versionId, versionName: offer.versionName, dateStart: offer.dateStart, dateEnd }),
    },
  );
  if (free) {
    const payment = await getRegistrationPayment(id);
    if (payment) await completeRenewalPayment(payment);
  }
  return id;
}

/** Paid `deadline` payment → the deadline is settled and the amount goes to the membership period. */
export async function settleDeadlinePayment(payment: RegistrationPayment, payModeOverride?: string): Promise<void> {
  const extra = await getPaymentExtraData(payment.id);
  const deadlineId = typeof extra?.deadlineId === 'string' ? extra.deadlineId : null;
  if (!deadlineId) return;
  const deadline = await getMovesbookDeadline(deadlineId);
  if (!deadline) return;
  const amount = Math.min(payment.amountEur, deadline.restEur);
  if (!(amount > 0)) return;
  const periodRows = await prisma.$queryRawUnsafe<{ period_id: string | null }[]>(
    `SELECT period_id FROM movesbook_deadlines WHERE id = ? LIMIT 1`,
    deadlineId,
  );
  const payMode = (payModeOverride ?? payment.provider ?? 'online').slice(0, 24);
  await prisma.$executeRawUnsafe(
    `UPDATE movesbook_deadlines
     SET paid_eur = LEAST(amount_eur, paid_eur + ?), paid_at = NOW(), pay_mode = ?, operator = 'Online'
     WHERE id = ?`,
    amount,
    payMode,
    deadlineId,
  );
  await addPaymentToPeriod(payment.userId, periodRows[0]?.period_id ?? null, amount, payMode);
}

/** Paid `renewal` payment → next membership period + its deadlines (first one paid). */
export async function completeRenewalPayment(payment: RegistrationPayment, payModeOverride?: string): Promise<void> {
  const extra = await getPaymentExtraData(payment.id);
  const dateStart = typeof extra?.dateStart === 'string' ? extra.dateStart : todayYmd();
  const dateEnd = typeof extra?.dateEnd === 'string' ? extra.dateEnd : addDaysYmd(dateStart, 365);
  const versionName = typeof extra?.versionName === 'string' ? extra.versionName : payment.versionName;
  const fresh = (await getRegistrationPayment(payment.id)) ?? payment;
  const settings = await prisma.userSettings.findUnique({ where: { userId: payment.userId }, select: { adminSettings: true } });
  if (settings && fresh.periodId) {
    const history = readNetworkSubscriptionHistory(settings.adminSettings);
    if (!history.some((p) => p.id === fresh.periodId)) {
      const next = [
        ...history,
        {
          id: fresh.periodId,
          dateStart,
          dateEnd,
          version: versionName,
          status: periodDisplayStatus(dateEnd),
          amountPaid: fresh.status === 'free' ? '0' : String(fresh.amountEur),
          paymentMethod: payModeOverride ?? fresh.provider ?? fresh.status,
        },
      ];
      await prisma.userSettings.update({
        where: { userId: payment.userId },
        data: { adminSettings: mergeNetworkSubscriptionHistory(settings.adminSettings, next) },
      });
    }
  }
  await ensureMovesbookDeadlinesTable();
  await createDeadlinesForPayment(prisma, fresh, { dateStart, typology: 'A' });
  if (payModeOverride) {
    await prisma.$executeRawUnsafe(
      `UPDATE movesbook_deadlines SET pay_mode = ? WHERE registration_payment_id = ? AND deadline_no = 1`,
      payModeOverride.slice(0, 24),
      fresh.id,
    );
  }
}
