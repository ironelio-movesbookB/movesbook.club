'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import TimetableDayRow from '@/components/club/settings/TimetableDayRow';
import TimetableHourRuler from '@/components/club/settings/TimetableHourRuler';
import { clubApiFetch } from '@/lib/club/servicePurchasesClient';
import {
  TIMETABLE_DAY_FULL_NAMES,
  TIMETABLE_DAY_KEYS,
  TIMETABLE_DAY_LABELS,
  type TimetableDayKey,
} from '@/lib/clubCardTimetable';
import {
  workGroupTimetableSummary,
  type WorkGroupRoom,
  type WorkGroupTimetable as Timetable,
} from '@/lib/club/clubWorkGroup.constants';

type Props = {
  groupName: string;
  value: Timetable;
  onChange: (value: Timetable) => void;
  rooms: WorkGroupRoom[];
  onRoomAdded: (room: WorkGroupRoom) => void;
};

const SUMMARY_COLOR = '#7c3aed';

export default function WorkGroupTimetable({ groupName, value, onChange, rooms, onRoomAdded }: Props) {
  const [activeDay, setActiveDay] = useState<TimetableDayKey>('mon');
  const [addingRoom, setAddingRoom] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomError, setRoomError] = useState('');
  const [savingRoom, setSavingRoom] = useState(false);

  const saveRoom = async () => {
    if (!roomName.trim()) return;
    setSavingRoom(true);
    setRoomError('');
    try {
      const { room } = await clubApiFetch<{ room: WorkGroupRoom }>('/api/club/work-groups/rooms', {
        method: 'POST',
        body: JSON.stringify({ name: roomName }),
      });
      onRoomAdded(room);
      setRoomName('');
      setAddingRoom(false);
    } catch (e) {
      setRoomError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSavingRoom(false);
    }
  };

  const summary = workGroupTimetableSummary(value, rooms);
  const hasSessions = summary.some((cell) => cell.length > 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
        <span className="font-semibold text-gray-700">Rooms</span>
        {rooms.length === 0 ? <span className="text-gray-500">No rooms yet.</span> : null}
        {rooms.map((r) => (
          <span key={r.id} className="rounded-full bg-white px-2.5 py-0.5 text-xs text-gray-700 ring-1 ring-gray-200" translate="no">
            {r.name}
          </span>
        ))}
        {addingRoom ? (
          <span className="flex items-center gap-2">
            <input
              autoFocus
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void saveRoom();
                }
              }}
              placeholder="Room name"
              className="h-8 rounded-md border border-gray-300 px-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void saveRoom()}
              disabled={savingRoom || !roomName.trim()}
              className="h-8 rounded-md bg-violet-700 px-3 text-xs font-semibold text-white disabled:opacity-50"
            >
              Add
            </button>
            <button type="button" onClick={() => setAddingRoom(false)} className="h-8 px-2 text-xs text-gray-600 hover:underline">
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setAddingRoom(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:underline"
          >
            <Plus className="h-3.5 w-3.5" /> Add room
          </button>
        )}
        {roomError ? <span className="text-xs text-red-600">{roomError}</span> : null}
      </div>

      <div>
        <div className="mb-2 pl-[88px] pr-[78px]">
          <TimetableHourRuler />
        </div>
        <div className="space-y-3">
          {TIMETABLE_DAY_KEYS.map((key) => (
            <TimetableDayRow
              key={key}
              dayKey={key}
              label={TIMETABLE_DAY_LABELS[key]}
              day={value[key]}
              active={activeDay === key}
              onSelect={() => setActiveDay(key)}
              onChange={(day) => onChange({ ...value, [key]: day })}
              radioName="work-group-active-day"
              renderSlotExtra={(slot, _index, update) => (
                <select
                  value={slot.room ?? ''}
                  onChange={(e) => update({ room: e.target.value })}
                  className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
                  aria-label="Room"
                >
                  <option value="">Room…</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id} translate="no">
                      {r.name}
                    </option>
                  ))}
                </select>
              )}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Tick a day, select it with the round button on the right, then drag the sliders to set start and end. Use + for more sessions on the same day.
        </p>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-gray-800">Summary</h4>
        {!hasSessions ? (
          <p className="text-sm text-gray-500">No training sessions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-xl bg-white text-sm shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
              <thead>
                <tr className="bg-[#484c70] text-white">
                  <th className="border-r border-white/20 px-3 py-3 text-left font-semibold uppercase tracking-wide">Course</th>
                  {TIMETABLE_DAY_KEYS.map((key) => (
                    <th key={key} className="border-r border-white/20 px-3 py-3 text-center font-semibold uppercase tracking-wide last:border-r-0">
                      {TIMETABLE_DAY_FULL_NAMES[key]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td
                    className="border border-gray-200 px-3 py-3 text-center text-sm font-semibold uppercase tracking-wide text-white"
                    style={{ backgroundColor: SUMMARY_COLOR }}
                    translate="no"
                  >
                    {groupName || '—'}
                  </td>
                  {summary.map((cell, i) => (
                    <td key={TIMETABLE_DAY_KEYS[i]} className="border border-gray-200 px-2 py-3 text-center align-middle">
                      {cell.length === 0 ? (
                        <span className="inline-block rounded-md border border-dashed border-gray-300 bg-gray-100 px-2 py-1 text-xs italic text-gray-400">
                          -
                        </span>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5">
                          {cell.map((s) => (
                            <span key={s.time} className="flex flex-col items-center">
                              <span
                                className="inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold text-white"
                                style={{ backgroundColor: SUMMARY_COLOR }}
                              >
                                {s.time}
                              </span>
                              {s.room ? (
                                <span className="mt-0.5 text-[11px] text-gray-500" translate="no">
                                  {s.room}
                                </span>
                              ) : null}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
