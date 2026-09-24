import React from 'react';
import type { FlowNode, LogicRule, ComparisonOperator } from '../types/workflow';
import { X, Plus, Trash2, GitFork, Bell, Globe, Mail, Sparkles, Terminal } from 'lucide-react';

interface InspectorDrawerProps {
  node: FlowNode | null;
  onClose: () => void;
  onUpdateNode: (id: string, updates: Partial<FlowNode>) => void;
}

export const InspectorDrawer: React.FC<InspectorDrawerProps> = ({
  node,
  onClose,
  onUpdateNode,
}) => {
  if (!node) return null;

  const updateConfig = (newConfig: Partial<typeof node.config>) => {
    onUpdateNode(node.id, {
      config: {
        ...node.config,
        ...newConfig,
      },
    });
  };

  // Logic block helpers
  const rules = node.config.rules || [];
  const handleAddRule = () => {
    const newRules: LogicRule[] = [
      ...rules,
      { field: 'order.total', op: 'greater_than', value: '100' },
    ];
    updateConfig({ rules: newRules });
  };

  const handleUpdateRule = (index: number, updates: Partial<LogicRule>) => {
    const newRules = [...rules];
    newRules[index] = { ...newRules[index], ...updates };
    updateConfig({ rules: newRules });
  };

  const handleRemoveRule = (index: number) => {
    const newRules = rules.filter((_, i) => i !== index);
    updateConfig({ rules: newRules });
  };

  let Icon = Globe;
  let categoryLabel = 'ACTION CONFIGURATION';
  if (node.type === 'trigger') {
    Icon = Bell;
    categoryLabel = 'TRIGGER CONFIGURATION';
  } else if (node.type === 'logic') {
    Icon = GitFork;
    categoryLabel = 'LOGIC BLOCK CONFIGURATION';
  } else {
    if (node.subtype === 'email') Icon = Mail;
    else if (node.subtype === 'enrich') Icon = Sparkles;
    else if (node.subtype === 'log') Icon = Terminal;
  }

  return (
    <aside className="w-80 sm:w-96 bg-white border-l border-slate-200 flex flex-col z-30 shadow-lg select-none">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {categoryLabel}
            </div>
            <div className="text-sm font-bold text-slate-800 truncate">{node.title}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          title="Close drawer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
        {/* Block Title */}
        <div className="flex flex-col gap-1.5">
          <label className="font-semibold text-slate-700">Block Title</label>
          <input
            type="text"
            value={node.title}
            onChange={(e) => onUpdateNode(node.id, { title: e.target.value })}
            className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-hidden"
          />
        </div>

        {/* Trigger Config */}
        {node.type === 'trigger' && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-slate-700">Event Type Identifier</label>
              <input
                type="text"
                value={node.config.eventType || ''}
                onChange={(e) => updateConfig({ eventType: e.target.value })}
                placeholder="e.g. ecommerce.order.created"
                className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-hidden"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-slate-700">Source Name</label>
              <input
                type="text"
                value={node.config.source || ''}
                onChange={(e) => updateConfig({ source: e.target.value })}
                placeholder="e.g. Inbound Webhook"
                className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-hidden"
              />
            </div>

            <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg text-sky-800 text-[11px] leading-relaxed">
              ℹ️ <strong>Event Origin:</strong> Ingests the incoming JSON payload into the flow. You can customize the sample test event in the top <strong>Test Payload</strong> editor.
            </div>
          </div>
        )}

        {/* Logic Block Config */}
        {node.type === 'logic' && (
          <div className="flex flex-col gap-4">
            {/* AND / OR Segmented Mode */}
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-slate-700 flex items-center justify-between">
                <span>Evaluation Mode</span>
                <span className="text-[10px] text-slate-400 font-normal">Condition logic</span>
              </label>
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-lg gap-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => updateConfig({ conditionMode: 'AND' })}
                  className={`py-1 rounded-md text-xs font-bold transition-all ${
                    (node.config.conditionMode || 'AND') === 'AND'
                      ? 'bg-white text-blue-600 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  AND (All Match)
                </button>
                <button
                  type="button"
                  onClick={() => updateConfig({ conditionMode: 'OR' })}
                  className={`py-1 rounded-md text-xs font-bold transition-all ${
                    node.config.conditionMode === 'OR'
                      ? 'bg-white text-blue-600 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  OR (Any Matches)
                </button>
              </div>
            </div>

            {/* Rules List */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700">Rules ({rules.length})</label>
                <button
                  onClick={handleAddRule}
                  className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Rule</span>
                </button>
              </div>

              <div className="flex flex-col gap-2.5">
                {rules.map((rule, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">
                        Rule #{idx + 1}
                      </span>
                      {rules.length > 1 && (
                        <button
                          onClick={() => handleRemoveRule(idx)}
                          className="text-slate-400 hover:text-red-500 p-0.5 rounded"
                          title="Remove rule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-500">Variable (dot path)</span>
                      <input
                        type="text"
                        value={rule.field}
                        onChange={(e) => handleUpdateRule(idx, { field: e.target.value })}
                        placeholder="order.total"
                        className="px-2 py-1 text-xs rounded border border-slate-200 bg-white focus:border-blue-500 outline-hidden font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-slate-500">Operator</span>
                        <select
                          value={rule.op}
                          onChange={(e) =>
                            handleUpdateRule(idx, { op: e.target.value as ComparisonOperator })
                          }
                          className="px-2 py-1 text-xs rounded border border-slate-200 bg-white focus:border-blue-500 outline-hidden cursor-pointer"
                        >
                          <option value="greater_than">greater_than (&gt;)</option>
                          <option value="greater_or_equal">greater_or_equal (&gt;=)</option>
                          <option value="less_than">less_than (&lt;)</option>
                          <option value="less_or_equal">less_or_equal (&lt;=)</option>
                          <option value="equals">equals (==)</option>
                          <option value="not_equals">not_equals (!=)</option>
                          <option value="contains">contains</option>
                          <option value="not_contains">not_contains</option>
                          <option value="is_empty">is_empty</option>
                          <option value="is_not_empty">is_not_empty</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-slate-500">Value</span>
                        <input
                          type="text"
                          value={rule.value}
                          onChange={(e) => handleUpdateRule(idx, { value: e.target.value })}
                          placeholder="100"
                          className="px-2 py-1 text-xs rounded border border-slate-200 bg-white focus:border-blue-500 outline-hidden font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Branching Explanation */}
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px]">
                <strong className="block text-emerald-700 font-bold mb-0.5">● TRUE Port (Green):</strong>
                Path taken when evaluated condition passes.
              </div>
              <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[10px]">
                <strong className="block text-rose-700 font-bold mb-0.5">● FALSE Port (Red):</strong>
                Path taken when evaluated condition fails.
              </div>
            </div>
          </div>
        )}

        {/* Action Config */}
        {node.type === 'action' && (
          <div className="flex flex-col gap-3">
            {node.subtype === 'webhook' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-slate-700">HTTP Method</label>
                  <select
                    value={node.config.method || 'POST'}
                    onChange={(e) => updateConfig({ method: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-800 focus:border-blue-500 outline-hidden cursor-pointer"
                  >
                    <option value="POST">POST</option>
                    <option value="GET">GET</option>
                    <option value="PUT">PUT</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-slate-700">Endpoint URL</label>
                  <input
                    type="text"
                    value={node.config.url || ''}
                    onChange={(e) => updateConfig({ url: e.target.value })}
                    placeholder="https://api.crm.com/v1/orders"
                    className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-800 focus:border-blue-500 outline-hidden font-mono text-xs"
                  />
                </div>
              </>
            )}

            {node.subtype === 'email' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-slate-700">Recipient</label>
                  <input
                    type="text"
                    value={node.config.recipient || ''}
                    onChange={(e) => updateConfig({ recipient: e.target.value })}
                    placeholder="{{customer.email}}"
                    className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-800 focus:border-blue-500 outline-hidden"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-slate-700">Subject</label>
                  <input
                    type="text"
                    value={node.config.subject || ''}
                    onChange={(e) => updateConfig({ subject: e.target.value })}
                    placeholder="Order Alert"
                    className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-800 focus:border-blue-500 outline-hidden"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-slate-700">Message Body</label>
                  <textarea
                    rows={3}
                    value={node.config.template || ''}
                    onChange={(e) => updateConfig({ template: e.target.value })}
                    placeholder="Hello {{customer.name}}, order {{order.id}} received."
                    className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-800 focus:border-blue-500 outline-hidden font-mono text-xs"
                  />
                </div>
              </>
            )}

            {node.subtype === 'enrich' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-slate-700">Enrich Variable Path</label>
                  <input
                    type="text"
                    value={node.config.enrichField || ''}
                    onChange={(e) => updateConfig({ enrichField: e.target.value })}
                    placeholder="order.isVipPriority"
                    className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-800 focus:border-blue-500 outline-hidden font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-slate-700">Assigned Value</label>
                  <input
                    type="text"
                    value={node.config.enrichValue || ''}
                    onChange={(e) => updateConfig({ enrichValue: e.target.value })}
                    placeholder="true"
                    className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-800 focus:border-blue-500 outline-hidden font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-slate-700">Annotation Notes</label>
                  <input
                    type="text"
                    value={node.config.enrichNotes || ''}
                    onChange={(e) => updateConfig({ enrichNotes: e.target.value })}
                    placeholder="Reason for transformation"
                    className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-800 focus:border-blue-500 outline-hidden"
                  />
                </div>
              </>
            )}

            {node.subtype === 'log' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-slate-700">Log Level</label>
                  <select
                    value={node.config.logLevel || 'INFO'}
                    onChange={(e) => updateConfig({ logLevel: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-800 focus:border-blue-500 outline-hidden cursor-pointer"
                  >
                    <option value="INFO">INFO</option>
                    <option value="WARN">WARN</option>
                    <option value="DEBUG">DEBUG</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-slate-700">Log Message</label>
                  <input
                    type="text"
                    value={node.config.message || ''}
                    onChange={(e) => updateConfig({ message: e.target.value })}
                    placeholder="Workflow log checkpoint"
                    className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-800 focus:border-blue-500 outline-hidden"
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
