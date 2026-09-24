import React from 'react';
import type { NodeType, ActionSubtype } from '../types/workflow';
import { Bell, Clock, Zap, GitFork, Globe, Mail, Sparkles, Terminal } from 'lucide-react';

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
  borderAccent: string;
  items: PaletteItem[];
}

const PALETTE_GROUPS: PaletteGroup[] = [
  {
    id: 'triggers',
    title: '1. Triggers',
    badge: 'Event Start',
    badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
    borderAccent: 'border-l-sky-500',
    items: [
      {
        type: 'trigger',
        subtype: 'webhook',
        name: 'Webhook Ingest',
        description: 'Receives HTTP JSON event',
        icon: <Bell className="w-4 h-4 text-sky-600" />,
      },
      {
        type: 'trigger',
        subtype: 'schedule',
        name: 'Cron / Schedule',
        description: 'Runs on timed intervals',
        icon: <Clock className="w-4 h-4 text-sky-600" />,
      },
      {
        type: 'trigger',
        subtype: 'event',
        name: 'Custom Event',
        description: 'Internal app event start',
        icon: <Zap className="w-4 h-4 text-sky-600" />,
      },
    ],
  },
  {
    id: 'logic',
    title: '2. Logic & Routing',
    badge: 'Branching',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    borderAccent: 'border-l-purple-500',
    items: [
      {
        type: 'logic',
        subtype: 'condition',
        name: 'Logic Rules Block',
        description: 'AND/OR rules (True/False)',
        icon: <GitFork className="w-4 h-4 text-purple-600" />,
      },
    ],
  },
  {
    id: 'actions',
    title: '3. Actions & Tasks',
    badge: 'Operations',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
    borderAccent: 'border-l-teal-500',
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
        description: 'Dynamic {{template}} alert',
        icon: <Mail className="w-4 h-4 text-teal-600" />,
      },
      {
        type: 'action',
        subtype: 'enrich' as ActionSubtype,
        name: 'Enrich / Mutate Data',
        description: 'Append or transform fields',
        icon: <Sparkles className="w-4 h-4 text-teal-600" />,
      },
      {
        type: 'action',
        subtype: 'log' as ActionSubtype,
        name: 'Audit Log & Trace',
        description: 'Record flow debug checkpoint',
        icon: <Terminal className="w-4 h-4 text-teal-600" />,
      },
    ],
  },
];

interface PaletteProps {
  onAddNode: (type: NodeType, subtype: string, name: string) => void;
}

export const Palette: React.FC<PaletteProps> = ({ onAddNode }) => {
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

  return (
    <aside className="w-64 bg-slate-50/80 border-r border-slate-200 flex flex-col p-3 z-20 overflow-y-auto shrink-0 select-none shadow-xs">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">
        Workflow Blocks Library
      </div>

      {/* Button Groups with distinct styling and margins */}
      <div className="flex flex-col gap-4">
        {PALETTE_GROUPS.map((group) => (
          <div
            key={group.id}
            className={`bg-white rounded-xl border border-slate-200 p-2.5 shadow-2xs border-l-4 ${group.borderAccent}`}
          >
            {/* Group Header */}
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800">{group.title}</span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${group.badgeColor}`}
              >
                {group.badge}
              </span>
            </div>

            {/* Group Buttons */}
            <div className="flex flex-col gap-1.5">
              {group.items.map((item, idx) => (
                <div
                  key={idx}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  onClick={() => onAddNode(item.type, item.subtype, item.name)}
                  className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 hover:border-slate-300 hover:bg-slate-50/80 cursor-grab active:cursor-grabbing transition-all hover:shadow-2xs group"
                >
                  <div className="w-6 h-6 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    {item.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-700 truncate group-hover:text-slate-900">
                      {item.name}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">{item.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-4 border-t border-slate-200/80 text-[11px] text-slate-400 leading-snug px-1">
        ⬇️ <strong>Vertical Flow:</strong> Events travel downwards. Connect top input handles to bottom output handles.
      </div>
    </aside>
  );
};
