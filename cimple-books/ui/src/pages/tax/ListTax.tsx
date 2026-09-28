import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { listTaxes, deleteTax, type Tax } from '../../lib/api';
import { useModal } from '../../lib/shared/modal/modal';
import TaxForm from './TaxForm';

const TAX_TYPES = [
    { value: 'sales', label: 'Sales' },
    { value: 'purchase', label: 'Purchase' },
];

const ListTax = () => {
    const { openModal, closeModal } = useModal();
    const [taxes, setTaxes] = useState<Tax[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadTaxes = async () => {
        setLoading(true);
        setError(null);
        try {
            const resp = await listTaxes();
            if (resp.status === 200) {
                setTaxes(resp.data || []);
            } else {
                setError(resp.error || 'Failed to load taxes');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load taxes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTaxes();
    }, []);

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this tax?')) {
            return;
        }
        try {
            const resp = await deleteTax(id);
            if (resp.status === 200) {
                await loadTaxes();
            } else {
                alert(resp.error || 'Failed to delete tax');
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete tax');
        }
    };

    const openTaxForm = (tax?: Tax | null) => {
        openModal({
            title: tax ? 'Edit Tax' : 'New Tax',
            content: (
                <TaxForm
                    tax={tax || null}
                    onSave={() => {
                        closeModal();
                        loadTaxes();
                    }}
                />
            ),
            onClose: () => {
                loadTaxes();
            },
        });
    };

    const formatRate = (rate: number) => {
        return (rate / 100).toFixed(2) + '%';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-lg text-gray-500">Loading taxes...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F4F5F1] p-6 lg:p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 font-display">Taxes</h1>
                        <p className="text-stone-500 mt-1 text-sm">Manage tax rates, tax classifications, and rules</p>
                    </div>
                    <button
                        onClick={() => openTaxForm()}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        New Tax
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                        {error}
                    </div>
                )}

                {/* Taxes Table */}
                <div className="bg-white rounded-xl border border-[#E1E3DB] shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-[#E1E3DB]">
                            <thead className="bg-[#F8F9F6]">
                                <tr>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                                        ID
                                    </th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                                        Name
                                    </th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                                        Type
                                    </th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                                        Rate
                                    </th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                                        Strict
                                    </th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                                        Info
                                    </th>
                                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-stone-600 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-[#E1E3DB]">
                                {taxes.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-stone-500">
                                            No taxes found. Create your first tax to get started.
                                        </td>
                                    </tr>
                                ) : (
                                    taxes.map((tax) => (
                                        <tr key={tax.id} className="hover:bg-[#FAFBF9] transition-colors">
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-stone-500">
                                                #{tax.id}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-stone-900">
                                                {tax.name}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-stone-600">
                                                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F4F5F1] text-stone-700 border border-[#E1E3DB]">
                                                    {TAX_TYPES.find(t => t.value === tax.ttype)?.label || tax.ttype}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-stone-900">
                                                {formatRate(tax.rate)}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                {tax.strict ? (
                                                    <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                                                        Strict
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-md bg-stone-100 text-stone-600">
                                                        Optional
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-sm text-stone-500 max-w-xs truncate">
                                                {tax.info || '-'}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => openTaxForm(tax)}
                                                        className="text-stone-600 hover:text-[#2E6E52] p-1.5 hover:bg-[#EEF0EA] rounded-lg transition-colors"
                                                        title="Edit tax"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(tax.id)}
                                                        className="text-stone-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete tax"
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

export default ListTax;

