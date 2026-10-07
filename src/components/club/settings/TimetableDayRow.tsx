'use client';

import type { ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';
import {
  MAX_SLOTS_PER_DAY,
  TIMETABLE_MINUTES_MAX,
  TIMETABLE_STEP,
  TimetableDayKey,
  TimetableDaySchedule,
  TimetableSlot,
  addSlotToDay,
  canAddSlotToDay,
  constrainSlotRange,
  minutesToDisplayTime,
  removeSlotFromDay,
  slotColor,
  syncSlotTimes
} from '@/lib/clubCardTimetable';

type TimetableDayRowProps = {
  dayKey: TimetableDayKey;
  label: string;
  day: TimetableDaySchedule;
  active: boolean;
  onSelect: () => void;
  onChange: (day: TimetableDaySchedule) => void;
  /** Extra control shown at the end of each slot editor row (e.g. a room picker). */
  renderSlotExtra?: (slot: TimetableSlot, index: number, update: (patch: Partial<TimetableSlot>) => void) => ReactNode;
  /** Radio group name; give each timetable on the page its own. */
  radioName?: string;
};

function updateSlot(slots: TimetableSlot[], index: number, patch: Partial<TimetableSlot>): TimetableSlot[] {
  return slots.map((slot, slotIndex) =>
    slotIndex === index ? syncSlotTimes({ ...slot, ...patch }) : slot
  );
}

function applySlotRangeChange(
  slots: TimetableSlot[],
  index: number,
  rangeStart: number,
  rangeEnd: number
): TimetableSlot[] {
  const constrained = constrainSlotRange(slots, index, rangeStart, rangeEnd);
  return updateSlot(slots, index, constrained);
}

export default function TimetableDayRow({
  label,
  day,
  active,
  onSelect,
  onChange,
  renderSlotExtra,
  radioName = 'timetable-active-day'
}: TimetableDayRowProps) {
  const handleToggleEnabled = (enabled: boolean) => {
    onChange({
      ...day,
      enabled,
      slots: enabled
        ? day.slots.some((slot) => slot.rangeEnd > slot.rangeStart)
          ? day.slots
          : [{ ...day.slots[0], rangeStart: 540, rangeEnd: 1320, amTime: minutesToDisplayTime(540), pmTime: minutesToDisplayTime(1320) }]
        : [{ ...day.slots[0], rangeStart: 0, rangeEnd: 0, amTime: '', pmTime: '' }]
    });
  };

  const handleAdd = () => {
    if (!active) {
      onSelect();
    }
    try {
      onChange(addSlotToDay(day));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to add slot.');
    }
  };

  const handleRemoveSlot = (slotIndex: number) => {
    if (!active) {
      onSelect();
    }
    onChange(removeSlotFromDay(day, slotIndex));
  };

  const handleSlotRangeChange = (slotIndex: number, rangeStart: number, rangeEnd: number) => {
    onChange({
      ...day,
      slots: applySlotRangeChange(day.slots, slotIndex, rangeStart, rangeEnd)
    });
  };

  return (
    <div className={`rounded-md border p-3 ${active ? 'border-gray-900 bg-white' : 'border-gray-200 bg-gray-50'}`}>
      <div className="flex items-center gap-3">
        <label className="flex w-16 shrink-0 items-center gap-2 text-sm font-semibold text-gray-800">
          <input
            type="checkbox"
            checked={day.enabled}
            onChange={(event) => handleToggleEnabled(event.target.checked)}
            className="h-4 w-4 accent-gray-900"
          />
          {label}
        </label>

        <div className="relative min-h-8 flex-1 rounded border border-gray-300 bg-[#D7D7D7]">
          {day.enabled ? (
            day.slots.map((slot, index) => {
              const left = (slot.rangeStart / TIMETABLE_MINUTES_MAX) * 100;
              const width = Math.max(
                ((slot.rangeEnd - slot.rangeStart) / TIMETABLE_MINUTES_MAX) * 100,
                0.5
              );
              return (
                <div
                  key={`${slot.rangeStart}-${slot.rangeEnd}-${index}`}
                  className="absolute top-0 h-full rounded-sm border border-[#5BA8E1]"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    backgroundColor: slotColor(index)
                  }}
                  title={`${slot.amTime} – ${slot.pmTime}`}
                />
              );
            })
          ) : (
            <div className="flex h-8 items-center justify-center text-xs text-gray-500">Disabled</div>
          )}
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAddSlotToDay(day)}
          className="rounded border border-gray-300 p-1 text-gray-700 hover:bg-gray-100 disabled:opacity-40"
          title={
            canAddSlotToDay(day)
              ? 'Add time slot'
              : day.slots.length >= MAX_SLOTS_PER_DAY
                ? 'Maximum 6 slots per day'
                : 'No room for another slot — shorten or remove the last slot first'
          }
        >
          <Plus className="h-4 w-4" />
        </button>
        <input
          type="radio"
          name={radioName}
          checked={active}
          onChange={onSelect}
          className="h-4 w-4 accent-gray-900"
        />
      </div>

      {active && day.enabled && (
        <div className="mt-3 space-y-3 border-t border-gray-200 pt-3">
          {day.slots.map((slot, index) => (
            <div
              key={`editor-${index}`}
              className={`grid gap-2 md:items-center ${
                renderSlotExtra ? 'md:grid-cols-[72px_1fr_90px_120px_200px]' : 'md:grid-cols-[72px_1fr_120px_120px]'
              }`}
            >
              <span className="text-xs font-semibold uppercase text-gray-500">{`Slot ${index + 1}`}</span>
              <div className="space-y-1">
                <input
                  type="range"
                  min={0}
                  max={TIMETABLE_MINUTES_MAX}
                  step={TIMETABLE_STEP}
                  value={slot.rangeStart}
                  onChange={(event) =>
                    handleSlotRangeChange(index, Number(event.target.value), slot.rangeEnd)
                  }
                  className="w-full accent-gray-900"
                />
                <input
                  type="range"
                  min={0}
                  max={TIMETABLE_MINUTES_MAX}
                  step={TIMETABLE_STEP}
                  value={slot.rangeEnd}
                  onChange={(event) =>
                    handleSlotRangeChange(index, slot.rangeStart, Number(event.target.value))
                  }
                  className="w-full accent-gray-900"
                />
              </div>
              <span className="text-sm text-gray-700">{slot.amTime}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">{slot.pmTime}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSlot(index)}
                  disabled={day.slots.length <= 1}
                  className="rounded border border-gray-300 p-1 text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                  title="Remove this slot"
                >
                  <Minus className="h-4 w-4" />
                </button>
              </div>
              {renderSlotExtra
                ? renderSlotExtra(slot, index, (patch) =>
                    onChange({ ...day, slots: updateSlot(day.slots, index, patch) })
                  )
                : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
