import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from 'react-router';
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

const PILL_COLORS = [
    { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
    { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
    { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
    { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
];

const getColorForString = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % PILL_COLORS.length;
    return PILL_COLORS[index];
};

const Table = () => {
    const { tableId } = useParams();
    const navigate = useNavigate();
    const { openModal, closeModal } = useModal();

    const [datatables, setDatatables] = useState<Datatable[]>([]);
    const [currentTable, setCurrentTable] = useState<Datatable | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        loadDatatables();
    }, []);

    useEffect(() => {
        if (tableId) {
            loadTable(parseInt(tableId));
            setSelectedRowIds(new Set());
        } else {
            setCurrentTable(null);
        }
    }, [tableId]);

    const toggleRowSelection = (rowId: number) => {
        setSelectedRowIds(prev => {
            const next = new Set(prev);
            if (next.has(rowId)) {
                next.delete(rowId);
            } else {
                next.add(rowId);
            }
            return next;
        });
    };

    const toggleAllSelection = () => {
        if (!currentTable?.rows) return;
        
        if (selectedRowIds.size === currentTable.rows.length) {
            setSelectedRowIds(new Set());
        } else {
            setSelectedRowIds(new Set(currentTable.rows.map(r => r.id)));
        }
    };

    const handleBulkDelete = async () => {
        if (!selectedRowIds.size || !currentTable) return;
        if (!confirm(`Are you sure you want to delete ${selectedRowIds.size} selected row(s)?`)) return;

        setLoading(true);
        for (const rowId of selectedRowIds) {
            await deleteRow(rowId);
        }
        await loadTable(currentTable.id);
        setSelectedRowIds(new Set());
        setLoading(false);
    };

    const loadDatatables = async () => {
        setLoading(true);
        const response = await listDatatables();
        if (response.error) {
            console.error("Failed to load datatables:", response.error);
        } else {
            setDatatables(response.data || []);
        }
        setLoading(false);
    };

    const loadTable = async (id: number) => {
        setLoading(true);
        const response = await getDatatable(id);
        if (response.error) {
            console.error("Failed to load table:", response.error);
        } else {
            const table = response.data;
            if (table) {
                // Normalize rows to always be an array
                if (!Array.isArray(table.rows)) {
                    table.rows = [];
                }
                // Normalize cells to always be arrays
                table.rows = table.rows.map(row => ({
                    ...row,
                    cells: Array.isArray(row.cells) ? row.cells : []
                }));
                // Normalize columns to always be an array
                if (!Array.isArray(table.columns)) {
                    table.columns = [];
                }
                setCurrentTable(table);
            } else {
                setCurrentTable(null);
            }
        }
        setLoading(false);
    };

    const handleCreateTable = () => {
        openModal({
            title: "Create New Datatable",
            content: (
                <CreateTableModal
                    onSave={async (data, templateColumns) => {
                        const response = await createDatatable(data);
                        if (!response.error && response.data) {
                            // Create columns if template was selected
                            if (templateColumns && templateColumns.length > 0) {
                                for (const col of templateColumns) {
                                    await createColumn({
                                        table_id: response.data.id,
                                        name: col.name,
                                        column_type: col.column_type,
                                        info: col.info || "",
                                    });
                                }
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
            title: "Edit Datatable",
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
                        if (confirm("Are you sure you want to delete this table?")) {
                            const response = await deleteDatatable(table.id);
                            if (!response.error) {
                                await loadDatatables();
                                navigate(`${BASE_PATH}table`);
                                closeModal();
                            } else {
                                alert("Failed to delete table: " + response.error);
                            }
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
            title: "Create New Column",
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
        openModal({
            title: "Edit Column",
            content: (
                <EditColumnModal
                    column={column}
                    onSave={async (data) => {
                        const response = await updateColumn(column.id, data);
                        if (!response.error) {
                            await loadTable(currentTable!.id);
                            closeModal();
                        } else {
                            alert("Failed to update column: " + response.error);
                        }
                    }}
                    onDelete={async () => {
                        if (confirm("Are you sure you want to delete this column?")) {
                            const response = await deleteColumn(column.id);
                            if (!response.error) {
                                await loadTable(currentTable!.id);
                                closeModal();
                            } else {
                                alert("Failed to delete column: " + response.error);
                            }
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
            title: "Create New Row",
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
            title: "Edit Row",
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
                        if (confirm("Are you sure you want to delete this row?")) {
                            const response = await deleteRow(row.id);
                            if (!response.error) {
                                await loadTable(currentTable.id);
                                closeModal();
                            } else {
                                alert("Failed to delete row: " + response.error);
                            }
                        }
                    }}
                    onCancel={closeModal}
                />
            ),
        });
    };

    const getCellValue = (row: DatatableRow, columnId: number): string => {
        if (!row.cells || !Array.isArray(row.cells)) {
            return "";
        }
        const cell = row.cells.find(c => c.column_id === columnId);
        return cell?.value || "";
    };

    const renderCellValue = (value: string, type: string) => {
        if (!value) return <span className="text-surface-300 italic text-[11px]">None</span>;

        if (type === 'dropdown' || type === 'multiselect' || type === 'radio') {
            const values = type === 'multiselect' ? value.split(',').map(v => v.trim()) : [value];
            return (
                <div className="flex flex-wrap gap-1.5">
                    {values.map((v, i) => {
                        const colors = getColorForString(v);
                        return (
                            <span 
                                key={i} 
                                className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${colors.bg} ${colors.text} ${colors.border} shadow-sm`}
                            >
                                {v}
                            </span>
                        );
                    })}
                </div>
            );
        }

        if (type === 'boolean' || type === 'checkbox') {
            const isTrue = value.toLowerCase() === 'true' || value === '1';
            return (
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold border ${
                    isTrue 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-surface-50 text-surface-500 border-surface-200'
                }`}>
                    <i className={`fa-solid fa-${isTrue ? 'check-circle' : 'circle-xmark'}`}></i>
                    {isTrue ? 'TRUE' : 'FALSE'}
                </span>
            );
        }

        if (type === 'date') {
            return (
                <span className="flex items-center gap-1.5 text-surface-600">
                    <i className="fa-solid fa-calendar text-[10px] text-surface-400"></i>
                    {value}
                </span>
            );
        }

        if (type === 'number') {
            return (
                <span className="font-mono text-accent-700 font-medium">
                    {value}
                </span>
            );
        }

        return <span className="text-surface-900">{value}</span>;
    };

    if (loading && !currentTable) {
        return (
            <div className="flex min-h-screen bg-gray-50">
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-lg">Loading...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-white">
            <aside className="fixed left-0 top-0 h-full w-64 bg-[#f9fafb] text-surface-900 flex flex-col border-r border-surface-200">
                <div className="p-4">
                    <h1 className="text-base font-bold text-surface-900 uppercase">SIMPLE Datatable</h1>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    <button
                        onClick={handleCreateTable}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded border border-surface-300 bg-white text-surface-700 hover:bg-surface-50 text-sm font-bold mb-6 transition-all active:scale-[0.98] shadow-sm"
                    >
                        <i className="fa-solid fa-plus text-xs text-accent-600"></i>
                        <span>New Table</span>
                    </button>

                    {datatables.map((table) => {
                        const Icon = <i className={`fa-solid fa-${table.icon || 'table'} text-xs`}></i>;
                        const path = `${BASE_PATH}table/${table.id}`;
                        const active = tableId === table.id.toString();
                        return (
                            <div key={table.id} className="group relative">
                                <Link
                                    to={path}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-md transition-all text-sm ${
                                        active
                                            ? 'bg-blue-600 text-white font-bold'
                                            : 'text-surface-700'
                                    }`}
                                >
                                    <span className={`w-4 flex justify-center ${active ? 'text-white' : 'text-surface-700'}`}>
                                        {Icon}
                                    </span>
                                    <span className="flex-1 truncate">{table.name}</span>
                                </Link>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        handleEditTable(table);
                                    }}
                                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-black/5 text-current opacity-0 group-hover:opacity-100 transition-all ${
                                        active ? 'text-white' : 'text-surface-400'
                                    }`}
                                >
                                    <i className="fa-solid fa-gear text-[10px]"></i>
                                </button>
                            </div>
                        );
                    })}
                </nav>
            </aside>

            <main className="flex-1 ml-64 min-w-0 bg-white">
                {currentTable ? (
                    <div className="p-4 animate-fade-in">
                        <div className="flex items-center justify-between mb-10 border-b border-surface-100 pb-8">
                            <div className="min-w-0">
                                <div className="flex items-center gap-4 mb-2">
                                    <div className="w-10 h-10 bg-surface-50 border border-surface-200 rounded flex items-center justify-center">
                                        <i className={`fa-solid fa-${currentTable.icon || 'table'} text-accent-600 text-lg`}></i>
                                    </div>
                                    <h2 className="text-3xl font-black text-surface-900 tracking-tight truncate">{currentTable.name}</h2>
                                    {selectedRowIds.size > 0 && (
                                        <div className="flex items-center gap-2 px-3 py-1 bg-accent-50 text-accent-700 rounded-full border border-accent-200 animate-slide-in">
                                            <span className="text-[11px] font-black">{selectedRowIds.size} SELECTED</span>
                                            <button 
                                                onClick={handleBulkDelete}
                                                className="text-[10px] bg-coral-500 text-white px-2 py-0.5 rounded hover:bg-coral-600 transition-colors"
                                            >
                                                DELETE
                                            </button>
                                            <button 
                                                onClick={() => setSelectedRowIds(new Set())}
                                                className="text-accent-400 hover:text-accent-600"
                                            >
                                                <i className="fa-solid fa-xmark text-[10px]"></i>
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {currentTable.info && (
                                    <p className="text-surface-500 text-base max-w-3xl leading-relaxed">{currentTable.info}</p>
                                )}
                            </div>
                            <div className="flex gap-3 items-center">
                                <button
                                    onClick={handleCreateColumn}
                                    className="px-4 py-2 bg-white border border-surface-300 text-surface-700 rounded hover:bg-surface-50 transition-all text-sm font-bold flex items-center gap-2 active:scale-95 shadow-sm"
                                >
                                    <i className="fa-solid fa-columns text-xs text-accent-600"></i>Add Column
                                </button>
                                <button
                                    onClick={handleCreateRow}
                                    className="px-4 py-2 bg-white border border-surface-300 text-surface-700 rounded hover:bg-surface-50 transition-all text-sm font-bold flex items-center gap-2 active:scale-95 shadow-sm"
                                >
                                    <i className="fa-solid fa-plus text-xs"></i>Add Row
                                </button>
                            </div>
                        </div>

                        {currentTable.columns && currentTable.columns.length > 0 ? (
                            <div className="border border-surface-200 rounded shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
                                <div className="overflow-x-auto scrollbar-thin">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-surface-50 border-b border-surface-200">
                                                <th className="w-10 px-5 py-3.5 border-r border-surface-200 bg-surface-50/80">
                                                    <div className="flex items-center justify-center">
                                                        <input 
                                                            type="checkbox" 
                                                            className="w-4 h-4 rounded border-surface-300 text-accent-600 focus:ring-accent-500 cursor-pointer"
                                                            checked={currentTable.rows && currentTable.rows.length > 0 && selectedRowIds.size === currentTable.rows.length}
                                                            onChange={toggleAllSelection}
                                                        />
                                                    </div>
                                                </th>
                                                {currentTable.columns.map((column) => (
                                                    <th
                                                        key={column.id}
                                                        className="px-5 py-3.5 text-[11px] font-black text-surface-500 uppercase border-r border-surface-200 last:border-r-0 hover:bg-surface-100 transition-colors cursor-pointer group whitespace-nowrap min-w-20"
                                                        onClick={() => handleEditColumn(column)}
                                                    >
                                                        <div className="flex items-center justify-between gap-3 min-w-48">
                                                            <div className="flex items-center gap-2.5">
                                                                <div className="w-5 h-5 rounded bg-white border border-surface-200 flex items-center justify-center shadow-sm">
                                                                    <i className={`fa-solid fa-${column.column_type === 'text' ? 'text-width' : column.column_type === 'number' ? 'hashtag' : column.column_type === 'date' ? 'calendar' : 'tag'} text-[9px] text-accent-600`}></i>
                                                                </div>
                                                                <span>{column.name}</span>
                                                            </div>
                                                            <i className="fa-solid fa-pencil text-[9px] opacity-0 group-hover:opacity-100 text-accent-400 transition-opacity"></i>
                                                        </div>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-surface-100">
                                            {currentTable.rows && currentTable.rows.length > 0 ? (
                                                currentTable.rows.map((row) => (
                                                    <tr 
                                                        key={row.id} 
                                                        className={`transition-colors group cursor-pointer ${selectedRowIds.has(row.id) ? 'bg-accent-50/40' : 'hover:bg-accent-50/20'}`}
                                                        onClick={() => handleEditRow(row)}
                                                    >
                                                        <td 
                                                            className="px-5 py-4 border-r border-surface-50 text-center"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <div className="flex items-center justify-center">
                                                                <input 
                                                                    type="checkbox" 
                                                                    className="w-4 h-4 rounded border-surface-300 text-accent-600 focus:ring-accent-500 cursor-pointer"
                                                                    checked={selectedRowIds.has(row.id)}
                                                                    onChange={() => toggleRowSelection(row.id)}
                                                                />
                                                            </div>
                                                        </td>
                                                        {currentTable.columns!.map((column) => {
                                                            const value = getCellValue(row, column.id);
                                                            return (
                                                                <td
                                                                    key={column.id}
                                                                    className="px-5 py-4 text-sm border-r border-surface-50 last:border-r-0"
                                                                >
                                                                    {renderCellValue(value, column.column_type)}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td
                                                        colSpan={(currentTable.columns?.length || 0) + 1}
                                                        className="px-6 py-24 text-center bg-surface-50/30"
                                                    >
                                                        <div className="flex flex-col items-center gap-4 max-w-sm mx-auto">
                                                            <div className="w-16 h-16 bg-white rounded-full border border-surface-200 flex items-center justify-center shadow-sm">
                                                                <i className="fa-solid fa-folder-open text-surface-200 text-2xl"></i>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <p className="text-base font-bold text-surface-900">No records found</p>
                                                                <p className="text-sm text-surface-500">Get started by creating your first entry in this table.</p>
                                                            </div>
                                                            <button
                                                                onClick={handleCreateRow}
                                                                className="px-6 py-2 bg-blue-600 text-white rounded font-bold text-sm hover:bg-blue-700 transition-all shadow-sm"
                                                            >
                                                                Add First Row
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="border border-dashed border-surface-300 rounded-lg p-20 text-center bg-surface-50/20">
                                <div className="max-w-md mx-auto space-y-6">
                                    <div className="w-20 h-20 bg-white rounded-2xl border border-surface-200 flex items-center justify-center mx-auto shadow-md rotate-3">
                                        <i className="fa-solid fa-table-columns text-accent-500 text-3xl"></i>
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-2xl font-black text-surface-900 tracking-tight">Setup your data schema</h3>
                                        <p className="text-surface-500 text-base">To start collecting data, you first need to define your columns. You can add text, numbers, dates, and more.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-10 animate-fade-in bg-white">
                        <div className="relative">
                            <div className="absolute -inset-4 bg-accent-500/10 blur-3xl rounded-full"></div>
                            <div className="relative w-24 h-24 bg-surface-50 rounded-3xl flex items-center justify-center border border-surface-200 rotate-6 shadow-sm">
                                <i className="fa-solid fa-cubes text-5xl text-accent-500"></i>
                            </div>
                        </div>
                        <div className="max-w-xl space-y-4">
                            <h2 className="text-4xl font-black text-surface-900 tracking-tight">Your Data, Simplified.</h2>
                            <p className="text-surface-500 text-lg leading-relaxed font-medium">Select a dataset from the left workspace to begin exploring, or create a brand new table to start your next big project.</p>
                        </div>
                        <button
                            onClick={handleCreateTable}
                            className="px-10 py-4 rounded border border-surface-300 bg-white text-surface-700 hover:bg-surface-50 text-sm font-bold mb-6 transition-all active:scale-[0.98]"
                        >
                            <i className="fa-solid fa-plus"></i>Create New Table
                        </button>
                        
                        
                    </div>
                )}
            </main>
        </div>
    );
};







export default Table;
