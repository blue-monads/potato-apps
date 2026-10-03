import React, { useState } from 'react';
import { X, Check } from 'lucide-react';

interface TagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; color: string }) => Promise<void>;
}

const PRESET_COLORS = [
  '#4f6ef7', // indigo
  '#46a86a', // green
  '#df8b4c', // orange
  '#9b6ad0', // purple
  '#e05252', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#eab308', // amber
  '#7c8795', // slate/gray
];

export const TagModal: React.FC<TagModalProps> = ({ isOpen, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Tag name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), color });
      setName('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create tag');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div 
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-base font-bold text-gray-900">Add New Tag</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Tag Name
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Marketing, Health, Urgent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-gray-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Color
            </label>
            <div className="flex flex-wrap gap-2.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 shadow-xs cursor-pointer"
                >
                  {color === c && <Check className="w-4 h-4 text-white stroke-[3]" />}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Tag'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
