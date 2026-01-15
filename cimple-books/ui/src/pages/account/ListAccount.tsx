import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Plus, Edit, Trash2, ArrowRight } from 'lucide-react';
import { listAccounts, deleteAccount, type Account } from '../../lib/api';
import { BASE_PATH } from '../../lib/base';
import { useModal } from '../../lib/modal/modal';
import AccountForm from './AccountForm';

const ACCOUNT_TYPES: Record<string, string> = {
    expenses: 'Expenses',
    revenue: 'Revenue',
    assets: 'Assets',
    liabilities: 'Liabilities',
    equity: 'Equity',
};

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
    expenses: 'bg-red-100 text-red-800',
    revenue: 'bg-green-100 text-green-800',
    assets: 'bg-blue-100 text-blue-800',
    liabilities: 'bg-orange-100 text-orange-800',
    equity: 'bg-purple-100 text-purple-800',
};

const ListAccount = () => {
    const { openModal, closeModal } = useModal();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadAccounts = async () => {
        setLoading(true);
        setError(null);
        try {
            const resp = await listAccounts();
            if (resp.status === 200) {
                setAccounts(resp.data || []);
            } else {
                setError(resp.error || 'Failed to load accounts');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load accounts');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAccounts();
    }, []);

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this account?')) {
            return;
        }
        try {
            const resp = await deleteAccount(id);
            if (resp.status === 200) {
                await loadAccounts();
            } else {
                alert(resp.error || 'Failed to delete account');
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete account');
        }
    };

    const openAccountForm = (account?: Account | null) => {
        openModal({
            title: account ? 'Edit Account' : 'New Account',
            content: (
                <AccountForm
                    account={account || null}
                    onSave={() => {
                        closeModal();
                        loadAccounts();
                    }}
                />
            ),
            onClose: () => {
                loadAccounts();
            },
        });
    };

    const handleEdit = (account: Account) => {
        openAccountForm(account);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-lg text-gray-500">Loading accounts...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Accounts</h1>
                        <p className="text-gray-600 mt-1">Manage your chart of accounts</p>
                    </div>
                    <button
                        onClick={() => openAccountForm()}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        New Account
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                        {error}
                    </div>
                )}

                {/* Accounts Table */}
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
                                        Info
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Debit
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Credit
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {accounts.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                            No accounts found. Create your first account to get started.
                                        </td>
                                    </tr>
                                ) : (
                                    accounts.map((account) => (
                                        <tr key={account.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {account.id}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {account.name}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span
                                                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                                        ACCOUNT_TYPE_COLORS[account.acc_type] ||
                                                        'bg-gray-100 text-gray-800'
                                                    }`}
                                                >
                                                    {ACCOUNT_TYPES[account.acc_type] || account.acc_type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                                                {account.info || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {(account.total_debit / 100).toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {(account.total_credit / 100).toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Link
                                                        to={`${BASE_PATH}txns?accountId=${account.id}`}
                                                        className="text-blue-600 hover:text-blue-900 p-1"
                                                        title="View transactions"
                                                    >
                                                        <ArrowRight className="w-4 h-4" />
                                                    </Link>
                                                    <button
                                                        onClick={() => handleEdit(account)}
                                                        className="text-indigo-600 hover:text-indigo-900 p-1"
                                                        title="Edit account"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(account.id)}
                                                        className="text-red-600 hover:text-red-900 p-1"
                                                        title="Delete account"
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

export default ListAccount;
