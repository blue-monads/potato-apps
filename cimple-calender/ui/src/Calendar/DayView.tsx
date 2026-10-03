import React, { useRef, useEffect } from 'react';
import type { CalEvent, CalTag } from '../lib/api';
import {
  formatDateIso,
  isToday,
  getEventColors,
  pad,
} from './dateUtils';

interface DayViewProps {
  cursor: Date;
  events: CalEvent[];
  tags: CalTag[];
  onOpenEvent: (event: CalEvent) => void;
  onNewEvent: (dateStr: string, timeStr?: string) => void;
}

export const DayView: React.FC<DayViewProps> = ({
  cursor,
  events,
  tags,
  onOpenEvent,
  onNewEvent,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isoStr = formatDateIso(cursor);
  const dayIsToday = isToday(cursor);

  const dayEvents = React.useMemo(() => {
    return events.filter((ev) => ev.start_date.slice(0, 10) === isoStr);
  }, [events, isoStr]);

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
      scrollContainerRef.current.scrollTop = 8 * 60;
    }
  }, [cursor]);

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return (
    <div className="flex flex-col h-full bg-white select-none overflow-hidden min-w-[500px]">
      {/* Day Header */}
      <div className="grid grid-cols-[64px_1fr] border-b border-gray-200 bg-gray-50/90 sticky top-0 z-20">
        <div className="py-2.5 border-r border-gray-200 text-center text-xs font-semibold text-gray-400">
          Time
        </div>
        <div className="py-2.5 px-4 flex items-center gap-3">
          <span
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
              dayIsToday ? 'bg-indigo-600 text-white shadow-xs' : 'bg-gray-100 text-gray-800'
            }`}
          >
            {cursor.getDate()}
          </span>
          <div>
            <div className="text-sm font-bold text-gray-900">
              {cursor.toLocaleString(undefined, { weekday: 'long' })}
            </div>
            <div className="text-xs text-gray-500">
              {cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {/* 24-Hour Slots Grid */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto grid grid-cols-[64px_1fr] relative"
      >
        {/* Time column */}
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

        {/* Day Column */}
        <div className={`relative bg-white ${dayIsToday ? 'bg-indigo-50/5' : ''}`}>
          {Array.from({ length: 24 }).map((_, hour) => (
            <div
              key={hour}
              onClick={() => onNewEvent(isoStr, `${pad(hour)}:00`)}
              className="h-[60px] border-b border-gray-100 hover:bg-indigo-50/30 transition-colors cursor-pointer"
            />
          ))}

          {/* Current time indicator */}
          {dayIsToday && (
            <div
              style={{ top: `${currentMinutes}px` }}
              className="absolute left-0 right-0 z-10 flex items-center pointer-events-none"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5" />
              <div className="flex-1 border-t-2 border-red-500 shadow-2xs" />
            </div>
          )}

          {/* Events */}
          {dayEvents.map((ev) => {
            const tagColor = tagColorMap.get(ev.tag_id);
            const colors = getEventColors(ev.color_type || ev.tag_id, tagColor);

            let top = 9 * 60;
            let height = 60;

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
                    height = Math.max(30, endTop - top);
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
                className="absolute left-3 right-3 rounded-lg px-3 py-1.5 text-left text-xs font-semibold overflow-hidden border-l-4 shadow-xs hover:brightness-95 transition-all z-5 cursor-pointer flex flex-col justify-start"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm truncate">{ev.title}</span>
                  {!ev.all_day && (
                    <span className="text-[11px] opacity-75 font-normal">
                      {ev.start_date.slice(11, 16)} - {ev.end_date.slice(11, 16)}
                    </span>
                  )}
                </div>
                {ev.description && (
                  <div className="text-xs opacity-85 font-normal mt-1 line-clamp-2">
                    {ev.description}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
