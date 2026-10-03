import React from 'react';
import type { CalEvent } from '../lib/api';
import { formatDateIso, isToday, getMonthName } from './dateUtils';

interface YearViewProps {
  cursor: Date;
  events: CalEvent[];
  onSelectDate: (d: Date) => void;
  onSelectMonth: (d: Date) => void;
}

export const YearView: React.FC<YearViewProps> = ({
  cursor,
  events,
  onSelectDate,
  onSelectMonth,
}) => {
  const year = cursor.getFullYear();

  // Pre-calculate events count by date
  const eventsCountByDate = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const ev of events) {
      const dStr = ev.start_date.slice(0, 10);
      map.set(dStr, (map.get(dStr) || 0) + 1);
    }
    return map;
  }, [events]);

  const months = Array.from({ length: 12 }, (_, m) => {
    const firstDay = new Date(year, m, 1);
    const lastDay = new Date(year, m + 1, 0);
    const totalDays = lastDay.getDate();
    const startDow = firstDay.getDay();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) days.push(new Date(year, m, d));

    return {
      monthIndex: m,
      firstDay,
      days,
    };
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
        {months.map(({ monthIndex, firstDay, days }) => (
          <div
            key={monthIndex}
            className="bg-white rounded-xl border border-gray-200 p-4 shadow-2xs hover:shadow-sm transition-shadow select-none"
          >
            <button
              onClick={() => onSelectMonth(firstDay)}
              className="w-full text-left font-bold text-sm text-gray-800 hover:text-indigo-600 mb-3 transition-colors cursor-pointer"
            >
              {getMonthName(firstDay)}
            </button>

            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-gray-400 mb-1">
              <span>S</span>
              <span>M</span>
              <span>T</span>
              <span>W</span>
              <span>T</span>
              <span>F</span>
              <span>S</span>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {days.map((date, idx) => {
                if (!date) {
                  return <div key={`empty-${idx}`} className="h-6 w-6" />;
                }

                const isoStr = formatDateIso(date);
                const hasEvents = (eventsCountByDate.get(isoStr) || 0) > 0;
                const count = eventsCountByDate.get(isoStr) || 0;
                const isCurrentToday = isToday(date);

                return (
                  <button
                    key={isoStr}
                    onClick={() => onSelectDate(date)}
                    title={hasEvents ? `${count} event(s) on ${isoStr}` : isoStr}
                    className={`h-6 w-6 mx-auto rounded-md flex items-center justify-center text-[11px] font-medium transition-all cursor-pointer ${
                      isCurrentToday
                        ? 'bg-indigo-600 text-white font-bold shadow-xs'
                        : hasEvents
                        ? 'bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100 ring-1 ring-indigo-200'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
