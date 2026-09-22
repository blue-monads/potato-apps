import { useState } from "react";
import { TABLE_TEMPLATES, type TableTemplate } from "../../../lib/templates";
import { getTypeIcon } from "./columnTypes";

export interface ColumnDraft {
    id: string;
    name: string;
    column_type: string;
    info: string;
    required: boolean;
    options: string;
}

export interface TableCreateData {
    name: string;
    info?: string;
    icon?: string;
}

interface CreateTableModalProps {
    onSave: (
        data: TableCreateData,
        columns: { name: string; column_type: string; info?: string; required?: boolean; options?: string }[]
    ) => Promise<void>;
    onCancel: () => void;
}

const AVAILABLE_TYPES = [
    { value: "text", label: "Text", icon: "font" },
    { value: "number", label: "Number", icon: "hashtag" },
    { value: "date", label: "Date", icon: "calendar" },
    { value: "checkbox", label: "Checkbox", icon: "square-check" },
    { value: "dropdown", label: "Dropdown", icon: "caret-down" },
    { value: "multiselect", label: "Multi-select", icon: "tags" },
    { value: "textarea", label: "Textarea", icon: "align-left" },
    { value: "link", label: "Link", icon: "link" },
    { value: "file", label: "File", icon: "paperclip" },
    { value: "image", label: "Image", icon: "image" },
    { value: "radio", label: "Radio", icon: "circle-dot" },
];

const COMMON_ICONS = ["table", "tasks", "address-book", "boxes", "calendar", "receipt", "sticky-note", "users", "folder", "database", "chart-simple"];

const CreateTableModal = ({ onSave, onCancel }: CreateTableModalProps) => {
    const [step, setStep] = useState<"presets" | "builder">("presets");
    const [submitting, setSubmitting] = useState(false);

    // Table Meta State
    const [name, setName] = useState("");
    const [info, setInfo] = useState("");
    const [icon, setIcon] = useState("table");

    // Columns Builder State
    const [columns, setColumns] = useState<ColumnDraft[]>([]);

    // Quick start into builder from a template
    const handleSelectTemplate = (template: TableTemplate) => {
        setName(template.id === "blank" ? "" : template.name);
        setInfo(template.id === "blank" ? "" : template.description);
        setIcon(template.icon || "table");

        setColumns(
            template.columns.map((c, i) => ({
                id: `col-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
                name: c.name,
                column_type: c.column_type,
                info: c.info || "",
                required: c.required || false,
                options: c.options || "",
            }))
        );
        setStep("builder");
    };

    const handleAddColumn = (defaultType = "text") => {
        setColumns(prev => [
            ...prev,
            {
                id: `col-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                name: "",
                column_type: defaultType,
                info: "",
                required: false,
                options: defaultType === "dropdown" || defaultType === "multiselect" || defaultType === "radio" ? "Option 1, Option 2" : "",
            },
        ]);
    };

    const handleUpdateColumn = (id: string, updates: Partial<ColumnDraft>) => {
        setColumns(prev =>
            prev.map(c => {
                if (c.id !== id) return c;
                const next = { ...c, ...updates };
                if (
                    (updates.column_type === "dropdown" || updates.column_type === "multiselect" || updates.column_type === "radio") &&
                    !next.options
                ) {
                    next.options = "Option 1, Option 2";
                }
                return next;
            })
        );
    };

    const handleRemoveColumn = (id: string) => {
        setColumns(prev => prev.filter(c => c.id !== id));
    };

    const handleMoveColumn = (index: number, direction: "up" | "down") => {
        if (
            (direction === "up" && index === 0) ||
            (direction === "down" && index === columns.length - 1)
        ) {
            return;
        }
        setColumns(prev => {
            const next = [...prev];
            const targetIdx = direction === "up" ? index - 1 : index + 1;
            const temp = next[index];
            next[index] = next[targetIdx];
            next[targetIdx] = temp;
            return next;
        });
    };

    const handleSave = async () => {
        if (!name.trim() || submitting) return;

        // Filter out completely blank column names
        const validColumns = columns
            .filter(c => c.name.trim().length > 0)
            .map(c => ({
                name: c.name.trim(),
                column_type: c.column_type,
                info: c.info.trim(),
                required: c.required,
                options: c.options.trim(),
            }));

        setSubmitting(true);
        try {
            await onSave({ name: name.trim(), info: info.trim(), icon }, validColumns);
        } finally {
            setSubmitting(false);
        }
    };

    // ==========================================
    // PAGE 1: PRESETS LIST
    // ==========================================
    if (step === "presets") {
        return (
            <div className="space-y-4">
                {/* Stepper Header */}
                <div className="flex items-center justify-between border-b border-surface-200 pb-3">
                    <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-accent-600 text-white text-[11px] font-bold flex items-center justify-center">1</span>
                        <span className="text-xs font-bold text-surface-900 uppercase tracking-wider">Choose a Template</span>
                        <span className="text-surface-300">→</span>
                        <span className="w-5 h-5 rounded-full bg-surface-200 text-surface-500 text-[11px] font-bold flex items-center justify-center">2</span>
                        <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Table Builder</span>
                    </div>
                    <button
                        onClick={() => handleSelectTemplate(TABLE_TEMPLATES[0])}
                        className="text-xs font-semibold text-accent-600 hover:text-accent-700 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                        <i className="fa-solid fa-plus text-[10px]" />
                        <span>Start from blank</span>
                    </button>
                </div>

                {/* Templates Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[58vh] overflow-y-auto pr-1">
                    {TABLE_TEMPLATES.map((template) => {
                        const isBlank = template.id === "blank";
                        return (
                            <button
                                key={template.id}
                                type="button"
                                onClick={() => handleSelectTemplate(template)}
                                className="p-3.5 bg-white border border-surface-200 hover:border-accent-500 rounded-lg transition-all flex flex-col justify-between text-left group shadow-xs hover:shadow-md cursor-pointer"
                            >
                                <div className="w-full">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-9 h-9 bg-surface-100 rounded-lg flex items-center justify-center group-hover:bg-accent-50 text-surface-500 group-hover:text-accent-600 transition-colors shrink-0">
                                                <i className={`fa-solid fa-${template.icon} text-base`} />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-sm font-bold text-surface-900 group-hover:text-accent-700 transition-colors truncate">
                                                    {template.name}
                                                </h4>
                                                <span className="text-[11px] font-medium text-surface-400">
                                                    {isBlank ? "Build custom columns" : `${template.columns.length} columns`}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-surface-300 group-hover:text-accent-600 group-hover:bg-accent-50 transition-all shrink-0">
                                            <i className="fa-solid fa-chevron-right text-[11px] group-hover:translate-x-0.5 transition-transform" />
                                        </div>
                                    </div>

                                    <p className="text-xs text-surface-500 line-clamp-2 mb-3">
                                        {template.description}
                                    </p>
                                </div>

                                {/* Column preview badges */}
                                {!isBlank && template.columns.length > 0 && (
                                    <div className="w-full flex flex-wrap gap-1 pt-2 border-t border-surface-100">
                                        {template.columns.map((c, i) => (
                                            <span
                                                key={i}
                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-100 text-surface-600"
                                            >
                                                <i className={`fa-solid fa-${getTypeIcon(c.column_type)} text-[9px] text-surface-400`} />
                                                {c.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 pt-3 border-t border-surface-200">
                    <button
                        onClick={onCancel}
                        className="px-4 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-100 rounded transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    // ==========================================
    // PAGE 2: TABLE BUILDER
    // ==========================================
    return (
        <div className="space-y-4">
            {/* Header & Back Navigation */}
            <div className="flex items-center justify-between border-b border-surface-200 pb-3">
                <button
                    onClick={() => setStep("presets")}
                    className="flex items-center gap-1.5 text-xs font-semibold text-surface-600 hover:text-accent-600 transition-colors cursor-pointer"
                >
                    <i className="fa-solid fa-arrow-left text-[11px]" />
                    <span>Back to Templates</span>
                </button>

                <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-surface-200 text-surface-600 text-[11px] font-bold flex items-center justify-center">1</span>
                    <span className="text-xs font-medium text-surface-400 uppercase tracking-wider">Template</span>
                    <span className="text-surface-300">→</span>
                    <span className="w-5 h-5 rounded-full bg-accent-600 text-white text-[11px] font-bold flex items-center justify-center">2</span>
                    <span className="text-xs font-bold text-surface-900 uppercase tracking-wider">Table Builder</span>
                </div>
            </div>

            {/* Table Metadata Form */}
            <div className="bg-surface-50 p-3.5 rounded-lg border border-surface-200 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2 space-y-1">
                        <label className="text-[11px] font-bold text-surface-600 uppercase tracking-wider flex items-center gap-1">
                            <span>Table Name</span>
                            <span className="text-coral-600">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Products, Project Roadmap..."
                            className="w-full bg-white border border-surface-300 rounded px-3 py-1.5 text-sm font-semibold text-surface-900 outline-none focus:border-accent-600 focus:ring-1 focus:ring-accent-600 transition-all"
                            autoFocus
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-surface-600 uppercase tracking-wider">Table Icon</label>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded bg-white border border-surface-300 flex items-center justify-center text-accent-600 shrink-0">
                                <i className={`fa-solid fa-${icon || "table"} text-sm`} />
                            </div>
                            <input
                                type="text"
                                value={icon}
                                onChange={(e) => setIcon(e.target.value)}
                                placeholder="icon name"
                                className="w-full bg-white border border-surface-300 rounded px-2.5 py-1.5 text-xs text-surface-700 outline-none focus:border-accent-600"
                            />
                        </div>
                    </div>
                </div>

                {/* Quick Icon Selector */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mr-1">Suggested:</span>
                    {COMMON_ICONS.map((ic) => (
                        <button
                            key={ic}
                            type="button"
                            onClick={() => setIcon(ic)}
                            className={`w-6 h-6 rounded flex items-center justify-center text-xs transition-colors cursor-pointer ${
                                icon === ic ? "bg-accent-600 text-white" : "bg-white border border-surface-200 text-surface-500 hover:bg-surface-200"
                            }`}
                            title={ic}
                        >
                            <i className={`fa-solid fa-${ic}`} />
                        </button>
                    ))}
                </div>

                <div className="space-y-1">
                    <label className="text-[11px] font-bold text-surface-600 uppercase tracking-wider">Description (Optional)</label>
                    <input
                        type="text"
                        value={info}
                        onChange={(e) => setInfo(e.target.value)}
                        placeholder="What will this table be used for?"
                        className="w-full bg-white border border-surface-300 rounded px-3 py-1.5 text-xs text-surface-700 outline-none focus:border-accent-600"
                    />
                </div>
            </div>

            {/* Column Builder Section */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-xs font-bold text-surface-800 uppercase tracking-wider">
                            Columns ({columns.length})
                        </h4>
                        <p className="text-[11px] text-surface-400">
                            Configure column names, data types, and options for this table.
                        </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => handleAddColumn("text")}
                            className="px-2 py-0.5 text-xs font-semibold bg-accent-50 text-accent-700 hover:bg-accent-100 rounded border border-accent-200 flex items-center gap-1 transition-colors cursor-pointer"
                        >
                            <i className="fa-solid fa-plus text-[10px]" />
                            <span>Add Column</span>
                        </button>
                    </div>
                </div>

                {/* Quick Add Types Bar */}
                <div className="flex items-center gap-1 overflow-x-auto py-0.5 text-[11px]">
                    <span className="text-surface-400 font-medium whitespace-nowrap mr-1 text-[10px]">+ Quick Add:</span>
                    {["text", "number", "date", "dropdown", "checkbox", "textarea"].map(t => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => handleAddColumn(t)}
                            className="px-1.5 py-0.5 rounded bg-surface-100 hover:bg-surface-200 text-surface-600 hover:text-surface-900 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 text-[10px]"
                        >
                            <i className={`fa-solid fa-${getTypeIcon(t)} text-[8px] text-surface-400`} />
                            <span>{t}</span>
                        </button>
                    ))}
                </div>

                {/* Columns List */}
                <div className="max-h-[44vh] overflow-y-auto space-y-1.5 pr-1">
                    {columns.length === 0 ? (
                        <div className="p-6 text-center border-2 border-dashed border-surface-200 rounded-lg">
                            <i className="fa-solid fa-table-columns text-2xl text-surface-300 mb-2" />
                            <p className="text-xs font-semibold text-surface-600">No columns configured yet</p>
                            <p className="text-[11px] text-surface-400 mt-0.5 mb-2.5">
                                Add your first column or start with one of the quick types above.
                            </p>
                            <button
                                type="button"
                                onClick={() => handleAddColumn("text")}
                                className="px-3 py-1 text-xs font-bold bg-accent-600 text-white rounded hover:bg-accent-700 transition-colors cursor-pointer"
                            >
                                Add First Column
                            </button>
                        </div>
                    ) : (
                        columns.map((col, idx) => {
                            const hasOptions =
                                col.column_type === "dropdown" ||
                                col.column_type === "multiselect" ||
                                col.column_type === "radio";

                            return (
                                <div
                                    key={col.id}
                                    className="px-2.5 py-1.5 bg-white border border-surface-200 hover:border-surface-300 rounded-md shadow-2xs space-y-1 transition-all"
                                >
                                    <div className="flex items-center gap-1.5">
                                        {/* Reorder Buttons */}
                                        <div className="flex flex-col text-surface-400 shrink-0">
                                            <button
                                                type="button"
                                                disabled={idx === 0}
                                                onClick={() => handleMoveColumn(idx, "up")}
                                                className="hover:text-surface-700 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed leading-none p-0.5"
                                                title="Move up"
                                            >
                                                <i className="fa-solid fa-chevron-up text-[8px]" />
                                            </button>
                                            <button
                                                type="button"
                                                disabled={idx === columns.length - 1}
                                                onClick={() => handleMoveColumn(idx, "down")}
                                                className="hover:text-surface-700 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed leading-none p-0.5"
                                                title="Move down"
                                            >
                                                <i className="fa-solid fa-chevron-down text-[8px]" />
                                            </button>
                                        </div>

                                        {/* Column Index */}
                                        <span className="text-[10px] font-mono text-surface-400 w-4 text-center select-none shrink-0">
                                            {idx + 1}
                                        </span>

                                        {/* Column Name */}
                                        <div className="flex-1 min-w-[130px]">
                                            <input
                                                type="text"
                                                value={col.name}
                                                onChange={(e) => handleUpdateColumn(col.id, { name: e.target.value })}
                                                placeholder="Column name"
                                                className="w-full bg-surface-50 focus:bg-white border border-surface-200 rounded px-2 py-1 text-xs font-semibold text-surface-800 outline-none focus:border-accent-600 focus:ring-1 focus:ring-accent-600 h-7"
                                            />
                                        </div>

                                        {/* Data Type Selector */}
                                        <div className="w-[125px] shrink-0">
                                            <select
                                                value={col.column_type}
                                                onChange={(e) => handleUpdateColumn(col.id, { column_type: e.target.value })}
                                                className="w-full bg-white border border-surface-200 rounded px-2 py-0.5 text-xs text-surface-700 font-medium outline-none focus:border-accent-600 cursor-pointer h-7"
                                            >
                                                {AVAILABLE_TYPES.map(t => (
                                                    <option key={t.value} value={t.value}>
                                                        {t.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Required Checkbox */}
                                        <label
                                            className="flex items-center gap-1 text-[10px] font-medium text-surface-600 cursor-pointer select-none shrink-0 px-1"
                                            title="Mark this field as mandatory"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={col.required}
                                                onChange={(e) => handleUpdateColumn(col.id, { required: e.target.checked })}
                                                className="rounded border-surface-300 text-accent-600 focus:ring-accent-500 w-3 h-3"
                                            />
                                            <span>Req</span>
                                        </label>

                                        {/* Delete Column */}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveColumn(col.id)}
                                            className="w-6 h-6 rounded hover:bg-coral-50 text-surface-400 hover:text-coral-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                            title="Delete column"
                                        >
                                            <i className="fa-solid fa-trash-can text-[11px]" />
                                        </button>
                                    </div>

                                    {/* Conditional Options Input for dropdown/multiselect/radio */}
                                    {hasOptions && (
                                        <div className="pl-7 pr-1 flex items-center gap-1.5 pt-1 border-t border-surface-100">
                                            <span className="text-[9px] font-bold text-surface-400 uppercase tracking-wider shrink-0">
                                                Options:
                                            </span>
                                            <input
                                                type="text"
                                                value={col.options}
                                                onChange={(e) => handleUpdateColumn(col.id, { options: e.target.value })}
                                                placeholder="Comma separated choices (e.g. Low, Medium, High)"
                                                className="flex-1 bg-surface-50 focus:bg-white border border-surface-200 rounded px-2 py-0.5 text-[11px] text-surface-700 outline-none focus:border-accent-600 h-6"
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-surface-200">
                <button
                    type="button"
                    onClick={() => setStep("presets")}
                    className="px-3 py-1.5 text-xs font-semibold text-surface-600 hover:text-surface-900 rounded hover:bg-surface-100 transition-colors cursor-pointer"
                >
                    Back to Templates
                </button>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-3.5 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-100 rounded transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!name.trim() || submitting}
                        className="px-4 py-1.5 bg-accent-600 hover:bg-accent-700 text-white rounded text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                    >
                        {submitting ? (
                            <>
                                <i className="fa-solid fa-spinner fa-spin text-xs" />
                                <span>Creating Table...</span>
                            </>
                        ) : (
                            <>
                                <i className="fa-solid fa-check text-xs" />
                                <span>Create Datatable {columns.filter(c => c.name.trim()).length > 0 && `(${columns.filter(c => c.name.trim()).length} cols)`}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateTableModal;
