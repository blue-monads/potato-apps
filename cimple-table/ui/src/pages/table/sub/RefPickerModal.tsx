import { useState, useEffect } from "react";
import {
    getDatatable,
    queryTable,
    type Datatable,
    type DatatableColumn,
    type DatatableRow,
} from "../../../lib/api";
import { getCellValue, CellValue } from "./columnTypes";
import { getRowIdentityText, getIdentityColumn } from "../../../lib/refCache";

interface RefPickerModalProps {
    tableId: number;
    isMulti?: boolean;
    selectedRowId?: number | string;
    selectedRowIds?: (number | string)[];
    identityColumnSlug?: string;
    onSelect?: (row: DatatableRow) => void;
    onSelectMulti?: (rows: DatatableRow[]) => void;
    onClear?: () => void;
    onCancel: () => void;
}

const PAGE_SIZE = 15;

const RefPickerModal = ({
    tableId,
    isMulti = false,
    selectedRowId,
    selectedRowIds,
    identityColumnSlug,
    onSelect,
    onSelectMulti,
    onClear,
    onCancel,
}: RefPickerModalProps) => {
    const [targetTable, setTargetTable] = useState<Datatable | null>(null);
    const [columns, setColumns] = useState<DatatableColumn[]>([]);
    const [rows, setRows] = useState<DatatableRow[]>([]);
    const [total, setTotal] = useState<number>(0);
    const [offset, setOffset] = useState<number>(0);
    const [search, setSearch] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(true);

    // Multi-select tracking
    const [selectedIds, setSelectedIds] = useState<Set<number>>(() => {
        const initial = new Set<number>();
        if (selectedRowIds && Array.isArray(selectedRowIds)) {
            selectedRowIds.forEach(id => {
                const n = typeof id === 'number' ? id : parseInt(String(id), 10);
                if (!isNaN(n) && n > 0) initial.add(n);
            });
        } else if (selectedRowId !== undefined && selectedRowId !== null) {
            const n = typeof selectedRowId === 'number' ? selectedRowId : parseInt(String(selectedRowId), 10);
            if (!isNaN(n) && n > 0) initial.add(n);
        }
        return initial;
    });

    const [selectedRowsMap, setSelectedRowsMap] = useState<Map<number, DatatableRow>>(() => new Map());

    const numericSelectedId = selectedRowId !== undefined
        ? (typeof selectedRowId === 'number' ? selectedRowId : parseInt(String(selectedRowId), 10))
        : NaN;

    // Load target table metadata
    useEffect(() => {
        let isMounted = true;
        const loadMeta = async () => {
            setLoading(true);
            const res = await getDatatable(tableId);
            if (isMounted && res.data) {
                setTargetTable(res.data);
                const cols = Array.isArray(res.data.columns) ? res.data.columns : [];
                setColumns(cols);
            }
            setLoading(false);
        };
        loadMeta();
        return () => {
            isMounted = false;
        };
    }, [tableId]);

    // Load rows when table, search, or offset changes
    useEffect(() => {
        if (!targetTable) return;
        let isMounted = true;

        const loadRows = async () => {
            setLoading(true);
            const res = await queryTable(tableId, {
                offset,
                limit: PAGE_SIZE,
                search: search.trim() || undefined,
            });

            if (isMounted && res.data) {
                const fetchedRows = Array.isArray(res.data.rows) ? res.data.rows : [];
                setRows(fetchedRows);
                setTotal(res.data.total ?? 0);
                setSelectedRowsMap(prev => {
                    const next = new Map(prev);
                    fetchedRows.forEach(r => {
                        if (selectedIds.has(r.id)) {
                            next.set(r.id, r);
                        }
                    });
                    return next;
                });
            }
            setLoading(false);
        };

        const timer = setTimeout(() => {
            loadRows();
        }, search ? 250 : 0);

        return () => {
            isMounted = false;
            clearTimeout(timer);
        };
    }, [tableId, targetTable, offset, search]);

    const toggleRowSelection = (row: DatatableRow) => {
        if (!isMulti) {
            onSelect?.(row);
            return;
        }
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(row.id)) {
                next.delete(row.id);
            } else {
                next.add(row.id);
            }
            return next;
        });
        setSelectedRowsMap(prev => {
            const next = new Map(prev);
            if (next.has(row.id)) {
                next.delete(row.id);
            } else {
                next.set(row.id, row);
            }
            return next;
        });
    };

    const handleDoneMulti = () => {
        const selectedList: DatatableRow[] = [];
        selectedIds.forEach(id => {
            const cached = selectedRowsMap.get(id);
            if (cached) {
                selectedList.push(cached);
            } else {
                selectedList.push({ id } as DatatableRow);
            }
        });
        onSelectMulti?.(selectedList);
    };

    const identityCol = identityColumnSlug
        ? columns.find(c => c.slug === identityColumnSlug)
        : getIdentityColumn(columns);

    return (
        <div className="space-y-3">
            {/* Header info & Search bar */}
            <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                    <i className="fa-solid fa-magnifying-glass text-[11px] text-surface-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setOffset(0);
                        }}
                        placeholder={`Search in ${targetTable?.name || 'table'}...`}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-surface-300 rounded outline-none focus:border-accent-600 focus:ring-1 focus:ring-accent-600 transition-all"
                        autoFocus
                    />
                </div>
                {isMulti ? (
                    selectedIds.size > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedIds(new Set());
                                setSelectedRowsMap(new Map());
                                onClear?.();
                            }}
                            className="px-2.5 py-1.5 text-xs font-semibold text-coral-600 hover:bg-coral-50 border border-coral-200 rounded transition-colors cursor-pointer"
                        >
                            Clear All ({selectedIds.size})
                        </button>
                    )
                ) : (
                    onClear && !isNaN(numericSelectedId) && (
                        <button
                            type="button"
                            onClick={onClear}
                            className="px-2.5 py-1.5 text-xs font-semibold text-coral-600 hover:bg-coral-50 border border-coral-200 rounded transition-colors cursor-pointer"
                        >
                            Clear Selection
                        </button>
                    )
                )}
            </div>

            {/* Mini Table Container */}
            <div className="border border-surface-200 rounded-lg overflow-hidden max-h-[380px] overflow-y-auto bg-white">
                <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-surface-50 border-b border-surface-200 sticky top-0 z-10">
                        <tr>
                            <th className="w-12 px-3 py-2 text-surface-500 font-semibold border-r border-surface-200">#</th>
                            {identityCol && (
                                <th className="px-3 py-2 text-surface-700 font-bold border-r border-surface-200 bg-accent-50/50">
                                    <div className="flex items-center gap-1.5">
                                        <i className="fa-solid fa-tag text-[10px] text-accent-600" />
                                        <span>{identityCol.name} (Identity)</span>
                                    </div>
                                </th>
                            )}
                            {columns
                                .filter(c => !identityCol || c.id !== identityCol.id)
                                .slice(0, 4) // Show up to 4 other columns in mini picker
                                .map(col => (
                                    <th key={col.id} className="px-3 py-2 text-surface-500 font-medium border-r border-surface-200 whitespace-nowrap">
                                        {col.name}
                                    </th>
                                ))}
                            <th className="w-16 px-3 py-2 text-center text-surface-500 font-medium">Select</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                        {loading && rows.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length + 2} className="py-12 text-center text-surface-400">
                                    <i className="fa-solid fa-spinner animate-spin mr-2 text-accent-600" />
                                    Loading records...
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length + 2} className="py-12 text-center text-surface-400">
                                    No matching records found.
                                </td>
                            </tr>
                        ) : (
                            rows.map((row) => {
                                const isSelected = isMulti ? selectedIds.has(row.id) : row.id === numericSelectedId;
                                const identityText = getRowIdentityText(row, identityColumnSlug, columns);

                                return (
                                    <tr
                                        key={row.id}
                                        onClick={() => toggleRowSelection(row)}
                                        className={`cursor-pointer transition-colors ${
                                            isSelected
                                                ? 'bg-accent-50 text-accent-900 font-medium hover:bg-accent-100/70'
                                                : 'hover:bg-surface-50 text-surface-700'
                                        }`}
                                    >
                                        <td className="px-3 py-2 font-mono text-[11px] text-surface-400 border-r border-surface-200">
                                            #{row.id}
                                        </td>
                                        {identityCol && (
                                            <td className="px-3 py-2 font-semibold text-surface-900 border-r border-surface-200">
                                                <span className="truncate max-w-[180px] inline-block">
                                                    {identityText || '—'}
                                                </span>
                                            </td>
                                        )}
                                        {columns
                                            .filter(c => !identityCol || c.id !== identityCol.id)
                                            .slice(0, 4)
                                            .map(col => (
                                                <td key={col.id} className="px-3 py-2 border-r border-surface-200 truncate max-w-[140px]">
                                                    <CellValue value={getCellValue(row, col)} column={col} />
                                                </td>
                                            ))}
                                        <td className="px-3 py-2 text-center" onClick={(e) => isMulti && e.stopPropagation()}>
                                            {isMulti ? (
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleRowSelection(row)}
                                                    className="w-4 h-4 text-accent-600 border-surface-300 rounded focus:ring-accent-500 cursor-pointer"
                                                />
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onSelect?.(row);
                                                    }}
                                                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                                                        isSelected
                                                            ? 'bg-accent-600 text-white'
                                                            : 'bg-surface-100 text-surface-600 hover:bg-accent-600 hover:text-white'
                                                    }`}
                                                >
                                                    {isSelected ? "Selected" : "Pick"}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer Pagination & Actions */}
            <div className="flex items-center justify-between pt-1 border-t border-surface-100 text-xs text-surface-500">
                <div>
                    Showing <span className="font-semibold text-surface-700">{rows.length > 0 ? offset + 1 : 0}</span> to{" "}
                    <span className="font-semibold text-surface-700">{Math.min(offset + rows.length, total)}</span> of{" "}
                    <span className="font-semibold text-surface-700">{total}</span>
                    {isMulti && (
                        <span className="ml-2 font-bold text-accent-700">
                            ({selectedIds.size} selected)
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setOffset(o => Math.max(0, o - PAGE_SIZE))}
                        disabled={offset === 0 || loading}
                        className="px-2.5 py-1 rounded border border-surface-200 bg-white hover:bg-surface-50 disabled:opacity-40 transition-colors font-medium cursor-pointer"
                    >
                        <i className="fa-solid fa-chevron-left text-[9px] mr-1" /> Prev
                    </button>
                    <button
                        type="button"
                        onClick={() => setOffset(o => o + PAGE_SIZE)}
                        disabled={offset + PAGE_SIZE >= total || loading}
                        className="px-2.5 py-1 rounded border border-surface-200 bg-white hover:bg-surface-50 disabled:opacity-40 transition-colors font-medium cursor-pointer"
                    >
                        Next <i className="fa-solid fa-chevron-right text-[9px] ml-1" />
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="ml-2 px-3 py-1 rounded bg-surface-100 hover:bg-surface-200 text-surface-700 font-semibold transition-colors cursor-pointer"
                    >
                        {isMulti ? "Cancel" : "Close"}
                    </button>
                    {isMulti && (
                        <button
                            type="button"
                            onClick={handleDoneMulti}
                            className="px-4 py-1 rounded bg-accent-600 hover:bg-accent-700 text-white font-bold transition-colors cursor-pointer shadow-xs"
                        >
                            Done ({selectedIds.size})
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RefPickerModal;
