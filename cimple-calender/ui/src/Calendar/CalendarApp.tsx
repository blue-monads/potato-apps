import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Tag as TagIcon,
  Menu,
  X,
  Keyboard,
  RefreshCw,
} from 'lucide-react';
import type { CalEvent, CalTag } from '../lib/api';
import {
  eventsApi,
  tagsApi,
  DEFAULT_TAGS,
} from '../lib/api';
import {
  getMonthName,
  startOfWeek,
} from './dateUtils';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import { DayView } from './DayView';
import { YearView } from './YearView';
import { MiniCalendar } from './MiniCalendar';
import { EventModal } from './EventModal';
import { TagModal } from './TagModal';

export type CalendarViewType = 'month' | 'week' | 'day' | 'year';

export const CalendarApp: React.FC = () => {
  const [cursor, setCursor] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [view, setView] = useState<CalendarViewType>('month');
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [tags, setTags] = useState<CalTag[]>(DEFAULT_TAGS);
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Modals state
  const [eventModalState, setEventModalState] = useState<{
    isOpen: boolean;
    event: CalEvent | null;
    initialDate?: string;
    initialTime?: string;
  }>({
    isOpen: false,
    event: null,
  });

  const [tagModalOpen, setTagModalOpen] = useState(false);

  // Load tags and events
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [loadedTags, loadedEvents] = await Promise.all([
        tagsApi.list(),
        eventsApi.list(),
      ]);
      if (loadedTags && loadedTags.length > 0) {
        setTags(loadedTags);
      }
      setEvents(loadedEvents || []);
    } catch (e) {
      console.error('Failed to fetch calendar data', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Navigate cursor
  const moveCursor = useCallback((delta: number) => {
    setCursor((prev) => {
      const next = new Date(prev);
      if (view === 'month') {
        next.setMonth(next.getMonth() + delta);
      } else if (view === 'year') {
        next.setFullYear(next.getFullYear() + delta);
      } else if (view === 'week') {
        next.setDate(next.getDate() + delta * 7);
      } else {
        next.setDate(next.getDate() + delta);
      }
      return next;
    });
  }, [view]);

  const goToToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setCursor(d);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((document.activeElement as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === 'Escape') {
        setEventModalState({ isOpen: false, event: null });
        setTagModalOpen(false);
        setShowShortcuts(false);
      } else if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setEventModalState({ isOpen: true, event: null });
      } else if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        goToToday();
      } else if (e.key.toLowerCase() === 'm') {
        setView('month');
      } else if (e.key.toLowerCase() === 'w') {
        setView('week');
      } else if (e.key.toLowerCase() === 'd') {
        setView('day');
      } else if (e.key.toLowerCase() === 'y') {
        setView('year');
      } else if (e.key === 'ArrowLeft') {
        moveCursor(-1);
      } else if (e.key === 'ArrowRight') {
        moveCursor(1);
      } else if (e.key === '?') {
        setShowShortcuts((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveCursor]);

  // Title formatting
  const formattedTitle = useMemo(() => {
    if (view === 'year') {
      return `${cursor.getFullYear()}`;
    }
    if (view === 'day') {
      return cursor.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    }
    if (view === 'week') {
      const start = startOfWeek(cursor);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return `${getMonthName(cursor)} ${cursor.getFullYear()}`;
  }, [cursor, view]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (selectedTag !== 'all' && ev.tag_id !== selectedTag) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = (ev.title || '').toLowerCase().includes(q);
        const matchesDesc = (ev.description || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc) return false;
      }
      return true;
    });
  }, [events, selectedTag, searchQuery]);

  // Event handlers
  const handleSaveEvent = async (data: {
    id?: number;
    title: string;
    description: string;
    start_date: string;
    end_date: string;
    all_day: boolean;
    tag_id: string;
    color_type: string;
  }) => {
    if (data.id) {
      const updated = await eventsApi.update(data.id, data);
      setEvents((prev) => prev.map((e) => (e.id === data.id ? updated : e)));
    } else {
      const created = await eventsApi.create(data);
      setEvents((prev) => [...prev, created]);
    }
  };

  const handleDeleteEvent = async (id: number) => {
    await eventsApi.delete(id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  const handleCreateTag = async (data: { name: string; color: string }) => {
    const created = await tagsApi.create(data);
    setTags((prev) => [...prev, created]);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#f8f9fa] text-[#20242b] overflow-hidden font-sans">
      {/* Top Navbar */}
      <header className="h-16 px-4 md:px-6 bg-white border-b border-gray-200 flex items-center justify-between gap-3 shrink-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            title="Toggle Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5 font-bold text-lg text-gray-900 tracking-tight select-none mr-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <span>Cimple Calendar</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 ml-2">
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors shadow-2xs cursor-pointer"
            >
              Today
            </button>
            <div className="flex items-center">
              <button
                onClick={() => moveCursor(-1)}
                className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                title="Previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => moveCursor(1)}
                className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                title="Next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <h1 className="text-base sm:text-lg font-bold text-gray-800 tracking-tight select-none ml-1 truncate">
            {formattedTitle}
          </h1>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative hidden md:block w-48 lg:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-7 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all placeholder:text-gray-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View switcher */}
          <div className="flex p-0.5 bg-gray-100 rounded-lg border border-gray-200 select-none">
            {(['month', 'week', 'day', 'year'] as CalendarViewType[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2.5 sm:px-3 py-1.5 text-xs font-semibold capitalize rounded-md transition-all cursor-pointer ${
                  view === v
                    ? 'bg-white text-gray-900 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          {/* New Event Button */}
          <button
            onClick={() => setEventModalState({ isOpen: true, event: null })}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-2xs hover:shadow transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">New Event</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex flex-1 min-h-0 relative overflow-hidden">
        {/* Left Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'w-64 min-w-[250px]' : 'w-0 -translate-x-full min-w-0 p-0 border-r-0'
          } bg-white border-r border-gray-200 transition-all duration-200 flex flex-col shrink-0 overflow-y-auto select-none z-20`}
        >
          <div className="p-4 space-y-5">
            {/* Mini Calendar */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 px-1">
                Mini Calendar
              </div>
              <MiniCalendar
                cursor={cursor}
                onSelectDate={(d) => {
                  setCursor(d);
                  if (view === 'year') setView('month');
                }}
              />
            </div>

            {/* Tags / Categories */}
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Tags & Categories
                </span>
                <button
                  onClick={() => setTagModalOpen(true)}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Tag
                </button>
              </div>

              <div className="space-y-1">
                <button
                  onClick={() => setSelectedTag('all')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    selectedTag === 'all'
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <TagIcon className="w-3.5 h-3.5 text-gray-400" />
                    <span>All Events</span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-semibold px-1.5 py-0.5 rounded-full bg-gray-100">
                    {events.length}
                  </span>
                </button>

                {tags.map((t) => {
                  const count = events.filter((e) => e.tag_id === t.id).length;
                  const isSelected = selectedTag === t.id;

                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTag(isSelected ? 'all' : t.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50 text-indigo-700 font-semibold'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: t.color }}
                        />
                        <span className="truncate">{t.name}</span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-semibold px-1.5 py-0.5 rounded-full bg-gray-100">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Helper Tips */}
            <div className="pt-2 border-t border-gray-100">
              <button
                onClick={() => setShowShortcuts(true)}
                className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
              >
                <Keyboard className="w-4 h-4 text-gray-400" />
                <span>Keyboard Shortcuts</span>
              </button>

              <button
                onClick={loadData}
                disabled={loading}
                className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
                <span>Sync with Server</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Calendar View Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden relative">
          {view === 'month' && (
            <MonthView
              cursor={cursor}
              events={filteredEvents}
              tags={tags}
              onOpenEvent={(ev) =>
                setEventModalState({ isOpen: true, event: ev })
              }
              onNewEvent={(dateStr) =>
                setEventModalState({
                  isOpen: true,
                  event: null,
                  initialDate: dateStr,
                })
              }
            />
          )}

          {view === 'week' && (
            <WeekView
              cursor={cursor}
              events={filteredEvents}
              tags={tags}
              onOpenEvent={(ev) =>
                setEventModalState({ isOpen: true, event: ev })
              }
              onNewEvent={(dateStr, timeStr) =>
                setEventModalState({
                  isOpen: true,
                  event: null,
                  initialDate: dateStr,
                  initialTime: timeStr,
                })
              }
            />
          )}

          {view === 'day' && (
            <DayView
              cursor={cursor}
              events={filteredEvents}
              tags={tags}
              onOpenEvent={(ev) =>
                setEventModalState({ isOpen: true, event: ev })
              }
              onNewEvent={(dateStr, timeStr) =>
                setEventModalState({
                  isOpen: true,
                  event: null,
                  initialDate: dateStr,
                  initialTime: timeStr,
                })
              }
            />
          )}

          {view === 'year' && (
            <YearView
              cursor={cursor}
              events={filteredEvents}
              onSelectDate={(d) => {
                setCursor(d);
                setView('day');
              }}
              onSelectMonth={(d) => {
                setCursor(d);
                setView('month');
              }}
            />
          )}
        </main>
      </div>

      {/* Event Modal */}
      <EventModal
        isOpen={eventModalState.isOpen}
        onClose={() => setEventModalState({ isOpen: false, event: null })}
        event={eventModalState.event}
        initialDate={eventModalState.initialDate}
        initialTime={eventModalState.initialTime}
        tags={tags}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
      />

      {/* Tag Modal */}
      <TagModal
        isOpen={tagModalOpen}
        onClose={() => setTagModalOpen(false)}
        onSave={handleCreateTag}
      />

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm">Keyboard Shortcuts</h3>
              <button
                onClick={() => setShowShortcuts(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-gray-100">
                <span className="text-gray-600">New Event</span>
                <kbd className="px-2 py-0.5 bg-gray-100 border border-gray-200 rounded font-mono font-semibold">N</kbd>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-gray-100">
                <span className="text-gray-600">Today</span>
                <kbd className="px-2 py-0.5 bg-gray-100 border border-gray-200 rounded font-mono font-semibold">T</kbd>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-gray-100">
                <span className="text-gray-600">Month / Week / Day / Year view</span>
                <div className="flex gap-1 font-mono font-semibold">
                  <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded">M</kbd>
                  <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded">W</kbd>
                  <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded">D</kbd>
                  <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded">Y</kbd>
                </div>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-gray-100">
                <span className="text-gray-600">Navigate Previous / Next</span>
                <div className="flex gap-1 font-mono font-semibold">
                  <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded">←</kbd>
                  <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded">→</kbd>
                </div>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-600">Close modal</span>
                <kbd className="px-2 py-0.5 bg-gray-100 border border-gray-200 rounded font-mono font-semibold">Esc</kbd>
              </div>
            </div>
            <button
              onClick={() => setShowShortcuts(false)}
              className="w-full py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
