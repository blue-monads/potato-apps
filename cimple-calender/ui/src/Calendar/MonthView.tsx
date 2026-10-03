import React from 'react';
import type { CalEvent, CalTag } from '../lib/api';
import { formatDateIso, isToday, getEventTime, getEventColors } from './dateUtils';

interface MonthViewProps {
  cursor: Date;
  events: CalEvent[];
  tags: CalTag[];
  onOpenEvent: (event: CalEvent) => void;
  onNewEvent: (dateStr: string) => void;
}

export const MonthView: React.FC<MonthViewProps> = ({
  cursor,
  events,
  tags,
  onOpenEvent,
  onNewEvent,
}) => {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const startDay = new Date(firstDayOfMonth);
  startDay.setDate(1 - firstDayOfMonth.getDay());

  // Generate 42 calendar cells
  const days: { date: Date; isOut: boolean; isoStr: string }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDay);
    d.setDate(startDay.getDate() + i);
    days.push({
      date: d,
      isOut: d.getMonth() !== month,
      isoStr: formatDateIso(d),
    });
  }

  // Pre-group events by date
  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const ev of events) {
      const dStr = ev.start_date.slice(0, 10);
      if (!map.has(dStr)) {
        map.set(dStr, []);
      }
      map.get(dStr)!.push(ev);
    }
    // Sort events on each day by start time
    map.forEach((list) => {
      list.sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));
    });
    return map;
  }, [events]);

  const tagColorMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tags) {
      map.set(t.id, t.color);
    }
    return map;
  }, [tags]);

  return (
    <div className="flex flex-col h-full bg-white select-none overflow-x-auto min-w-[750px]">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50/80 sticky top-0 z-10">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div
            key={d}
            className="py-2.5 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 text-left border-r last:border-r-0 border-gray-100"
          >
            {d}
          </div>
        ))}
      </div>

      {/* 6-row month grid */}
      <div className="grid grid-cols-7 grid-rows-6 flex-1 border-b border-gray-200">
        {days.map(({ date, isOut, isoStr }) => {
          const isCurrentToday = isToday(date);
          const dayEvents = eventsByDate.get(isoStr) || [];
          const visibleEvents = dayEvents.slice(0, 3);
          const moreCount = dayEvents.length - visibleEvents.length;

          return (
            <div
              key={isoStr}
              onClick={() => onNewEvent(isoStr)}
              className={`min-h-[95px] p-1.5 border-b border-r last:border-r-0 border-gray-200 flex flex-col transition-colors cursor-pointer group hover:bg-indigo-50/20 ${
                isOut ? 'bg-gray-50/50 text-gray-400' : 'bg-white text-gray-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full transition-transform ${
                    isCurrentToday
                      ? 'bg-indigo-600 text-white font-bold shadow-xs'
                      : isOut
                      ? 'text-gray-400'
                      : 'text-gray-700 group-hover:text-indigo-600'
                  }`}
                >
                  {date.getDate()}
                </span>
                {dayEvents.length > 0 && (
                  <span className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                    {dayEvents.length} event{dayEvents.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Event pills */}
              <div className="flex-1 space-y-1 overflow-hidden">
                {visibleEvents.map((ev) => {
                  const tagColor = tagColorMap.get(ev.tag_id);
                  const colors = getEventColors(ev.color_type || ev.tag_id, tagColor);
                  const time = getEventTime(ev);

                  return (
                    <button
                      key={ev.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenEvent(ev);
                      }}
                      style={{
                        backgroundColor: colors.bg,
                        color: colors.text,
                        borderLeftColor: colors.border,
                      }}
                      className="w-full text-left px-2 py-0.5 rounded text-[11px] font-medium truncate flex items-center gap-1.5 border-l-3 hover:brightness-95 transition-all shadow-2xs cursor-pointer block"
                      title={`${time ? `${time} ` : ''}${ev.title}`}
                    >
                      {time && (
                        <span className="opacity-75 font-normal text-[10px] shrink-0">
                          {time}
                        </span>
                      )}
                      <span className="truncate">{ev.title}</span>
                    </button>
                  );
                })}

                {moreCount > 0 && (
                  <div className="text-[10px] font-semibold text-gray-500 hover:text-indigo-600 px-1 py-0.5 cursor-pointer">
                    +{moreCount} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
