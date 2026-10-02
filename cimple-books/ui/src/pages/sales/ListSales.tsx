import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, CheckCircle, CreditCard, Ban, RefreshCw, X, Search, Filter, ArrowUpDown } from 'lucide-react';
import { Link } from 'react-router';
import { 
    listSales, 
    deleteSale, 
    confirmSale, 
    registerSalePayment, 
    cancelSale, 
    listAccounts, 
    getSettings, 
    getCurrencySymbol, 
    type Sale, 
    type Account 
} from '../../lib/api';
import { BASE_PATH } from '../../lib/base';
import { Pagination } from '../../components/Pagination';

const ListSales = () => {
    const [sales, setSales] = useState<Sale[]>([]);
    const [assetAccounts, setAssetAccounts] = useState<Account[]>([]);
    const [defaultPaymentAccId, setDefaultPaymentAccId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter and search states (server-side)
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [salesStatusFilter, setSalesStatusFilter] = useState('all');
    const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
    const [sortBy, setSortBy] = useState('date_desc');

    // Pagination state (server-side)
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(15);
    const [totalCount, setTotalCount] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(1);

    // Register Payment modal state
    const [paymentModalSale, setPaymentModalSale] = useState<Sale | null>(null);
    const [selectedPaymentAccId, setSelectedPaymentAccId] = useState<number | null>(null);
    const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
    const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 280);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Reset page to 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch, salesStatusFilter, paymentStatusFilter, sortBy]);

    // Load initial accounts and settings
    useEffect(() => {
        listAccounts().then((accResp) => {
            if (accResp.status === 200 && Array.isArray(accResp.data)) {
                setAssetAccounts(accResp.data.filter(a => !a.is_deleted && a.acc_type === 'assets'));
            }
        });
        getSettings().then((setResp) => {
            if (setResp.status === 200 && setResp.data?.default_payment_account_id) {
                setDefaultPaymentAccId(setResp.data.default_payment_account_id);
            }
        });
    }, []);

    const loadSales = async () => {
        setLoading(true);
        setError(null);
        try {
            const resp = await listSales({
                page: currentPage,
                pageSize,
                search: debouncedSearch,
                salesStatus: salesStatusFilter,
                paymentStatus: paymentStatusFilter,
                sortBy,
            });

            if (resp.status === 200 && resp.data) {
                setSales(resp.data.items || []);
                setTotalCount(resp.data.total || 0);
                setTotalPages(resp.data.total_pages || 1);
            } else {
                setError(resp.error || 'Failed to load sales');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSales();
    }, [currentPage, pageSize, debouncedSearch, salesStatusFilter, paymentStatusFilter, sortBy]);

    const handleConfirm = async (sale: Sale) => {
        if (!confirm(`Confirm sale #${sale.id}? Journal transactions will be recorded.`)) {
            return;
        }
        setActionLoadingId(sale.id);
        try {
            const resp = await confirmSale(sale.id);
            if (resp.status === 200) {
                await loadSales();
            } else {
                alert(resp.error || 'Failed to confirm sale');
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to confirm sale');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleCancel = async (sale: Sale) => {
        const isConfirmed = sale.sales_status === 'confirmed';
        const isScrapped = sale.sales_status === 'scrapped';
        const msg = isScrapped
            ? `Cancel scrap #${sale.id}? The inventory write-off will be reversed and stock restored.`
            : (isConfirmed
                ? `Cancel sale #${sale.id}? All associated journal transactions will be reversed (marked deleted).`
                : `Cancel draft sale #${sale.id}?`);
        if (!confirm(msg)) {
            return;
        }
        setActionLoadingId(sale.id);
        try {
            const resp = await cancelSale(sale.id);
            if (resp.status === 200) {
                await loadSales();
            } else {
                alert(resp.error || 'Failed to cancel sale');
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to cancel sale');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleOpenPaymentModal = (sale: Sale) => {
        setPaymentModalSale(sale);
        setSelectedPaymentAccId(defaultPaymentAccId || (assetAccounts.length > 0 ? assetAccounts[0].id : null));
        setPaymentDate(new Date().toISOString().slice(0, 10));
    };

    const handleRegisterPaymentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!paymentModalSale) return;
        setActionLoadingId(paymentModalSale.id);
        try {
            const resp = await registerSalePayment(paymentModalSale.id, {
                account_id: selectedPaymentAccId,
                payment_date: paymentDate
            });
            if (resp.status === 200) {
                setPaymentModalSale(null);
                await loadSales();
            } else {
                alert(resp.error || 'Failed to register payment');
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to register payment');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this sale? Any linked transactions will also be removed.')) {
            return;
        }
        try {
            const resp = await deleteSale(id);
            if (resp.status === 200) {
                await loadSales();
            } else {
                alert(resp.error || 'Failed to delete sale');
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete sale');
        }
    };

    const formatCurrency = (amount: number) => {
        return (amount / 100).toFixed(2);
    };

    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleDateString();
        } catch {
            return dateString;
        }
    };

    const getPaymentStatusColor = (status: string) => {
        switch (status) {
            case 'paid':
                return 'bg-green-100 text-green-800';
            case 'partially_paid':
                return 'bg-yellow-100 text-yellow-800';
            case 'unpaid':
                return 'bg-red-100 text-red-800';
            case 'refunded':
                return 'bg-gray-100 text-gray-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const cs = getCurrencySymbol();

    return (
        <div className="min-h-screen bg-[#F4F5F1] p-6 lg:p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 font-display">Sales & Invoices</h1>
                        <p className="text-stone-500 mt-1 text-sm">Create and manage sales orders, billing, and invoices</p>
                    </div>
                    <Link
                        to={`${BASE_PATH}sales/new`}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg text-sm font-semibold transition-colors shadow-sm cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        New Sale
                    </Link>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                        {error}
                    </div>
                )}

                {/* Filter and Search Bar */}
                <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search sales by title, ID, client, or notes..."
                            className="w-full pl-9 pr-9 py-2 bg-white border border-[#E1E3DB] rounded-lg text-sm placeholder-stone-400 focus:outline-hidden focus:border-[#2E6E52] focus:ring-1 focus:ring-[#2E6E52] transition-colors"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Sales Status Filter */}
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-stone-400 hidden sm:block" />
                        <select
                            value={salesStatusFilter}
                            onChange={(e) => setSalesStatusFilter(e.target.value)}
                            className="bg-white border border-[#E1E3DB] rounded-lg px-3 py-2 text-sm font-medium text-stone-800 focus:outline-hidden focus:border-[#2E6E52] cursor-pointer"
                        >
                            <option value="all">All Sales Statuses</option>
                            <option value="draft">Draft</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="scrapped">Scrapped</option>
                        </select>
                    </div>

                    {/* Payment Status Filter */}
                    <div className="flex items-center gap-2">
                        <select
                            value={paymentStatusFilter}
                            onChange={(e) => setPaymentStatusFilter(e.target.value)}
                            className="bg-white border border-[#E1E3DB] rounded-lg px-3 py-2 text-sm font-medium text-stone-800 focus:outline-hidden focus:border-[#2E6E52] cursor-pointer"
                        >
                            <option value="all">All Payment Statuses</option>
                            <option value="unpaid">Unpaid</option>
                            <option value="partially_paid">Partially Paid</option>
                            <option value="paid">Paid</option>
                        </select>
                    </div>

                    {/* Sort By */}
                    <div className="flex items-center gap-2">
                        <ArrowUpDown className="w-4 h-4 text-stone-400 hidden sm:block" />
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="bg-white border border-[#E1E3DB] rounded-lg px-3 py-2 text-sm font-medium text-stone-800 focus:outline-hidden focus:border-[#2E6E52] cursor-pointer"
                        >
                            <option value="date_desc">Date: Newest</option>
                            <option value="date_asc">Date: Oldest</option>
                            <option value="amount_desc">Amount: High → Low</option>
                            <option value="amount_asc">Amount: Low → High</option>
                        </select>
                    </div>
                </div>

                {/* Sales Table */}
                <div className="bg-white rounded-xl border border-[#E1E3DB] shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-[#E1E3DB]">
                            <thead className="bg-[#F8F9F6]">
                                <tr>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                                        ID
                                    </th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                                        Title
                                    </th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                                        Client
                                    </th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                                        Date
                                    </th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                                        Total
                                    </th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                                        Payment
                                    </th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-stone-600 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-[#E1E3DB]">
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center text-stone-500 animate-pulse">
                                            Loading sales...
                                        </td>
                                    </tr>
                                ) : sales.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center text-stone-500">
                                            {debouncedSearch || salesStatusFilter !== 'all' || paymentStatusFilter !== 'all'
                                                ? 'No sales match the current filters.'
                                                : 'No sales found. Create your first sale to get started.'}
                                        </td>
                                    </tr>
                                ) : (
                                    sales.map((sale) => {
                                        const isActionLoading = actionLoadingId === sale.id;
                                        return (
                                        <tr key={sale.id} className="hover:bg-[#FAFBF9] transition-colors">
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-stone-500">
                                                #{sale.id}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-stone-900">
                                                <div className="flex items-center gap-2">
                                                    <span>{sale.title || 'Untitled Sale'}</span>
                                                    {sale.sales_status === 'scrapped' && (
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300">
                                                            SCRAP
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-stone-600">
                                                {sale.client_name || '-'}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-stone-500">
                                                {formatDate(sale.sales_date)}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-stone-900">
                                                {cs}{formatCurrency(sale.total)}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <span
                                                    className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full ${getPaymentStatusColor(
                                                        sale.payment_status
                                                    )}`}
                                                >
                                                    {sale.payment_status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <span
                                                    className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                                                        sale.sales_status === 'confirmed'
                                                            ? 'bg-blue-100 text-blue-800'
                                                            : sale.sales_status === 'cancelled'
                                                            ? 'bg-stone-200 text-stone-700'
                                                            : sale.sales_status === 'scrapped'
                                                            ? 'bg-amber-100 text-amber-800'
                                                            : 'bg-yellow-100 text-yellow-800'
                                                    }`}
                                                >
                                                    {sale.sales_status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end gap-1">
                                                    {isActionLoading ? (
                                                        <div className="p-1.5 text-stone-400">
                                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {/* Register Payment button - when confirmed and not fully paid */}
                                                            {sale.sales_status === 'confirmed' && sale.payment_status !== 'paid' && (
                                                                <button
                                                                    onClick={() => handleOpenPaymentModal(sale)}
                                                                    className="text-stone-600 hover:text-[#2E6E52] p-1.5 hover:bg-[#EEF0EA] rounded-lg transition-colors cursor-pointer"
                                                                    title="Register Payment"
                                                                >
                                                                    <CreditCard className="w-4 h-4 text-[#2E6E52]" />
                                                                </button>
                                                            )}

                                                            {/* Confirm sale - when draft */}
                                                            {sale.sales_status === 'draft' && (
                                                                <button
                                                                    onClick={() => handleConfirm(sale)}
                                                                    className="text-stone-600 hover:text-[#2E6E52] p-1.5 hover:bg-[#EEF0EA] rounded-lg transition-colors cursor-pointer"
                                                                    title="Confirm sale & record transactions"
                                                                >
                                                                    <CheckCircle className="w-4 h-4 text-[#2E6E52]" />
                                                                </button>
                                                            )}

                                                            {/* Edit - only if draft */}
                                                            {sale.sales_status === 'draft' && (
                                                                <Link
                                                                    to={`${BASE_PATH}sales/${sale.id}/edit`}
                                                                    className="text-stone-600 hover:text-[#2E6E52] p-1.5 hover:bg-[#EEF0EA] rounded-lg transition-colors cursor-pointer"
                                                                    title="Edit sale"
                                                                >
                                                                    <Edit className="w-4 h-4" />
                                                                </Link>
                                                            )}

                                                            {/* Cancel - if confirmed or draft */}
                                                            {sale.sales_status !== 'cancelled' && (
                                                                <button
                                                                    onClick={() => handleCancel(sale)}
                                                                    className="text-stone-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                                                    title={sale.sales_status === 'scrapped' ? 'Cancel scrap & restore inventory' : 'Cancel sale & reverse journal transactions'}
                                                                >
                                                                    <Ban className="w-4 h-4 text-rose-500" />
                                                                </button>
                                                            )}

                                                            {/* Delete */}
                                                            <button
                                                                onClick={() => handleDelete(sale.id)}
                                                                className="text-stone-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                                title="Delete sale"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Server-side Pagination */}
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalCount={totalCount}
                        pageSize={pageSize}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={(newSize) => {
                            setPageSize(newSize);
                            setCurrentPage(1);
                        }}
                        itemLabel="sales"
                    />
                </div>
            </div>

            {/* Register Payment Modal */}
            {paymentModalSale && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
                    <div className="bg-white rounded-xl shadow-xl border border-[#E1E3DB] max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E1E3DB] bg-[#F8F9F6]">
                            <div className="flex items-center gap-2 text-stone-900 font-semibold">
                                <CreditCard className="w-5 h-5 text-[#2E6E52]" />
                                <span>Register Payment</span>
                            </div>
                            <button
                                onClick={() => setPaymentModalSale(null)}
                                className="text-stone-400 hover:text-stone-600 p-1 rounded-md hover:bg-stone-100 transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleRegisterPaymentSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
                                    Sale
                                </label>
                                <div className="text-sm font-semibold text-stone-900">
                                    #{paymentModalSale.id} - {paymentModalSale.title || 'Untitled Sale'}
                                </div>
                            </div>

                            <div className="p-3 bg-[#F4F5F1] rounded-lg flex items-center justify-between">
                                <span className="text-sm font-medium text-stone-700">Amount Due:</span>
                                <span className="text-lg font-bold text-[#2E6E52]">
                                    {cs}{formatCurrency(paymentModalSale.total)}
                                </span>
                            </div>

                            <div>
                                <label htmlFor="payment_account_select" className="block text-sm font-medium text-stone-700 mb-1">
                                    Payment Account (Asset)
                                </label>
                                <select
                                    id="payment_account_select"
                                    value={selectedPaymentAccId ?? ''}
                                    onChange={(e) => setSelectedPaymentAccId(e.target.value ? Number(e.target.value) : null)}
                                    className="w-full px-3.5 py-2.5 border border-[#D5D7CE] rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-[#2E6E52] bg-white text-stone-900 cursor-pointer"
                                    required
                                >
                                    <option value="">-- Select Payment Asset Account --</option>
                                    {assetAccounts.map((acc) => (
                                        <option key={acc.id} value={acc.id}>
                                            {acc.name} {acc.info ? `(${acc.info})` : ''}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-stone-500 mt-1">
                                    Select the asset account debited for receiving this payment (Cash / Bank).
                                </p>
                            </div>

                            <div>
                                <label htmlFor="payment_date_input" className="block text-sm font-medium text-stone-700 mb-1">
                                    Payment Date
                                </label>
                                <input
                                    id="payment_date_input"
                                    type="date"
                                    value={paymentDate}
                                    onChange={(e) => setPaymentDate(e.target.value)}
                                    className="w-full px-3.5 py-2.5 border border-[#D5D7CE] rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-[#2E6E52] bg-white text-stone-900"
                                    required
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E1E3DB]">
                                <button
                                    type="button"
                                    onClick={() => setPaymentModalSale(null)}
                                    className="px-4 py-2 border border-[#D5D7CE] text-stone-700 rounded-lg text-sm font-medium hover:bg-[#F4F5F1] transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoadingId === paymentModalSale.id || !selectedPaymentAccId}
                                    className="px-4 py-2 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    {actionLoadingId === paymentModalSale.id ? 'Recording...' : 'Record Payment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ListSales;