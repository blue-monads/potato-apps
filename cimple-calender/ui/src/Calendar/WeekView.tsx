import React, { useRef, useEffect } from 'react';
import type { CalEvent, CalTag } from '../lib/api';
import {
  formatDateIso,
  isToday,
  startOfWeek,
  getEventColors,
  pad,
} from './dateUtils';

interface WeekViewProps {
  cursor: Date;
  events: CalEvent[];
  tags: CalTag[];
  onOpenEvent: (event: CalEvent) => void;
  onNewEvent: (dateStr: string, timeStr?: string) => void;
}

export const WeekView: React.FC<WeekViewProps> = ({
  cursor,
  events,
  tags,
  onOpenEvent,
  onNewEvent,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const weekStart = startOfWeek(cursor);

  // Generate 7 days of the week
  const days: { date: Date; isoStr: string; isToday: boolean }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    days.push({
      date: d,
      isoStr: formatDateIso(d),
      isToday: isToday(d),
    });
  }

  // Pre-filter events for each day
  const eventsByDay = React.useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const d of days) {
      map.set(d.isoStr, []);
    }
    for (const ev of events) {
      const dStr = ev.start_date.slice(0, 10);
      if (map.has(dStr)) {
        map.get(dStr)!.push(ev);
      }
    }
    return map;
  }, [events, days]);

  const tagColorMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tags) {
      map.set(t.id, t.color);
    }
    return map;
  }, [tags]);

  // Scroll to 8:00 AM on initial load
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 8 * 60; // 8 AM
    }
  }, []);

  // Current time position
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return (
    <div className="flex flex-col h-full bg-white select-none overflow-hidden min-w-[800px]">
      {/* Week Header */}
      <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-gray-200 bg-gray-50/90 sticky top-0 z-20">
        <div className="py-2.5 border-r border-gray-200 text-center text-xs font-semibold text-gray-400">
          Time
        </div>
        {days.map(({ date, isToday }) => (
          <div
            key={date.toISOString()}
            className={`py-2 px-1 text-center border-r last:border-r-0 border-gray-200 ${
              isToday ? 'bg-indigo-50/50' : ''
            }`}
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              {date.toLocaleString(undefined, { weekday: 'short' })}
            </div>
            <div
              className={`inline-flex items-center justify-center w-7 h-7 mt-0.5 rounded-full text-sm font-bold ${
                isToday ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-800'
              }`}
            >
              {date.getDate()}
            </div>
          </div>
        ))}
      </div>

      {/* Week Grid Slots */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto grid grid-cols-[64px_repeat(7,1fr)] relative"
      >
        {/* Time column labels */}
        <div className="border-r border-gray-200 bg-white select-none">
          {Array.from({ length: 24 }).map((_, hour) => (
            <div
              key={hour}
              className="h-[60px] border-b border-gray-100 text-right pr-2 pt-1 text-[11px] font-medium text-gray-400"
            >
              {pad(hour)}:00
            </div>
          ))}
        </div>

        {/* 7 day columns */}
        {days.map(({ isoStr, isToday: dayIsToday }) => {
          const dayEvents = eventsByDay.get(isoStr) || [];

          return (
            <div
              key={isoStr}
              className={`relative border-r last:border-r-0 border-gray-200 bg-white ${
                dayIsToday ? 'bg-indigo-50/10' : ''
              }`}
            >
              {/* 24 hour slots for clicking */}
              {Array.from({ length: 24 }).map((_, hour) => (
                <div
                  key={hour}
                  onClick={() => onNewEvent(isoStr, `${pad(hour)}:00`)}
                  className="h-[60px] border-b border-gray-100 hover:bg-indigo-50/30 transition-colors cursor-pointer"
                />
              ))}

              {/* Red current time indicator line */}
              {dayIsToday && (
                <div
                  style={{ top: `${currentMinutes}px` }}
                  className="absolute left-0 right-0 z-10 flex items-center pointer-events-none"
                >
                  <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                  <div className="flex-1 border-t-2 border-red-500 shadow-2xs" />
                </div>
              )}

              {/* Event blocks */}
              {dayEvents.map((ev) => {
                const tagColor = tagColorMap.get(ev.tag_id);
                const colors = getEventColors(ev.color_type || ev.tag_id, tagColor);

                // Calculate top and height
                let top = 9 * 60; // default 9am
                let height = 60; // 1 hr default

                if (ev.all_day) {
                  top = 0;
                  height = 50;
                } else if (ev.start_date) {
                  const timePart = ev.start_date.includes(' ')
                    ? ev.start_date.split(' ')[1]
                    : ev.start_date.split('T')[1];
                  if (timePart) {
                    const [h, m] = timePart.split(':').map(Number);
                    top = (h || 0) * 60 + (m || 0);
                  }

                  if (ev.end_date) {
                    const endTimePart = ev.end_date.includes(' ')
                      ? ev.end_date.split(' ')[1]
                      : ev.end_date.split('T')[1];
                    if (endTimePart) {
                      const [eh, em] = endTimePart.split(':').map(Number);
                      const endTop = (eh || 0) * 60 + (em || 0);
                      if (endTop > top) {
                        height = Math.max(26, endTop - top);
                      }
                    }
                  }
                }

                return (
                  <button
                    key={ev.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenEvent(ev);
                    }}
                    style={{
                      top: `${top}px`,
                      height: `${height}px`,
                      backgroundColor: colors.bg,
                      color: colors.text,
                      borderLeftColor: colors.border,
                    }}
                    className="absolute left-1 right-1 rounded-md px-2 py-1 text-left text-xs font-semibold overflow-hidden border-l-4 shadow-xs hover:brightness-95 transition-all z-5 cursor-pointer flex flex-col justify-start"
                  >
                    <div className="truncate flex items-center gap-1 leading-tight">
                      <span>{ev.title}</span>
                    </div>
                    {height >= 40 && ev.description && (
                      <div className="text-[10px] opacity-80 font-normal truncate mt-0.5 leading-tight">
                        {ev.description}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
