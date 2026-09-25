import React, { useState } from 'react';
import type { NodeType, ActionSubtype } from '../types/workflow';
import { Bell, Clock, Zap, GitFork, Globe, Mail, Sparkles, Terminal, Search, Plus } from 'lucide-react';

interface PaletteItem {
  type: NodeType;
  subtype: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

interface PaletteGroup {
  id: string;
  title: string;
  badge: string;
  badgeColor: string;
  items: PaletteItem[];
}

const PALETTE_GROUPS: PaletteGroup[] = [
  {
    id: 'triggers',
    title: 'Triggers (Event Start)',
    badge: 'Origin',
    badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
    items: [
      {
        type: 'trigger',
        subtype: 'webhook',
        name: 'Webhook Ingest',
        description: 'Receives HTTP JSON event payload',
        icon: <Bell className="w-4 h-4 text-sky-600" />,
      },
      {
        type: 'trigger',
        subtype: 'schedule',
        name: 'Cron / Schedule',
        description: 'Periodic timer or scheduled run',
        icon: <Clock className="w-4 h-4 text-sky-600" />,
      },
      {
        type: 'trigger',
        subtype: 'event',
        name: 'Custom Event',
        description: 'Internal app event dispatcher',
        icon: <Zap className="w-4 h-4 text-sky-600" />,
      },
    ],
  },
  {
    id: 'logic',
    title: 'Logic & Branching',
    badge: 'Rules',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    items: [
      {
        type: 'logic',
        subtype: 'condition',
        name: 'Logic Rules Block',
        description: 'AND/OR rules with True/False branches',
        icon: <GitFork className="w-4 h-4 text-purple-600" />,
      },
    ],
  },
  {
    id: 'actions',
    title: 'Actions & Operations',
    badge: 'Tasks',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
    items: [
      {
        type: 'action',
        subtype: 'webhook' as ActionSubtype,
        name: 'HTTP Webhook API',
        description: 'POST / GET external endpoint',
        icon: <Globe className="w-4 h-4 text-teal-600" />,
      },
      {
        type: 'action',
        subtype: 'email' as ActionSubtype,
        name: 'Send Email Notification',
        description: 'Dynamic {{template}} notification',
        icon: <Mail className="w-4 h-4 text-teal-600" />,
      },
      {
        type: 'action',
        subtype: 'enrich' as ActionSubtype,
        name: 'Enrich / Mutate Data',
        description: 'Mutates payload fields for next steps',
        icon: <Sparkles className="w-4 h-4 text-teal-600" />,
      },
      {
        type: 'action',
        subtype: 'log' as ActionSubtype,
        name: 'Audit Log & Trace',
        description: 'Outputs debug trace checkpoint',
        icon: <Terminal className="w-4 h-4 text-teal-600" />,
      },
    ],
  },
];

interface PaletteProps {
  onAddNode: (type: NodeType, subtype: string, name: string) => void;
}

export const Palette: React.FC<PaletteProps> = ({ onAddNode }) => {
  const [search, setSearch] = useState('');

  const handleDragStart = (e: React.DragEvent, item: PaletteItem) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        type: item.type,
        subtype: item.subtype,
        name: item.name,
      })
    );
  };

  const filteredGroups = PALETTE_GROUPS.map((grp) => ({
    ...grp,
    items: grp.items.filter(
      (it) =>
        it.name.toLowerCase().includes(search.toLowerCase()) ||
        it.description.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((grp) => grp.items.length > 0);

  return (
    <aside className="w-72 bg-[#f8fafc] border-r border-slate-200 flex flex-col p-3 z-20 overflow-y-auto shrink-0 select-none shadow-2xs">
      {/* Search Header */}
      <div className="relative mb-3">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter blocks..."
          className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 text-xs rounded-lg text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400"
        />
      </div>

      {/* Categorized Groups */}
      <div className="flex flex-col gap-3.5 flex-1">
        {filteredGroups.map((group) => (
          <div
            key={group.id}
            className="bg-white rounded-xl border border-slate-200/90 p-2.5 shadow-2xs"
          >
            {/* Group Header */}
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100">
              <span className="text-[11px] font-bold text-slate-700 tracking-tight">
                {group.title}
              </span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${group.badgeColor}`}
              >
                {group.badge}
              </span>
            </div>

            {/* Items */}
            <div className="flex flex-col gap-1.5">
              {group.items.map((item, idx) => (
                <div
                  key={idx}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 cursor-grab active:cursor-grabbing transition-all hover:shadow-2xs group"
                >
                  <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-white transition-all shadow-2xs">
                    {item.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-800 truncate group-hover:text-indigo-900">
                      {item.name}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate leading-tight">
                      {item.description}
                    </div>
                  </div>
                  <button
                    onClick={() => onAddNode(item.type, item.subtype, item.name)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-indigo-600 hover:bg-indigo-100/70 transition-all cursor-pointer"
                    title="Add block to workflow"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-200 text-[11px] text-slate-400 leading-snug">
        🪄 <strong>Auto-Layout Active:</strong> New blocks and connections automatically snap into a vertical hierarchy without manual dragging.
      </div>
    </aside>
  );
};
