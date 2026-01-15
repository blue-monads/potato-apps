import { useState } from "react";

export interface TableCoreValues {
    name: string;
    info: string;
    icon: string;
}

interface TableCoreModalProps {
    initialValues?: TableCoreValues;
    onSave: (values: TableCoreValues) => Promise<void>;
    onCancel: () => void;
    onDelete?: () => Promise<void>;
    submitLabel: string;
    extraActions?: React.ReactNode;
}

const TableCoreModal = ({ initialValues, onSave, onCancel, onDelete, submitLabel, extraActions }: TableCoreModalProps) => {
    const [name, setName] = useState(initialValues?.name || "");
    const [info, setInfo] = useState(initialValues?.info || "");
    const [icon, setIcon] = useState(initialValues?.icon || "table");

    return (
        <div className="space-y-4">
            {extraActions}
            <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-white border border-surface-300 rounded px-3 py-2 text-sm focus:border-accent-600 focus:ring-1 focus:ring-accent-600 outline-none transition-all"
                        placeholder="Project Name"
                        autoFocus={!initialValues}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">Description</label>
                    <textarea
                        value={info}
                        onChange={(e) => setInfo(e.target.value)}
                        className="w-full bg-white border border-surface-300 rounded px-3 py-2 text-sm focus:border-accent-600 focus:ring-1 focus:ring-accent-600 outline-none transition-all min-h-[80px]"
                        placeholder="Optional description..."
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">Icon</label>
                    <input
                        type="text"
                        value={icon}
                        onChange={(e) => setIcon(e.target.value)}
                        className="w-full bg-white border border-surface-300 rounded px-3 py-2 text-sm focus:border-accent-600 focus:ring-1 focus:ring-accent-600 outline-none transition-all"
                        placeholder="table"
                    />
                </div>
            </div>
            <div className={`flex ${onDelete ? 'justify-between' : 'justify-end'} pt-4 border-t border-surface-100`}>
                {onDelete && (
                    <button
                        onClick={onDelete}
                        className="px-3 py-2 text-sm font-bold text-coral-600 hover:bg-coral-50 rounded transition-colors"
                    >
                        Delete
                    </button>
                )}
                <div className="flex gap-2">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50 rounded transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave({ name, info, icon })}
                        disabled={!name.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm"
                    >
                        {submitLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TableCoreModal;
