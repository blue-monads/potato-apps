import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from 'react-router';
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
    deleteRow,
    upsertCell,
    type Datatable,
    type DatatableColumn,
    type DatatableRow,
} from "../../lib/api";
import EditRowModal from "./sub/EditRowModal";
import CreateRowModal from "./sub/CreateRowModal";
import CreateTableModal from "./sub/CreateTableModal";
import CreateColumnModal from "./sub/CreateColumnModal";
import EditColumnModal from "./sub/EditColumnModal";
import EditTableModal from "./sub/EditTableModal";
import { useModal } from "../../lib/shared/modal/modal";
import {
    CellValue,
    getCellValue,
    getTypeIcon,
    summarize,
    normalizeCells,
} from "./sub/columnTypes";

type SortState = { columnId: number; dir: 'asc' | 'desc' } | null;
type FilterOp = 'contains' | 'equals' | 'not_equals' | 'empty' | 'not_empty';
type FilterState = { columnId: number | null; op: FilterOp; value: string };

const EMPTY_FILTER: FilterState = { columnId: null, op: 'contains', value: '' };

const Table = () => {
    const { tableId } = useParams();
    const navigate = useNavigate();
    const { openModal, closeModal } = useModal();

    const [datatables, setDatatables] = useState<Datatable[]>([]);
    const [currentTable, setCurrentTable] = useState<Datatable | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(new Set());

    const [search, setSearch] = useState("");
    const [sort, setSort] = useState<SortState>(null);
    const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER);
    const [filterOpen, setFilterOpen] = useState(false);

    useEffect(() => {
        loadDatatables();
    }, []);

    useEffect(() => {
        setSelectedRowIds(new Set());
        setSearch("");
        setSort(null);
        setFilter(EMPTY_FILTER);
        setFilterOpen(false);

        if (tableId) {
            loadTable(parseInt(tableId));
        } else {
            setCurrentTable(null);
        }
    }, [tableId]);

    const loadDatatables = async () => {
        const response = await listDatatables();
        if (response.error) {
            console.error("Failed to load datatables:", response.error);
        } else {
            setDatatables(response.data || []);
        }
    };

    const loadTable = async (id: number) => {
        setLoading(true);
        const response = await getDatatable(id);
        if (response.error) {
            console.error("Failed to load table:", response.error);
        } else {
            const table = response.data;
            if (table) {
                table.columns = Array.isArray(table.columns) 
                    ? table.columns 
                    : (table.columns && typeof table.columns === 'object' ? Object.values(table.columns) as DatatableColumn[] : []);
                
                const rawRows: DatatableRow[] = Array.isArray(table.rows) 
                    ? table.rows 
                    : (table.rows && typeof table.rows === 'object' ? Object.values(table.rows) as DatatableRow[] : []);

                table.rows = rawRows.map((row: DatatableRow) => ({
                    ...row,
                    cells: normalizeCells(row.cells),
                }));
                setCurrentTable(table);
            } else {
                setCurrentTable(null);
            }
        }
        setLoading(false);
    };

    const columns = currentTable?.columns ?? [];
    const rows = currentTable?.rows ?? [];

    const visibleRows = useMemo(() => {
        const query = search.trim().toLowerCase();

        let result = rows.filter(row => {
            if (query) {
                const hit = columns.some(col =>
                    getCellValue(row, col.id).toLowerCase().includes(query)
                );
                if (!hit) return false;
            }

            if (filter.columnId !== null) {
                const cell = getCellValue(row, filter.columnId).toLowerCase();
                const needle = filter.value.trim().toLowerCase();

                if (filter.op === 'empty') return cell === '';
                if (filter.op === 'not_empty') return cell !== '';
                if (!needle) return true;
                if (filter.op === 'contains') return cell.includes(needle);
                if (filter.op === 'equals') return cell === needle;
                if (filter.op === 'not_equals') return cell !== needle;
            }

            return true;
        });

        if (sort) {
            const column = columns.find(c => c.id === sort.columnId);
            const numeric = column?.column_type === 'number';
            const factor = sort.dir === 'asc' ? 1 : -1;

            result = [...result].sort((a, b) => {
                const av = getCellValue(a, sort.columnId);
                const bv = getCellValue(b, sort.columnId);

                if (av === bv) return 0;
                if (av === '') return 1;
                if (bv === '') return -1;

                if (numeric) return ((Number(av) || 0) - (Number(bv) || 0)) * factor;
                return av.toLowerCase().localeCompare(bv.toLowerCase()) * factor;
            });
        }

        return result;
    }, [rows, columns, search, sort, filter]);

    const toggleRowSelection = (rowId: number) => {
        setSelectedRowIds(prev => {
            const next = new Set(prev);
            if (next.has(rowId)) next.delete(rowId);
            else next.add(rowId);
            return next;
        });
    };

    const toggleAllSelection = () => {
        if (selectedRowIds.size === visibleRows.length) {
            setSelectedRowIds(new Set());
        } else {
            setSelectedRowIds(new Set(visibleRows.map(r => r.id)));
        }
    };

    const cycleSort = (columnId: number) => {
        setSort(prev => {
            if (!prev || prev.columnId !== columnId) return { columnId, dir: 'asc' };
            if (prev.dir === 'asc') return { columnId, dir: 'desc' };
            return null;
        });
    };

    const handleBulkDelete = async () => {
        if (!selectedRowIds.size || !currentTable) return;
        if (!confirm(`Delete ${selectedRowIds.size} selected row(s)?`)) return;

        setLoading(true);
        for (const rowId of selectedRowIds) {
            await deleteRow(rowId);
        }
        await loadTable(currentTable.id);
        setSelectedRowIds(new Set());
    };

    const handleCreateTable = () => {
        openModal({
            title: "Create New Datatable",
            maxWidth: '620px',
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
                                    info: col.info || "",
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
                            setFilter(prev => (prev.columnId === column.id ? EMPTY_FILTER : prev));
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
                    onSave={async (cellUpdates) => {
                        for (const update of cellUpdates) {
                            await upsertCell({
                                table_id: currentTable.id,
                                row_id: row.id,
                                column_id: update.column_id,
                                value: update.value,
                            });
                        }
                        await loadTable(currentTable.id);
                        closeModal();
                    }}
                    onDelete={async () => {
                        if (!confirm("Delete this record?")) return;
                        const response = await deleteRow(row.id);
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
    const allVisibleSelected = visibleRows.length > 0 && selectedRowIds.size === visibleRows.length;

    return (
        <div className="h-screen flex flex-col bg-surface-50 overflow-hidden">

            {/* App header */}
            <header className="flex items-center justify-between gap-4 bg-surface-800 text-white px-4 py-2 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                    <i className="fa-solid fa-table-cells text-accent-400 text-sm" />
                    <span className="font-semibold text-[15px]">Simple Datatable</span>
                    {currentTable?.info && (
                        <span className="hidden md:inline text-[11px] text-surface-400 truncate max-w-md">
                            {currentTable.info}
                        </span>
                    )}
                </div>
                <span className="text-[12px] text-surface-400 shrink-0">
                    {selectedRowIds.size > 0
                        ? `${selectedRowIds.size} row${selectedRowIds.size === 1 ? '' : 's'} selected`
                        : `${rows.length} record${rows.length === 1 ? '' : 's'}`}
                </span>
            </header>

            {/* Table tabs */}
            <nav className="flex items-center gap-1 bg-surface-900 px-3 overflow-x-auto scrollbar-thin border-b border-surface-700 shrink-0">
                {datatables.map(table => {
                    const active = tableId === table.id.toString();
                    return (
                        <div
                            key={table.id}
                            onClick={() => navigate(`${BASE_PATH}table/${table.id}`)}
                            onDoubleClick={() => handleEditTable(table)}
                            className={`group flex items-center gap-2 px-3.5 py-2 text-[13px] rounded-t-md cursor-pointer whitespace-nowrap select-none border border-b-0 transition-colors ${
                                active
                                    ? 'bg-white text-accent-600 font-semibold border-surface-200'
                                    : 'text-surface-400 border-transparent hover:text-white hover:bg-surface-800'
                            }`}
                        >
                            <i className={`fa-solid fa-${table.icon || 'table'} text-[11px]`} />
                            <span>{table.name}</span>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleEditTable(table); }}
                                title="Table settings"
                                className={`w-4 h-4 rounded-full inline-flex items-center justify-center transition-opacity ${
                                    active
                                        ? 'text-surface-400 hover:text-surface-900 hover:bg-surface-200'
                                        : 'text-surface-500 hover:text-white opacity-0 group-hover:opacity-100'
                                }`}
                            >
                                <i className="fa-solid fa-gear text-[9px]" />
                            </button>
                        </div>
                    );
                })}
                <button
                    onClick={handleCreateTable}
                    className="px-2.5 py-1.5 my-1 text-surface-400 text-[13px] rounded hover:text-white hover:bg-surface-800 whitespace-nowrap transition-colors"
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
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md bg-accent-600 text-white hover:bg-accent-700 disabled:opacity-40 disabled:hover:bg-accent-600 transition-colors"
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
                                onClick={() => setFilterOpen(o => !o)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md border transition-colors ${
                                    filter.columnId !== null || filterOpen
                                        ? 'bg-accent-50 text-accent-700 border-accent-600'
                                        : 'bg-white border-surface-200 hover:bg-surface-50 hover:border-surface-300'
                                }`}
                            >
                                <i className="fa-solid fa-filter text-[11px]" />Filter
                            </button>
                            <button
                                onClick={() => (sort ? setSort(null) : columns[0] && cycleSort(columns[0].id))}
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
                            onClick={() => loadTable(currentTable.id)}
                            title="Refresh"
                            className="px-2.5 py-1.5 text-[13px] rounded-md border border-surface-200 text-surface-500 bg-white hover:bg-surface-50 hover:border-surface-300 transition-colors"
                        >
                            <i className={`fa-solid fa-rotate-right text-[11px] ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    {/* Filter panel */}
                    {filterOpen && (
                        <div className="flex items-center gap-2 flex-wrap bg-surface-50 border-b border-surface-200 px-4 py-2 text-[13px] shrink-0">
                            <span className="font-semibold text-surface-500">Where</span>
                            <select
                                value={filter.columnId ?? ''}
                                onChange={(e) => setFilter(f => ({
                                    ...f,
                                    columnId: e.target.value ? parseInt(e.target.value) : null,
                                }))}
                                className="px-2.5 py-1.5 bg-white border border-surface-200 rounded-md outline-none focus:border-accent-600 cursor-pointer"
                            >
                                <option value="">Select a field…</option>
                                {columns.map(col => (
                                    <option key={col.id} value={col.id}>{col.name}</option>
                                ))}
                            </select>
                            <select
                                value={filter.op}
                                onChange={(e) => setFilter(f => ({ ...f, op: e.target.value as FilterOp }))}
                                className="px-2.5 py-1.5 bg-white border border-surface-200 rounded-md outline-none focus:border-accent-600 cursor-pointer"
                            >
                                <option value="contains">contains</option>
                                <option value="equals">equals</option>
                                <option value="not_equals">does not equal</option>
                                <option value="empty">is empty</option>
                                <option value="not_empty">is not empty</option>
                            </select>
                            {filter.op !== 'empty' && filter.op !== 'not_empty' && (
                                <input
                                    type="text"
                                    value={filter.value}
                                    onChange={(e) => setFilter(f => ({ ...f, value: e.target.value }))}
                                    placeholder="Enter a value…"
                                    className="px-2.5 py-1.5 bg-white border border-surface-200 rounded-md outline-none focus:border-accent-600"
                                />
                            )}
                            <button
                                onClick={() => setFilter(EMPTY_FILTER)}
                                className="px-2.5 py-1 text-[12px] text-surface-500 rounded hover:bg-surface-200 transition-colors"
                            >
                                Clear
                            </button>
                            <span className="ml-auto text-[12px] text-surface-400">
                                {visibleRows.length} of {rows.length} shown
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
                        <div className="flex-1 overflow-auto scrollbar-thin bg-white">
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
                                                        <i className={`fa-solid fa-${getTypeIcon(col.column_type)} text-[10px] text-surface-400`} />
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
                                    {visibleRows.map((row, index) => {
                                        const selected = selectedRowIds.has(row.id);
                                        const stickyBg = selected
                                            ? 'bg-accent-50'
                                            : 'bg-white group-hover:bg-surface-100';
                                        return (
                                            <tr
                                                key={row.id}
                                                onClick={() => handleEditRow(row)}
                                                className={`group cursor-pointer ${selected ? 'bg-accent-50' : 'hover:bg-surface-100'}`}
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
                                                <td className={`sticky left-10 z-10 h-9 text-center text-[11px] text-surface-400 border-b border-r border-surface-200 transition-colors ${stickyBg}`}>
                                                    <span className="group-hover:hidden">{index + 1}</span>
                                                    <i className="fa-solid fa-up-right-and-down-left-from-center text-[10px] text-accent-600 hidden group-hover:inline" />
                                                </td>
                                                {columns.map(col => (
                                                    <td
                                                        key={col.id}
                                                        className="h-9 max-w-xs px-3 border-b border-r border-surface-200 overflow-hidden whitespace-nowrap"
                                                    >
                                                        <div className="flex items-center overflow-hidden">
                                                            <CellValue value={getCellValue(row, col.id)} column={col} />
                                                        </div>
                                                    </td>
                                                ))}
                                                <td className="h-9 border-b border-surface-200" />
                                            </tr>
                                        );
                                    })}

                                    {visibleRows.length === 0 && (
                                        <tr>
                                            <td colSpan={columns.length + 3} className="h-40 text-center text-surface-400">
                                                {rows.length === 0 ? (
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
                                                {summarize(col, visibleRows.map(r => getCellValue(r, col.id)))}
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
