import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Plus, Edit, Trash2, ArrowRight, Search, X, Filter } from 'lucide-react';
import { listAccounts, deleteAccount, type Account } from '../../lib/api';
import { BASE_PATH } from '../../lib/base';
import { useModal } from '../../lib/shared/modal/modal';
import AccountForm from './AccountForm';
import { Pagination } from '../../components/Pagination';

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

    // Search and filter states (server-side)
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');

    // Pagination state (server-side)
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(15);
    const [totalCount, setTotalCount] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(1);

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
    }, [debouncedSearch, typeFilter]);

    const loadAccounts = async () => {
        setLoading(true);
        setError(null);
        try {
            const resp = await listAccounts({
                page: currentPage,
                pageSize,
                search: debouncedSearch,
                type: typeFilter,
            });
            if (resp.status === 200 && resp.data) {
                setAccounts(resp.data.items || []);
                setTotalCount(resp.data.total || 0);
                setTotalPages(resp.data.total_pages || 1);
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
    }, [currentPage, pageSize, debouncedSearch, typeFilter]);

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

    return (
        <div className="min-h-screen bg-[#F4F5F1] p-6 lg:p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 font-display">Accounts</h1>
                        <p className="text-stone-500 mt-1 text-sm">Manage your chart of accounts, assets, liabilities, and equity</p>
                    </div>
                    <button
                        onClick={() => openAccountForm()}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg text-sm font-semibold transition-colors shadow-sm cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        New Account
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
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
                            placeholder="Search accounts by name or description..."
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

                    {/* Account Type Filter */}
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-stone-400 hidden sm:block" />
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="bg-white border border-[#E1E3DB] rounded-lg px-3 py-2 text-sm font-medium text-stone-800 focus:outline-hidden focus:border-[#2E6E52] cursor-pointer"
                        >
                            <option value="all">All Types</option>
                            <option value="assets">Assets</option>
                            <option value="liabilities">Liabilities</option>
                            <option value="equity">Equity</option>
                            <option value="revenue">Revenue</option>
                            <option value="expenses">Expenses</option>
                        </select>
                    </div>
                </div>

                {/* Accounts Table */}
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
                                        Info
                                    </th>
                                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-stone-600 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-[#E1E3DB]">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-stone-500 animate-pulse">
                                            Loading accounts...
                                        </td>
                                    </tr>
                                ) : accounts.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-stone-500">
                                            {debouncedSearch || typeFilter !== 'all'
                                                ? 'No accounts match the current filters.'
                                                : 'No accounts found. Create your first account to get started.'}
                                        </td>
                                    </tr>
                                ) : (
                                    accounts.map((account) => (
                                        <tr key={account.id} className="hover:bg-[#FAFBF9] transition-colors">
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-stone-500">
                                                #{account.id}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-stone-900">
                                                {account.name}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <span
                                                    className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full border border-[#E1E3DB] ${
                                                        ACCOUNT_TYPE_COLORS[account.acc_type] ||
                                                        'bg-[#F4F5F1] text-stone-700'
                                                    }`}
                                                >
                                                    {ACCOUNT_TYPES[account.acc_type] || account.acc_type}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-sm text-stone-500 max-w-xs truncate">
                                                {account.info || '-'}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Link
                                                        to={`${BASE_PATH}txns?accountId=${account.id}`}
                                                        className="text-stone-600 hover:text-[#2E6E52] p-1.5 hover:bg-[#EEF0EA] rounded-lg transition-colors cursor-pointer"
                                                        title="View transactions"
                                                    >
                                                        <ArrowRight className="w-4 h-4" />
                                                    </Link>
                                                    <button
                                                        onClick={() => handleEdit(account)}
                                                        className="text-stone-600 hover:text-[#2E6E52] p-1.5 hover:bg-[#EEF0EA] rounded-lg transition-colors cursor-pointer"
                                                        title="Edit account"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(account.id)}
                                                        className="text-stone-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
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
                        itemLabel="accounts"
                    />
                </div>
            </div>
        </div>
    );
};

export default ListAccount;
