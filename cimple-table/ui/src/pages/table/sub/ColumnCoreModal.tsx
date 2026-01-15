import { useState } from "react";

export interface ColumnCoreValues {
    name: string;
    column_type: string;
    info: string;
    required: boolean;
    options: string;
}

interface ColumnCoreModalProps {
    initialValues?: ColumnCoreValues;
    onSave: (values: ColumnCoreValues) => Promise<void>;
    onCancel: () => void;
    onDelete?: () => Promise<void>;
    submitLabel: string;
}

const ColumnCoreModal = ({ initialValues, onSave, onCancel, onDelete, submitLabel }: ColumnCoreModalProps) => {
    const [name, setName] = useState(initialValues?.name || "");
    const [columnType, setColumnType] = useState(initialValues?.column_type || "text");
    const [info, setInfo] = useState(initialValues?.info || "");
    const [required, setRequired] = useState(initialValues?.required || false);
    const [options, setOptions] = useState(initialValues?.options || "");
    
    const needsOptions = columnType === 'dropdown' || columnType === 'multiselect' || columnType === 'radio';

    const columnTypes = [
        "text", "number", "date", "boolean", "image", "file", "link",
        "dropdown", "multiselect", "checkbox", "radio", "textarea"
    ];

    return (
        <div className="space-y-4">
            <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">Column Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-white border border-surface-300 rounded px-3 py-2 text-sm outline-none focus:border-accent-600 transition-all"
                        placeholder="e.g. Due Date"
                        autoFocus={!initialValues}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">Data Type</label>
                    <div className="relative">
                        <select
                            value={columnType}
                            onChange={(e) => setColumnType(e.target.value)}
                            className="w-full bg-white border border-surface-300 rounded px-3 py-2 text-sm outline-none focus:border-accent-600 appearance-none cursor-pointer pr-10"
                        >
                            {columnTypes.map(type => (
                                <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-surface-400">
                            <i className="fa-solid fa-chevron-down text-[10px]"></i>
                        </div>
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">Info</label>
                    <textarea
                        value={info}
                        onChange={(e) => setInfo(e.target.value)}
                        className="w-full bg-white border border-surface-300 rounded px-3 py-2 text-sm outline-none focus:border-accent-600 min-h-[60px] transition-all"
                        placeholder="Optional details..."
                    />
                </div>
                {needsOptions && (
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">Options</label>
                        <input
                            type="text"
                            value={options}
                            onChange={(e) => setOptions(e.target.value)}
                            className="w-full bg-white border border-surface-300 rounded px-3 py-2 text-sm outline-none focus:border-accent-600 transition-all"
                            placeholder="Option 1, Option 2, Option 3"
                        />
                        <p className="text-[10px] text-surface-400 mt-1">Separate options with commas</p>
                    </div>
                )}
                <div className="space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={required}
                            onChange={(e) => setRequired(e.target.checked)}
                            className="w-4 h-4 text-accent-600 border-surface-300 rounded focus:ring-accent-500 focus:ring-2"
                        />
                        <span className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">Required</span>
                    </label>
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
                        onClick={() => onSave({ name, column_type: columnType, info, required, options })}
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

export default ColumnCoreModal;
