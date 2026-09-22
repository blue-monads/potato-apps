import { useState } from "react";
import { TABLE_COLOR_PRESETS } from "../../../lib/tableColors";
import IconSelector from "./IconSelector";

export interface TableCoreValues {
    name: string;
    info: string;
    icon: string;
    color?: string;
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
    const [color, setColor] = useState(initialValues?.color || "blue");

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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <IconSelector
                        label="Table Icon"
                        value={icon}
                        defaultValue="table"
                        onChange={setIcon}
                        title="Select Table Icon"
                    />
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">
                            Theme Color
                        </label>
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            {TABLE_COLOR_PRESETS.map((preset) => {
                                const isSelected = color === preset.id;
                                return (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() => setColor(preset.id)}
                                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                                            isSelected
                                                ? "ring-2 ring-offset-2 ring-surface-700 scale-110 shadow-sm"
                                                : "hover:scale-105 opacity-80 hover:opacity-100"
                                        }`}
                                        style={{ backgroundColor: preset.hex }}
                                        title={preset.name}
                                    >
                                        {isSelected && (
                                            <i className="fa-solid fa-check text-white text-[9px]" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
            <div className={`flex ${onDelete ? 'justify-between' : 'justify-end'} pt-4 border-t border-surface-100`}>
                {onDelete && (
                    <button
                        onClick={onDelete}
                        className="px-3 py-2 text-sm font-bold text-coral-600 hover:bg-coral-50 rounded transition-colors cursor-pointer"
                    >
                        Delete
                    </button>
                )}
                <div className="flex gap-2">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50 rounded transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave({ name, info, icon, color })}
                        disabled={!name.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
                    >
                        {submitLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TableCoreModal;
