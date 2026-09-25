import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { BASE_PATH } from "../../lib/base";
import {
    listDatatables,
    getDatatable,
    createDatatable,
    updateDatatable,
    deleteDatatable,
    createColumn,
    updateColumn,
    deleteColumn,
    createRow,
    updateRow,
    deleteRow,
    queryTable,
    getTableLastUpdated,
    type Datatable,
    type DatatableColumn,
    type DatatableRow,
    type FilterCondition,
    type FilterOp,
} from "../../lib/api";
import EditRowModal from "./sub/EditRowModal";
import CreateRowModal from "./sub/CreateRowModal";
import CreateTableModal from "./sub/CreateTableModal";
import CreateColumnModal from "./sub/CreateColumnModal";
import EditColumnModal from "./sub/EditColumnModal";
import EditTableModal from "./sub/EditTableModal";
import FilterModal from "./sub/FilterModal";
import { useModal } from "../../lib/shared/modal/modal";
import {
    CellValue,
    getCellValue,
    getTypeIcon,
    summarize,
} from "./sub/columnTypes";
import {
    parseRefOptions,
    parseRefIds,
    batchResolveRefs,
    parseReverseRefOptions,
    stageBatchResolveReverseRefs,
} from "../../lib/refCache";
import { getTableColorConfig } from "../../lib/tableColors";

type SortState = { columnId: number; dir: 'asc' | 'desc' } | null;

const getActiveFilters = (list: FilterCondition[]) => {
    return list.filter(f => {
        if (!f.columnId) return false;
        if (f.op === 'empty' || f.op === 'not_empty') return true;
        return f.value.trim() !== '';
    });
};

const PAGE_SIZE = 100;

const normalizeArray = <T,>(val: any): T[] => {
    if (Array.isArray(val)) return val;
    if (val && typeof val === 'object') return Object.values(val);
    return [];
};

const Table = () => {
    const { tableId } = useParams<{ tableId: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { openModal, closeModal } = useModal();
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const [datatables, setDatatables] = useState<Datatable[]>([]);
    const [currentTable, setCurrentTable] = useState<Datatable | null>(null);
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<DatatableRow[]>([]);
    const [totalCount, setTotalCount] = useState<number>(0);
    const [topOffset, setTopOffset] = useState<number>(0);
    const [bottomOffset, setBottomOffset] = useState<number>(0);
    const [loadingMoreUp, setLoadingMoreUp] = useState<boolean>(false);
    const [loadingMoreDown, setLoadingMoreDown] = useState<boolean>(false);

    const [search, setSearch] = useState("");
    const [sort, setSort] = useState<SortState>(null);
    const [filters, setFilters] = useState<FilterCondition[]>([]);
    const [filterModalOpen, setFilterModalOpen] = useState(false);
    const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(new Set());
    const [appsMenuOpen, setAppsMenuOpen] = useState(false);
    const [targetRowOffset, setTargetRowOffset] = useState<number | null>(null);
    const [loadedLastUpdated, setLoadedLastUpdated] = useState<string | null>(null);
    const [hasRemoteChanges, setHasRemoteChanges] = useState<boolean>(false);
    const loadedLastUpdatedRef = useRef<string | null>(null);
    const appsMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (appsMenuRef.current && !appsMenuRef.current.contains(e.target as Node)) {
                setAppsMenuOpen(false);
            }
        };
        if (appsMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [appsMenuOpen]);

    useEffect(() => {
        loadDatatables();
    }, []);

    useEffect(() => {
        if (tableId) {
            const rawOffset = searchParams.get('row_offset') || searchParams.get('offset');
            const targetRow = rawOffset ? Math.max(0, parseInt(rawOffset, 10) || 0) : 0;
            setSort(null);
            setFilters([]);
            setSearch("");
            setSelectedRowIds(new Set());
            loadTable(parseInt(tableId), targetRow);
        } else if (datatables.length > 0) {
            navigate(`${BASE_PATH}table/${datatables[0].id}`, { replace: true });
        }
        setSelectedRowIds(new Set());
    }, [tableId, datatables]);

    const loadDatatables = async () => {
        const response = await listDatatables();
        if (response.data) {
            setDatatables(normalizeArray<Datatable>(response.data));
        }
    };

    const handleRunQuery = async (
        offset = 0,
        overrideFilters?: FilterCondition[],
        overrideSort?: SortState,
        overrideSearch?: string,
        tableOverride?: Datatable
    ) => {
        const tbl = tableOverride || currentTable;
        if (!tbl) return;
        setLoading(true);

        const currentFiltersList = overrideFilters !== undefined ? overrideFilters : filters;
        const s = overrideSort !== undefined ? overrideSort : sort;
        const q = overrideSearch !== undefined ? overrideSearch : search;

        const tblCols = normalizeArray<DatatableColumn>(tbl.columns);
        const sortCol = s ? tblCols.find(c => c.id === s.columnId) : null;

        const activeList = getActiveFilters(currentFiltersList);
        const queryFilters = activeList.map(f => {
            const col = tblCols.find(c => c.id === f.columnId);
            return col ? { column: col.slug, op: f.op, value: f.value } : null;
        }).filter((item): item is { column: string; op: FilterOp; value: string } => item !== null);

        const res = await queryTable(tbl.id, {
            offset,
            limit: PAGE_SIZE,
            sort: sortCol ? { column: sortCol.slug, dir: s!.dir } : null,
            filter: queryFilters[0] || null,
            filters: queryFilters.length > 0 ? queryFilters : null,
            search: q.trim() || undefined,
        });

        if (res.data) {
            const returnedRows = normalizeArray<DatatableRow>(res.data.rows);
            setRows(returnedRows);
            setTotalCount(res.data.total ?? 0);
            setTopOffset(res.data.offset ?? 0);
            setBottomOffset((res.data.offset ?? 0) + returnedRows.length);
            if (res.data.last_updated !== undefined) {
                setLoadedLastUpdated(res.data.last_updated);
                loadedLastUpdatedRef.current = res.data.last_updated;
            }
            setHasRemoteChanges(false);
        }
        setLoading(false);
    };

    const loadTable = async (tId: number, targetRowParam: number = 0) => {
        setLoading(true);
        const response = await getDatatable(tId);
        if (response.data) {
            const table = response.data;
            if (table) {
                const cols = normalizeArray<DatatableColumn>(table.columns);
                table.columns = cols;
                setCurrentTable(table);

                // If targetRowParam is provided (e.g. 47), target 0-indexed row is targetRowParam - 1 (or 0 if 0).
                // Preload ~30 rows before it so target row is loaded in the window surrounded by context.
                const targetIdx = targetRowParam > 0 ? targetRowParam - 1 : 0;
                const windowStart = Math.max(0, targetIdx - 30);

                await handleRunQuery(windowStart, undefined, undefined, undefined, table);

                if (targetRowParam > 0) {
                    setTargetRowOffset(targetIdx);
                    setTimeout(() => {
                        const el = document.getElementById(`row-${targetIdx}`);
                        if (el) {
                            el.scrollIntoView({ block: 'center', behavior: 'smooth' });
                        }
                    }, 200);

                    // Clear highlight after 4 seconds
                    setTimeout(() => {
                        setTargetRowOffset(null);
                    }, 4000);
                }
            } else {
                setCurrentTable(null);
                setRows([]);
                setTotalCount(0);
            }
        }
        setLoading(false);
    };

    const columns = normalizeArray<DatatableColumn>(currentTable?.columns);
    const activeFilters = getActiveFilters(filters);
    const activeFilterCount = activeFilters.length;

    // Debounce search text input
    useEffect(() => {
        if (!currentTable) return;
        const timer = setTimeout(() => {
            handleRunQuery(0);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    // Poll for changes when table and browser tab are active
    useEffect(() => {
        if (!currentTable) return;

        let isMounted = true;

        const checkLatestUpdate = async () => {
            if (document.visibilityState !== 'visible') return;
            if (!isMounted || !currentTable) return;

            const res = await getTableLastUpdated(currentTable.id);
            if (res.data && res.data.last_updated && isMounted) {
                const latest = res.data.last_updated;
                const current = loadedLastUpdatedRef.current;
                if (current && latest && latest !== current) {
                    setHasRemoteChanges(true);
                }
            }
        };

        const intervalId = setInterval(checkLatestUpdate, 30000);

        const handleVisibilityOrFocus = () => {
            if (document.visibilityState === 'visible') {
                checkLatestUpdate();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityOrFocus);
        window.addEventListener('focus', handleVisibilityOrFocus);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
            window.removeEventListener('focus', handleVisibilityOrFocus);
        };
    }, [currentTable?.id]);

    // Lazy batch-resolve table references in visible rows
    useEffect(() => {
        if (!rows || rows.length === 0 || !columns || columns.length === 0) return;
        columns.forEach(col => {
            if (col.column_type === 'ref' || col.column_type === 'multiref') {
                const opts = parseRefOptions(col.options);
                if (opts?.target_table_id) {
                    const allIds: number[] = [];
                    rows.forEach(r => {
                        const parsed = parseRefIds(r[col.slug]);
                        allIds.push(...parsed);
                    });
                    if (allIds.length > 0) {
                        batchResolveRefs(opts.target_table_id, allIds);
                    }
                }
            }
            if (col.column_type === 'reverse_ref') {
                const revOpts = parseReverseRefOptions(col.options);
                if (currentTable && revOpts?.target_table_id && revOpts?.target_column_slug) {
                    const rowIds = rows.map(r => r.id);
                    stageBatchResolveReverseRefs(currentTable.id, col.slug, revOpts.target_table_id, revOpts.target_column_slug, rowIds);
                }
            }
        });
    }, [rows, columns, currentTable?.id]);

    const loadMoreDown = async () => {
        if (!currentTable || loadingMoreDown || bottomOffset >= totalCount) return;
        setLoadingMoreDown(true);

        const tblCols = normalizeArray<DatatableColumn>(currentTable.columns);
        const sortCol = sort ? tblCols.find(c => c.id === sort.columnId) : null;

        const activeList = getActiveFilters(filters);
        const queryFilters = activeList.map(f => {
            const col = tblCols.find(c => c.id === f.columnId);
            return col ? { column: col.slug, op: f.op, value: f.value } : null;
        }).filter((item): item is { column: string; op: FilterOp; value: string } => item !== null);

        const res = await queryTable(currentTable.id, {
            offset: bottomOffset,
            limit: PAGE_SIZE,
            sort: sortCol ? { column: sortCol.slug, dir: sort!.dir } : null,
            filter: queryFilters[0] || null,
            filters: queryFilters.length > 0 ? queryFilters : null,
            search: search.trim() || undefined,
        });

        const newRows = normalizeArray<DatatableRow>(res.data?.rows);
        if (newRows.length > 0) {
            setRows(prev => [...normalizeArray<DatatableRow>(prev), ...newRows]);
            setBottomOffset(prev => prev + newRows.length);
            setTotalCount(res.data?.total ?? (bottomOffset + newRows.length));
        }
        setLoadingMoreDown(false);
    };

    const loadMoreUp = async () => {
        if (!currentTable || loadingMoreUp || topOffset <= 0) return;
        setLoadingMoreUp(true);
        const el = scrollContainerRef.current;
        const oldScrollHeight = el ? el.scrollHeight : 0;

        const countToLoad = Math.min(PAGE_SIZE, topOffset);
        const newOffset = topOffset - countToLoad;

        const tblCols = normalizeArray<DatatableColumn>(currentTable.columns);
        const sortCol = sort ? tblCols.find(c => c.id === sort.columnId) : null;

        const activeList = getActiveFilters(filters);
        const queryFilters = activeList.map(f => {
            const col = tblCols.find(c => c.id === f.columnId);
            return col ? { column: col.slug, op: f.op, value: f.value } : null;
        }).filter((item): item is { column: string; op: FilterOp; value: string } => item !== null);

        const res = await queryTable(currentTable.id, {
            offset: newOffset,
            limit: countToLoad,
            sort: sortCol ? { column: sortCol.slug, dir: sort!.dir } : null,
            filter: queryFilters[0] || null,
            filters: queryFilters.length > 0 ? queryFilters : null,
            search: search.trim() || undefined,
        });

        const newRows = normalizeArray<DatatableRow>(res.data?.rows);
        if (newRows.length > 0) {
            setRows(prev => [...newRows, ...normalizeArray<DatatableRow>(prev)]);
            setTopOffset(newOffset);

            requestAnimationFrame(() => {
                if (el) {
                    const diff = el.scrollHeight - oldScrollHeight;
                    el.scrollTop += diff;
                }
            });
        }
        setLoadingMoreUp(false);
    };

    const handleScroll = () => {
        const el = scrollContainerRef.current;
        if (!el || !currentTable || loading || loadingMoreUp || loadingMoreDown) return;

        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 250) {
            if (bottomOffset < totalCount) {
                loadMoreDown();
            }
        }

        if (el.scrollTop <= 100) {
            if (topOffset > 0) {
                loadMoreUp();
            }
        }
    };

    const handleCopySelectedRowLink = () => {
        if (selectedRowIds.size !== 1) return;
        const selectedId = Array.from(selectedRowIds)[0];
        const rowIndex = rows.findIndex(r => r.id === selectedId);
        const rowNumber = topOffset + (rowIndex >= 0 ? rowIndex : 0) + 1;
        const url = new URL(window.location.href);
        url.searchParams.set('row_offset', String(rowNumber));
        navigator.clipboard.writeText(url.toString());
        alert(`Copied direct link to row #${rowNumber}:\n${url.toString()}`);
    };

    const toggleRowSelection = (rowId: number) => {
        setSelectedRowIds(prev => {
            const next = new Set(prev);
            if (next.has(rowId)) next.delete(rowId);
            else next.add(rowId);
            return next;
        });
    };

    const toggleAllSelection = () => {
        if (selectedRowIds.size === rows.length) {
            setSelectedRowIds(new Set());
        } else {
            setSelectedRowIds(new Set(rows.map(r => r.id)));
        }
    };

    const cycleSort = (columnId: number) => {
        const nextSort: SortState = (() => {
            if (!sort || sort.columnId !== columnId) return { columnId, dir: 'asc' };
            if (sort.dir === 'asc') return { columnId, dir: 'desc' };
            return null;
        })();
        setSort(nextSort);
        handleRunQuery(0, undefined, nextSort);
    };

    const handleBulkDelete = async () => {
        if (!selectedRowIds.size || !currentTable) return;
        if (!confirm(`Delete ${selectedRowIds.size} selected row(s)?`)) return;

        setLoading(true);
        for (const rowId of selectedRowIds) {
            await deleteRow(rowId, currentTable.id);
        }
        await handleRunQuery(topOffset);
        setSelectedRowIds(new Set());
    };

    const handleCreateTable = () => {
        openModal({
            title: "Create New Datatable",
            maxWidth: '820px',
            content: (
                <CreateTableModal
                    onSave={async (data, templateColumns) => {
                        const response = await createDatatable(data);
                        if (!response.error && response.data) {
                            for (const col of templateColumns || []) {
                                await createColumn({
                                    table_id: response.data.id,
                                    name: col.name,
                                    column_type: col.column_type,
                                    icon: col.icon || "",
                                    info: col.info || "",
                                    required: col.required || false,
                                    options: col.options || "",
                                });
                            }
                            await loadDatatables();
                            navigate(`${BASE_PATH}table/${response.data.id}`);
                            closeModal();
                        } else {
                            alert("Failed to create table: " + (response.error || "Unknown error"));
                        }
                    }}
                    onCancel={closeModal}
                />
            ),
        });
    };

    const handleEditTable = (table: Datatable) => {
        openModal({
            title: "Table Settings",
            content: (
                <EditTableModal
                    table={table}
                    onSave={async (data) => {
                        const response = await updateDatatable(table.id, data);
                        if (!response.error) {
                            await loadDatatables();
                            await loadTable(table.id);
                            closeModal();
                        } else {
                            alert("Failed to update table: " + response.error);
                        }
                    }}
                    onDelete={async () => {
                        if (!confirm("Delete this table and all its records?")) return;
                        const response = await deleteDatatable(table.id);
                        if (!response.error) {
                            await loadDatatables();
                            navigate(`${BASE_PATH}table`);
                            closeModal();
                        } else {
                            alert("Failed to delete table: " + response.error);
                        }
                    }}
                    onCancel={closeModal}
                />
            ),
        });
    };

    const handleCreateColumn = () => {
        if (!currentTable) return;
        openModal({
            title: "Create New Field",
            content: (
                <CreateColumnModal
                    tableId={currentTable.id}
                    onSave={async (data) => {
                        const response = await createColumn(data);
                        if (!response.error) {
                            await loadTable(currentTable.id);
                            closeModal();
                        } else {
                            alert("Failed to create column: " + response.error);
                        }
                    }}
                    onCancel={closeModal}
                />
            ),
        });
    };

    const handleEditColumn = (column: DatatableColumn) => {
        if (!currentTable) return;
        openModal({
            title: "Edit Field",
            content: (
                <EditColumnModal
                    column={column}
                    onSave={async (data) => {
                        const response = await updateColumn(column.id, data);
                        if (!response.error) {
                            await loadTable(currentTable.id);
                            closeModal();
                        } else {
                            alert("Failed to update column: " + response.error);
                        }
                    }}
                    onDelete={async () => {
                        if (!confirm("Delete this field and all its values?")) return;
                        const response = await deleteColumn(column.id);
                        if (!response.error) {
                            setSort(prev => (prev?.columnId === column.id ? null : prev));
                            setFilters(prev => prev.filter(f => f.columnId !== column.id));
                            await loadTable(currentTable.id);
                            closeModal();
                        } else {
                            alert("Failed to delete column: " + response.error);
                        }
                    }}
                    onCancel={closeModal}
                />
            ),
        });
    };

    const handleCreateRow = () => {
        if (!currentTable) return;
        openModal({
            title: "New Record",
            maxWidth: '750px',
            content: (
                <CreateRowModal
                    table={currentTable}
                    onSave={async (data) => {
                        const response = await createRow(data);
                        if (!response.error) {
                            await loadTable(currentTable.id);
                            closeModal();
                        } else {
                            alert("Failed to create row: " + response.error);
                        }
                    }}
                    onCancel={closeModal}
                />
            ),
        });
    };

    const handleEditRow = (row: DatatableRow) => {
        if (!currentTable) return;
        openModal({
            title: "Edit Record",
            maxWidth: '750px',
            content: (
                <EditRowModal
                    table={currentTable}
                    row={row}
                    onSave={async (values) => {
                        const response = await updateRow(row.id, {
                            table_id: currentTable.id,
                            data: values,
                        });
                        if (!response.error) {
                            await loadTable(currentTable.id);
                            closeModal();
                        } else {
                            alert("Failed to update row: " + response.error);
                        }
                    }}
                    onDelete={async () => {
                        if (!confirm("Delete this record?")) return;
                        const response = await deleteRow(row.id, currentTable.id);
                        if (!response.error) {
                            await loadTable(currentTable.id);
                            closeModal();
                        } else {
                            alert("Failed to delete row: " + response.error);
                        }
                    }}
                    onCancel={closeModal}
                />
            ),
        });
    };

    const sortedColumn = sort ? columns.find(c => c.id === sort.columnId) : null;
    const allVisibleSelected = rows.length > 0 && selectedRowIds.size === rows.length;
    const activeColorConfig = getTableColorConfig(currentTable?.color);

    return (
        <div className="h-screen flex flex-col bg-surface-50 overflow-hidden">

            {/* App header */}
            <header
                className="flex items-center justify-between gap-4 text-white px-4 py-2 shrink-0 transition-colors duration-200 shadow-xs"
                style={{ backgroundColor: activeColorConfig.headerBg }}
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <i className="fa-solid fa-table-cells text-white/80 text-sm" />
                    <span className="font-semibold text-[15px] tracking-tight">Simple Datatable</span>
                    {currentTable?.info && (
                        <span className="hidden md:inline text-[11px] text-white/70 truncate max-w-md">
                            {currentTable.info}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[12px] text-white/75">
                        {selectedRowIds.size > 0
                            ? `${selectedRowIds.size} row${selectedRowIds.size === 1 ? '' : 's'} selected`
                            : `${totalCount.toLocaleString()} record${totalCount === 1 ? '' : 's'}`}
                    </span>

                    {/* 4-dot Apps Launcher Menu */}
                    <div className="relative" ref={appsMenuRef}>
                        <button
                            onClick={() => setAppsMenuOpen(o => !o)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                                appsMenuOpen
                                    ? 'bg-black/30 text-white'
                                    : 'text-white/70 hover:text-white hover:bg-black/20'
                            }`}
                            title="Apps & Tools"
                        >
                            <svg className="w-4 h-4 fill-current" viewBox="0 0 16 16">
                                <circle cx="4.5" cy="4.5" r="1.8" />
                                <circle cx="11.5" cy="4.5" r="1.8" />
                                <circle cx="4.5" cy="11.5" r="1.8" />
                                <circle cx="11.5" cy="11.5" r="1.8" />
                            </svg>
                        </button>

                        {appsMenuOpen && (
                            <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-surface-200 p-2.5 z-50 text-surface-800 animate-slide-in">
                                <div className="text-[10px] font-bold text-surface-400 uppercase tracking-wider px-2 py-1 mb-1">
                                    Tools & Apps
                                </div>
                                <button
                                    onClick={() => {
                                        setAppsMenuOpen(false);
                                        navigate(`${BASE_PATH}seeder${currentTable ? `/${currentTable.id}` : ''}`);
                                    }}
                                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-surface-100 transition-colors text-left group cursor-pointer"
                                >
                                    <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
                                        <i className="fa-solid fa-seedling text-base" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-xs font-semibold text-surface-800 group-hover:text-accent-600 transition-colors">
                                            Data Seeder
                                        </div>
                                        <div className="text-[11px] text-surface-400 truncate">
                                            Generate & seed mock records
                                        </div>
                                    </div>
                                    <i className="fa-solid fa-chevron-right text-[10px] text-surface-300 group-hover:text-surface-600 transition-colors" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Table tabs */}
            <nav
                className="flex items-center gap-1 px-3 overflow-x-auto scrollbar-thin border-b border-black/20 shrink-0 transition-colors duration-200"
                style={{ backgroundColor: activeColorConfig.navBg }}
            >
                {datatables.map(table => {
                    const active = tableId === table.id.toString();
                    const tableColor = getTableColorConfig(table.color);
                    return (
                        <div
                            key={table.id}
                            onClick={() => navigate(`${BASE_PATH}table/${table.id}`)}
                            onDoubleClick={() => handleEditTable(table)}
                            style={active ? { borderTop: `3px solid ${tableColor.hex}` } : undefined}
                            className={`group flex items-center gap-2 px-3.5 py-2 text-[13px] rounded-t-md cursor-pointer whitespace-nowrap select-none border border-b-0 transition-all ${
                                active
                                    ? 'bg-white font-semibold border-surface-200 shadow-xs'
                                    : 'text-white/70 border-transparent hover:text-white hover:bg-white/10'
                            }`}
                        >
                            <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: tableColor.hex }}
                            />
                            <i className={`fa-solid fa-${table.icon || 'table'} text-[11px] ${active ? '' : 'opacity-70'}`} />
                            <span style={active ? { color: tableColor.hex } : undefined}>{table.name}</span>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleEditTable(table); }}
                                title="Table settings"
                                className={`w-4 h-4 rounded-full inline-flex items-center justify-center transition-opacity ${
                                    active
                                        ? 'text-surface-400 hover:text-surface-900 hover:bg-surface-100'
                                        : 'text-white/60 hover:text-white opacity-0 group-hover:opacity-100'
                                }`}
                            >
                                <i className="fa-solid fa-gear text-[9px]" />
                            </button>
                        </div>
                    );
                })}
                <button
                    onClick={handleCreateTable}
                    className="px-2.5 py-1.5 my-1 text-white/70 text-[13px] rounded hover:text-white hover:bg-white/10 whitespace-nowrap transition-colors cursor-pointer"
                >
                    <i className="fa-solid fa-plus text-[11px] mr-1.5" />New Table
                </button>
            </nav>

            {currentTable ? (
                <>
                    {/* Toolbar */}
                    <div className="flex items-center gap-2 flex-wrap bg-white border-b border-surface-200 px-4 py-2 shrink-0">
                        <div className="flex items-center gap-1.5 pr-3 mr-1 border-r border-surface-200">
                            <button
                                onClick={handleCreateRow}
                                disabled={columns.length === 0}
                                style={{ backgroundColor: activeColorConfig.hex }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md text-white hover:opacity-90 disabled:opacity-40 transition-all cursor-pointer shadow-xs"
                            >
                                <i className="fa-solid fa-plus text-[11px]" />Add Record
                            </button>
                            <button
                                onClick={handleCreateColumn}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md bg-white border border-surface-200 hover:bg-surface-50 hover:border-surface-300 transition-colors"
                            >
                                <i className="fa-solid fa-plus text-[11px] text-surface-400" />Field
                            </button>
                        </div>

                        <div className="flex items-center gap-1.5 pr-3 mr-1 border-r border-surface-200">
                            <button
                                onClick={() => setFilterModalOpen(true)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md border transition-colors cursor-pointer ${
                                    activeFilterCount > 0
                                        ? 'bg-accent-50 text-accent-700 border-accent-600 font-semibold shadow-xs'
                                        : 'bg-white border-surface-200 hover:bg-surface-50 hover:border-surface-300 text-surface-700'
                                }`}
                                title={activeFilterCount > 0 ? `${activeFilterCount} active filter${activeFilterCount > 1 ? 's' : ''}` : "Filter records"}
                            >
                                <i className="fa-solid fa-filter text-[11px]" />
                                <span>Filter</span>
                                {activeFilterCount > 0 && (
                                    <span className="flex items-center gap-1 ml-0.5">
                                        <span className="w-2 h-2 rounded-full bg-accent-600 inline-block shadow-xs animate-pulse" />
                                        <span className="text-[11px] font-bold text-accent-700 font-mono">
                                            ({activeFilterCount})
                                        </span>
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => (sort ? cycleSort(sort.columnId) : columns[0] && cycleSort(columns[0].id))}
                                disabled={columns.length === 0}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md border transition-colors disabled:opacity-40 ${
                                    sort
                                        ? 'bg-accent-50 text-accent-700 border-accent-600'
                                        : 'bg-white border-surface-200 hover:bg-surface-50 hover:border-surface-300'
                                }`}
                            >
                                <i className={`fa-solid fa-arrow-${sort?.dir === 'desc' ? 'down' : 'up'}-short-wide text-[11px]`} />
                                {sortedColumn ? `${sortedColumn.name} ${sort?.dir === 'asc' ? '↑' : '↓'}` : 'Sort'}
                            </button>
                        </div>

                        <div className="relative">
                            <i className="fa-solid fa-magnifying-glass text-[11px] text-surface-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search this table..."
                                className="w-56 pl-8 pr-3 py-1.5 text-[13px] bg-white border border-surface-200 rounded-md outline-none focus:border-accent-600 transition-colors"
                            />
                        </div>

                        <div className="flex-1" />

                        {selectedRowIds.size === 1 && (
                            <button
                                onClick={handleCopySelectedRowLink}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md border border-surface-200 text-surface-700 bg-white hover:bg-surface-50 hover:border-surface-300 transition-colors animate-slide-in cursor-pointer"
                                title="Copy direct link to selected row"
                            >
                                <i className="fa-solid fa-link text-[11px] text-accent-600" />
                                Copy Link
                            </button>
                        )}

                        {selectedRowIds.size > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md border border-coral-300 text-coral-600 hover:bg-coral-50 transition-colors animate-slide-in"
                            >
                                <i className="fa-solid fa-trash text-[11px]" />
                                Delete {selectedRowIds.size}
                            </button>
                        )}
                        <button
                            onClick={() => {
                                setHasRemoteChanges(false);
                                handleRunQuery(topOffset);
                            }}
                            title={
                                hasRemoteChanges
                                    ? "Data modified - click to refresh to latest"
                                    : loadedLastUpdated
                                        ? `Refresh (Last updated: ${loadedLastUpdated})`
                                        : "Refresh"
                            }
                            className={`relative px-2.5 py-1.5 text-[13px] rounded-md border transition-colors cursor-pointer ${
                                hasRemoteChanges
                                    ? 'border-amber-400 text-amber-600 bg-amber-50 hover:bg-amber-100/70 ring-1 ring-amber-300'
                                    : 'border-surface-200 text-surface-500 bg-white hover:bg-surface-50 hover:border-surface-300'
                            }`}
                        >
                            <i className={`fa-solid fa-rotate-right text-[11px] ${loading ? 'animate-spin' : ''}`} />
                            {hasRemoteChanges && (
                                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 pointer-events-none">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 ring-1 ring-white"></span>
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Active filters pill bar */}
                    {activeFilterCount > 0 && (
                        <div className="flex items-center gap-2 flex-wrap bg-surface-50 border-b border-surface-200 px-4 py-1.5 text-xs shrink-0">
                            <span className="font-semibold text-surface-600 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-accent-600 shrink-0" />
                                <span>Filtered by:</span>
                            </span>
                            {activeFilters.map((cond, idx) => {
                                const col = columns.find(c => c.id === cond.columnId);
                                const colName = col ? col.name : 'Unknown';
                                const opLabel = cond.op.replace(/_/g, ' ');
                                const valDisplay = cond.op === 'empty' || cond.op === 'not_empty' ? '' : ` "${cond.value}"`;
                                return (
                                    <div
                                        key={cond.id || idx}
                                        className="inline-flex items-center gap-1 bg-white border border-surface-300 text-surface-800 rounded-md px-2 py-0.5 shadow-2xs group text-xs"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => setFilterModalOpen(true)}
                                            className="hover:text-accent-600 cursor-pointer font-medium text-left"
                                            title="Click to edit filters"
                                        >
                                            <span className="text-surface-600">{idx > 0 ? "and " : ""}{colName}</span>
                                            <span className="text-surface-400 mx-1">{opLabel}</span>
                                            {valDisplay && <span className="font-semibold text-surface-900">{valDisplay}</span>}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const updated = filters.filter((_, i) => i !== idx);
                                                setFilters(updated);
                                                handleRunQuery(0, updated);
                                            }}
                                            className="text-surface-400 hover:text-coral-600 w-4 h-4 rounded flex items-center justify-center cursor-pointer transition-colors ml-0.5"
                                            title="Remove this filter"
                                        >
                                            <i className="fa-solid fa-xmark text-[10px]" />
                                        </button>
                                    </div>
                                );
                            })}
                            <button
                                type="button"
                                onClick={() => {
                                    setFilters([]);
                                    handleRunQuery(0, []);
                                }}
                                className="text-xs text-coral-600 hover:text-coral-700 hover:underline cursor-pointer ml-1 font-medium"
                            >
                                Clear all
                            </button>
                            <span className="ml-auto text-[12px] text-surface-400">
                                {totalCount > 0 ? `Showing ${topOffset + 1}–${topOffset + rows.length} of ${totalCount.toLocaleString()} records` : '0 records'}
                            </span>
                        </div>
                    )}

                    {/* Grid */}
                    {columns.length === 0 ? (
                        <EmptyState
                            icon="table-columns"
                            title="Set up your fields"
                            body="This table has no fields yet. Add text, number, date and select fields to start collecting records."
                            actionLabel="Add First Field"
                            onAction={handleCreateColumn}
                        />
                    ) : (
                        <div
                            ref={scrollContainerRef}
                            onScroll={handleScroll}
                            className="flex-1 overflow-auto scrollbar-thin bg-white"
                        >
                            <table className="border-separate border-spacing-0 text-[13px] w-full">
                                <thead>
                                    <tr>
                                        <th className="sticky top-0 left-0 z-30 w-10 min-w-10 h-9 bg-surface-50 border-b border-r border-surface-200">
                                            <input
                                                type="checkbox"
                                                className="w-3.5 h-3.5 align-middle cursor-pointer accent-accent-600"
                                                checked={allVisibleSelected}
                                                onChange={toggleAllSelection}
                                            />
                                        </th>
                                        <th className="sticky top-0 left-10 z-30 w-11 min-w-11 h-9 bg-surface-50 border-b border-r border-surface-200 text-[11px] font-semibold text-surface-400">
                                            #
                                        </th>
                                        {columns.map(col => {
                                            const active = sort?.columnId === col.id;
                                            return (
                                                <th
                                                    key={col.id}
                                                    onClick={() => cycleSort(col.id)}
                                                    title={col.info || col.name}
                                                    className="group sticky top-0 z-20 h-9 min-w-44 px-3 bg-surface-50 border-b border-r border-surface-200 text-left font-semibold text-surface-500 cursor-pointer hover:bg-surface-100 transition-colors select-none"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <i className={`fa-solid fa-${col.icon || getTypeIcon(col.column_type)} text-[10px] text-surface-400`} />
                                                        <span className="truncate">{col.name}</span>
                                                        {col.required && <span className="text-coral-500">*</span>}
                                                        {active && (
                                                            <i className={`fa-solid fa-arrow-${sort?.dir === 'asc' ? 'up' : 'down'} text-[9px] text-accent-600`} />
                                                        )}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleEditColumn(col); }}
                                                            title="Edit field"
                                                            className="ml-auto opacity-0 group-hover:opacity-100 text-surface-400 hover:text-accent-600 transition-opacity"
                                                        >
                                                            <i className="fa-solid fa-pencil text-[10px]" />
                                                        </button>
                                                    </div>
                                                </th>
                                            );
                                        })}
                                        <th
                                            onClick={handleCreateColumn}
                                            title="Add field"
                                            className="sticky top-0 z-20 w-10 min-w-10 h-9 bg-surface-50 border-b border-surface-200 text-surface-400 hover:bg-surface-100 hover:text-accent-600 cursor-pointer transition-colors"
                                        >
                                            <i className="fa-solid fa-plus text-[11px]" />
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {topOffset > 0 && (
                                        <tr>
                                            <td colSpan={columns.length + 3} className="p-1.5 text-center bg-surface-50 border-b border-surface-200">
                                                <button
                                                    onClick={() => loadMoreUp()}
                                                    disabled={loadingMoreUp}
                                                    className="text-xs text-accent-600 hover:text-accent-700 font-medium py-1 px-3 rounded hover:bg-accent-50 transition-colors inline-flex items-center gap-1.5"
                                                >
                                                    {loadingMoreUp ? (
                                                        <>
                                                            <i className="fa-solid fa-spinner animate-spin" />
                                                            Loading previous records...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <i className="fa-solid fa-arrow-up" />
                                                            Load previous {topOffset} records
                                                        </>
                                                    )}
                                                </button>
                                            </td>
                                        </tr>
                                    )}

                                    {rows.map((row, index) => {
                                        const absRowIndex = topOffset + index + 1;
                                        const isTargeted = targetRowOffset === absRowIndex;
                                        const selected = selectedRowIds.has(row.id);
                                        const stickyBg = isTargeted
                                            ? 'bg-amber-100 group-hover:bg-amber-100'
                                            : selected
                                                ? 'bg-accent-50'
                                                : 'bg-white group-hover:bg-surface-100';
                                        return (
                                            <tr
                                                key={row.id}
                                                id={`row-${absRowIndex}`}
                                                onClick={() => handleEditRow(row)}
                                                className={`group cursor-pointer transition-colors ${
                                                    isTargeted
                                                        ? 'bg-amber-100 ring-2 ring-amber-400 ring-inset'
                                                        : selected
                                                            ? 'bg-accent-50'
                                                            : 'hover:bg-surface-100'
                                                }`}
                                            >
                                                <td
                                                    onClick={(e) => e.stopPropagation()}
                                                    className={`sticky left-0 z-10 h-9 text-center border-b border-r border-surface-200 transition-colors ${stickyBg}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="w-3.5 h-3.5 align-middle cursor-pointer accent-accent-600"
                                                        checked={selected}
                                                        onChange={() => toggleRowSelection(row.id)}
                                                    />
                                                </td>
                                                <td className={`sticky left-10 z-10 h-9 text-center text-[11px] text-surface-400 border-b border-r border-surface-200 transition-colors select-none ${stickyBg}`}>
                                                    {absRowIndex}
                                                </td>
                                                {columns.map(col => (
                                                    <td
                                                        key={col.id}
                                                        className="h-9 max-w-xs px-3 border-b border-r border-surface-200 overflow-hidden whitespace-nowrap"
                                                    >
                                                        <div className="flex items-center overflow-hidden">
                                                            <CellValue value={getCellValue(row, col)} column={col} row={row} />
                                                        </div>
                                                    </td>
                                                ))}
                                                <td className="h-9 border-b border-surface-200" />
                                            </tr>
                                        );
                                    })}

                                    {bottomOffset < totalCount && (
                                        <tr>
                                            <td colSpan={columns.length + 3} className="p-1.5 text-center bg-surface-50 border-b border-surface-200">
                                                <button
                                                    onClick={() => loadMoreDown()}
                                                    disabled={loadingMoreDown}
                                                    className="text-xs text-accent-600 hover:text-accent-700 font-medium py-1 px-3 rounded hover:bg-accent-50 transition-colors inline-flex items-center gap-1.5"
                                                >
                                                    {loadingMoreDown ? (
                                                        <>
                                                            <i className="fa-solid fa-spinner animate-spin" />
                                                            Loading more records...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <i className="fa-solid fa-arrow-down" />
                                                            Load next {totalCount - bottomOffset} records
                                                        </>
                                                    )}
                                                </button>
                                            </td>
                                        </tr>
                                    )}

                                    {rows.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan={columns.length + 3} className="h-40 text-center text-surface-400">
                                                {totalCount === 0 ? (
                                                    <button
                                                        onClick={handleCreateRow}
                                                        className="text-accent-600 hover:underline font-medium"
                                                    >
                                                        <i className="fa-solid fa-plus text-[11px] mr-1.5" />
                                                        Add the first record
                                                    </button>
                                                ) : (
                                                    <span>No records match your search or filter.</span>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>

                                <tfoot>
                                    <tr>
                                        <td className="sticky bottom-0 left-0 z-30 h-8 bg-surface-50 border-t-2 border-r border-surface-200" />
                                        <td className="sticky bottom-0 left-10 z-30 h-8 bg-surface-50 border-t-2 border-r border-surface-200 text-center text-[10px] font-semibold text-surface-400 uppercase">
                                            Σ
                                        </td>
                                        {columns.map(col => (
                                            <td
                                                key={col.id}
                                                className="sticky bottom-0 z-20 h-8 px-3 bg-surface-50 border-t-2 border-r border-surface-200 text-[11px] font-semibold text-surface-500 whitespace-nowrap"
                                            >
                                                {summarize(col, rows.map(r => getCellValue(r, col)))}
                                            </td>
                                        ))}
                                        <td className="sticky bottom-0 z-20 h-8 bg-surface-50 border-t-2 border-surface-200" />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </>
            ) : (
                <EmptyState
                    icon="cubes"
                    title="Your data, simplified"
                    body="Pick a table from the tabs above to start exploring, or create a new one to get going."
                    actionLabel="Create New Table"
                    onAction={handleCreateTable}
                />
            )}

            {currentTable && (
                <FilterModal
                    isOpen={filterModalOpen}
                    columns={columns}
                    initialFilters={filters}
                    onApply={(newFilters) => {
                        setFilters(newFilters);
                        handleRunQuery(0, newFilters);
                    }}
                    onClose={() => setFilterModalOpen(false)}
                />
            )}
        </div>
    );
};

const EmptyState = ({ icon, title, body, actionLabel, onAction }: {
    icon: string;
    title: string;
    body: string;
    actionLabel: string;
    onAction: () => void;
}) => (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 bg-white text-center px-8 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-surface-50 border border-surface-200 flex items-center justify-center">
            <i className={`fa-solid fa-${icon} text-2xl text-accent-500`} />
        </div>
        <div className="max-w-md space-y-1.5">
            <h2 className="text-xl font-bold text-surface-900">{title}</h2>
            <p className="text-surface-500 text-[13px] leading-relaxed">{body}</p>
        </div>
        <button
            onClick={onAction}
            className="px-4 py-2 text-[13px] font-medium rounded-md bg-accent-600 text-white hover:bg-accent-700 transition-colors"
        >
            <i className="fa-solid fa-plus text-[11px] mr-1.5" />{actionLabel}
        </button>
    </div>
);

export default Table;
