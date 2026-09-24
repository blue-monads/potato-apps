import React, { useState, useEffect } from 'react';
import { X, Check, RotateCcw } from 'lucide-react';

interface PayloadModalProps {
  isOpen: boolean;
  payload: Record<string, any>;
  onClose: () => void;
  onSave: (newPayload: Record<string, any>) => void;
}

export const PayloadModal: React.FC<PayloadModalProps> = ({
  isOpen,
  payload,
  onClose,
  onSave,
}) => {
  const [text, setText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setText(JSON.stringify(payload || {}, null, 2));
      setError(null);
    }
  }, [isOpen, payload]);

  if (!isOpen) return null;

  const handleSave = () => {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Payload must be a valid JSON object');
      }
      onSave(parsed);
      onClose();
    } catch (err: any) {
      setError(`Invalid JSON: ${err.message}`);
    }
  };

  const handleReset = () => {
    setText(JSON.stringify(payload || {}, null, 2));
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="font-bold text-slate-800 text-sm">
            Incoming Test Event Payload (JSON)
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-3">
          <p className="text-xs text-slate-500">
            This payload will be injected into the Trigger node when running workflow tests:
          </p>

          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError(null);
            }}
            rows={12}
            className="w-full font-mono text-xs p-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-hidden leading-relaxed text-slate-800"
          />

          {error && (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-2 rounded-md">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 border border-slate-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-200/60 border border-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply Payload</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
