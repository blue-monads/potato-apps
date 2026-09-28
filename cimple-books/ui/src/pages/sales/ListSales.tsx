import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit } from 'lucide-react';
import { Link } from 'react-router';
import { listSales, deleteSale, type Sale } from '../../lib/api';
import { BASE_PATH } from '../../lib/base';

const ListSales = () => {
    const [sales, setSales] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const resp = await listSales();
            if (resp.status === 200) {
                setSales(resp.data || []);
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
        loadData();
    }, []);

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this sale?')) {
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
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                        {error}
                    </div>
                )}

                {/* Sales List */}
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
                                        <td colSpan={7} className="px-6 py-12 text-center text-stone-500">
                                            No sales found. Create your first sale to get started.
                                        </td>
                                    </tr>
                                ) : (
                                    sales.map((sale) => (
                                        <tr key={sale.id} className="hover:bg-[#FAFBF9] transition-colors">
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-stone-500">
                                                #{sale.id}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-stone-900">
                                                {sale.title || `Sale #${sale.id}`}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-stone-600">
                                                {sale.client_name || `Client #${sale.client_id}`}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-stone-500">
                                                {formatDate(sale.sales_date)}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-stone-900">
                                                ${formatCurrency(sale.total)}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border border-[#E1E3DB] ${getPaymentStatusColor(sale.payment_status)}`}>
                                                    {sale.payment_status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Link
                                                        to={`${BASE_PATH}sales/${sale.id}/edit`}
                                                        className="text-stone-600 hover:text-[#2E6E52] p-1.5 hover:bg-[#EEF0EA] rounded-lg transition-colors"
                                                        title="Edit sale"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </Link>
                                                    <button
                                                        onClick={() => handleDelete(sale.id)}
                                                        className="text-stone-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete sale"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ListSales;