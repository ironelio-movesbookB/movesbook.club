import {
  TIMETABLE_DAY_KEYS,
  createEmptyTimetableForm,
  minutesToDisplayTime,
  type TimetableDayKey,
  type TimetableDaySchedule,
} from '@/lib/clubCardTimetable';
import { currentSportSeason } from '@/lib/sport/sportProfileTypes';

export const WORK_GROUP_CATEGORIES = ['Mixed', 'Male', 'Female'] as const;

/** Months between two payment deadlines. */
export const DEADLINE_RECURRENCES = [
  { months: 1, label: 'Every month' },
  { months: 2, label: 'Every 2 months' },
  { months: 3, label: 'Every 3 months' },
] as const;

export const MAX_DEADLINES = 36;

export type WorkGroupTimetable = Record<TimetableDayKey, TimetableDaySchedule>;

export type WorkGroupPaymentPlan = {
  id: string;
  recurrenceMonths: 1 | 2 | 3;
  count: number;
  /** Cost of each deadline */
  costEach: number;
  /** yyyy-mm-dd of the first deadline */
  firstDate: string;
  /** Display the payment status in the Call for athletes */
  showStatusAtCallUp: boolean;
};

export type WorkGroupInput = {
  name: string;
  category: string;
  sport: string;
  season: string;
  /** yyyy-mm-dd */
  dateFrom: string;
  dateTo: string;
  showInRegistration: boolean;
  registrationNote: string;
  /** Full price paid in one go; '' when not set */
  price: string;
  timetable: WorkGroupTimetable;
  paymentPlans: WorkGroupPaymentPlan[];
  coachIds: string[];
  memberIds: string[];
};

export type WorkGroupPerson = { id: string; name: string; username?: string; image: string | null };

export type WorkGroup = Omit<WorkGroupInput, 'coachIds' | 'memberIds'> & {
  id: string;
  coaches: WorkGroupPerson[];
  members: WorkGroupPerson[];
  createdAt: string;
};

export type WorkGroupListItem = Pick<
  WorkGroup,
  'id' | 'name' | 'category' | 'sport' | 'season' | 'dateFrom' | 'dateTo' | 'createdAt'
> & { memberCount: number; coachNames: string[] };

export type WorkGroupRoom = { id: string; name: string };

export type WorkGroupMeta = {
  workspace: { kind: 'club' | 'team'; id: string; name: string };
  coaches: WorkGroupPerson[];
  rooms: WorkGroupRoom[];
};

export type WorkGroupAnnouncement = {
  id: string;
  title: string;
  message: string;
  sendMail: boolean;
  postToAccount: boolean;
  showAtLogin: boolean;
  enableFrom: string;
  enableTo: string;
  attachmentName: string;
  mailedCount: number;
  postedCount: number;
  createdAt: string;
};

export type WorkGroupAnnouncementInput = {
  title: string;
  message: string;
  sendMail: boolean;
  postToAccount: boolean;
  showAtLogin: boolean;
  enableFrom: string;
  enableTo: string;
  attachment: { name: string; type: string; base64: string } | null;
};

export const MAX_ANNOUNCEMENT_ATTACHMENT_BYTES = 2 * 1024 * 1024;

export function emptyWorkGroupTimetable(): WorkGroupTimetable {
  return createEmptyTimetableForm().days;
}

export function emptyWorkGroupInput(): WorkGroupInput {
  return {
    name: '',
    category: 'Mixed',
    sport: '',
    season: currentSportSeason(),
    dateFrom: '',
    dateTo: '',
    showInRegistration: false,
    registrationNote: '',
    price: '',
    timetable: emptyWorkGroupTimetable(),
    paymentPlans: [],
    coachIds: [],
    memberIds: [],
  };
}

/** Previous, current and next three seasons, plus any season already saved on a group. */
export function workGroupSeasonOptions(extra: string[] = []): string[] {
  const start = Number(currentSportSeason().slice(0, 4));
  const seasons = Array.from({ length: 5 }, (_, i) => `${start - 1 + i}/${start + i}`);
  return [...new Set([...extra.filter(Boolean), ...seasons])].sort();
}

function addMonths(ymd: string, months: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return '';
  const year = Number(m[1]);
  const month = Number(m[2]) - 1 + months;
  const day = Number(m[3]);
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const d = new Date(Date.UTC(year, month, Math.min(day, lastDay)));
  return d.toISOString().slice(0, 10);
}

export function paymentPlanDates(plan: Pick<WorkGroupPaymentPlan, 'firstDate' | 'count' | 'recurrenceMonths'>): string[] {
  if (!plan.firstDate) return [];
  return Array.from({ length: plan.count }, (_, i) => addMonths(plan.firstDate, i * plan.recurrenceMonths));
}

export function paymentPlanTotal(plan: Pick<WorkGroupPaymentPlan, 'count' | 'costEach'>): number {
  return Math.round(plan.count * plan.costEach * 100) / 100;
}

/** Discount (positive) or surcharge (negative) of a plan against the full price, in percent. */
export function paymentPlanDiscount(plan: Pick<WorkGroupPaymentPlan, 'count' | 'costEach'>, price: string): number | null {
  const full = Number(price);
  if (!price || !Number.isFinite(full) || full <= 0) return null;
  return Math.round(((full - paymentPlanTotal(plan)) / full) * 1000) / 10;
}

export function formatEuro(value: number): string {
  return `€ ${value.toFixed(2)}`;
}

/** yyyy-mm-dd → dd/mm/yyyy */
export function formatWorkGroupDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

export type WorkGroupTimetableSummaryCell = { time: string; room: string }[];

/** Times per weekday (Mon…Sun) for the "Timetable by course" summary. */
export function workGroupTimetableSummary(
  timetable: WorkGroupTimetable,
  rooms: WorkGroupRoom[],
): WorkGroupTimetableSummaryCell[] {
  const roomNames = new Map(rooms.map((r) => [r.id, r.name]));
  return TIMETABLE_DAY_KEYS.map((key) => {
    const day = timetable[key];
    if (!day?.enabled) return [];
    return day.slots
      .filter((slot) => slot.rangeEnd > slot.rangeStart)
      .map((slot) => ({
        time: `${minutesToDisplayTime(slot.rangeStart)} - ${minutesToDisplayTime(slot.rangeEnd)}`,
        room: (slot.room && roomNames.get(slot.room)) || '',
      }));
  });
}

export const WORK_GROUPS_CHANGED_EVENT = 'club-work-groups-changed';

export function notifyWorkGroupsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(WORK_GROUPS_CHANGED_EVENT));
}
