import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { listTaxes, deleteTax, type Tax } from '../../lib/api';
import { useModal } from '../../lib/shared/modal/modal';
import TaxForm from './TaxForm';

const TAX_TYPES = [
    { value: 'item_percent', label: 'Item Percent' },
    { value: 'category_percent', label: 'Category Percent' },
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
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Taxes</h1>
                        <p className="text-gray-600 mt-1">Manage tax rates and rules</p>
                    </div>
                    <button
                        onClick={() => openTaxForm()}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        New Tax
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                        {error}
                    </div>
                )}

                {/* Taxes Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        ID
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Name
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Type
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Rate
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Strict
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Info
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {taxes.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                            No taxes found. Create your first tax to get started.
                                        </td>
                                    </tr>
                                ) : (
                                    taxes.map((tax) => (
                                        <tr key={tax.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {tax.id}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {tax.name}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {TAX_TYPES.find(t => t.value === tax.ttype)?.label || tax.ttype}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {formatRate(tax.rate)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {tax.strict ? (
                                                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                                        Yes
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                                                        No
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                                                {tax.info || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => openTaxForm(tax)}
                                                        className="text-indigo-600 hover:text-indigo-900 p-1"
                                                        title="Edit tax"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(tax.id)}
                                                        className="text-red-600 hover:text-red-900 p-1"
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

