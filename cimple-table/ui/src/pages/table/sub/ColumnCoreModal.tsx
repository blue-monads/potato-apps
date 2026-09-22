import { useState, useEffect } from "react";
import {
    listDatatables,
    getDatatable,
    type Datatable,
    type DatatableColumn,
} from "../../../lib/api";
import { parseRefOptions, getIdentityColumn } from "../../../lib/refCache";
import { getTypeIcon } from "./columnTypes";
import IconSelector from "./IconSelector";

export interface ColumnCoreValues {
    name: string;
    column_type: string;
    icon?: string;
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
    const [icon, setIcon] = useState(initialValues?.icon || "");
    const [info, setInfo] = useState(initialValues?.info || "");
    const [required, setRequired] = useState(initialValues?.required || false);
    const [options, setOptions] = useState(initialValues?.options || "");

    // State for Ref column configuration
    const [allTables, setAllTables] = useState<Datatable[]>([]);
    const [refTargetTableId, setRefTargetTableId] = useState<number>(0);
    const [refIdentityCol, setRefIdentityCol] = useState<string>("");
    const [targetColumns, setTargetColumns] = useState<DatatableColumn[]>([]);

    const needsOptions = columnType === 'dropdown' || columnType === 'multiselect' || columnType === 'radio';
    const isRefType = columnType === 'ref' || columnType === 'multiref';

    const columnTypes = [
        { id: "text", label: "Text" },
        { id: "number", label: "Number" },
        { id: "date", label: "Date" },
        { id: "checkbox", label: "Checkbox" },
        { id: "dropdown", label: "Dropdown" },
        { id: "multiselect", label: "Multi-select" },
        { id: "ref", label: "Table Ref" },
        { id: "multiref", label: "Table Multi-Ref" },
        { id: "link", label: "Link" },
        { id: "textarea", label: "Textarea" },
        { id: "image", label: "Image" },
        { id: "file", label: "File" },
        { id: "radio", label: "Radio" },
    ];

    // Load available tables for Ref configuration
    useEffect(() => {
        listDatatables().then(res => {
            if (res.data) {
                const list = Array.isArray(res.data) ? res.data : [];
                setAllTables(list);
            }
        });
    }, []);

    // Initialize ref options if editing an existing ref column
    useEffect(() => {
        if (isRefType && options) {
            const parsed = parseRefOptions(options);
            if (parsed?.target_table_id) {
                setRefTargetTableId(parsed.target_table_id);
                setRefIdentityCol(parsed.identity_column || "");
            }
        }
    }, [isRefType]);

    // Load columns for selected ref target table
    useEffect(() => {
        if (refTargetTableId > 0) {
            getDatatable(refTargetTableId).then(res => {
                if (res.data && Array.isArray(res.data.columns)) {
                    const cols = res.data.columns;
                    setTargetColumns(cols);

                    // Auto-select identity column if not already selected
                    if (!refIdentityCol) {
                        const autoIdCol = getIdentityColumn(cols);
                        if (autoIdCol) {
                            setRefIdentityCol(autoIdCol.slug);
                            setOptions(JSON.stringify({
                                target_table_id: refTargetTableId,
                                identity_column: autoIdCol.slug,
                            }));
                        }
                    }
                }
            });
        }
    }, [refTargetTableId]);

    const handleRefTableChange = (tid: number) => {
        setRefTargetTableId(tid);
        setRefIdentityCol("");
        setOptions(JSON.stringify({
            target_table_id: tid,
            identity_column: "",
        }));
    };

    const handleRefIdentityChange = (colSlug: string) => {
        setRefIdentityCol(colSlug);
        setOptions(JSON.stringify({
            target_table_id: refTargetTableId,
            identity_column: colSlug,
        }));
    };

    const canSubmit = name.trim().length > 0 && (!isRefType || refTargetTableId > 0);

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
                        placeholder="e.g. Customer, Assigned To, Product..."
                        autoFocus={!initialValues}
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">Data Type</label>
                        <div className="relative">
                            <select
                                value={columnType}
                                onChange={(e) => {
                                    const newType = e.target.value;
                                    setColumnType(newType);
                                    if ((newType === 'ref' || newType === 'multiref') && allTables.length > 0 && refTargetTableId === 0) {
                                        handleRefTableChange(allTables[0].id);
                                    }
                                }}
                                className="w-full bg-white border border-surface-300 rounded px-3 py-2 text-sm outline-none focus:border-accent-600 appearance-none cursor-pointer pr-10"
                            >
                                {columnTypes.map(t => (
                                    <option key={t.id} value={t.id}>{t.label}</option>
                                ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-surface-400">
                                <i className="fa-solid fa-chevron-down text-[10px]"></i>
                            </div>
                        </div>
                    </div>
                    <div>
                        <IconSelector
                            label="Column Icon"
                            value={icon}
                            defaultValue={getTypeIcon(columnType)}
                            onChange={setIcon}
                            title="Select Column Icon"
                        />
                    </div>
                </div>

                {/* Table Ref Configuration */}
                {isRefType && (
                    <div className="p-3 bg-accent-50/60 border border-accent-200 rounded-lg space-y-3">
                        <div className="flex items-center gap-2 text-accent-800 text-xs font-bold">
                            <i className="fa-solid fa-link text-[11px]" />
                            <span>Table Reference Settings</span>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-surface-600 uppercase tracking-wider">
                                Target Datatable
                            </label>
                            <div className="relative">
                                <select
                                    value={refTargetTableId}
                                    onChange={(e) => handleRefTableChange(Number(e.target.value))}
                                    className="w-full bg-white border border-surface-300 rounded px-3 py-1.5 text-xs outline-none focus:border-accent-600 appearance-none cursor-pointer pr-8"
                                >
                                    <option value={0}>-- Select target table --</option>
                                    {allTables.map(t => (
                                        <option key={t.id} value={t.id}>{t.name} (ID: #{t.id})</option>
                                    ))}
                                </select>
                                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-surface-400">
                                    <i className="fa-solid fa-chevron-down text-[9px]"></i>
                                </div>
                            </div>
                        </div>

                        {refTargetTableId > 0 && targetColumns.length > 0 && (
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-surface-600 uppercase tracking-wider">
                                    Display / Identity Column
                                </label>
                                <div className="relative">
                                    <select
                                        value={refIdentityCol}
                                        onChange={(e) => handleRefIdentityChange(e.target.value)}
                                        className="w-full bg-white border border-surface-300 rounded px-3 py-1.5 text-xs outline-none focus:border-accent-600 appearance-none cursor-pointer pr-8"
                                    >
                                        <option value="">Auto-detect (Name/Title)</option>
                                        {targetColumns.map(col => (
                                            <option key={col.id} value={col.slug}>
                                                {col.name} ({col.column_type})
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-surface-400">
                                        <i className="fa-solid fa-chevron-down text-[9px]"></i>
                                    </div>
                                </div>
                                <p className="text-[10px] text-surface-500">
                                    This field's text will render as the label in this table's cells.
                                </p>
                            </div>
                        )}
                    </div>
                )}

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
                        type="button"
                        onClick={onDelete}
                        className="px-3 py-2 text-sm font-bold text-coral-600 hover:bg-coral-50 rounded transition-colors cursor-pointer"
                    >
                        Delete
                    </button>
                )}
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50 rounded transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => onSave({ name, column_type: columnType, icon: icon.trim(), info, required, options })}
                        disabled={!canSubmit}
                        className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
                    >
                        {submitLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ColumnCoreModal;
