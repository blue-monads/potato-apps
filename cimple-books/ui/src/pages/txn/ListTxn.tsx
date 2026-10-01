import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import {
    Plus,
    Trash2,
    Edit,
    ArrowLeft,
    Search,
    Calendar,
    Filter,
    X,
    ChevronDown,
    ChevronUp,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    CheckCircle2,
    BookOpen,
    ArrowUpDown,
    RefreshCw,
    SlidersHorizontal,
    Layers,
} from 'lucide-react';
import { listTransactions, deleteTransaction, listAccounts, type Transaction, type Account } from '../../lib/api';
import { useModal } from '../../lib/shared/modal/modal';
import TransactionForm from './TransactionForm';

type DatePreset = 'all' | 'today' | 'this_month' | 'last_30_days' | 'custom';
type SortOption = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';
type TxnTypeFilter = 'all' | 'manual' | 'sales' | 'stockin';

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
    assets: 'Asset',
    liabilities: 'Liability',
    equity: 'Equity',
    revenue: 'Revenue',
    expenses: 'Expense',
};

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
    assets: 'bg-blue-50 text-blue-800 border-blue-200',
    liabilities: 'bg-amber-50 text-amber-800 border-amber-200',
    equity: 'bg-purple-50 text-purple-800 border-purple-200',
    revenue: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    expenses: 'bg-rose-50 text-rose-800 border-rose-200',
};

const parseTxnDate = (val: any): Date | null => {
    if (!val) return null;
    if (typeof val === 'number') {
        const ms = val < 10000000000 ? val * 1000 : val;
        return new Date(ms);
    }
    const num = Number(val);
    if (!isNaN(num) && num > 1000000) {
        const ms = num < 10000000000 ? num * 1000 : num;
        return new Date(ms);
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
};

const formatCurrency = (amountInCents: number) => {
    return (amountInCents / 100).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const formatDateDisplay = (dateVal: any) => {
    const d = parseTxnDate(dateVal);
    if (!d) return '—';
    return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

const formatTimeDisplay = (dateVal: any) => {
    const d = parseTxnDate(dateVal);
    if (!d) return '';
    return d.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
    });
};

const getTxnAmount = (txn: Transaction): number => {
    if (!txn.lines || txn.lines.length === 0) return 0;
    return txn.lines.reduce((sum, l) => sum + (l.debit_amount || 0), 0);
};

function getPageNumbers(current: number, total: number): (number | string)[] {
    if (total <= 7) {
        return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (current <= 4) {
        return [1, 2, 3, 4, 5, '...', total];
    }
    if (current >= total - 3) {
        return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    }
    return [1, '...', current - 1, current, current + 1, '...', total];
}

const ListTxn = () => {
    const { openModal, closeModal } = useModal();
    const [searchParams, setSearchParams] = useSearchParams();

    // Data state
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [totalCount, setTotalCount] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [accountTxnCounts, setAccountTxnCounts] = useState<Map<number, number>>(new Map());
    const [initialLoading, setInitialLoading] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter & Query States
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedAccountId, setSelectedAccountId] = useState<string>(
        searchParams.get('accountId') || 'all'
    );
    const [datePreset, setDatePreset] = useState<DatePreset>('all');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [typeFilter, setTypeFilter] = useState<TxnTypeFilter>('all');
    const [sortOption, setSortOption] = useState<SortOption>('date_desc');
    const [expandedTxnIds, setExpandedTxnIds] = useState<Record<number, boolean>>({});
    const [allExpanded, setAllExpanded] = useState(true);

    // Server-computed Aggregated Metrics
    const [metrics, setMetrics] = useState({
        totalEntries: 0,
        totalDebit: 0,
        totalCredit: 0,
        accountsCount: 0,
        isBalanced: true,
    });

    // Pagination State
    const [pageSize, setPageSize] = useState<number>(15);
    const [currentPage, setCurrentPage] = useState<number>(1);

    // Debounce search query by 280ms
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 280);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Sync from URL param if changed externally
    useEffect(() => {
        const accParam = searchParams.get('accountId');
        if (accParam && accParam !== selectedAccountId) {
            setSelectedAccountId(accParam);
            setCurrentPage(1);
        }
    }, [searchParams]);

    // Load accounts once on mount
    useEffect(() => {
        listAccounts().then((res) => {
            if (res.status === 200) {
                setAccounts(res.data || []);
            }
        });
    }, []);

    // Account mapping helper
    const accountMap = useMemo(() => {
        const map = new Map<number, Account>();
        accounts.forEach((a) => map.set(a.id, a));
        return map;
    }, [accounts]);

    const getAccount = (id: number): Account | undefined => {
        return accountMap.get(id);
    };

    // Primary Backend Fetch function
    const fetchTransactions = async () => {
        setLoading(true);
        setError(null);
        try {
            const resp = await listTransactions({
                page: currentPage,
                pageSize,
                search: debouncedSearch,
                accountId: selectedAccountId,
                txnType: typeFilter,
                datePreset,
                startDate: customStartDate,
                endDate: customEndDate,
                sortBy: sortOption,
            });

            if (resp.status === 200 && resp.data) {
                setTransactions(resp.data.items || []);
                setTotalCount(resp.data.total || 0);
                setTotalPages(resp.data.total_pages || 1);
                if (resp.data.metrics) {
                    setMetrics({
                        totalEntries: resp.data.metrics.total_entries || 0,
                        totalDebit: resp.data.metrics.total_debit || 0,
                        totalCredit: resp.data.metrics.total_credit || 0,
                        accountsCount: resp.data.metrics.accounts_count || 0,
                        isBalanced: !!resp.data.metrics.is_balanced,
                    });
                }
                if (resp.data.account_counts) {
                    const countsMap = new Map<number, number>();
                    Object.entries(resp.data.account_counts).forEach(([accId, count]) => {
                        countsMap.set(Number(accId), count);
                    });
                    setAccountTxnCounts(countsMap);
                }
            } else {
                setError(resp.error || 'Failed to load transactions');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setLoading(false);
            setInitialLoading(false);
        }
    };

    // Trigger backend fetch whenever query parameters or page changes
    useEffect(() => {
        fetchTransactions();
    }, [
        currentPage,
        pageSize,
        debouncedSearch,
        selectedAccountId,
        datePreset,
        customStartDate,
        customEndDate,
        typeFilter,
        sortOption,
    ]);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (searchQuery.trim()) count++;
        if (selectedAccountId !== 'all') count++;
        if (datePreset !== 'all') count++;
        if (typeFilter !== 'all') count++;
        return count;
    }, [searchQuery, selectedAccountId, datePreset, typeFilter]);

    const handleSearchChange = (query: string) => {
        setSearchQuery(query);
        setCurrentPage(1);
    };

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setCurrentPage(1);
    };

    const resetFilters = () => {
        setSearchQuery('');
        setSelectedAccountId('all');
        setDatePreset('all');
        setCustomStartDate('');
        setCustomEndDate('');
        setTypeFilter('all');
        setSortOption('date_desc');
        setCurrentPage(1);
        setSearchParams({});
    };

    const handleAccountFilterChange = (newAccId: string) => {
        setSelectedAccountId(newAccId);
        setCurrentPage(1);
        if (newAccId === 'all') {
            const next = new URLSearchParams(searchParams);
            next.delete('accountId');
            setSearchParams(next);
        } else {
            setSearchParams({ accountId: newAccId });
        }
    };

    const toggleExpandAll = () => {
        const nextState = !allExpanded;
        setAllExpanded(nextState);
        const newRecord: Record<number, boolean> = {};
        transactions.forEach((t) => {
            newRecord[t.id] = nextState;
        });
        setExpandedTxnIds(newRecord);
    };

    const toggleTxnExpand = (id: number) => {
        setExpandedTxnIds((prev) => {
            const isCurrentlyExpanded = prev[id] !== undefined ? prev[id] : allExpanded;
            return {
                ...prev,
                [id]: !isCurrentlyExpanded,
            };
        });
    };

    const isTxnExpanded = (id: number) => {
        return expandedTxnIds[id] !== undefined ? expandedTxnIds[id] : allExpanded;
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this transaction? All associated journal lines will be reversed.')) {
            return;
        }
        try {
            const resp = await deleteTransaction(id);
            if (resp.status === 200) {
                await fetchTransactions();
            } else {
                alert(resp.error || 'Failed to delete transaction');
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete transaction');
        }
    };

    const openTransactionForm = (transaction?: Transaction | null) => {
        openModal({
            title: transaction ? 'Edit Journal Entry' : 'New Journal Entry',
            content: (
                <TransactionForm
                    transaction={transaction || null}
                    accounts={accounts}
                    onSave={() => {
                        closeModal();
                        fetchTransactions();
                    }}
                />
            ),
            onClose: () => {
                fetchTransactions();
            },
        });
    };

    const selectedAccountObj = accounts.find((a) => String(a.id) === selectedAccountId);

    if (initialLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#F4F5F1]">
                <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="w-6 h-6 text-[#2E6E52] animate-spin" />
                    <div className="text-stone-500 font-sans text-sm">Loading journal transactions...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F4F5F1] p-6 lg:p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            {selectedAccountId !== 'all' && (
                                <button
                                    type="button"
                                    onClick={() => handleAccountFilterChange('all')}
                                    className="p-1.5 text-stone-600 hover:text-[#2E6E52] hover:bg-[#EEF0EA] rounded-xl transition-colors border border-[#E1E3DB] bg-white"
                                    title="View All Accounts"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                </button>
                            )}
                            <div>
                                <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 font-display flex items-center gap-2.5">
                                    <BookOpen className="w-7 h-7 text-[#2E6E52]" />
                                    {selectedAccountObj ? `Ledger: ${selectedAccountObj.name}` : 'Journal Transactions'}
                                </h1>
                                <p className="text-stone-500 mt-1 text-sm">
                                    {selectedAccountObj
                                        ? `All double-entry debit and credit postings for ${selectedAccountObj.name}`
                                        : 'Double-entry bookkeeping journal, ledger postings, and audit trail'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={fetchTransactions}
                            disabled={loading}
                            className="p-2.5 bg-white border border-[#E1E3DB] text-stone-600 hover:text-stone-900 hover:bg-stone-50 rounded-xl transition-colors shadow-xs disabled:opacity-50"
                            title="Refresh Transactions"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#2E6E52]' : ''}`} />
                        </button>
                        <button
                            type="button"
                            onClick={() => openTransactionForm()}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
                        >
                            <Plus className="w-4 h-4" />
                            New Transaction
                        </button>
                    </div>
                </div>

                {/* Metrics Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-2xl border border-[#E1E3DB] shadow-xs">
                        <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">Journal Entries</span>
                        <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-2xl font-black text-stone-900 font-display">{totalCount}</span>
                            {activeFilterCount > 0 && (
                                <span className="text-xs text-stone-400">filtered</span>
                            )}
                        </div>
                        <span className="text-xs text-stone-400 mt-0.5 block">Recorded batches</span>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-[#E1E3DB] shadow-xs">
                        <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">Total Debits</span>
                        <span className="text-2xl font-black text-emerald-800 font-display mt-1 block">
                            ${formatCurrency(metrics.totalDebit)}
                        </span>
                        <span className="text-xs text-stone-400 mt-0.5 block">Cumulative Dr side</span>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-[#E1E3DB] shadow-xs">
                        <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">Total Credits</span>
                        <span className="text-2xl font-black text-blue-800 font-display mt-1 block">
                            ${formatCurrency(metrics.totalCredit)}
                        </span>
                        <span className="text-xs text-stone-400 mt-0.5 block">Cumulative Cr side</span>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-[#E1E3DB] shadow-xs">
                        <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">Accounts Active</span>
                        <span className="text-2xl font-black text-stone-900 font-display mt-1 block">
                            {metrics.accountsCount}
                        </span>
                        <span className="text-xs text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {metrics.isBalanced ? '100% Balanced' : 'Out of balance!'}
                        </span>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
                        {error}
                    </div>
                )}

                {/* Filters & Query Toolbar */}
                <div className="bg-white rounded-2xl border border-[#E1E3DB] p-4 shadow-xs mb-6 space-y-3.5">
                    {/* Top Row: Search Bar & Quick Toggles */}
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                            <input
                                type="text"
                                placeholder="Search by title, reference #, notes, account name, amount..."
                                value={searchQuery}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                className="w-full pl-10 pr-9 py-2.5 bg-stone-50 hover:bg-stone-100/60 focus:bg-white border border-[#E1E3DB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6E52] text-stone-900 placeholder-stone-400 transition-colors"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => handleSearchChange('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-0.5"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-2 self-end md:self-auto flex-shrink-0">
                            <button
                                type="button"
                                onClick={toggleExpandAll}
                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-50 hover:bg-stone-100 border border-[#E1E3DB] rounded-xl text-xs font-semibold text-stone-700 transition-colors"
                            >
                                <Layers className="w-3.5 h-3.5 text-stone-500" />
                                {allExpanded ? 'Collapse All' : 'Expand All'}
                            </button>

                            {activeFilterCount > 0 && (
                                <button
                                    type="button"
                                    onClick={resetFilters}
                                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors"
                                >
                                    <X className="w-3.5 h-3.5" />
                                    Clear Filters ({activeFilterCount})
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Bottom Row: Detailed Filter Parameters */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-[#E1E3DB]">
                        {/* Account Filter */}
                        <div>
                            <label className="block text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <Filter className="w-3 h-3" />
                                Account
                            </label>
                            <select
                                value={selectedAccountId}
                                onChange={(e) => handleAccountFilterChange(e.target.value)}
                                className="w-full px-3 py-2 bg-stone-50 border border-[#E1E3DB] rounded-xl text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#2E6E52] focus:bg-white"
                            >
                                <option value="all">All Accounts ({accounts.length})</option>
                                {accounts.map((a) => {
                                    const cnt = accountTxnCounts.get(a.id);
                                    return (
                                        <option key={a.id} value={String(a.id)}>
                                            {a.name} ({ACCOUNT_TYPE_LABELS[a.acc_type] || a.acc_type}){cnt !== undefined ? ` • ${cnt}` : ''}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        {/* Date Preset Filter */}
                        <div>
                            <label className="block text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Date Range
                            </label>
                            <select
                                value={datePreset}
                                onChange={(e) => {
                                    setDatePreset(e.target.value as DatePreset);
                                    setCurrentPage(1);
                                }}
                                className="w-full px-3 py-2 bg-stone-50 border border-[#E1E3DB] rounded-xl text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#2E6E52] focus:bg-white"
                            >
                                <option value="all">All Time</option>
                                <option value="today">Today</option>
                                <option value="this_month">This Month</option>
                                <option value="last_30_days">Last 30 Days</option>
                                <option value="custom">Custom Date Range...</option>
                            </select>
                        </div>

                        {/* Transaction Type Filter */}
                        <div>
                            <label className="block text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <SlidersHorizontal className="w-3 h-3" />
                                Transaction Type
                            </label>
                            <select
                                value={typeFilter}
                                onChange={(e) => {
                                    setTypeFilter(e.target.value as TxnTypeFilter);
                                    setCurrentPage(1);
                                }}
                                className="w-full px-3 py-2 bg-stone-50 border border-[#E1E3DB] rounded-xl text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#2E6E52] focus:bg-white"
                            >
                                <option value="all">All Types</option>
                                <option value="manual">Manual / Journal Entries</option>
                                <option value="sales">Sales Postings</option>
                                <option value="stockin">Stock In Postings</option>
                            </select>
                        </div>

                        {/* Sort By */}
                        <div>
                            <label className="block text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <ArrowUpDown className="w-3 h-3" />
                                Sort By
                            </label>
                            <select
                                value={sortOption}
                                onChange={(e) => {
                                    setSortOption(e.target.value as SortOption);
                                    setCurrentPage(1);
                                }}
                                className="w-full px-3 py-2 bg-stone-50 border border-[#E1E3DB] rounded-xl text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#2E6E52] focus:bg-white"
                            >
                                <option value="date_desc">Date: Newest First</option>
                                <option value="date_asc">Date: Oldest First</option>
                                <option value="amount_desc">Amount: High to Low</option>
                                <option value="amount_asc">Amount: Low to High</option>
                            </select>
                        </div>
                    </div>

                    {/* Custom Date Inputs Row (if custom preset active) */}
                    {datePreset === 'custom' && (
                        <div className="pt-2 flex flex-wrap items-center gap-3 bg-[#FAFBF9] p-3 rounded-xl border border-[#E1E3DB]">
                            <span className="text-xs font-semibold text-stone-600">Custom Range:</span>
                            <div className="flex items-center gap-2">
                                <label className="text-xs text-stone-500">From</label>
                                <input
                                    type="date"
                                    value={customStartDate}
                                    onChange={(e) => {
                                        setCustomStartDate(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="px-2.5 py-1.5 bg-white border border-[#E1E3DB] rounded-lg text-xs text-stone-900 focus:ring-2 focus:ring-[#2E6E52]"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-xs text-stone-500">To</label>
                                <input
                                    type="date"
                                    value={customEndDate}
                                    onChange={(e) => {
                                        setCustomEndDate(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="px-2.5 py-1.5 bg-white border border-[#E1E3DB] rounded-lg text-xs text-stone-900 focus:ring-2 focus:ring-[#2E6E52]"
                                />
                            </div>
                            {(customStartDate || customEndDate) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCustomStartDate('');
                                        setCustomEndDate('');
                                        setCurrentPage(1);
                                    }}
                                    className="text-xs text-stone-500 hover:text-stone-900 underline ml-auto"
                                >
                                    Clear Dates
                                </button>
                            )}
                        </div>
                    )}

                    {/* Active Filter Chips */}
                    {activeFilterCount > 0 && (
                        <div className="flex flex-wrap items-center gap-2 pt-2">
                            <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Active:</span>
                            {selectedAccountId !== 'all' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#EAF3EE] text-[#2E6E52] border border-[#2E6E52]/20">
                                    Account: {selectedAccountObj?.name || selectedAccountId}
                                    <button
                                        type="button"
                                        onClick={() => handleAccountFilterChange('all')}
                                        className="hover:text-red-600"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            )}
                            {datePreset !== 'all' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-stone-100 text-stone-700 border border-stone-200">
                                    Date: {datePreset.replace('_', ' ')}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDatePreset('all');
                                            setCurrentPage(1);
                                        }}
                                        className="hover:text-red-600"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            )}
                            {typeFilter !== 'all' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-stone-100 text-stone-700 border border-stone-200">
                                    Type: {typeFilter}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTypeFilter('all');
                                            setCurrentPage(1);
                                        }}
                                        className="hover:text-red-600"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            )}
                            {searchQuery && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-stone-100 text-stone-700 border border-stone-200">
                                    Query: "{searchQuery}"
                                    <button
                                        type="button"
                                        onClick={() => handleSearchChange('')}
                                        className="hover:text-red-600"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Transactions List */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="bg-white rounded-2xl border border-[#E1E3DB] shadow-xs p-16 text-center">
                            <RefreshCw className="w-6 h-6 text-[#2E6E52] animate-spin mx-auto mb-3" />
                            <p className="text-xs text-stone-500">Loading transactions...</p>
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-[#E1E3DB] shadow-xs p-16 text-center">
                            <div className="w-12 h-12 rounded-full bg-[#EAF3EE] text-[#2E6E52] flex items-center justify-center mx-auto mb-3">
                                <BookOpen className="w-6 h-6" />
                            </div>
                            <h3 className="text-base font-bold text-stone-900 font-display">No transactions found</h3>
                            <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1 mb-5">
                                {activeFilterCount > 0
                                    ? 'No journal entries match your active filters. Try adjusting your query or resetting filters.'
                                    : 'Start recording double-entry bookkeeping journal entries.'}
                            </p>
                            {activeFilterCount > 0 ? (
                                <button
                                    type="button"
                                    onClick={resetFilters}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold transition-colors"
                                >
                                    <X className="w-3.5 h-3.5" />
                                    Reset All Filters
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => openTransactionForm()}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Record First Transaction
                                </button>
                            )}
                        </div>
                    ) : (
                        transactions.map((txn) => {
                            const isExpanded = isTxnExpanded(txn.id);
                            const amount = getTxnAmount(txn);
                            const lines = txn.lines || [];
                            const tType = (txn.txn_type || 'normal').toLowerCase();

                            return (
                                <div
                                    key={txn.id}
                                    className="bg-white rounded-2xl border border-[#E1E3DB] shadow-xs overflow-hidden transition-all hover:border-stone-400"
                                >
                                    {/* Transaction Card Header */}
                                    <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E1E3DB]/70 bg-gradient-to-r from-[#FAFBF9] to-white">
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className="w-9 h-9 rounded-xl bg-[#EEF0EA] border border-[#E1E3DB] text-stone-700 flex items-center justify-center font-bold text-xs font-mono flex-shrink-0 mt-0.5">
                                                #{txn.id}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="text-base font-bold text-stone-900 font-display truncate">
                                                        {txn.title || `Transaction #${txn.id}`}
                                                    </h3>

                                                    {/* Type badge */}
                                                    <span
                                                        className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                                                            tType === 'sales'
                                                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                                : tType === 'stockin'
                                                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                                : 'bg-blue-50 text-blue-800 border-blue-200'
                                                        }`}
                                                    >
                                                        {tType === 'manual' || tType === 'normal' ? 'Journal Entry' : tType}
                                                    </span>

                                                    {/* Reference badge */}
                                                    {txn.reference_id && (
                                                        <span className="text-[11px] px-2 py-0.5 rounded bg-stone-100 text-stone-600 font-mono border border-stone-200 font-medium">
                                                            Ref: {txn.reference_id}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-3 text-xs text-stone-500 mt-1">
                                                    <span className="flex items-center gap-1 font-medium text-stone-700">
                                                        <Calendar className="w-3.5 h-3.5 text-stone-400" />
                                                        {formatDateDisplay(txn.txn_date)}
                                                        {formatTimeDisplay(txn.txn_date) && (
                                                            <span className="text-stone-400 font-normal">
                                                                at {formatTimeDisplay(txn.txn_date)}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span>•</span>
                                                    <span>{lines.length} lines posted</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between md:justify-end gap-3 self-end md:self-center">
                                            <div className="text-right">
                                                <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">
                                                    Batch Total
                                                </span>
                                                <span className="text-lg font-black text-stone-900 font-display">
                                                    ${formatCurrency(amount)}
                                                </span>
                                            </div>

                                            <div className="h-8 w-px bg-[#E1E3DB] mx-1 hidden sm:block" />

                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => openTransactionForm(txn)}
                                                    className="p-2 text-stone-500 hover:text-[#2E6E52] hover:bg-[#EEF0EA] rounded-xl transition-colors"
                                                    title="Edit Transaction"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                {txn.is_editable && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(txn.id)}
                                                        className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                                        title="Delete Transaction"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => toggleTxnExpand(txn.id)}
                                                    className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors ml-1"
                                                    title={isExpanded ? 'Collapse Lines' : 'Expand Lines'}
                                                >
                                                    {isExpanded ? (
                                                        <ChevronUp className="w-4 h-4" />
                                                    ) : (
                                                        <ChevronDown className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Transaction Notes (if any) */}
                                    {txn.notes && (
                                        <div className="px-5 py-3 bg-[#FAFBF9] border-b border-[#E1E3DB]/60 text-xs text-stone-600 flex items-start gap-2">
                                            <span className="font-bold text-stone-400 uppercase tracking-wider text-[10px] mt-0.5">
                                                Memo:
                                            </span>
                                            <span className="italic">{txn.notes}</span>
                                        </div>
                                    )}

                                    {/* Expanded Transaction Lines Table */}
                                    {isExpanded && (
                                        <div className="p-5">
                                            <div className="overflow-x-auto border border-[#E1E3DB] rounded-xl">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-[#FAFBF9] border-b border-[#E1E3DB] text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                                                            <th className="px-4 py-2.5">Account & Classification</th>
                                                            <th className="px-4 py-2.5 text-right w-44">Debit (Dr)</th>
                                                            <th className="px-4 py-2.5 text-right w-44">Credit (Cr)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-[#E1E3DB] text-xs">
                                                        {lines.map((line) => {
                                                            const acc = getAccount(line.account_id);
                                                            const isSelectedAcc =
                                                                selectedAccountId !== 'all' &&
                                                                String(line.account_id) === selectedAccountId;

                                                            return (
                                                                <tr
                                                                    key={line.id}
                                                                    className={`hover:bg-stone-50/70 transition-colors ${
                                                                        isSelectedAcc ? 'bg-[#EAF3EE]/40 font-semibold' : ''
                                                                    }`}
                                                                >
                                                                    <td className="px-4 py-3">
                                                                        <div className="flex items-center gap-2">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    handleAccountFilterChange(
                                                                                        String(line.account_id)
                                                                                    )
                                                                                }
                                                                                className="font-bold text-stone-900 hover:text-[#2E6E52] hover:underline text-left text-xs transition-colors"
                                                                                title={`Filter by ${acc?.name || line.account_id}`}
                                                                            >
                                                                                {acc?.name || `Account #${line.account_id}`}
                                                                            </button>
                                                                            {acc?.acc_type && (
                                                                                <span
                                                                                    className={`text-[10px] px-2 py-0.2 rounded-md font-semibold border ${
                                                                                        ACCOUNT_TYPE_COLORS[acc.acc_type] ||
                                                                                        'bg-stone-100 text-stone-700 border-stone-200'
                                                                                    }`}
                                                                                >
                                                                                    {ACCOUNT_TYPE_LABELS[acc.acc_type] ||
                                                                                        acc.acc_type}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        {line.created_at && (
                                                                            <div className="text-[10px] text-stone-400 mt-0.5">
                                                                                Line ID #{line.id}
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right font-mono text-xs">
                                                                        {line.debit_amount > 0 ? (
                                                                            <span className="font-bold text-emerald-800 bg-emerald-50/70 px-2 py-0.5 rounded border border-emerald-200">
                                                                                ${formatCurrency(line.debit_amount)}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-stone-300">—</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right font-mono text-xs">
                                                                        {line.credit_amount > 0 ? (
                                                                            <span className="font-bold text-blue-800 bg-blue-50/70 px-2 py-0.5 rounded border border-blue-200">
                                                                                ${formatCurrency(line.credit_amount)}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-stone-300">—</span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr className="bg-[#FAFBF9] border-t border-[#E1E3DB] font-bold text-xs text-stone-800">
                                                            <td className="px-4 py-2.5 text-stone-500 uppercase tracking-wider text-[11px]">
                                                                Journal Total
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right font-mono text-emerald-900">
                                                                ${formatCurrency(amount)}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right font-mono text-blue-900">
                                                                ${formatCurrency(amount)}
                                                            </td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}

                    {/* Pagination Bar */}
                    {totalCount > 0 && (
                        <div className="bg-white rounded-2xl border border-[#E1E3DB] p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs mt-2">
                            <div className="flex items-center gap-3 text-xs text-stone-600 flex-wrap">
                                <span>
                                    Showing <strong className="text-stone-900 font-semibold">{Math.min((currentPage - 1) * pageSize + 1, totalCount)}</strong> to{' '}
                                    <strong className="text-stone-900 font-semibold">{Math.min(currentPage * pageSize, totalCount)}</strong> of{' '}
                                    <strong className="text-stone-900 font-semibold">{totalCount}</strong> transactions
                                </span>
                                <div className="flex items-center gap-1.5 border-l border-stone-200 pl-3">
                                    <span className="text-stone-500">Per page:</span>
                                    <select
                                        value={pageSize}
                                        onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                                        className="bg-[#FAFBF9] border border-[#CBCEC3] rounded-lg px-2 py-1 text-xs font-medium text-stone-800 focus:outline-none focus:border-[#2E6E52] cursor-pointer"
                                    >
                                        <option value={10}>10</option>
                                        <option value={15}>15</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                </div>
                            </div>

                            {totalPages > 1 && (
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        disabled={currentPage <= 1}
                                        onClick={() => {
                                            setCurrentPage(1);
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                        className="p-1.5 rounded-lg border border-[#E1E3DB] text-stone-600 hover:bg-stone-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                                        title="First page"
                                    >
                                        <ChevronsLeft className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        disabled={currentPage <= 1}
                                        onClick={() => {
                                            setCurrentPage((p) => Math.max(1, p - 1));
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                        className="p-1.5 rounded-lg border border-[#E1E3DB] text-stone-600 hover:bg-stone-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                                        title="Previous page"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>

                                    {/* Page Number Pills */}
                                    <div className="flex items-center gap-1 mx-1">
                                        {getPageNumbers(currentPage, totalPages).map((p, idx) => {
                                            if (p === '...') {
                                                return (
                                                    <span key={`ellipsis-${idx}`} className="px-1.5 text-xs text-stone-400">
                                                        …
                                                    </span>
                                                );
                                            }
                                            const pageNum = Number(p);
                                            const isActive = pageNum === currentPage;
                                            return (
                                                <button
                                                    key={pageNum}
                                                    type="button"
                                                    onClick={() => {
                                                        setCurrentPage(pageNum);
                                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                                    }}
                                                    className={`min-w-8 h-8 px-2 rounded-lg text-xs font-semibold transition-colors ${
                                                        isActive
                                                            ? 'bg-[#2E6E52] text-white shadow-xs'
                                                            : 'bg-[#FAFBF9] hover:bg-stone-100 text-stone-700 border border-[#E1E3DB]'
                                                    }`}
                                                >
                                                    {pageNum}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <button
                                        type="button"
                                        disabled={currentPage >= totalPages}
                                        onClick={() => {
                                            setCurrentPage((p) => Math.min(totalPages, p + 1));
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                        className="p-1.5 rounded-lg border border-[#E1E3DB] text-stone-600 hover:bg-stone-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                                        title="Next page"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        disabled={currentPage >= totalPages}
                                        onClick={() => {
                                            setCurrentPage(totalPages);
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                        className="p-1.5 rounded-lg border border-[#E1E3DB] text-stone-600 hover:bg-stone-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                                        title="Last page"
                                    >
                                        <ChevronsRight className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ListTxn;
