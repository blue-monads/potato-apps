import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDateIso, getMonthName, isToday, isSameDay } from './dateUtils';

interface MiniCalendarProps {
  cursor: Date;
  onSelectDate: (d: Date) => void;
}

export const MiniCalendar: React.FC<MiniCalendarProps> = ({ cursor, onSelectDate }) => {
  const [miniCursor, setMiniCursor] = useState(new Date(cursor.getFullYear(), cursor.getMonth(), 1));

  // Sync if cursor month changes
  React.useEffect(() => {
    setMiniCursor(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
  }, [cursor.getFullYear(), cursor.getMonth()]);

  const year = miniCursor.getFullYear();
  const month = miniCursor.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const totalDays = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  const handlePrev = () => {
    setMiniCursor(new Date(year, month - 1, 1));
  };

  const handleNext = () => {
    setMiniCursor(new Date(year, month + 1, 1));
  };

  const days: (Date | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(null);
  }
  for (let d = 1; d <= totalDays; d++) {
    days.push(new Date(year, month, d));
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-xs">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-bold text-gray-800">
          {getMonthName(miniCursor, true)} {year}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrev}
            className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleNext}
            className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

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
            return <div key={`empty-${idx}`} className="h-6.5 w-6.5" />;
          }

          const isCurrentToday = isToday(date);
          const isSelected = isSameDay(date, cursor);

          return (
            <button
              key={formatDateIso(date)}
              onClick={() => onSelectDate(date)}
              className={`h-6.5 w-6.5 mx-auto rounded-md flex items-center justify-center text-xs font-medium transition-all cursor-pointer ${
                isSelected
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : isCurrentToday
                  ? 'text-indigo-600 font-bold bg-indigo-50 hover:bg-indigo-100'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
};
