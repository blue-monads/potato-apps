import { useState, useEffect, useMemo } from "react";
import {
    listDatatables,
    getDatatable,
    type Datatable,
    type DatatableColumn,
} from "../../../lib/api";
import { parseRefOptions, parseReverseRefOptions, getIdentityColumn } from "../../../lib/refCache";
import { getTypeIcon, parseTextPatternConfig } from "./columnTypes";
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
    currentTableId?: number;
    onSave: (values: ColumnCoreValues) => Promise<void>;
    onCancel: () => void;
    onDelete?: () => Promise<void>;
    submitLabel: string;
}

const ColumnCoreModal = ({ initialValues, currentTableId, onSave, onCancel, onDelete, submitLabel }: ColumnCoreModalProps) => {
    const [name, setName] = useState(initialValues?.name || "");
    const [columnType, setColumnType] = useState(initialValues?.column_type || "text");
    const [icon, setIcon] = useState(initialValues?.icon || "");
    const [info, setInfo] = useState(initialValues?.info || "");
    const [required, setRequired] = useState(initialValues?.required || false);
    const [options, setOptions] = useState(initialValues?.options || "");

    // Regex pattern state for text columns
    const isTextType = columnType === 'text';
    const isDurationType = columnType === 'duration';

    const [regexPattern, setRegexPattern] = useState(() => {
        if (initialValues?.column_type === 'text' && initialValues?.options) {
            return parseTextPatternConfig(initialValues.options).pattern || "";
        }
        return "";
    });
    const [regexError, setRegexError] = useState(() => {
        if (initialValues?.column_type === 'text' && initialValues?.options) {
            return parseTextPatternConfig(initialValues.options).description || "";
        }
        return "";
    });

    const isRegexSyntaxValid = useMemo(() => {
        if (!regexPattern) return true;
        try {
            new RegExp(regexPattern);
            return true;
        } catch {
            return false;
        }
    }, [regexPattern]);

    // State for Ref and Reverse Ref column configuration
    const [allTables, setAllTables] = useState<Datatable[]>([]);
    const [refTargetTableId, setRefTargetTableId] = useState<number>(0);
    const [refIdentityCol, setRefIdentityCol] = useState<string>("");
    const [revTargetColSlug, setRevTargetColSlug] = useState<string>("");
    const [targetColumns, setTargetColumns] = useState<DatatableColumn[]>([]);

    const needsOptions = columnType === 'dropdown' || columnType === 'multiselect' || columnType === 'radio';
    const isRefType = columnType === 'ref' || columnType === 'multiref';
    const isReverseRefType = columnType === 'reverse_ref';

    const columnTypes = [
        { id: "text", label: "Text" },
        { id: "number", label: "Number" },
        { id: "duration", label: "Duration" },
        { id: "date", label: "Date" },
        { id: "datetime", label: "Date & Time" },
        { id: "time", label: "Time" },
        { id: "email", label: "Email" },
        { id: "percent", label: "Percent" },
        { id: "rating", label: "Rating" },
        { id: "checkbox", label: "Checkbox" },
        { id: "dropdown", label: "Dropdown" },
        { id: "multiselect", label: "Multi-select" },
        { id: "ref", label: "Table Ref" },
        { id: "multiref", label: "Table Multi-Ref" },
        { id: "reverse_ref", label: "Table Reverse Ref" },
        { id: "link", label: "Link" },
        { id: "textarea", label: "Textarea" },
        { id: "image", label: "Image" },
        { id: "file", label: "File" },
        { id: "barcode", label: "Barcode" },
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

    // Initialize ref / reverse ref options if editing an existing column
    useEffect(() => {
        if (isRefType && options) {
            const parsed = parseRefOptions(options);
            if (parsed?.target_table_id) {
                setRefTargetTableId(parsed.target_table_id);
                setRefIdentityCol(parsed.identity_column || "");
            }
        } else if (isReverseRefType && options) {
            const parsed = parseReverseRefOptions(options);
            if (parsed?.target_table_id) {
                setRefTargetTableId(parsed.target_table_id);
                setRevTargetColSlug(parsed.target_column_slug || "");
                setRefIdentityCol(parsed.identity_column || "");
            }
        }
    }, [isRefType, isReverseRefType]);

    // Load columns for selected ref / reverse ref target table
    useEffect(() => {
        if (refTargetTableId > 0) {
            getDatatable(refTargetTableId).then(res => {
                if (res.data && Array.isArray(res.data.columns)) {
                    const cols = res.data.columns;
                    setTargetColumns(cols);

                    let chosenRevCol = revTargetColSlug;
                    if (isReverseRefType && !chosenRevCol) {
                        const matchingCol = cols.find(c => {
                            if (c.column_type === 'ref' || c.column_type === 'multiref') {
                                const parsed = parseRefOptions(c.options);
                                return parsed?.target_table_id === currentTableId;
                            }
                            return false;
                        });
                        if (matchingCol) {
                            chosenRevCol = matchingCol.slug;
                            setRevTargetColSlug(matchingCol.slug);
                        } else {
                            const firstRef = cols.find(c => c.column_type === 'ref' || c.column_type === 'multiref');
                            if (firstRef) {
                                chosenRevCol = firstRef.slug;
                                setRevTargetColSlug(firstRef.slug);
                            }
                        }
                    }

                    // Auto-select identity column if not already selected
                    let chosenIdentity = refIdentityCol;
                    if (!chosenIdentity) {
                        const autoIdCol = getIdentityColumn(cols);
                        if (autoIdCol) {
                            chosenIdentity = autoIdCol.slug;
                            setRefIdentityCol(autoIdCol.slug);
                        }
                    }

                    if (isReverseRefType) {
                        setOptions(JSON.stringify({
                            target_table_id: refTargetTableId,
                            target_column_slug: chosenRevCol || "",
                            identity_column: chosenIdentity || "",
                        }));
                    } else if (isRefType) {
                        setOptions(JSON.stringify({
                            target_table_id: refTargetTableId,
                            identity_column: chosenIdentity || "",
                        }));
                    }
                }
            });
        }
    }, [refTargetTableId, isReverseRefType, isRefType]);

    const handleRefTableChange = (tid: number) => {
        setRefTargetTableId(tid);
        setRefIdentityCol("");
        setRevTargetColSlug("");
        if (isReverseRefType) {
            setOptions(JSON.stringify({
                target_table_id: tid,
                target_column_slug: "",
                identity_column: "",
            }));
        } else {
            setOptions(JSON.stringify({
                target_table_id: tid,
                identity_column: "",
            }));
        }
    };

    const handleRevTargetColChange = (colSlug: string) => {
        setRevTargetColSlug(colSlug);
        setOptions(JSON.stringify({
            target_table_id: refTargetTableId,
            target_column_slug: colSlug,
            identity_column: refIdentityCol,
        }));
    };

    const handleRefIdentityChange = (colSlug: string) => {
        setRefIdentityCol(colSlug);
        if (isReverseRefType) {
            setOptions(JSON.stringify({
                target_table_id: refTargetTableId,
                target_column_slug: revTargetColSlug,
                identity_column: colSlug,
            }));
        } else {
            setOptions(JSON.stringify({
                target_table_id: refTargetTableId,
                identity_column: colSlug,
            }));
        }
    };

    const canSubmit = name.trim().length > 0 && 
        (!isRefType || refTargetTableId > 0) &&
        (!isReverseRefType || (refTargetTableId > 0 && revTargetColSlug.trim().length > 0)) &&
        (!isTextType || isRegexSyntaxValid);

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
                                    if ((newType === 'ref' || newType === 'multiref' || newType === 'reverse_ref') && allTables.length > 0 && refTargetTableId === 0) {
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

                {/* Table Ref / Reverse Ref Configuration */}
                {(isRefType || isReverseRefType) && (
                    <div className="p-3 bg-accent-50/60 border border-accent-200 rounded-lg space-y-3">
                        <div className="flex items-center gap-2 text-accent-800 text-xs font-bold">
                            <i className={`fa-solid fa-${isReverseRefType ? 'reply' : 'link'} text-[11px]`} />
                            <span>{isReverseRefType ? 'Table Reverse Ref Settings' : 'Table Reference Settings'}</span>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-surface-600 uppercase tracking-wider">
                                {isReverseRefType ? 'Referencing Datatable (Source of Records)' : 'Target Datatable'}
                            </label>
                            <div className="relative">
                                <select
                                    value={refTargetTableId}
                                    onChange={(e) => handleRefTableChange(Number(e.target.value))}
                                    className="w-full bg-white border border-surface-300 rounded px-3 py-1.5 text-xs outline-none focus:border-accent-600 appearance-none cursor-pointer pr-8"
                                >
                                    <option value={0}>-- Select datatable --</option>
                                    {allTables.map(t => (
                                        <option key={t.id} value={t.id}>{t.name} (ID: #{t.id})</option>
                                    ))}
                                </select>
                                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-surface-400">
                                    <i className="fa-solid fa-chevron-down text-[9px]"></i>
                                </div>
                            </div>
                        </div>

                        {/* For Reverse Ref: Foreign Key column in the referencing datatable */}
                        {isReverseRefType && refTargetTableId > 0 && targetColumns.length > 0 && (
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-surface-600 uppercase tracking-wider">
                                    Foreign Key Column (in #{refTargetTableId})
                                </label>
                                <div className="relative">
                                    <select
                                        value={revTargetColSlug}
                                        onChange={(e) => handleRevTargetColChange(e.target.value)}
                                        className="w-full bg-white border border-surface-300 rounded px-3 py-1.5 text-xs outline-none focus:border-accent-600 appearance-none cursor-pointer pr-8"
                                    >
                                        <option value="">-- Select column referencing this table --</option>
                                        {targetColumns.map(col => {
                                            const isColRef = col.column_type === 'ref' || col.column_type === 'multiref';
                                            const pointsHere = isColRef && currentTableId && parseRefOptions(col.options)?.target_table_id === currentTableId;
                                            return (
                                                <option key={col.id} value={col.slug}>
                                                    {col.name} ({col.column_type}){pointsHere ? ' ★ (References this table)' : ''}
                                                </option>
                                            );
                                        })}
                                    </select>
                                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-surface-400">
                                        <i className="fa-solid fa-chevron-down text-[9px]"></i>
                                    </div>
                                </div>
                                <p className="text-[10px] text-surface-500">
                                    Records in Table #{refTargetTableId} matching this table's row ID via this column will be shown.
                                </p>
                            </div>
                        )}

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
                                    This field's text will render as the label on the linked badges.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Duration info notice */}
                {isDurationType && (
                    <div className="p-3 bg-accent-50/60 border border-accent-200 rounded-lg flex items-center gap-2.5 text-xs text-accent-800">
                        <i className="fa-solid fa-stopwatch text-accent-600 text-sm shrink-0" />
                        <div>
                            <span className="font-bold">Duration Field:</span> Stored as numeric seconds on the backend and displayed with user-friendly formatting (e.g. 1h 30m, 45s).
                        </div>
                    </div>
                )}

                {/* Text Regex Pattern Configuration */}
                {isTextType && (
                    <div className="p-3 bg-surface-50 border border-surface-200 rounded-lg space-y-2.5">
                        <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-surface-600 uppercase tracking-wider flex items-center gap-1.5">
                                <i className="fa-solid fa-code text-[10px] text-accent-600" />
                                <span>Regex Pattern Validation (Optional)</span>
                            </label>
                            {!isRegexSyntaxValid && (
                                <span className="text-[10px] text-coral-600 font-semibold">Invalid regex syntax</span>
                            )}
                        </div>
                        <div className="space-y-1">
                            <input
                                type="text"
                                value={regexPattern}
                                onChange={(e) => setRegexPattern(e.target.value)}
                                className={`w-full bg-white border rounded px-3 py-1.5 text-xs font-mono outline-none transition-all ${
                                    !isRegexSyntaxValid
                                        ? 'border-coral-500 focus:border-coral-600'
                                        : 'border-surface-300 focus:border-accent-600'
                                }`}
                                placeholder="e.g. ^[a-zA-Z0-9_-]+$ or ^\d{3}-\d{4}$"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">
                                Validation Error Message / Help Text (Optional)
                            </label>
                            <input
                                type="text"
                                value={regexError}
                                onChange={(e) => setRegexError(e.target.value)}
                                className="w-full bg-white border border-surface-300 rounded px-3 py-1.5 text-xs outline-none focus:border-accent-600"
                                placeholder="e.g. Must contain only letters and numbers"
                            />
                        </div>
                        {/* Quick Presets */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                            <span className="text-[9px] font-bold text-surface-400 uppercase">Presets:</span>
                            <button
                                type="button"
                                onClick={() => {
                                    setRegexPattern("^[a-zA-Z0-9]+$");
                                    setRegexError("Must contain only alphanumeric characters");
                                }}
                                className="px-1.5 py-0.5 bg-white border border-surface-200 hover:border-accent-400 rounded text-[10px] text-surface-600 hover:text-accent-700 transition-colors cursor-pointer"
                            >
                                Alphanumeric
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setRegexPattern("^\\d+$");
                                    setRegexError("Must contain digits only");
                                }}
                                className="px-1.5 py-0.5 bg-white border border-surface-200 hover:border-accent-400 rounded text-[10px] text-surface-600 hover:text-accent-700 transition-colors cursor-pointer"
                            >
                                Digits Only
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setRegexPattern("^[a-zA-Z ]+$");
                                    setRegexError("Must contain letters only");
                                }}
                                className="px-1.5 py-0.5 bg-white border border-surface-200 hover:border-accent-400 rounded text-[10px] text-surface-600 hover:text-accent-700 transition-colors cursor-pointer"
                            >
                                Letters Only
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setRegexPattern("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$");
                                    setRegexError("Must be a valid email address format");
                                }}
                                className="px-1.5 py-0.5 bg-white border border-surface-200 hover:border-accent-400 rounded text-[10px] text-surface-600 hover:text-accent-700 transition-colors cursor-pointer"
                            >
                                Email Format
                            </button>
                            {regexPattern && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setRegexPattern("");
                                        setRegexError("");
                                    }}
                                    className="px-1.5 py-0.5 bg-coral-50 border border-coral-200 text-coral-600 hover:bg-coral-100 rounded text-[10px] transition-colors cursor-pointer"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
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
                        onClick={() => {
                            let finalOptions = options;
                            if (isTextType) {
                                finalOptions = regexPattern.trim()
                                    ? JSON.stringify({ pattern: regexPattern.trim(), description: regexError.trim() })
                                    : "";
                            }
                            onSave({ name, column_type: columnType, icon: icon.trim(), info, required, options: finalOptions });
                        }}
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
