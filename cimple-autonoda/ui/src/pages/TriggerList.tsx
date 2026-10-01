import React, { useState, useEffect } from 'react';
import type { EventTrigger } from '../types/workflow';
import { autonodaApi } from '../lib/api';
import {
  GitFork,
  Plus,
  ArrowRight,
  Trash2,
  Database,
  Search,
  Calendar,
  X,
  Loader2,
  Workflow,
} from 'lucide-react';

interface TriggerListProps {
  onSelectTrigger: (triggerId: number) => void;
}

export const TriggerList: React.FC<TriggerListProps> = ({ onSelectTrigger }) => {
  const [triggers, setTriggers] = useState<EventTrigger[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // New trigger modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const loadTriggers = async () => {
    setLoading(true);
    try {
      const list = await autonodaApi.listTriggers();
      setTriggers(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTriggers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setCreating(true);
    try {
      const created = await autonodaApi.createTrigger({
        name: newName.trim(),
        description: newDesc.trim(),
      });
      setIsModalOpen(false);
      setNewName('');
      setNewDesc('');
      onSelectTrigger(created.id);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (confirm('Delete this event trigger and all its associated rule blocks and targets?')) {
      await autonodaApi.deleteTrigger(id);
      setTriggers((prev) => prev.filter((t) => t.id !== id));
    }
  };

  const handleRunSetup = async () => {
    const res = await autonodaApi.runSetup();
    if (res.error) {
      alert(`Migration error: ${res.error}`);
    } else {
      alert('Database migrations completed successfully!');
      loadTriggers();
    }
  };

  const filtered = triggers.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans select-none">
      {/* Top Header - Modern Minimalist Airtable Aesthetic */}
      <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-xs">
            <GitFork className="w-4 h-4 transform rotate-90" />
          </div>
          <div>
            <h1 className="text-xs font-bold text-slate-900 leading-none">Autonoda</h1>
            <span className="text-[10px] text-slate-500 font-mono">Event Node Editor</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunSetup}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-medium transition-colors cursor-pointer"
            title="Run database migrations"
          >
            <Database className="w-3.5 h-3.5 text-slate-500" />
            <span>DB Setup</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Trigger</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl w-full mx-auto p-6 md:p-8 flex-1 flex flex-col">
        {/* Banner / Title & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Event Triggers</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select an event trigger to design its conditional rules and target dispatch flow.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search triggers..."
              className="w-full text-xs pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-800 transition-all shadow-2xs"
            />
          </div>
        </div>

        {/* Triggers Grid */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-400 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-slate-700" />
            <span>Loading triggers...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-dashed border-slate-300 text-center my-4">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center mb-3">
              <Workflow className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">No event triggers found</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
              {search
                ? 'No triggers matched your search query.'
                : 'Create an event trigger to start adding conditional rule blocks and target actions.'}
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Event Trigger</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((trigger) => (
              <div
                key={trigger.id}
                onClick={() => onSelectTrigger(trigger.id)}
                className="group bg-white rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-xs transition-all p-4 flex flex-col justify-between cursor-pointer relative"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold border border-slate-200">
                        #{trigger.id}
                      </span>
                      <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                        {trigger.name}
                      </h3>
                    </div>

                    <button
                      onClick={(e) => handleDelete(e, trigger.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-all cursor-pointer"
                      title="Delete trigger"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">
                    {trigger.description || 'No description provided.'}
                  </p>
                </div>

                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>{trigger.createdAt ? new Date(trigger.createdAt).toLocaleDateString() : 'Active'}</span>
                  </div>

                  <div className="inline-flex items-center gap-1 font-semibold text-slate-700 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all text-xs">
                    <span>Open Graph</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-2xs flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-5 relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-sm font-bold text-slate-900 mb-1">Create Event Trigger</h3>
            <p className="text-xs text-slate-500 mb-4">
              Define the root trigger event for your automation flow.
            </p>

            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Trigger Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Order Placed Ingestion"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:border-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Describe when this event triggers and what it routes..."
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:border-slate-800 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newName.trim()}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  {creating ? 'Creating...' : 'Create & Open Graph'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
