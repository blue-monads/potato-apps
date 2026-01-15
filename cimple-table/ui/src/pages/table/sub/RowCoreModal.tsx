import { useState, useEffect } from "react";
import { type Datatable, type DatatableRow, type DatatableColumn } from "../../../lib/api";

interface RowCoreModalProps {
    table: Datatable;
    row?: DatatableRow;
    onSave: (cellValues: Record<number, string>, rowData?: string) => Promise<void>;
    onCancel: () => void;
    onDelete?: () => Promise<void>;
    submitLabel: string;
}

const RowCoreModal = ({ table, row, onSave, onCancel, onDelete, submitLabel }: RowCoreModalProps) => {
    const [rowData, setRowData] = useState("");
    const [cellValues, setCellValues] = useState<Record<number, string>>({});
    const [validationErrors, setValidationErrors] = useState<Record<number, boolean>>({});

    useEffect(() => {
        if (row) {
            const initialValues: Record<number, string> = {};
            if (row.cells && Array.isArray(row.cells)) {
                row.cells.forEach(cell => {
                    initialValues[cell.column_id] = cell.value;
                });
            }
            setCellValues(initialValues);
            setRowData(row.row_data || "");
        }
    }, [row]);

    const validateAndSave = () => {
        const errors: Record<number, boolean> = {};
        let hasErrors = false;

        table.columns?.forEach(column => {
            if (column.required) {
                const value = cellValues[column.id] || "";
                if (!value.trim()) {
                    errors[column.id] = true;
                    hasErrors = true;
                }
            }
        });

        setValidationErrors(errors);

        if (!hasErrors) {
            onSave(cellValues, rowData);
        }
    };

    const handleValueChange = (columnId: number, value: string) => {
        setCellValues({ ...cellValues, [columnId]: value });
        if (validationErrors[columnId]) {
            setValidationErrors({ ...validationErrors, [columnId]: false });
        }
    };

    const renderFieldEditor = (column: DatatableColumn, currentValue: string) => {
        const baseInputClasses = `w-full bg-white border rounded px-3 py-2 text-sm outline-none focus:border-accent-600 transition-all ${
            validationErrors[column.id] 
                ? 'border-coral-500 focus:border-coral-600' 
                : 'border-surface-300'
        }`;

        switch (column.column_type) {
            case 'textarea':
                return (
                    <textarea
                        value={currentValue}
                        onChange={(e) => handleValueChange(column.id, e.target.value)}
                        className={baseInputClasses}
                        rows={4}
                    />
                );

            case 'boolean':
            case 'checkbox':
                const isChecked = currentValue.toLowerCase() === 'true' || currentValue === '1';
                return (
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => handleValueChange(column.id, e.target.checked ? 'true' : 'false')}
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
                            onChange={(e) => handleValueChange(column.id, e.target.value)}
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
                        onChange={(e) => handleValueChange(column.id, e.target.value)}
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
                                onChange={(e) => handleValueChange(column.id, e.target.value)}
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
                                onChange={(e) => handleValueChange(column.id, e.target.value)}
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
                                onChange={(e) => handleValueChange(column.id, e.target.value)}
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
                                onChange={(e) => handleValueChange(column.id, e.target.value)}
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
                // Fallback to text input if no options
                return (
                    <input
                        type="text"
                        value={currentValue}
                        onChange={(e) => handleValueChange(column.id, e.target.value)}
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
                                                    handleValueChange(column.id, newValues.join(', '));
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
                // Fallback to text input if no options
                return (
                    <input
                        type="text"
                        value={currentValue}
                        onChange={(e) => handleValueChange(column.id, e.target.value)}
                        className={baseInputClasses}
                    />
                );
            }

            default: // text
                return (
                    <input
                        type="text"
                        value={currentValue}
                        onChange={(e) => handleValueChange(column.id, e.target.value)}
                        className={baseInputClasses}
                    />
                );
        }
    };

    return (
        <div className="space-y-4">
            <div className="max-h-[50vh] overflow-y-auto pr-2 space-y-4">
                {table.columns?.map((column) => {
                    const currentValue = cellValues[column.id] || "";

                    return (
                        <div key={column.id} className="space-y-1">
                            <label className="text-[11px] font-bold text-surface-500 uppercase tracking-tight">
                                {column.name}
                                {column.required && <span className="text-coral-600 ml-1">*</span>}
                            </label>
                            {renderFieldEditor(column, currentValue)}
                            {validationErrors[column.id] && (
                                <p className="text-[10px] text-coral-600 mt-0.5">This field is required</p>
                            )}
                        </div>
                    );
                })}
                
                <div className="pt-2 border-t border-surface-100">
                    <label className="text-[11px] font-bold text-surface-500 uppercase tracking-wider block mb-1">
                        Metadata
                    </label>
                    <textarea
                        value={rowData}
                        onChange={(e) => setRowData(e.target.value)}
                        className="w-full bg-white border border-surface-300 rounded px-3 py-2 text-sm outline-none focus:border-accent-600 transition-all min-h-[60px]"
                        placeholder="Additional hidden data..."
                    />
                </div>
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
        </div>
    );
};

export default RowCoreModal;
