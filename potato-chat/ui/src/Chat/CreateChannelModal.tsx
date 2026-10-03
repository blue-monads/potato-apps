import React, { useState } from 'react';
import { X, Lock, Globe, Loader2 } from 'lucide-react';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string, visibility: string) => Promise<void>;
}

const CreateChannelModal: React.FC<CreateChannelModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim().toLowerCase().replace(/\s+/g, '-');
    if (!cleanName) {
      setError('Channel name is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onCreate(cleanName, description.trim(), visibility);
      setName('');
      setDescription('');
      setVisibility('public');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create channel.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs select-none">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200/90 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-3.5 border-b border-slate-200/90 flex justify-between items-center bg-white">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-md bg-[#eef2fe] text-[#2d7ff9] border border-blue-200/60 flex items-center justify-center font-bold text-xs shadow-2xs">
              #
            </div>
            <h2 className="text-sm font-semibold text-slate-900 tracking-tight">Create a channel</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Channel Name
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">#</span>
              <input
                type="text"
                id="name"
                className="w-full pl-7 pr-3 py-1.5 border border-slate-200/90 rounded-md shadow-2xs text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g. project-discussion"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                autoFocus
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Names must be lowercase and spaces will convert to hyphens.
            </p>
          </div>

          <div>
            <label htmlFor="description" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Description <span className="text-slate-400 font-normal lowercase">(optional)</span>
            </label>
            <textarea
              id="description"
              rows={2}
              className="w-full px-3 py-1.5 border border-slate-200/90 rounded-md shadow-2xs text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="What's this channel about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Channel Visibility
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <label
                className={`flex items-start p-2.5 rounded-lg border cursor-pointer transition-all ${
                  visibility === 'public'
                    ? 'border-[#2d7ff9] bg-blue-50/50 shadow-2xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="visibility"
                  value="public"
                  checked={visibility === 'public'}
                  onChange={() => setVisibility('public')}
                  className="sr-only"
                />
                <Globe className="w-3.5 h-3.5 text-[#2d7ff9] mt-0.5 mr-2 flex-shrink-0" />
                <div className="text-xs">
                  <span className="font-semibold text-slate-800 block">Public</span>
                  <span className="text-[11px] text-slate-400">Anyone in space can join</span>
                </div>
              </label>

              <label
                className={`flex items-start p-2.5 rounded-lg border cursor-pointer transition-all ${
                  visibility === 'private'
                    ? 'border-[#2d7ff9] bg-blue-50/50 shadow-2xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="visibility"
                  value="private"
                  checked={visibility === 'private'}
                  onChange={() => setVisibility('private')}
                  className="sr-only"
                />
                <Lock className="w-3.5 h-3.5 text-purple-600 mt-0.5 mr-2 flex-shrink-0" />
                <div className="text-xs">
                  <span className="font-semibold text-slate-800 block">Private</span>
                  <span className="text-[11px] text-slate-400">Only invited members can join</span>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-slate-200/90 rounded-md text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-2xs"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-3.5 py-1.5 rounded-md text-xs font-semibold text-white bg-[#2d7ff9] hover:bg-[#1b6fe5] disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
              <span>{isSubmitting ? 'Creating...' : 'Create Channel'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateChannelModal;
