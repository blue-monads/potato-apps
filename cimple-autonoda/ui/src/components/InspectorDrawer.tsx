import React, { useState, useEffect } from 'react';
import type { EditorNode, EventTrigger, RuleBlock, Rule, Target, ComparisonOperator, TargetType, BlockType } from '../types/workflow';
import { X, Plus, Trash2, Clock, Bell, GitFork, Globe } from 'lucide-react';

interface InspectorDrawerProps {
  node: EditorNode;
  onClose: () => void;
  onUpdateTrigger: (id: number, updates: Partial<EventTrigger>) => void;
  onUpdateRuleBlock: (id: number, updates: Partial<RuleBlock>) => void;
  onAddRule: (ruleBlockId: number, rule: Partial<Rule>) => void;
  onUpdateRule: (id: number, updates: Partial<Rule>) => void;
  onDeleteRule: (id: number) => void;
  onUpdateTarget: (id: number, updates: Partial<Target>) => void;
}

export const InspectorDrawer: React.FC<InspectorDrawerProps> = ({
  node,
  onClose,
  onUpdateTrigger,
  onUpdateRuleBlock,
  onAddRule,
  onUpdateRule,
  onDeleteRule,
  onUpdateTarget,
}) => {
  const [triggerName, setTriggerName] = useState('');
  const [triggerDesc, setTriggerDesc] = useState('');

  const [rbBlockType, setRbBlockType] = useState<BlockType>('ALL_OF');
  const [rbDelay, setRbDelay] = useState<number>(0);

  const [targetType, setTargetType] = useState<TargetType>('WEBHOOK');
  const [targetMeta, setTargetMeta] = useState<Record<string, any>>({});

  useEffect(() => {
    if (node.type === 'trigger' && node.trigger) {
      setTriggerName(node.trigger.name || '');
      setTriggerDesc(node.trigger.description || '');
    } else if (node.type === 'rule_block' && node.ruleBlock) {
      setRbBlockType(node.ruleBlock.blockType || 'ALL_OF');
      setRbDelay(node.ruleBlock.delaySeconds || 0);
    } else if (node.type === 'target' && node.target) {
      setTargetType(node.target.targetType || 'WEBHOOK');
      setTargetMeta(node.target.targetMeta || {});
    }
  }, [node]);

  return (
    <aside className="w-80 bg-white border-l border-slate-200 flex flex-col h-full shadow-sm z-20 overflow-y-auto">
      {/* Drawer Header - Modern Minimalist */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/70">
        <div className="flex items-center gap-2">
          {node.type === 'trigger' && <Bell className="w-3.5 h-3.5 text-blue-600" />}
          {node.type === 'rule_block' && <GitFork className="w-3.5 h-3.5 text-slate-700" />}
          {node.type === 'target' && <Globe className="w-3.5 h-3.5 text-emerald-600" />}
          <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
            {node.type === 'trigger' ? 'Event Trigger' : node.type === 'rule_block' ? 'Rule Block' : 'Target Action'}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Drawer Content */}
      <div className="p-4 flex flex-col gap-4 flex-1">
        {/* ================= TRIGGER INSPECTOR ================= */}
        {node.type === 'trigger' && node.trigger && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">Trigger Name</label>
              <input
                type="text"
                value={triggerName}
                onChange={(e) => {
                  setTriggerName(e.target.value);
                  onUpdateTrigger(node.entityId, { name: e.target.value });
                }}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:border-slate-800"
                placeholder="e.g. Order Placed Webhook"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">Description</label>
              <textarea
                value={triggerDesc}
                onChange={(e) => {
                  setTriggerDesc(e.target.value);
                  onUpdateTrigger(node.entityId, { description: e.target.value });
                }}
                rows={3}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:border-slate-800"
                placeholder="Trigger details and ingestion notes"
              />
            </div>
          </div>
        )}

        {/* ================= RULE BLOCK INSPECTOR ================= */}
        {node.type === 'rule_block' && node.ruleBlock && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">Evaluation Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRbBlockType('ALL_OF');
                    onUpdateRuleBlock(node.entityId, { blockType: 'ALL_OF' });
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-all cursor-pointer ${
                    rbBlockType === 'ALL_OF'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  ALL_OF (AND)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRbBlockType('ANY_OF');
                    onUpdateRuleBlock(node.entityId, { blockType: 'ANY_OF' });
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-all cursor-pointer ${
                    rbBlockType === 'ANY_OF'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  ANY_OF (OR)
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-600 flex items-center gap-1 mb-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Delay (Seconds)
              </label>
              <input
                type="number"
                min="0"
                value={rbDelay}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setRbDelay(val);
                  onUpdateRuleBlock(node.entityId, { delaySeconds: val });
                }}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:border-slate-800 font-mono"
              />
            </div>

            {/* Rules list */}
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-700">Conditions ({node.ruleBlock.rules?.length || 0})</label>
                <button
                  type="button"
                  onClick={() =>
                    onAddRule(node.entityId, {
                      triggerId: node.ruleBlock?.triggerId,
                      ruleBlockId: node.entityId,
                      variable: 'data.field',
                      operator: 'equals',
                      value: 'value',
                    })
                  }
                  className="inline-flex items-center gap-1 text-[11px] text-slate-900 hover:text-blue-600 font-semibold cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Add Rule
                </button>
              </div>

              {(node.ruleBlock.rules || []).length === 0 ? (
                <div className="text-center py-4 bg-slate-50/70 border border-dashed border-slate-200 rounded text-slate-400 text-xs">
                  No rules configured. Click "Add Rule" to define criteria.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {node.ruleBlock.rules?.map((rule, idx) => (
                    <div
                      key={rule.id || idx}
                      className="p-2.5 bg-slate-50/70 border border-slate-200 rounded-md flex flex-col gap-1.5 relative group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500">Condition #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => onDeleteRule(rule.id)}
                          className="p-0.5 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                          title="Delete rule"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      <input
                        type="text"
                        value={rule.variable}
                        onChange={(e) => onUpdateRule(rule.id, { variable: e.target.value })}
                        placeholder="field (e.g. order.total)"
                        className="text-[11px] font-mono px-2 py-1 bg-white border border-slate-200 rounded focus:border-slate-800 outline-none"
                      />

                      <select
                        value={rule.operator}
                        onChange={(e) => onUpdateRule(rule.id, { operator: e.target.value as ComparisonOperator })}
                        className="text-[11px] px-2 py-1 bg-white border border-slate-200 rounded focus:border-slate-800 outline-none cursor-pointer"
                      >
                        <option value="equals">equals (==)</option>
                        <option value="not_equals">not equals (!=)</option>
                        <option value="greater_than">greater than (&gt;)</option>
                        <option value="less_than">less than (&lt;)</option>
                        <option value="greater_or_equal">greater or equal (&gt;=)</option>
                        <option value="less_or_equal">less or equal (&lt;=)</option>
                        <option value="contains">contains</option>
                        <option value="not_contains">not contains</option>
                        <option value="starts_with">starts with</option>
                        <option value="ends_with">ends with</option>
                        <option value="is_empty">is empty</option>
                        <option value="is_not_empty">is not empty</option>
                      </select>

                      <input
                        type="text"
                        value={rule.value}
                        onChange={(e) => onUpdateRule(rule.id, { value: e.target.value })}
                        placeholder="target value"
                        className="text-[11px] font-mono px-2 py-1 bg-white border border-slate-200 rounded focus:border-slate-800 outline-none"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TARGET INSPECTOR ================= */}
        {node.type === 'target' && node.target && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">Target Action Type</label>
              <select
                value={targetType}
                onChange={(e) => {
                  const newType = e.target.value as TargetType;
                  setTargetType(newType);
                  onUpdateTarget(node.entityId, { targetType: newType });
                }}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md focus:border-slate-800 outline-none font-medium cursor-pointer"
              >
                <option value="WEBHOOK">WEBHOOK (HTTP Dispatch)</option>
                <option value="EMAIL">EMAIL (Send Mail)</option>
                <option value="SMS">SMS (Text Alert)</option>
                <option value="PUSH">PUSH (Mobile Notification)</option>
                <option value="TRANSFORM">TRANSFORM (Payload Mutation)</option>
                <option value="CODE">CODE (Custom Script)</option>
              </select>
            </div>

            {targetType === 'WEBHOOK' && (
              <>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">HTTP Method</label>
                  <select
                    value={targetMeta.method || 'POST'}
                    onChange={(e) => {
                      const updated = { ...targetMeta, method: e.target.value };
                      setTargetMeta(updated);
                      onUpdateTarget(node.entityId, { targetMeta: updated });
                    }}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md focus:border-slate-800 outline-none"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Endpoint URL</label>
                  <input
                    type="text"
                    value={targetMeta.url || ''}
                    onChange={(e) => {
                      const updated = { ...targetMeta, url: e.target.value };
                      setTargetMeta(updated);
                      onUpdateTarget(node.entityId, { targetMeta: updated });
                    }}
                    placeholder="https://api.example.com/events"
                    className="w-full text-xs font-mono px-2.5 py-1.5 border border-slate-200 rounded-md focus:border-slate-800 outline-none"
                  />
                </div>
              </>
            )}

            {targetType === 'EMAIL' && (
              <>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Recipient</label>
                  <input
                    type="text"
                    value={targetMeta.recipient || ''}
                    onChange={(e) => {
                      const updated = { ...targetMeta, recipient: e.target.value };
                      setTargetMeta(updated);
                      onUpdateTarget(node.entityId, { targetMeta: updated });
                    }}
                    placeholder="e.g. {{customer.email}} or team@org.com"
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md focus:border-slate-800 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Subject</label>
                  <input
                    type="text"
                    value={targetMeta.subject || ''}
                    onChange={(e) => {
                      const updated = { ...targetMeta, subject: e.target.value };
                      setTargetMeta(updated);
                      onUpdateTarget(node.entityId, { targetMeta: updated });
                    }}
                    placeholder="Notification subject"
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md focus:border-slate-800 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Message Template</label>
                  <textarea
                    rows={4}
                    value={targetMeta.template || ''}
                    onChange={(e) => {
                      const updated = { ...targetMeta, template: e.target.value };
                      setTargetMeta(updated);
                      onUpdateTarget(node.entityId, { targetMeta: updated });
                    }}
                    placeholder="Hello {{customer.name}}..."
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md focus:border-slate-800 outline-none font-mono"
                  />
                </div>
              </>
            )}

            {(targetType === 'TRANSFORM' || targetType === 'CODE') && (
              <div>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">Config JSON</label>
                <textarea
                  rows={6}
                  value={JSON.stringify(targetMeta, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setTargetMeta(parsed);
                      onUpdateTarget(node.entityId, { targetMeta: parsed });
                    } catch {}
                  }}
                  className="w-full text-xs font-mono px-2.5 py-1.5 border border-slate-200 rounded-md focus:border-slate-800 outline-none"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
