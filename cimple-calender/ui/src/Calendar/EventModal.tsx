import { useState, useEffect } from 'react';
import type { CalEvent, CalTag } from '../lib/api';
import { X, Trash2, Calendar, Clock, Tag as TagIcon, AlignLeft } from 'lucide-react';
import { formatDateIso, getEventDate, getEventTime, getEventEndTime } from './dateUtils';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: CalEvent | null;
  initialDate?: string;
  initialTime?: string;
  tags: CalTag[];
  onSave: (data: {
    id?: number;
    title: string;
    description: string;
    start_date: string;
    end_date: string;
    all_day: boolean;
    tag_id: string;
    color_type: string;
  }) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
}

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  event,
  initialDate,
  initialTime,
  tags,
  onSave,
  onDelete,
}) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [allDay, setAllDay] = useState(false);
  const [tagId, setTagId] = useState('work');
  const [colorType, setColorType] = useState('work');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setDate(getEventDate(event));
      setTime(getEventTime(event) || '09:00');
      setEndTime(getEventEndTime(event) || '10:00');
      setAllDay(Boolean(event.all_day));
      setTagId(event.tag_id || 'work');
      setColorType(event.color_type || event.tag_id || 'default');
      setNotes(event.description || '');
    } else {
      setTitle('');
      setDate(initialDate || formatDateIso(new Date()));
      setTime(initialTime || '09:00');
      const startH = parseInt((initialTime || '09:00').split(':')[0] || '9', 10);
      const nextH = String((startH + 1) % 24).padStart(2, '0');
      setEndTime(`${nextH}:00`);
      setAllDay(false);
      setTagId(tags[0]?.id || 'work');
      setColorType(tags[0]?.id || 'work');
      setNotes('');
    }
    setError(null);
  }, [event, initialDate, initialTime, isOpen, tags]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Event title is required');
      return;
    }
    if (!date) {
      setError('Date is required');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const start_date = allDay ? `${date} 00:00:00` : `${date} ${time}:00`;
      const end_date = allDay ? `${date} 23:59:59` : `${date} ${endTime || time}:00`;

      await onSave({
        id: event?.id,
        title: title.trim(),
        description: notes.trim(),
        start_date,
        end_date,
        all_day: allDay,
        tag_id: tagId,
        color_type: colorType,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !onDelete) return;
    if (confirm('Are you sure you want to delete this event?')) {
      setDeleting(true);
      try {
        await onDelete(event.id);
        onClose();
      } catch (err: any) {
        setError(err?.message || 'Failed to delete event');
      } finally {
        setDeleting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div 
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-900">
            {event ? 'Edit Event' : 'New Event'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Event Title
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="What is happening?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-gray-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-gray-400" /> Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={(e) => setAllDay(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="font-medium text-xs text-gray-600">All day event</span>
              </label>
            </div>
          </div>

          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-gray-400" /> Start Time
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-gray-400" /> End Time
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1">
                <TagIcon className="w-3.5 h-3.5 text-gray-400" /> Tag
              </label>
              <select
                value={tagId}
                onChange={(e) => {
                  setTagId(e.target.value);
                  setColorType(e.target.value);
                }}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Type / Color
              </label>
              <select
                value={colorType}
                onChange={(e) => setColorType(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="default">Default (Blue)</option>
                <option value="work">Work (Green)</option>
                <option value="personal">Personal (Orange)</option>
                <option value="focus">Focus (Purple)</option>
                <option value="other">Other (Gray)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1">
              <AlignLeft className="w-3.5 h-3.5 text-gray-400" /> Notes
            </label>
            <textarea
              rows={3}
              placeholder="Optional notes or details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y placeholder:text-gray-400"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            {event && onDelete ? (
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Saving...' : event ? 'Save Changes' : 'Create Event'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
