import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, Search, Calendar, User, ArrowDownToLine, Layers } from 'lucide-react';
import { Link } from 'react-router';
import { listStockIn, deleteStockIn, type ProductStockIn } from '../../lib/api';
import { BASE_PATH } from '../../lib/base';

const ListStockIn = () => {
    const [stockins, setStockins] = useState<ProductStockIn[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const resp = await listStockIn();
            if (resp.status === 200) {
                setStockins(resp.data || []);
            } else {
                setError(resp.error || 'Failed to load stock in records');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load stock in records');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this Stock In record? Stock counts will be recalculated.')) {
            return;
        }
        try {
            const resp = await deleteStockIn(id);
            if (resp.status === 200) {
                await loadData();
            } else {
                alert(resp.error || 'Failed to delete stock in record');
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete stock in record');
        }
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return '—';
        try {
            return new Date(dateString).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            });
        } catch {
            return dateString;
        }
    };

    const filteredStockIns = stockins.filter(s => {
        const q = searchQuery.toLowerCase();
        if (s.vendor_name && s.vendor_name.toLowerCase().includes(q)) return true;
        if (s.vendor_alt_name && s.vendor_alt_name.toLowerCase().includes(q)) return true;
        if (s.reference_id && s.reference_id.toLowerCase().includes(q)) return true;
        if (s.info && s.info.toLowerCase().includes(q)) return true;
        if (s.lines && s.lines.some(l => 
            (l.product_name && l.product_name.toLowerCase().includes(q)) || 
            (l.variant_name && l.variant_name.toLowerCase().includes(q))
        )) return true;
        return false;
    });

    const totalReceipts = stockins.length;
    const totalUnits = stockins.reduce((sum, s) => {
        return sum + (s.lines ? s.lines.reduce((lSum, l) => lSum + (l.qty || 0), 0) : 0);
    }, 0);
    const totalValueCents = stockins.reduce((sum, s) => sum + (s.amount || 0), 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#F4F5F1]">
                <div className="text-stone-500 font-sans">Loading stock in records...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F4F5F1] p-6 lg:p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 font-display flex items-center gap-2.5">
                            <ArrowDownToLine className="w-7 h-7 text-[#2E6E52]" />
                            Stock In & Receiving
                        </h1>
                        <p className="text-stone-500 mt-1 text-sm">
                            Manage inventory shipments, vendor purchase receipts, and product variant stock levels
                        </p>
                    </div>
                    <Link
                        to={`${BASE_PATH}stockin/new`}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Record Stock In
                    </Link>
                </div>

                {/* Metrics Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white p-5 rounded-2xl border border-[#E1E3DB] shadow-xs">
                        <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">Total Receipts</span>
                        <span className="text-2xl font-black text-stone-900 font-display mt-1 block">{totalReceipts}</span>
                        <span className="text-xs text-stone-400 mt-1 block">Batches recorded</span>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-[#E1E3DB] shadow-xs">
                        <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">Total Units Received</span>
                        <span className="text-2xl font-black text-[#2E6E52] font-display mt-1 block">+{totalUnits}</span>
                        <span className="text-xs text-stone-400 mt-1 block">Across all products & variants</span>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-[#E1E3DB] shadow-xs">
                        <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">Total Received Value</span>
                        <span className="text-2xl font-black text-stone-900 font-display mt-1 block">
                            ${(totalValueCents / 100).toFixed(2)}
                        </span>
                        <span className="text-xs text-stone-400 mt-1 block">Cumulative purchase amount</span>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
                        {error}
                    </div>
                )}

                {/* Search Bar */}
                <div className="mb-4">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                        <input
                            type="text"
                            placeholder="Search by vendor, reference #, product or variant..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-[#E1E3DB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6E52] text-stone-900 placeholder-stone-400 shadow-xs"
                        />
                    </div>
                </div>

                {/* Stock In List Table */}
                <div className="bg-white rounded-2xl border border-[#E1E3DB] shadow-xs overflow-hidden">
                    {filteredStockIns.length === 0 ? (
                        <div className="text-center py-16 px-4">
                            <div className="w-12 h-12 rounded-full bg-[#EAF3EE] text-[#2E6E52] flex items-center justify-center mx-auto mb-3">
                                <ArrowDownToLine className="w-6 h-6" />
                            </div>
                            <h3 className="text-base font-bold text-stone-900 font-display">No stock in records found</h3>
                            <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1 mb-5">
                                {searchQuery ? 'Try adjusting your search criteria.' : 'Start recording incoming stock shipments from your suppliers.'}
                            </p>
                            {!searchQuery && (
                                <Link
                                    to={`${BASE_PATH}stockin/new`}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Record First Stock In
                                </Link>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#FAFBF9] border-b border-[#E1E3DB] text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                                        <th className="px-5 py-3.5">ID / Date</th>
                                        <th className="px-5 py-3.5">Vendor / Supplier</th>
                                        <th className="px-5 py-3.5">Reference / Notes</th>
                                        <th className="px-5 py-3.5">Received Items</th>
                                        <th className="px-5 py-3.5">Total Quantity</th>
                                        <th className="px-5 py-3.5">Total Value</th>
                                        <th className="px-5 py-3.5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#E1E3DB] text-sm text-stone-900">
                                    {filteredStockIns.map((s) => {
                                        const lineCount = s.lines ? s.lines.length : 0;
                                        const batchUnits = s.lines ? s.lines.reduce((sum, l) => sum + (l.qty || 0), 0) : 0;

                                        return (
                                            <tr key={s.id} className="hover:bg-stone-50/60 transition-colors">
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <div className="font-bold text-stone-900">#{s.id}</div>
                                                    <div className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                                                        <Calendar className="w-3 h-3 text-stone-400" />
                                                        {formatDate(s.stockin_date || s.created_at)}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    {(s.vendor_name || s.vendor_alt_name) ? (
                                                        <div className="font-semibold text-stone-900 flex items-center gap-1.5">
                                                            <User className="w-3.5 h-3.5 text-stone-400" />
                                                            {s.vendor_name || s.vendor_alt_name}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-stone-400 italic">No vendor specified</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 max-w-xs truncate">
                                                    {s.reference_id && (
                                                        <span className="inline-block px-2 py-0.5 bg-stone-100 text-stone-700 rounded text-xs font-mono font-medium mr-2">
                                                            {s.reference_id}
                                                        </span>
                                                    )}
                                                    <span className="text-xs text-stone-600">
                                                        {s.info || '—'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        {s.lines && s.lines.slice(0, 3).map((l, lIdx) => (
                                                            <div key={lIdx} className="text-xs text-stone-700 flex items-center gap-1.5">
                                                                <span className="font-medium text-stone-900">{l.product_name}</span>
                                                                {l.variant_name && (
                                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-medium bg-[#EAF3EE] text-[#2E6E52] border border-[#2E6E52]/20">
                                                                        <Layers className="w-2.5 h-2.5" />
                                                                        {l.variant_name}
                                                                    </span>
                                                                )}
                                                                <span className="text-stone-400 text-[11px]">× {l.qty}</span>
                                                            </div>
                                                        ))}
                                                        {lineCount > 3 && (
                                                            <span className="text-[11px] text-stone-400 font-medium">
                                                                +{lineCount - 3} more items
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <span className="inline-block px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                        +{batchUnits} units
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap font-bold text-stone-900">
                                                    ${(s.amount / 100).toFixed(2)}
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <Link
                                                            to={`${BASE_PATH}stockin/${s.id}/edit`}
                                                            className="p-1.5 text-stone-500 hover:text-[#2E6E52] hover:bg-[#EEF0EA] rounded-lg transition-colors"
                                                            title="Edit Stock In"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(s.id)}
                                                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Delete Stock In"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ListStockIn;
