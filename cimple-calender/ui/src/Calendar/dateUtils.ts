import type { CalEvent } from '../lib/api';

export const pad = (n: number): string => String(n).padStart(2, '0');

export function formatDateIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDateTime(d: Date): string {
  return `${formatDateIso(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

export function formatTimeHM(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseDateTime(str: string): Date {
  if (!str) return new Date();
  // Handle "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS"
  const normalized = str.includes('T') ? str : str.replace(' ', 'T');
  const d = new Date(normalized);
  if (isNaN(d.getTime())) {
    // Try YYYY-MM-DD
    const parts = str.split(/[- :T]/);
    if (parts.length >= 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const hours = parseInt(parts[3] || '0', 10);
      const mins = parseInt(parts[4] || '0', 10);
      return new Date(year, month, day, hours, mins);
    }
    return new Date();
  }
  return d;
}

export function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

export function startOfWeek(d: Date): Date {
  const res = new Date(d);
  res.setHours(0, 0, 0, 0);
  res.setDate(res.getDate() - res.getDay());
  return res;
}

export function getMonthName(d: Date, short = false): string {
  return d.toLocaleString(undefined, { month: short ? 'short' : 'long' });
}

export function getWeekdayName(d: Date, short = false): string {
  return d.toLocaleString(undefined, { weekday: short ? 'short' : 'long' });
}

export function getEventDate(event: CalEvent): string {
  if (!event.start_date) return '';
  if (event.start_date.length >= 10) {
    return event.start_date.slice(0, 10);
  }
  return formatDateIso(new Date());
}

export function getEventTime(event: CalEvent): string {
  if (event.all_day) return 'All day';
  if (!event.start_date) return '';
  if (event.start_date.includes(' ') || event.start_date.includes('T')) {
    const timePart = event.start_date.includes('T')
      ? event.start_date.split('T')[1]
      : event.start_date.split(' ')[1];
    return timePart ? timePart.slice(0, 5) : '';
  }
  return '';
}

export function getEventEndTime(event: CalEvent): string {
  if (event.all_day) return '';
  if (!event.end_date) return '';
  if (event.end_date.includes(' ') || event.end_date.includes('T')) {
    const timePart = event.end_date.includes('T')
      ? event.end_date.split('T')[1]
      : event.end_date.split(' ')[1];
    return timePart ? timePart.slice(0, 5) : '';
  }
  return '';
}

export interface ColorScheme {
  bg: string;
  text: string;
  border: string;
  accent: string;
}

export const COLOR_SCHEMES: Record<string, ColorScheme> = {
  work: { bg: '#eaf7ee', text: '#28693d', border: '#46a86a', accent: '#46a86a' },
  personal: { bg: '#fff0e7', text: '#9c5222', border: '#df8b4c', accent: '#df8b4c' },
  focus: { bg: '#f4ecff', text: '#6840a1', border: '#9b6ad0', accent: '#9b6ad0' },
  other: { bg: '#edf0f3', text: '#4e5661', border: '#7c8795', accent: '#7c8795' },
  default: { bg: '#edf1ff', text: '#3b4ea8', border: '#4f6ef7', accent: '#4f6ef7' },
};

export function getEventColors(typeOrTag?: string, tagColor?: string): ColorScheme {
  const key = (typeOrTag || 'default').toLowerCase();
  if (COLOR_SCHEMES[key]) {
    return COLOR_SCHEMES[key];
  }
  if (tagColor) {
    return {
      bg: `${tagColor}18`,
      text: tagColor,
      border: tagColor,
      accent: tagColor,
    };
  }
  return COLOR_SCHEMES.default;
}
