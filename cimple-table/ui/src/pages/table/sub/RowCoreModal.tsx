import { useState, useEffect } from "react";
import { type Datatable, type DatatableRow, type DatatableColumn } from "../../../lib/api";
import { getCellValue } from "./columnTypes";
import { parseRefOptions, parseRefIds, getRowIdentityText, useRefResolution } from "../../../lib/refCache";
import RefPickerModal from "./RefPickerModal";

const RefFieldInput = ({
    column,
    value,
    onOpenPicker,
    onClear,
    hasError,
}: {
    column: DatatableColumn;
    value: string;
    onOpenPicker: () => void;
    onClear: () => void;
    hasError?: boolean;
}) => {
    const opts = parseRefOptions(column.options);
    const targetTableId = opts?.target_table_id;
    const resolvedRow = useRefResolution(targetTableId, value);

    if (!targetTableId) {
        return (
            <div className="text-xs text-coral-600 bg-coral-50 p-2 rounded border border-coral-200">
                Table reference not configured: target table not specified.
            </div>
        );
    }

    const identityText = getRowIdentityText(resolvedRow, opts?.identity_column);

    if (value) {
        return (
            <div className={`flex items-center justify-between p-2 rounded-lg border bg-surface-50 transition-all ${
                hasError ? 'border-coral-500' : 'border-surface-300'
            }`}>
                <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-6 h-6 rounded bg-accent-100 text-accent-700 flex items-center justify-center shrink-0">
                        <i className="fa-solid fa-link text-[10px]" />
                    </div>
                    <div className="overflow-hidden">
                        <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs text-surface-900 truncate max-w-[240px]">
                                {identityText || `#${value}`}
                            </span>
                            <span className="text-[10px] font-mono text-surface-400">#{value}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={onOpenPicker}
                        className="px-2 py-1 text-xs font-semibold text-accent-600 hover:bg-accent-50 rounded transition-colors cursor-pointer"
                    >
                        Change
                    </button>
                    <button
                        type="button"
                        onClick={onClear}
                        title="Remove reference"
                        className="w-6 h-6 flex items-center justify-center text-surface-400 hover:text-coral-600 hover:bg-coral-50 rounded transition-colors cursor-pointer"
                    >
                        <i className="fa-solid fa-xmark text-xs" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={onOpenPicker}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left bg-white border border-dashed rounded transition-colors cursor-pointer ${
                hasError
                    ? 'border-coral-500 text-coral-600'
                    : 'border-surface-300 text-surface-500 hover:border-accent-500 hover:bg-accent-50/20 hover:text-accent-700'
            }`}
        >
            <div className="flex items-center gap-2">
                <i className="fa-solid fa-arrow-up-right-from-square text-xs text-surface-400" />
                <span>Select referenced record...</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-surface-100 px-2 py-0.5 rounded text-surface-600">
                Browse
            </span>
        </button>
    );
};

const MultiRefBadge = ({
    tableId,
    rowId,
    identityColSlug,
    onRemove,
}: {
    tableId: number;
    rowId: number;
    identityColSlug?: string;
    onRemove: () => void;
}) => {
    const resolvedRow = useRefResolution(tableId, rowId);
    const identityText = getRowIdentityText(resolvedRow, identityColSlug);

    return (
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
            <i className="fa-solid fa-arrow-up-right-from-square text-[9px] text-slate-400" />
            <span className="font-semibold truncate max-w-[140px]">{identityText || `#${rowId}`}</span>
            {identityText && <span className="text-[10px] text-slate-400 font-mono">#{rowId}</span>}
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                }}
                title="Remove"
                className="text-slate-400 hover:text-coral-600 ml-0.5 cursor-pointer"
            >
                <i className="fa-solid fa-xmark text-[10px]" />
            </button>
        </span>
    );
};

const MultiRefFieldInput = ({
    column,
    value,
    onOpenPicker,
    onChange,
    hasError,
}: {
    column: DatatableColumn;
    value: string;
    onOpenPicker: () => void;
    onChange: (newValue: string) => void;
    hasError?: boolean;
}) => {
    const opts = parseRefOptions(column.options);
    const targetTableId = opts?.target_table_id;
    const ids = parseRefIds(value);

    if (!targetTableId) {
        return (
            <div className="text-xs text-coral-600 bg-coral-50 p-2 rounded border border-coral-200">
                Table reference not configured: target table not specified.
            </div>
        );
    }

    const handleRemoveId = (idToRemove: number) => {
        const nextIds = ids.filter(id => id !== idToRemove);
        onChange(nextIds.join(', '));
    };

    return (
        <div className={`p-2.5 rounded-lg border bg-white space-y-2 transition-all ${
            hasError ? 'border-coral-500' : 'border-surface-300'
        }`}>
            {ids.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 items-center">
                    {ids.map(id => (
                        <MultiRefBadge
                            key={id}
                            tableId={targetTableId}
                            rowId={id}
                            identityColSlug={opts.identity_column}
                            onRemove={() => handleRemoveId(id)}
                        />
                    ))}
                </div>
            ) : (
                <p className="text-xs text-surface-400 italic">No referenced records selected.</p>
            )}

            <div className="flex items-center justify-between pt-1 border-t border-surface-100">
                <button
                    type="button"
                    onClick={onOpenPicker}
                    className="px-2.5 py-1 text-xs font-semibold bg-accent-50 text-accent-700 hover:bg-accent-100 rounded border border-accent-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                    <i className="fa-solid fa-plus text-[10px]" />
                    <span>{ids.length > 0 ? "Edit / Add More" : "Select References"}</span>
                </button>
                {ids.length > 0 && (
                    <button
                        type="button"
                        onClick={() => onChange("")}
                        className="text-[11px] font-medium text-coral-600 hover:underline cursor-pointer"
                    >
                        Clear All ({ids.length})
                    </button>
                )}
            </div>
        </div>
    );
};

interface RowCoreModalProps {
    table: Datatable;
    row?: DatatableRow;
    onSave: (values: Record<string, string>) => Promise<void>;
    onCancel: () => void;
    onDelete?: () => Promise<void>;
    submitLabel: string;
}

const RowCoreModal = ({ table, row, onSave, onCancel, onDelete, submitLabel }: RowCoreModalProps) => {
    const [cellValues, setCellValues] = useState<Record<string, string>>({});
    const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});
    const [pickerColumn, setPickerColumn] = useState<DatatableColumn | null>(null);

    useEffect(() => {
        if (row) {
            const initialValues: Record<string, string> = {};
            table.columns?.forEach(column => {
                initialValues[column.slug] = getCellValue(row, column);
            });
            setCellValues(initialValues);
        }
    }, [row, table.columns]);

    const validateAndSave = () => {
        const errors: Record<string, boolean> = {};
        let hasErrors = false;

        table.columns?.forEach(column => {
            if (column.required) {
                const value = cellValues[column.slug] || "";
                if (!value.trim()) {
                    errors[column.slug] = true;
                    hasErrors = true;
                }
            }
        });

        setValidationErrors(errors);

        if (!hasErrors) {
            onSave(cellValues);
        }
    };

    const handleValueChange = (slug: string, value: string) => {
        setCellValues(prev => ({ ...prev, [slug]: value }));
        if (validationErrors[slug]) {
            setValidationErrors(prev => ({ ...prev, [slug]: false }));
        }
    };

    const renderFieldEditor = (column: DatatableColumn, currentValue: string) => {
        const baseInputClasses = `w-full bg-white border rounded px-3 py-2 text-sm outline-none focus:border-accent-600 transition-all ${
            validationErrors[column.slug] 
                ? 'border-coral-500 focus:border-coral-600' 
                : 'border-surface-300'
        }`;

        const onChange = (val: string) => handleValueChange(column.slug, val);

        switch (column.column_type) {
            case 'ref':
                return (
                    <RefFieldInput
                        column={column}
                        value={currentValue}
                        onOpenPicker={() => setPickerColumn(column)}
                        onClear={() => onChange("")}
                        hasError={validationErrors[column.slug]}
                    />
                );

            case 'multiref':
                return (
                    <MultiRefFieldInput
                        column={column}
                        value={currentValue}
                        onOpenPicker={() => setPickerColumn(column)}
                        onChange={onChange}
                        hasError={validationErrors[column.slug]}
                    />
                );

            case 'textarea':
                return (
                    <textarea
                        value={currentValue}
                        onChange={(e) => onChange(e.target.value)}
                        className={baseInputClasses}
                        rows={4}
                    />
                );

            case 'checkbox':
                const isChecked = currentValue.toLowerCase() === 'true' || currentValue === '1';
                return (
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
                            className="w-5 h-5 text-accent-600 border-surface-300 rounded focus:ring-accent-500 focus:ring-2"
                        />
                        <span className="text-sm text-surface-600">
                            {isChecked ? 'Yes' : 'No'}
                        </span>
                    </label>
                );

            case 'date':
                return (
                    <div className="relative">
                        <input
                            type="date"
                            value={currentValue}
                            onChange={(e) => onChange(e.target.value)}
                            className={baseInputClasses}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-surface-400">
                            <i className="fa-solid fa-calendar text-[10px]"></i>
                        </div>
                    </div>
                );

            case 'number':
                return (
                    <input
                        type="number"
                        value={currentValue}
                        onChange={(e) => onChange(e.target.value)}
                        className={baseInputClasses}
                        placeholder="0"
                    />
                );

            case 'link':
                return (
                    <div className="space-y-1">
                        <div className="relative">
                            <input
                                type="url"
                                value={currentValue}
                                onChange={(e) => onChange(e.target.value)}
                                className={baseInputClasses}
                                placeholder="https://example.com"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-surface-400">
                                <i className="fa-solid fa-link text-[10px]"></i>
                            </div>
                        </div>
                        {currentValue && (
                            <a 
                                href={currentValue} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[10px] text-accent-600 hover:text-accent-700 flex items-center gap-1"
                            >
                                <i className="fa-solid fa-external-link"></i>
                                Open link
                            </a>
                        )}
                    </div>
                );

            case 'image':
                return (
                    <div className="space-y-2">
                        <div className="relative">
                            <input
                                type="url"
                                value={currentValue}
                                onChange={(e) => onChange(e.target.value)}
                                className={baseInputClasses}
                                placeholder="https://example.com/image.jpg"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-surface-400">
                                <i className="fa-solid fa-image text-[10px]"></i>
                            </div>
                        </div>
                        {currentValue && (
                            <div className="mt-2">
                                <img 
                                    src={currentValue} 
                                    alt="Preview" 
                                    className="max-w-full h-32 object-contain border border-surface-200 rounded"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            </div>
                        )}
                    </div>
                );

            case 'file':
                return (
                    <div className="space-y-1">
                        <div className="relative">
                            <input
                                type="text"
                                value={currentValue}
                                onChange={(e) => onChange(e.target.value)}
                                className={baseInputClasses}
                                placeholder="File URL or path"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-surface-400">
                                <i className="fa-solid fa-file text-[10px]"></i>
                            </div>
                        </div>
                        <p className="text-[10px] text-surface-400">Enter file URL or path</p>
                    </div>
                );

            case 'dropdown':
            case 'radio': {
                const options = column.options ? column.options.split(',').map((opt: string) => opt.trim()).filter((opt: string) => opt) : [];
                if (options.length > 0) {
                    return (
                        <div className="relative">
                            <select
                                value={currentValue}
                                onChange={(e) => onChange(e.target.value)}
                                className={`${baseInputClasses} appearance-none cursor-pointer pr-10`}
                            >
                                <option value="">-- Select --</option>
                                {options.map((option: string, idx: number) => (
                                    <option key={idx} value={option}>{option}</option>
                                ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-surface-400">
                                <i className="fa-solid fa-chevron-down text-[10px]"></i>
                            </div>
                        </div>
                    );
                }
                return (
                    <input
                        type="text"
                        value={currentValue}
                        onChange={(e) => onChange(e.target.value)}
                        className={baseInputClasses}
                    />
                );
            }

            case 'multiselect': {
                const options = column.options ? column.options.split(',').map((opt: string) => opt.trim()).filter((opt: string) => opt) : [];
                const selectedValues = currentValue ? currentValue.split(',').map((v: string) => v.trim()) : [];
                
                if (options.length > 0) {
                    return (
                        <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                                {options.map((option: string, idx: number) => {
                                    const isSelected = selectedValues.includes(option);
                                    return (
                                        <label
                                            key={idx}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm cursor-pointer border transition-all ${
                                                isSelected
                                                    ? 'bg-accent-50 text-accent-700 border-accent-300'
                                                    : 'bg-white text-surface-600 border-surface-300 hover:border-accent-300'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={(e) => {
                                                    let newValues: string[];
                                                    if (e.target.checked) {
                                                        newValues = [...selectedValues, option];
                                                    } else {
                                                        newValues = selectedValues.filter((v: string) => v !== option);
                                                    }
                                                    onChange(newValues.join(', '));
                                                }}
                                                className="w-4 h-4 text-accent-600 border-surface-300 rounded focus:ring-accent-500"
                                            />
                                            <span className="text-[11px] font-medium">{option}</span>
                                        </label>
                                    );
                                })}
                            </div>
                            {selectedValues.length > 0 && (
                                <p className="text-[10px] text-surface-400">Selected: {selectedValues.join(', ')}</p>
                            )}
                        </div>
                    );
                }
                return (
                    <input
                        type="text"
                        value={currentValue}
                        onChange={(e) => onChange(e.target.value)}
                        className={baseInputClasses}
                    />
                );
            }

            default: // text
                return (
                    <input
                        type="text"
                        value={currentValue}
                        onChange={(e) => onChange(e.target.value)}
                        className={baseInputClasses}
                    />
                );
        }
    };

    return (
        <div className="space-y-4">
            <div className="max-h-[50vh] overflow-y-auto pr-2 space-y-4">
                {table.columns?.map((column) => {
                    const currentValue = cellValues[column.slug] || "";

                    return (
                        <div key={column.id} className="space-y-1">
                            <label className="text-[11px] font-bold text-surface-500 uppercase tracking-tight">
                                {column.name}
                                {column.required && <span className="text-coral-600 ml-1">*</span>}
                            </label>
                            {renderFieldEditor(column, currentValue)}
                            {validationErrors[column.slug] && (
                                <p className="text-[10px] text-coral-600 mt-0.5">This field is required</p>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className={`flex ${onDelete ? 'justify-between' : 'justify-end'} pt-4 border-t border-surface-100`}>
                {onDelete && (
                    <button
                        onClick={onDelete}
                        className="px-3 py-2 text-sm font-bold text-coral-600 hover:bg-coral-50 rounded transition-colors"
                    >
                        Delete Row
                    </button>
                )}
                <div className="flex gap-2">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50 rounded transition-colors"
                    >
                        {onDelete ? 'Discard' : 'Cancel'}
                    </button>
                    <button
                        onClick={validateAndSave}
                        className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700 transition-all shadow-sm"
                    >
                        {submitLabel}
                    </button>
                </div>
            </div>

            {/* Table Ref Picker Modal Overlay */}
            {pickerColumn && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
                    onClick={() => setPickerColumn(null)}
                >
                    <div 
                        className="bg-white rounded-xl shadow-2xl border border-surface-200 w-full max-w-2xl overflow-hidden p-5 animate-scale-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between pb-3 mb-3 border-b border-surface-200">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded bg-accent-50 text-accent-600 flex items-center justify-center">
                                    <i className={`fa-solid fa-${pickerColumn.column_type === 'multiref' ? 'layer-group' : 'arrow-up-right-from-square'} text-xs`} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-surface-900">
                                        Select {pickerColumn.name} {pickerColumn.column_type === 'multiref' ? '(Multi-Ref)' : ''}
                                    </h3>
                                    <p className="text-[11px] text-surface-500">
                                        {pickerColumn.column_type === 'multiref'
                                            ? 'Select multiple referenced records to link to this field'
                                            : 'Pick a referenced record to link to this field'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPickerColumn(null)}
                                className="text-surface-400 hover:text-surface-600 transition-colors p-1 cursor-pointer"
                            >
                                <i className="fa-solid fa-xmark text-sm" />
                            </button>
                        </div>
                        <RefPickerModal
                            tableId={parseRefOptions(pickerColumn.options)?.target_table_id || 0}
                            isMulti={pickerColumn.column_type === 'multiref'}
                            selectedRowId={pickerColumn.column_type !== 'multiref' ? cellValues[pickerColumn.slug] : undefined}
                            selectedRowIds={pickerColumn.column_type === 'multiref' ? parseRefIds(cellValues[pickerColumn.slug]) : undefined}
                            identityColumnSlug={parseRefOptions(pickerColumn.options)?.identity_column}
                            onSelect={(selectedRow) => {
                                handleValueChange(pickerColumn.slug, String(selectedRow.id));
                                setPickerColumn(null);
                            }}
                            onSelectMulti={(selectedRows) => {
                                handleValueChange(pickerColumn.slug, selectedRows.map(r => r.id).join(', '));
                                setPickerColumn(null);
                            }}
                            onClear={() => {
                                handleValueChange(pickerColumn.slug, "");
                                setPickerColumn(null);
                            }}
                            onCancel={() => setPickerColumn(null)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default RowCoreModal;
