import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { type DatatableColumn, type FilterCondition, type FilterOp } from "../../../lib/api";

export interface FilterModalProps {
    isOpen: boolean;
    columns: DatatableColumn[];
    initialFilters: FilterCondition[];
    onApply: (filters: FilterCondition[]) => void;
    onClose: () => void;
}

const FILTER_OPERATORS: { op: FilterOp; label: string }[] = [
    { op: "contains", label: "contains" },
    { op: "not_contains", label: "does not contain" },
    { op: "equals", label: "equals" },
    { op: "not_equals", label: "does not equal" },
    { op: "gt", label: "greater than (>)" },
    { op: "gte", label: "greater or equal (>=)" },
    { op: "lt", label: "less than (<)" },
    { op: "lte", label: "less or equal (<=)" },
    { op: "empty", label: "is empty" },
    { op: "not_empty", label: "is not empty" },
];

function generateId(): string {
    return Math.random().toString(36).substring(2, 9);
}

export const FilterModal: React.FC<FilterModalProps> = ({
    isOpen,
    columns,
    initialFilters,
    onApply,
    onClose,
}) => {
    const eligibleColumns = columns.filter((c) => c.column_type !== "reverse_ref");

    const [draftFilters, setDraftFilters] = useState<FilterCondition[]>([]);

    useEffect(() => {
        if (isOpen) {
            if (initialFilters.length > 0) {
                setDraftFilters(
                    initialFilters.map((f) => ({
                        id: f.id || generateId(),
                        columnId: f.columnId,
                        op: f.op,
                        value: f.value,
                    }))
                );
            } else {
                setDraftFilters([
                    {
                        id: generateId(),
                        columnId: eligibleColumns[0]?.id ?? null,
                        op: "contains",
                        value: "",
                    },
                ]);
            }
        }
    }, [isOpen, initialFilters, columns]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === "Escape") {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const addCondition = () => {
        setDraftFilters((prev) => [
            ...prev,
            {
                id: generateId(),
                columnId: eligibleColumns[0]?.id ?? null,
                op: "contains",
                value: "",
            },
        ]);
    };

    const updateCondition = (index: number, updates: Partial<FilterCondition>) => {
        setDraftFilters((prev) =>
            prev.map((item, idx) => (idx === index ? { ...item, ...updates } : item))
        );
    };

    const removeCondition = (index: number) => {
        setDraftFilters((prev) => prev.filter((_, idx) => idx !== index));
    };

    const handleApply = () => {
        // Keep valid conditions: column selected and either empty/not_empty op OR non-empty value
        const valid = draftFilters.filter((f) => {
            if (!f.columnId) return false;
            if (f.op === "empty" || f.op === "not_empty") return true;
            return f.value.trim() !== "";
        });
        onApply(valid);
        onClose();
    };

    const handleClearAll = () => {
        onApply([]);
        onClose();
    };

    const modalMarkup = (
        <div
            className="fixed inset-0 z-[1000] bg-surface-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-surface-200 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-accent-50 text-accent-600 flex items-center justify-center">
                            <i className="fa-solid fa-filter text-xs" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm text-surface-900">
                                Filter Records
                            </h3>
                            <p className="text-[11px] text-surface-400">
                                Set one or more conditions to filter records
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-surface-400 hover:text-surface-700 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-100 cursor-pointer transition-colors"
                    >
                        <i className="fa-solid fa-xmark text-sm" />
                    </button>
                </div>

                {/* Body: list of conditions */}
                <div className="p-6 overflow-y-auto space-y-3 flex-1 min-h-[160px]">
                    {draftFilters.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center space-y-2 bg-surface-50/50 rounded-xl border border-dashed border-surface-200">
                            <div className="w-10 h-10 rounded-full bg-surface-100 text-surface-400 flex items-center justify-center">
                                <i className="fa-solid fa-filter text-sm" />
                            </div>
                            <p className="text-xs font-medium text-surface-600">No filter conditions set</p>
                            <p className="text-[11px] text-surface-400 max-w-xs">
                                All records in this table will be displayed. Add a condition to narrow them down.
                            </p>
                            <button
                                type="button"
                                onClick={addCondition}
                                className="mt-2 px-3 py-1.5 text-xs font-semibold text-accent-600 bg-accent-50 hover:bg-accent-100 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5"
                            >
                                <i className="fa-solid fa-plus text-[10px]" />
                                Add condition
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {draftFilters.map((cond, idx) => {
                                const isFirst = idx === 0;
                                const isNoValueOp = cond.op === "empty" || cond.op === "not_empty";

                                return (
                                    <div
                                        key={cond.id || idx}
                                        className="flex items-center gap-2 bg-surface-50/60 p-2 rounded-lg border border-surface-200 transition-all hover:border-surface-300"
                                    >
                                        {/* Prefix label (Where / And) */}
                                        <div className="w-14 shrink-0 text-right pr-1">
                                            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
                                                {isFirst ? "Where" : "And"}
                                            </span>
                                        </div>

                                        {/* Column Selector */}
                                        <select
                                            value={cond.columnId ?? ""}
                                            onChange={(e) =>
                                                updateCondition(idx, {
                                                    columnId: e.target.value ? parseInt(e.target.value) : null,
                                                })
                                            }
                                            className="min-w-[130px] flex-1 max-w-[180px] bg-white border border-surface-200 text-xs font-medium text-surface-800 rounded-lg px-2.5 py-1.5 outline-none focus:border-accent-600 cursor-pointer shadow-xs"
                                        >
                                            <option value="">Select field...</option>
                                            {eligibleColumns.map((col) => (
                                                <option key={col.id} value={col.id}>
                                                    {col.name}
                                                </option>
                                            ))}
                                        </select>

                                        {/* Operator Selector */}
                                        <select
                                            value={cond.op}
                                            onChange={(e) =>
                                                updateCondition(idx, { op: e.target.value as FilterOp })
                                            }
                                            className="min-w-[120px] max-w-[160px] bg-white border border-surface-200 text-xs font-medium text-surface-800 rounded-lg px-2.5 py-1.5 outline-none focus:border-accent-600 cursor-pointer shadow-xs"
                                        >
                                            {FILTER_OPERATORS.map((o) => (
                                                <option key={o.op} value={o.op}>
                                                    {o.label}
                                                </option>
                                            ))}
                                        </select>

                                        {/* Value Input */}
                                        <div className="flex-1 min-w-[120px]">
                                            {isNoValueOp ? (
                                                <div className="text-[11px] text-surface-400 italic px-2 py-1 bg-surface-100/60 rounded border border-transparent">
                                                    (No value needed)
                                                </div>
                                            ) : (
                                                <input
                                                    type="text"
                                                    value={cond.value}
                                                    onChange={(e) =>
                                                        updateCondition(idx, { value: e.target.value })
                                                    }
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") {
                                                            e.preventDefault();
                                                            handleApply();
                                                        }
                                                    }}
                                                    placeholder="Enter value..."
                                                    className="w-full bg-white border border-surface-200 text-xs text-surface-800 rounded-lg px-2.5 py-1.5 outline-none focus:border-accent-600 shadow-xs"
                                                />
                                            )}
                                        </div>

                                        {/* Delete Condition Button */}
                                        <button
                                            type="button"
                                            onClick={() => removeCondition(idx)}
                                            className="w-7 h-7 rounded-lg text-surface-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer transition-colors shrink-0"
                                            title="Remove condition"
                                        >
                                            <i className="fa-solid fa-trash text-xs" />
                                        </button>
                                    </div>
                                );
                            })}

                            <div className="pt-1 pl-16">
                                <button
                                    type="button"
                                    onClick={addCondition}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-accent-600 hover:text-accent-700 bg-accent-50 hover:bg-accent-100/80 rounded-lg cursor-pointer transition-colors"
                                >
                                    <i className="fa-solid fa-plus text-[10px]" />
                                    Add condition
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3.5 border-t border-surface-200 bg-surface-50/50 flex items-center justify-between shrink-0">
                    <button
                        type="button"
                        onClick={handleClearAll}
                        className="px-3 py-1.5 text-xs font-medium text-surface-600 hover:text-coral-600 hover:bg-coral-50 rounded-lg transition-colors cursor-pointer"
                    >
                        Clear All
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-1.5 text-xs font-medium text-surface-700 hover:bg-surface-200 rounded-lg transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleApply}
                            className="px-4 py-1.5 text-xs font-semibold text-white bg-accent-600 hover:bg-accent-700 rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                            <i className="fa-solid fa-check text-[11px]" />
                            Apply Filters
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalMarkup, document.body);
};

export default FilterModal;
