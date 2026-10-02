import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, CheckCircle, CreditCard, Ban, RefreshCw, X } from 'lucide-react';
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

const ListSales = () => {
    const [sales, setSales] = useState<Sale[]>([]);
    const [assetAccounts, setAssetAccounts] = useState<Account[]>([]);
    const [defaultPaymentAccId, setDefaultPaymentAccId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Register Payment modal state
    const [paymentModalSale, setPaymentModalSale] = useState<Sale | null>(null);
    const [selectedPaymentAccId, setSelectedPaymentAccId] = useState<number | null>(null);
    const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
    const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [salesResp, accResp, setResp] = await Promise.all([
                listSales(),
                listAccounts(),
                getSettings(),
            ]);

            if (salesResp.status === 200) {
                setSales(salesResp.data || []);
            } else {
                setError(salesResp.error || 'Failed to load sales');
            }

            if (accResp.status === 200 && Array.isArray(accResp.data)) {
                setAssetAccounts(accResp.data.filter(a => !a.is_deleted && a.acc_type === 'assets'));
            }

            if (setResp.status === 200 && setResp.data?.default_payment_account_id) {
                setDefaultPaymentAccId(setResp.data.default_payment_account_id);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleConfirm = async (sale: Sale) => {
        if (!confirm(`Confirm sale #${sale.id}? Journal transactions will be recorded.`)) {
            return;
        }
        setActionLoadingId(sale.id);
        try {
            const resp = await confirmSale(sale.id);
            if (resp.status === 200) {
                await loadData();
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
        const msg = isConfirmed
            ? `Cancel sale #${sale.id}? All associated journal transactions will be reversed (marked deleted).`
            : `Cancel draft sale #${sale.id}?`;
        if (!confirm(msg)) {
            return;
        }
        setActionLoadingId(sale.id);
        try {
            const resp = await cancelSale(sale.id);
            if (resp.status === 200) {
                await loadData();
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
                await loadData();
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
                await loadData();
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

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-lg text-gray-500">Loading sales...</div>
            </div>
        );
    }

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
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
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
                                {sales.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center text-stone-500">
                                            No sales found. Create your first sale to get started.
                                        </td>
                                    </tr>
                                ) : (
                                    sales.map((sale) => {
                                        const sStatus = sale.sales_status || 'draft';
                                        const isDraft = sStatus === 'draft';
                                        const isConfirmed = sStatus === 'confirmed';
                                        const isCancelled = sStatus === 'cancelled';
                                        const isPaid = sale.payment_status === 'paid';
                                        const isProcessing = actionLoadingId === sale.id;

                                        return (
                                        <tr key={sale.id} className="hover:bg-[#FAFBF9] transition-colors">
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-stone-500">
                                                #{sale.id}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-stone-900">
                                                {sale.title || `Sale #${sale.id}`}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-stone-600">
                                                {sale.client_name || sale.client_alt_name || (sale.client_contact_id ? `Client #${sale.client_contact_id}` : (sale.client_id ? `Client #${sale.client_id}` : '—'))}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-stone-500">
                                                {formatDate(sale.sales_date)}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-stone-900">
                                                {cs}{formatCurrency(sale.total)}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border border-[#E1E3DB] ${getPaymentStatusColor(sale.payment_status)}`}>
                                                    {sale.payment_status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full capitalize border ${
                                                    sStatus === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                    sStatus === 'cancelled' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                                    'bg-amber-50 text-amber-700 border-amber-200'
                                                }`}>
                                                    {sStatus}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end gap-1">
                                                    {isProcessing ? (
                                                        <span className="p-1.5 text-stone-400">
                                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                                        </span>
                                                    ) : (
                                                        <>
                                                            {/* Flow 2 helper: Confirm Draft Sale */}
                                                            {isDraft && (
                                                                <button
                                                                    onClick={() => handleConfirm(sale)}
                                                                    className="text-stone-600 hover:text-emerald-700 p-1.5 hover:bg-emerald-50 rounded-lg transition-colors"
                                                                    title="Confirm sale (records transaction)"
                                                                >
                                                                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                                                                </button>
                                                            )}

                                                            {/* Flow 3 & 5: Register Payment */}
                                                            {(!isCancelled && !isPaid) && (
                                                                <button
                                                                    onClick={() => handleOpenPaymentModal(sale)}
                                                                    className="text-stone-600 hover:text-blue-700 p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                                                                    title="Register payment"
                                                                >
                                                                    <CreditCard className="w-4 h-4 text-blue-600" />
                                                                </button>
                                                            )}

                                                            {/* Edit: Only Draft */}
                                                            {isDraft ? (
                                                                <Link
                                                                    to={`${BASE_PATH}sales/${sale.id}/edit`}
                                                                    className="text-stone-600 hover:text-[#2E6E52] p-1.5 hover:bg-[#EEF0EA] rounded-lg transition-colors"
                                                                    title="Edit draft sale"
                                                                >
                                                                    <Edit className="w-4 h-4" />
                                                                </Link>
                                                            ) : (
                                                                <span
                                                                    className="text-stone-300 p-1.5 cursor-not-allowed rounded-lg inline-flex"
                                                                    title="Only draft sales can be edited"
                                                                >
                                                                    <Edit className="w-4 h-4 opacity-30" />
                                                                </span>
                                                            )}

                                                            {/* Flow 4, 6, 7: Cancel Sale */}
                                                            {!isCancelled && (
                                                                <button
                                                                    onClick={() => handleCancel(sale)}
                                                                    className="text-stone-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-lg transition-colors"
                                                                    title={isConfirmed ? "Cancel sale (reverses journal transactions)" : "Cancel draft sale"}
                                                                >
                                                                    <Ban className="w-4 h-4 text-rose-500" />
                                                                </button>
                                                            )}

                                                            {/* Delete */}
                                                            <button
                                                                onClick={() => handleDelete(sale.id)}
                                                                className="text-stone-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
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
                                className="text-stone-400 hover:text-stone-600 p-1 rounded-md hover:bg-stone-100 transition-colors"
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
                                    className="w-full px-3.5 py-2.5 border border-[#D5D7CE] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6E52] bg-white text-stone-900"
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
                                    className="w-full px-3.5 py-2.5 border border-[#D5D7CE] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6E52] bg-white text-stone-900"
                                    required
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E1E3DB]">
                                <button
                                    type="button"
                                    onClick={() => setPaymentModalSale(null)}
                                    className="px-4 py-2 border border-[#D5D7CE] text-stone-700 bg-white hover:bg-stone-50 rounded-lg text-sm font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoadingId === paymentModalSale.id || !selectedPaymentAccId}
                                    className="inline-flex items-center gap-2 px-5 py-2 bg-[#2E6E52] hover:bg-[#255842] disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
                                >
                                    {actionLoadingId === paymentModalSale.id ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle className="w-4 h-4" />
                                            Confirm Payment
                                        </>
                                    )}
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