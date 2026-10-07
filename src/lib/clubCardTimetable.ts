import { serialize, unserialize } from 'php-serialize';

export const TIMETABLE_DAY_KEYS = ['mon', 'tues', 'wed', 'thurs', 'fri', 'sat', 'sun'] as const;
export type TimetableDayKey = (typeof TIMETABLE_DAY_KEYS)[number];

export const TIMETABLE_DAY_LABELS: Record<TimetableDayKey, string> = {
  mon: 'Mon',
  tues: 'Tues',
  wed: 'Wed',
  thurs: 'Thurs',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun'
};

export const TIMETABLE_DAY_FULL_NAMES: Record<TimetableDayKey, string> = {
  mon: 'Monday',
  tues: 'Tuesday',
  wed: 'Wednesday',
  thurs: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday'
};

export const MAX_SLOTS_PER_DAY = 6;
export const TIMETABLE_MINUTES_MAX = 1440;
export const TIMETABLE_STEP = 30;
/** CakePHP: gap before a newly added slot after the previous slot end */
export const MIN_SLOT_GAP_MINUTES = 50;
/** CakePHP: cannot add another slot when the last one ends at or beyond this minute */
export const MAX_LAST_SLOT_END_FOR_ADD = 1350;
export const NEW_SLOT_DURATION_MINUTES = 100;

export const PERMIT_MINUTE_OPTIONS = ['10', '20', '30', '40', '50', '60', '70', '80', '90'];

export const FROM_START_OPTIONS = [
  { value: '30', label: '30' },
  { value: '1h', label: '1h' },
  { value: '1h30', label: '1h30' },
  { value: '2h', label: '2h' },
  { value: '3h', label: '3h' },
  { value: '4h', label: '4h' },
  { value: '6h', label: '6h' },
  { value: '8h', label: '8h' },
  { value: '12h', label: '12h' },
  { value: '18h', label: '18h' },
  { value: '24h', label: '24h' },
  { value: '36h', label: '36h' },
  { value: '48h', label: '48h' },
  { value: '96h', label: '4 days' },
  { value: '120h', label: '5 days' },
  { value: '144h', label: '6 days' },
  { value: '168h', label: '7 days' }
] as const;

export type PayableValue = '0' | '1' | '2';

export type TimetableSlot = {
  rangeStart: number;
  rangeEnd: number;
  amTime: string;
  pmTime: string;
  fromStart: string;
  bookabled: boolean;
  maxNumber: string;
  payable: PayableValue;
  instructor: string;
  /** Room id; used by the Groups of work timetable, not saved by the typology timetable. */
  room?: string;
};

export type TimetableDaySchedule = {
  enabled: boolean;
  slots: TimetableSlot[];
};

export type TimetableBookingSettings = {
  enabledForBooking: boolean;
  paymentPostecipedOrCreditCard: boolean;
  payWithinDays: string;
  cost: string;
};

export type TimetableOperator = {
  id: string;
  name: string;
};

export type CardTimetableForm = {
  id: string | null;
  typologyId: string;
  reserveMaxNumber: string;
  permitMinuteAccess: string;
  blockingMinuteAccess: string;
  editableSubscriptionTimetable: boolean;
  setBook: string;
  bookingSettings: TimetableBookingSettings;
  days: Record<TimetableDayKey, TimetableDaySchedule>;
};

const DAY_INDEX: Record<TimetableDayKey, number> = {
  mon: 0,
  tues: 1,
  wed: 2,
  thurs: 3,
  fri: 4,
  sat: 5,
  sun: 6
};

const SLOT_COLORS = ['#81B8F3', '#6AA8E8', '#5598DD', '#4088D2', '#2B78C7', '#1668BC'];

export function slotColor(index: number): string {
  return SLOT_COLORS[index % SLOT_COLORS.length];
}

export function text(value: unknown): string {
  return String(value ?? '').trim();
}

export function minutesToDisplayTime(minutes: number): string {
  const total = Math.max(0, Math.min(1440, Math.round(minutes)));
  const hours24 = Math.floor(total / 60) % 24;
  const mins = total % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hour12 = hours24 % 12 || 12;
  return `${hour12}:${mins.toString().padStart(2, '0')} ${period}`;
}

export function parseRangeMinutes(value: string): { start: number; end: number } {
  const [startRaw, endRaw] = text(value).split('#');
  const start = Number(startRaw);
  const end = Number(endRaw);
  return {
    start: Number.isFinite(start) ? start : 0,
    end: Number.isFinite(end) ? end : 0
  };
}

export function formatRangeMinutes(start: number, end: number): string {
  return `${Math.max(0, Math.round(start))}#${Math.max(0, Math.round(end))}`;
}

function splitCsv(value: string): string[] {
  if (!value) return [];
  return value.split(',').map((part) => part.trim());
}

function unserializePhpArray(raw: unknown): string[] {
  const result = Array.from({ length: 7 }, () => '');
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    return result;
  }

  try {
    const parsed = unserialize(raw) as Record<string | number, string> | string[] | null;
    if (!parsed || typeof parsed !== 'object') {
      return result;
    }

    if (Array.isArray(parsed)) {
      parsed.forEach((value, index) => {
        if (index < 7) result[index] = text(value);
      });
      return result;
    }

    Object.entries(parsed).forEach(([index, value]) => {
      const position = Number(index);
      if (Number.isInteger(position) && position >= 0 && position < 7) {
        result[position] = text(value);
      }
    });
  } catch {
    return result;
  }

  return result;
}

function parseEnabledDays(raw: unknown): Set<TimetableDayKey> {
  const enabled = new Set<TimetableDayKey>();
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    return enabled;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, string | number>;
    TIMETABLE_DAY_KEYS.forEach((key) => {
      if (parsed[key] != null && String(parsed[key]) !== '' && String(parsed[key]) !== '0') {
        enabled.add(key);
      }
    });
  } catch {
    return enabled;
  }

  return enabled;
}

export function createDefaultSlot(start = 540, end = 1320): TimetableSlot {
  const safeEnd = end > start ? end : start + TIMETABLE_STEP;
  return {
    rangeStart: start,
    rangeEnd: safeEnd,
    amTime: minutesToDisplayTime(start),
    pmTime: minutesToDisplayTime(safeEnd),
    fromStart: '30',
    bookabled: true,
    maxNumber: '1',
    payable: '0',
    instructor: ''
  };
}

function createDisabledDay(): TimetableDaySchedule {
  return {
    enabled: false,
    slots: [createDefaultSlot(0, 0)]
  };
}

function createEnabledDay(): TimetableDaySchedule {
  return {
    enabled: true,
    slots: [createDefaultSlot()]
  };
}

export function syncSlotTimes(slot: TimetableSlot): TimetableSlot {
  const safeEnd = slot.rangeEnd > slot.rangeStart ? slot.rangeEnd : slot.rangeStart + TIMETABLE_STEP;
  return {
    ...slot,
    rangeEnd: safeEnd,
    amTime: minutesToDisplayTime(slot.rangeStart),
    pmTime: minutesToDisplayTime(safeEnd)
  };
}

export function slotsOverlap(
  a: Pick<TimetableSlot, 'rangeStart' | 'rangeEnd'>,
  b: Pick<TimetableSlot, 'rangeStart' | 'rangeEnd'>
): boolean {
  return a.rangeStart < b.rangeEnd && b.rangeStart < a.rangeEnd;
}

export function dayHasOverlappingSlots(slots: TimetableSlot[]): boolean {
  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      if (slotsOverlap(slots[i], slots[j])) {
        return true;
      }
    }
  }
  return false;
}

/** Keep a slot inside the day bounds and away from its neighbours (CakePHP overlap:false). */
export function constrainSlotRange(
  slots: TimetableSlot[],
  index: number,
  rangeStart: number,
  rangeEnd: number
): { rangeStart: number; rangeEnd: number } {
  const prev = index > 0 ? slots[index - 1] : null;
  const next = index < slots.length - 1 ? slots[index + 1] : null;
  const minStart = prev ? prev.rangeEnd : 0;
  const maxEnd = next ? next.rangeStart : TIMETABLE_MINUTES_MAX;

  let start = Math.max(0, Math.min(TIMETABLE_MINUTES_MAX, rangeStart));
  let end = Math.max(0, Math.min(TIMETABLE_MINUTES_MAX, rangeEnd));

  start = Math.max(minStart, Math.min(start, maxEnd - TIMETABLE_STEP));
  end = Math.max(start + TIMETABLE_STEP, Math.min(end, maxEnd));

  if (end <= start) {
    end = Math.min(maxEnd, start + TIMETABLE_STEP);
    start = Math.max(minStart, end - TIMETABLE_STEP);
  }

  return { rangeStart: start, rangeEnd: end };
}

export function canAddSlotToDay(day: TimetableDaySchedule): boolean {
  if (!day.enabled || day.slots.length >= MAX_SLOTS_PER_DAY) {
    return false;
  }

  const last = day.slots[day.slots.length - 1];
  if (!last || last.rangeEnd <= last.rangeStart) {
    return day.slots.length < MAX_SLOTS_PER_DAY;
  }

  if (last.rangeEnd >= MAX_LAST_SLOT_END_FOR_ADD) {
    return false;
  }

  const newStart = last.rangeEnd + MIN_SLOT_GAP_MINUTES;
  return newStart + TIMETABLE_STEP <= TIMETABLE_MINUTES_MAX;
}

export function addSlotToDay(day: TimetableDaySchedule): TimetableDaySchedule {
  if (day.slots.length >= MAX_SLOTS_PER_DAY) {
    throw new Error('You cannot reserve more than 6 per day');
  }

  const last = day.slots[day.slots.length - 1] ?? createDefaultSlot();
  if (last.rangeEnd >= MAX_LAST_SLOT_END_FOR_ADD) {
    throw new Error('Delete last slider and create new again');
  }

  let newStart = last.rangeEnd + MIN_SLOT_GAP_MINUTES;
  let newEnd = newStart + NEW_SLOT_DURATION_MINUTES;
  if (newEnd > TIMETABLE_MINUTES_MAX) {
    newEnd = TIMETABLE_MINUTES_MAX;
  }

  if (newEnd <= newStart) {
    throw new Error('No room left to add another time slot on this day');
  }

  const newSlot = createDefaultSlot(newStart, newEnd);
  const nextSlots = [...day.slots, newSlot];
  if (dayHasOverlappingSlots(nextSlots)) {
    throw new Error('No room left to add another time slot on this day');
  }

  return {
    ...day,
    slots: nextSlots
  };
}

export function removeSlotFromDay(
  day: TimetableDaySchedule,
  slotIndex?: number
): TimetableDaySchedule {
  if (day.slots.length <= 1) {
    return day;
  }
  const index =
    slotIndex === undefined ? day.slots.length - 1 : slotIndex;
  if (index < 0 || index >= day.slots.length) {
    return day;
  }
  return {
    ...day,
    slots: day.slots.filter((_, i) => i !== index)
  };
}

function parseDaySlots(
  rangeStr: string,
  amStr: string,
  pmStr: string,
  fromStartStr: string,
  bookabledStr: string,
  maxNumStr: string,
  payableStr: string,
  instructorStr: string,
  enabled: boolean
): TimetableSlot[] {
  if (!enabled) {
    return [createDefaultSlot(0, 0)];
  }

  const rangeParts = splitCsv(rangeStr).filter((part) => part && part !== '0#' && part !== '0#0');
  if (rangeParts.length === 0) {
    return [createDefaultSlot()];
  }

  const amParts = splitCsv(amStr);
  const pmParts = splitCsv(pmStr);
  const fromStartParts = splitCsv(fromStartStr);
  const bookabledParts = splitCsv(bookabledStr);
  const maxNumParts = splitCsv(maxNumStr);
  const payableParts = splitCsv(payableStr);
  const instructorParts = splitCsv(instructorStr);

  return rangeParts.map((rangePart, index) => {
    const range = parseRangeMinutes(rangePart);
    const end = range.end > range.start ? range.end : range.start + TIMETABLE_STEP;
    return syncSlotTimes({
      rangeStart: range.start,
      rangeEnd: end,
      amTime: amParts[index] || minutesToDisplayTime(range.start),
      pmTime: pmParts[index] || minutesToDisplayTime(end),
      fromStart: fromStartParts[index] || '30',
      bookabled: bookabledParts[index] !== '0',
      maxNumber: maxNumParts[index] || '1',
      payable: (payableParts[index] || '0') as PayableValue,
      instructor: instructorParts[index] || ''
    });
  });
}

function serializeDayField(slots: TimetableSlot[], getter: (slot: TimetableSlot) => string): string {
  if (slots.length === 0) return '';
  if (slots.length === 1) return getter(slots[0]);
  return slots.map(getter).join(',');
}

function serializeDayRanges(slots: TimetableSlot[], enabled: boolean): string {
  if (!enabled || slots.length === 0) return '0#0';
  return slots.map((slot) => formatRangeMinutes(slot.rangeStart, slot.rangeEnd)).join(',');
}

export function createEmptyTimetableForm(typologyId = ''): CardTimetableForm {
  return {
    id: null,
    typologyId,
    reserveMaxNumber: '5',
    permitMinuteAccess: '',
    blockingMinuteAccess: '',
    editableSubscriptionTimetable: false,
    setBook: '',
    bookingSettings: {
      enabledForBooking: true,
      paymentPostecipedOrCreditCard: false,
      payWithinDays: '',
      cost: ''
    },
    days: TIMETABLE_DAY_KEYS.reduce((acc, key) => {
      acc[key] = createDisabledDay();
      return acc;
    }, {} as Record<TimetableDayKey, TimetableDaySchedule>)
  };
}

export function mapDbRowToTimetableForm(
  row: Record<string, unknown>,
  typologyId: string,
  editableSubscriptionTimetable: boolean,
  bookingSettings?: Partial<TimetableBookingSettings>
): CardTimetableForm {
  const amTimes = unserializePhpArray(row.am_time);
  const pmTimes = unserializePhpArray(row.pm_time);
  const rangeValues = unserializePhpArray(row.rangValue);
  const fromStarts = unserializePhpArray(row.from_start);
  const bookabledValues = unserializePhpArray(row.bookabled);
  const maxNumbers = unserializePhpArray(row.maxnumber);
  const payableValues = unserializePhpArray(row.payable);
  const instructorValues = unserializePhpArray(row.instructor);
  const enabledDays = parseEnabledDays(row.enabled);

  const days = TIMETABLE_DAY_KEYS.reduce((acc, key) => {
    const index = DAY_INDEX[key];
    const enabled = enabledDays.has(key);
    acc[key] = {
      enabled,
      slots: parseDaySlots(
        rangeValues[index] || '',
        amTimes[index] || '',
        pmTimes[index] || '',
        fromStarts[index] || '',
        bookabledValues[index] || '',
        maxNumbers[index] || '',
        payableValues[index] || '',
        instructorValues[index] || '',
        enabled
      )
    };
    return acc;
  }, {} as Record<TimetableDayKey, TimetableDaySchedule>);

  return {
    id: row.id != null ? String(row.id) : null,
    typologyId,
    reserveMaxNumber: text(row.reserve_maxnumber) || '5',
    permitMinuteAccess: row.permit_minute_access != null ? String(row.permit_minute_access) : '',
    blockingMinuteAccess: row.blocking_minute_access != null ? String(row.blocking_minute_access) : '',
    editableSubscriptionTimetable,
    setBook: text(row.setbook),
    bookingSettings: {
      enabledForBooking: bookingSettings?.enabledForBooking ?? true,
      paymentPostecipedOrCreditCard: bookingSettings?.paymentPostecipedOrCreditCard ?? false,
      payWithinDays: bookingSettings?.payWithinDays ?? '',
      cost: bookingSettings?.cost ?? ''
    },
    days
  };
}

export function buildTimetableDbValues(form: CardTimetableForm): Record<string, unknown> {
  const amTime: string[] = [];
  const pmTime: string[] = [];
  const rangValue: string[] = [];
  const fromStart: string[] = [];
  const bookabled: string[] = [];
  const maxnumber: string[] = [];
  const payable: string[] = [];
  const instructor: string[] = [];
  const enabled: Record<string, string> = {};

  TIMETABLE_DAY_KEYS.forEach((key) => {
    const day = form.days[key];
    if (day.enabled) {
      enabled[key] = '1';
    }

    const slots = day.enabled ? day.slots : [createDefaultSlot(0, 0)];
    amTime.push(day.enabled ? serializeDayField(slots, (slot) => slot.amTime) : '');
    pmTime.push(day.enabled ? serializeDayField(slots, (slot) => slot.pmTime) : '');
    rangValue.push(serializeDayRanges(slots, day.enabled));
    fromStart.push(day.enabled ? serializeDayField(slots, (slot) => slot.fromStart) : '');
    bookabled.push(day.enabled ? serializeDayField(slots, (slot) => (slot.bookabled ? '1' : '0')) : '');
    maxnumber.push(day.enabled ? serializeDayField(slots, (slot) => slot.maxNumber) : '');
    payable.push(day.enabled ? serializeDayField(slots, (slot) => slot.payable) : '');
    instructor.push(day.enabled ? serializeDayField(slots, (slot) => slot.instructor) : '');
  });

  return {
    typology_message_id: form.typologyId,
    subscription_id: 0,
    am_time: serialize(amTime),
    pm_time: serialize(pmTime),
    rangValue: serialize(rangValue),
    from_start: serialize(fromStart),
    bookabled: serialize(bookabled),
    maxnumber: serialize(maxnumber),
    payable: serialize(payable),
    instructor: serialize(instructor),
    setbook: form.setBook || '',
    enabled: JSON.stringify(enabled),
    permit_minute_access: form.permitMinuteAccess ? Number(form.permitMinuteAccess) : null,
    blocking_minute_access: form.blockingMinuteAccess ? Number(form.blockingMinuteAccess) : null,
    reserve_maxnumber: form.reserveMaxNumber || '5'
  };
}

export function resetAllDays(form: CardTimetableForm): CardTimetableForm {
  const days = TIMETABLE_DAY_KEYS.reduce((acc, key) => {
    acc[key] = {
      enabled: form.days[key].enabled,
      slots: [createDefaultSlot(0, 0)]
    };
    return acc;
  }, {} as Record<TimetableDayKey, TimetableDaySchedule>);

  return { ...form, days };
}

export function validateTimetableForm(form: CardTimetableForm): string | null {
  for (const key of TIMETABLE_DAY_KEYS) {
    const day = form.days[key];
    if (!day.enabled) {
      continue;
    }
    if (day.slots.length > MAX_SLOTS_PER_DAY) {
      return 'You cannot reserve more than 6 per day';
    }
    for (const slot of day.slots) {
      if (slot.rangeEnd <= slot.rangeStart) {
        return `${TIMETABLE_DAY_LABELS[key]}: each time slot must have a valid start and end time.`;
      }
    }
    if (dayHasOverlappingSlots(day.slots)) {
      return `${TIMETABLE_DAY_LABELS[key]}: time slots cannot overlap. Adjust or remove overlapping slots.`;
    }
  }
  return null;
}

export function toggleDayEnabled(
  day: TimetableDaySchedule,
  enabled: boolean
): TimetableDaySchedule {
  if (!enabled) {
    return { enabled: false, slots: [createDefaultSlot(0, 0)] };
  }
  if (day.slots.length === 1 && day.slots[0].rangeStart === 0 && day.slots[0].rangeEnd === 0) {
    return createEnabledDay();
  }
  return { ...day, enabled: true };
}
