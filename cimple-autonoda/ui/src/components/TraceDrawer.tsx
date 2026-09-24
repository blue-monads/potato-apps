import React, { useState } from 'react';
import type { ExecutionTraceStep } from '../types/workflow';
import { ChevronDown, ChevronUp, Activity, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';

interface TraceDrawerProps {
  trace: ExecutionTraceStep[];
  isOpen: boolean;
  onToggle: () => void;
}

export const TraceDrawer: React.FC<TraceDrawerProps> = ({ trace, isOpen, onToggle }) => {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const activeStep = trace.find((s) => s.stepId === selectedStepId) || trace[trace.length - 1] || null;

  return (
    <footer
      className={`bg-white border-t border-slate-200 flex flex-col z-25 shadow-lg transition-all duration-200 select-none ${
        isOpen ? 'h-64' : 'h-10'
      }`}
    >
      {/* Drawer Header */}
      <div
        onClick={onToggle}
        className="h-10 px-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-100/70 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Activity className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-bold text-slate-800">
            Execution Trace & Step-by-Step Payload Inspector
          </span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
            {trace.length} step(s)
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            {trace.length > 0
              ? `Last run executed with ${trace.length} blocks processed.`
              : 'Click "Test Workflow" to simulate event flow'}
          </span>
          <button className="p-1 rounded text-slate-400 hover:text-slate-700">
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Drawer Body (visible when open) */}
      {isOpen && (
        <div className="flex-1 flex overflow-hidden">
          {trace.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-400 italic">
              No executions yet. Click "Test Workflow" in the top bar to run this pipeline.
            </div>
          ) : (
            <>
              {/* Left Step List */}
              <div className="w-64 sm:w-72 border-r border-slate-200 overflow-y-auto p-2 flex flex-col gap-1.5 bg-slate-50/50 shrink-0">
                {trace.map((step, idx) => {
                  const isSelected = activeStep?.stepId === step.stepId;
                  return (
                    <div
                      key={step.stepId}
                      onClick={() => setSelectedStepId(step.stepId)}
                      className={`p-2 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-all ${
                        isSelected
                          ? 'bg-blue-50/80 border-blue-300 text-blue-900 shadow-2xs'
                          : 'bg-white border-slate-200/80 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-bold text-slate-400">#{idx + 1}</span>
                        <span className="font-semibold truncate">{step.nodeTitle}</span>
                      </div>

                      {step.status === 'pass' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          TRUE
                        </span>
                      )}
                      {step.status === 'fail' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                          FALSE
                        </span>
                      )}
                      {step.status === 'done' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800">
                          DONE
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Right Details Panel */}
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 text-xs bg-white">
                {activeStep && (
                  <>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-sm">{activeStep.nodeTitle}</span>
                        <span className="text-[10px] uppercase font-bold text-slate-400 px-1.5 py-0.5 rounded bg-slate-100">
                          {activeStep.nodeType}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">{activeStep.timestamp}</span>
                    </div>

                    {/* Logic Evaluation Details */}
                    {activeStep.nodeType === 'logic' && (
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>
                            Mode: <strong>{activeStep.details.mode}</strong> &rarr; Result:{' '}
                            <span
                              className={`font-bold ${
                                activeStep.details.result === 'TRUE' ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              {activeStep.details.result}
                            </span>
                          </span>
                          <span className="text-[11px] text-slate-500 font-normal">
                            Branch: {activeStep.details.branchTaken}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1">
                          {activeStep.details.rulesEvaluated?.map((r, i) => (
                            <div
                              key={i}
                              className="px-2 py-1 rounded bg-white border border-slate-200 font-mono text-[11px] flex items-center justify-between"
                            >
                              <span>
                                <span className="text-purple-600">{r.field}</span> (
                                {JSON.stringify(r.actual)}) <strong>{r.op}</strong>{' '}
                                <span className="text-slate-600">{JSON.stringify(r.expected)}</span>
                              </span>
                              <span
                                className={`font-bold flex items-center gap-1 ${
                                  r.passed ? 'text-emerald-600' : 'text-rose-600'
                                }`}
                              >
                                {r.passed ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3" /> PASS
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-3 h-3" /> FAIL
                                  </>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Step Details */}
                    {activeStep.nodeType === 'action' && (
                      <div className="p-2.5 rounded-lg bg-teal-50/60 border border-teal-200">
                        <div className="font-semibold text-teal-900 mb-1">
                          Action Outcome: {activeStep.details.action}
                        </div>
                        <pre className="text-[11px] font-mono bg-white p-2 rounded border border-teal-100 overflow-x-auto text-slate-800">
                          {JSON.stringify(activeStep.details, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Side-by-Side Payload Comparison */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                          <span>Incoming Payload</span>
                        </div>
                        <pre className="text-[10px] font-mono bg-slate-50 border border-slate-200 p-2 rounded-lg max-h-36 overflow-auto text-slate-800">
                          {JSON.stringify(activeStep.inputPayload, null, 2)}
                        </pre>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                          <ArrowRight className="w-3 h-3 text-blue-500" />
                          <span>Output Payload</span>
                        </div>
                        <pre className="text-[10px] font-mono bg-slate-50 border border-slate-200 p-2 rounded-lg max-h-36 overflow-auto text-slate-800">
                          {JSON.stringify(activeStep.outputPayload, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </footer>
  );
};
