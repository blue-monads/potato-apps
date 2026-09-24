import React, { useState, useEffect } from 'react';
import type { ExecutionRecord, ExecutionTraceStep } from '../types/workflow';
import { workflowsApi } from '../lib/api';
import { X, CheckCircle2, XCircle, Clock, RotateCcw } from 'lucide-react';

interface HistoryModalProps {
  isOpen: boolean;
  workflowId: number | string;
  onClose: () => void;
  onLoadTrace: (trace: ExecutionTraceStep[]) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  workflowId,
  onClose,
  onLoadTrace,
}) => {
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedExec, setSelectedExec] = useState<ExecutionRecord | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      workflowsApi
        .listExecutions(workflowId)
        .then((list) => {
          setExecutions(list);
          setSelectedExec(list[0] || null);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [isOpen, workflowId]);

  if (!isOpen) return null;

  const handleApplyTrace = () => {
    if (!selectedExec) return;
    try {
      const trace = JSON.parse(selectedExec.steps_trace_json || '[]');
      onLoadTrace(trace);
      onClose();
    } catch (e) {
      console.error('Failed to parse execution trace', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl h-[520px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <span className="font-bold text-slate-800 text-sm">Execution History & Audit Log</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
              Loading history...
            </div>
          ) : executions.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-400 italic">
              No executions recorded yet for this workflow.
            </div>
          ) : (
            <>
              {/* List */}
              <div className="w-72 border-r border-slate-200 overflow-y-auto p-3 flex flex-col gap-2 bg-slate-50/50">
                {executions.map((exec) => {
                  const isSelected = selectedExec?.id === exec.id;
                  return (
                    <div
                      key={exec.id}
                      onClick={() => setSelectedExec(exec)}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer flex flex-col gap-1 transition-all ${
                        isSelected
                          ? 'bg-blue-50/80 border-blue-300 text-blue-900 shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">
                          {exec.status === 'success' ? (
                            <span className="flex items-center gap-1 text-emerald-600">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Success
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-rose-600">
                              <XCircle className="w-3.5 h-3.5" /> Failed
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {exec.duration_ms}ms
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {new Date(exec.started_at).toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Details */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 text-xs bg-white">
                {selectedExec && (
                  <>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div>
                        <span className="font-bold text-slate-800 text-sm">
                          Execution #{selectedExec.id}
                        </span>
                        <div className="text-[11px] text-slate-400">
                          Trigger: {selectedExec.trigger_type} • Duration: {selectedExec.duration_ms}ms
                        </div>
                      </div>
                      <button
                        onClick={handleApplyTrace}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Load in Inspector</span>
                      </button>
                    </div>

                    <div>
                      <div className="font-semibold text-slate-600 mb-1">Final Resulting Payload</div>
                      <pre className="text-[10px] font-mono p-3 rounded-lg bg-slate-50 border border-slate-200 overflow-auto max-h-48 text-slate-800">
                        {selectedExec.final_payload}
                      </pre>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
