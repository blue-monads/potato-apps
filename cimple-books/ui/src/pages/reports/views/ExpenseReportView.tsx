import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { PieChart, TrendingDown, Layers, Receipt, Filter } from 'lucide-react';
import {
    getExpenseReport,
    listAccounts,
    listTransactions,
    type ExpenseReportData,
    type Account
} from '../../../lib/api';
import { MetricCard } from '../components/MetricCard';
import { formatCents, downloadCsv, formatDate } from '../components/ExportUtils';
import { BASE_PATH } from '../../../lib/base';

interface ExpenseReportViewProps {
    startDate: string;
    endDate: string;
    currencySymbol: string;
    onRegisterExport?: (exportFn: () => void) => void;
}

const BAR_COLORS = [
    'bg-rose-500',
    'bg-amber-500',
    'bg-blue-500',
    'bg-purple-500',
    'bg-emerald-500',
    'bg-indigo-500',
    'bg-cyan-500',
];

export const ExpenseReportView: React.FC<ExpenseReportViewProps> = ({
    startDate,
    endDate,
    currencySymbol,
    onRegisterExport,
}) => {
    const [data, setData] = useState<ExpenseReportData | null>(null);
    const [accountsList, setAccountsList] = useState<Account[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        listAccounts().then((res) => {
            if (res.status === 200) {
                const expAccounts = (res.data || []).filter((a) => a.acc_type === 'expenses');
                setAccountsList(expAccounts);
            }
        });
    }, []);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const resp = await getExpenseReport({
                accountId: selectedAccountId,
                startDate,
                endDate,
            });
            if (resp.status === 200 && resp.data) {
                setData({
                    ...resp.data,
                    by_account: Array.isArray(resp.data.by_account) ? resp.data.by_account : [],
                    transactions: Array.isArray(resp.data.transactions) ? resp.data.transactions : [],
                    timeline: Array.isArray(resp.data.timeline) ? resp.data.timeline : [],
                });
            } else {
                await fallbackCompute();
            }
        } catch {
            await fallbackCompute();
        } finally {
            setLoading(false);
        }
    };

    const fallbackCompute = async () => {
        try {
            const [accResp, txnResp] = await Promise.all([
                listAccounts(),
                listTransactions({ startDate, endDate, pageSize: 500 }),
            ]);

            const accounts = (accResp.data || []).filter((a) => a.acc_type === 'expenses');
            const targetAccs = selectedAccountId !== 'all'
                ? accounts.filter((a) => String(a.id) === selectedAccountId)
                : accounts;
            const expIdSet = new Set(targetAccs.map((a) => a.id));

            const transactions = txnResp.data?.items || [];
            const accAmountMap = new Map<number, { id: number; name: string; amount: number; txn_count: number }>();
            targetAccs.forEach((a) => accAmountMap.set(a.id, { id: a.id, name: a.name, amount: 0, txn_count: 0 }));

            const expTxns: ExpenseReportData['transactions'] = [];
            let total = 0;

            transactions.forEach((t) => {
                (t.lines || []).forEach((l) => {
                    if (expIdSet.has(l.account_id)) {
                        const deb = (l.debit_amount || 0) - (l.credit_amount || 0);
                        if (deb > 0) {
                            total += deb;
                            const am = accAmountMap.get(l.account_id)!;
                            am.amount += deb;
                            am.txn_count += 1;

                            expTxns.push({
                                txn_id: t.id,
                                date: t.txn_date,
                                title: t.title,
                                notes: t.notes,
                                reference_id: t.reference_id,
                                account_name: am.name,
                                amount: deb,
                            });
                        }
                    }
                });
            });

            const by_account = Array.from(accAmountMap.values())
                .filter((a) => a.amount > 0 || selectedAccountId !== 'all')
                .map((a) => ({
                    ...a,
                    percentage: total > 0 ? (a.amount / total) * 100 : 0,
                }))
                .sort((a, b) => b.amount - a.amount);

            setData({
                start_date: startDate || null,
                end_date: endDate || null,
                total_expenses: total,
                total_entries: expTxns.length,
                avg_expense: expTxns.length > 0 ? Math.floor(total / expTxns.length) : 0,
                by_account,
                transactions: expTxns.slice(0, 100),
                timeline: [],
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to compute expense report');
        }
    };

    useEffect(() => {
        loadData();
    }, [startDate, endDate, selectedAccountId]);

    const byAccountList = Array.isArray(data?.by_account) ? data.by_account : [];
    const transactionsList = Array.isArray(data?.transactions) ? data.transactions : [];

    useEffect(() => {
        if (!onRegisterExport || !data) return;
        onRegisterExport(() => {
            const rows: (string | number)[][] = [
                ['Expense Analysis Report'],
                ['Period', `${startDate || 'Start'} to ${endDate || 'Current'}`],
                ['Total Expenses', (data.total_expenses / 100).toFixed(2)],
                ['Total Entries', data.total_entries],
                ['Average Expense', (data.avg_expense / 100).toFixed(2)],
                [],
                ['EXPENSES BY ACCOUNT', 'Amount ($)', 'Transactions Count', 'Share (%)'],
                ...byAccountList.map((a) => [
                    a.name,
                    (a.amount / 100).toFixed(2),
                    a.txn_count,
                    `${a.percentage.toFixed(1)}%`,
                ]),
                [],
                ['EXPENSE TRANSACTIONS LOG', 'Date', 'Txn #', 'Description', 'Account', 'Amount ($)', 'Reference'],
                ...transactionsList.map((t) => [
                    formatDate(t.date),
                    `TXN-${t.txn_id}`,
                    t.title,
                    t.account_name,
                    (t.amount / 100).toFixed(2),
                    t.reference_id,
                ]),
            ];
            downloadCsv(`expense_report_${selectedAccountId}_${startDate || 'all'}`, rows);
        });
    }, [data, selectedAccountId, onRegisterExport, byAccountList, transactionsList]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-16">
                <div className="text-stone-500 font-sans text-sm animate-pulse">Calculating expense analytics...</div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
                {error || 'Unable to generate expense report'}
            </div>
        );
    }

    const topCategory = data.by_account[0]?.name || 'None';

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="Total Expenses"
                    value={formatCents(data.total_expenses, currencySymbol)}
                    subtitle="Operational & cost outflows"
                    icon={TrendingDown}
                    color="rose"
                />
                <MetricCard
                    title="Expense Entries"
                    value={String(data.total_entries)}
                    subtitle="Logged expenditures"
                    icon={Receipt}
                    color="blue"
                />
                <MetricCard
                    title="Average Expenditure"
                    value={formatCents(data.avg_expense, currencySymbol)}
                    subtitle="Per recorded transaction"
                    icon={PieChart}
                    color="purple"
                />
                <MetricCard
                    title="Top Spending Category"
                    value={topCategory}
                    subtitle={data.by_account[0] ? `${data.by_account[0].percentage.toFixed(1)}% of all expenses` : 'No expenses'}
                    icon={Layers}
                    color="amber"
                />
            </div>

            {/* Filter by Category */}
            <div className="bg-white rounded-xl border border-[#E1E3DB] p-4 shadow-xs flex items-center justify-between gap-4 print:hidden">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-600">
                        <Filter className="w-3.5 h-3.5 text-stone-400" />
                        <span>Filter Expense Category:</span>
                    </div>
                    <select
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                        className="text-xs bg-[#F8F9F6] border border-[#E1E3DB] rounded-lg px-3 py-1.5 text-stone-800 font-medium focus:outline-hidden focus:ring-1 focus:ring-[#2E6E52]"
                    >
                        <option value="all">All Expense Accounts</option>
                        {accountsList.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Visual Category Distribution Bar */}
            {data.total_expenses > 0 && (
                <div className="bg-white rounded-xl border border-[#E1E3DB] p-5 shadow-xs">
                    <div className="flex items-center justify-between text-xs font-semibold text-stone-700 mb-2">
                        <span>Expense Distribution by Account</span>
                        <span>{data.by_account.length} categories active</span>
                    </div>
                    <div className="w-full bg-stone-100 h-3 rounded-full overflow-hidden flex">
                        {data.by_account.map((acc, idx) => (
                            <div
                                key={acc.id}
                                style={{ width: `${acc.percentage}%` }}
                                className={`${BAR_COLORS[idx % BAR_COLORS.length]} h-full transition-all`}
                                title={`${acc.name}: ${formatCents(acc.amount, currencySymbol)} (${acc.percentage.toFixed(1)}%)`}
                            />
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-stone-600 mt-3">
                        {data.by_account.map((acc, idx) => (
                            <span key={acc.id} className="flex items-center gap-1.5">
                                <span className={`w-2.5 h-2.5 rounded-full ${BAR_COLORS[idx % BAR_COLORS.length]}`} />
                                {acc.name}: <strong className="text-stone-900">{acc.percentage.toFixed(1)}%</strong>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Expenses by Category Table */}
            <div className="bg-white rounded-xl border border-[#E1E3DB] shadow-xs overflow-hidden">
                <div className="px-5 py-4 bg-[#F8F9F6] border-b border-[#E1E3DB] flex items-center justify-between">
                    <h3 className="font-semibold text-stone-900 text-sm flex items-center gap-2">
                        <PieChart className="w-4 h-4 text-stone-500" />
                        Expenses Breakdown by Category
                    </h3>
                    <span className="text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                        {formatCents(data.total_expenses, currencySymbol)}
                    </span>
                </div>
                <table className="min-w-full divide-y divide-[#E1E3DB]">
                    <thead className="bg-[#FAFBF9] text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                        <tr>
                            <th className="px-5 py-3 text-left">Category / Account</th>
                            <th className="px-5 py-3 text-center">Txn Count</th>
                            <th className="px-5 py-3 text-right">Percentage Share</th>
                            <th className="px-5 py-3 text-right">Total Spent</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E1E3DB] text-xs">
                        {byAccountList.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-10 text-center text-stone-400">
                                    No expenses recorded for this selection
                                </td>
                            </tr>
                        ) : (
                            byAccountList.map((acc) => (
                                <tr key={acc.id} className="hover:bg-[#FAFBF9] transition-colors">
                                    <td className="px-5 py-3.5 font-medium text-stone-900">
                                        <Link
                                            to={`${BASE_PATH}txns?accountId=${acc.id}`}
                                            className="hover:text-[#2E6E52] hover:underline"
                                            title="View account journal"
                                        >
                                            {acc.name}
                                        </Link>
                                    </td>
                                    <td className="px-5 py-3.5 text-center text-stone-600">
                                        {acc.txn_count}
                                    </td>
                                    <td className="px-5 py-3.5 text-right font-medium text-stone-600">
                                        {acc.percentage.toFixed(1)}%
                                    </td>
                                    <td className="px-5 py-3.5 text-right font-mono font-bold text-rose-700">
                                        {formatCents(acc.amount, currencySymbol)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                    <tfoot className="bg-[#FAFBF9] border-t-2 border-[#E1E3DB] font-bold text-xs text-stone-900">
                        <tr>
                            <td className="px-5 py-3.5">Total Operating Expenses</td>
                            <td className="px-5 py-3.5 text-center">{data.total_entries}</td>
                            <td className="px-5 py-3.5 text-right">100.0%</td>
                            <td className="px-5 py-3.5 text-right font-mono text-rose-800 font-display text-sm">
                                {formatCents(data.total_expenses, currencySymbol)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Individual Expense Transactions */}
            <div className="bg-white rounded-xl border border-[#E1E3DB] shadow-xs overflow-hidden">
                <div className="px-5 py-4 bg-[#F8F9F6] border-b border-[#E1E3DB] flex items-center justify-between">
                    <h3 className="font-semibold text-stone-900 text-sm flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-stone-500" />
                        Recent Expense Transactions
                    </h3>
                    <span className="text-xs text-stone-500">Latest 100 entries</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-[#E1E3DB]">
                        <thead className="bg-[#FAFBF9] text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                            <tr>
                                <th className="px-5 py-3 text-left w-24">Date</th>
                                <th className="px-5 py-3 text-left w-20">Txn #</th>
                                <th className="px-5 py-3 text-left">Description</th>
                                <th className="px-5 py-3 text-left">Category</th>
                                <th className="px-5 py-3 text-left w-28">Reference</th>
                                <th className="px-5 py-3 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E1E3DB] text-xs">
                            {transactionsList.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-5 py-8 text-center text-stone-400">
                                        No expense transactions recorded
                                    </td>
                                </tr>
                            ) : (
                                transactionsList.map((t) => (
                                    <tr key={`${t.txn_id}-${t.amount}`} className="hover:bg-[#FAFBF9] transition-colors">
                                        <td className="px-5 py-3 whitespace-nowrap text-stone-500">
                                            {formatDate(t.date)}
                                        </td>
                                        <td className="px-5 py-3 whitespace-nowrap text-stone-400 font-mono">
                                            <Link
                                                to={`${BASE_PATH}txns?search=${t.txn_id}`}
                                                className="hover:text-[#2E6E52] hover:underline"
                                            >
                                                #{t.txn_id}
                                            </Link>
                                        </td>
                                        <td className="px-5 py-3 font-medium text-stone-900 max-w-xs truncate">
                                            {t.title}
                                        </td>
                                        <td className="px-5 py-3 whitespace-nowrap text-stone-700">
                                            {t.account_name}
                                        </td>
                                        <td className="px-5 py-3 whitespace-nowrap text-stone-400 font-mono text-[11px]">
                                            {t.reference_id || '—'}
                                        </td>
                                        <td className="px-5 py-3 whitespace-nowrap text-right font-mono font-bold text-rose-700">
                                            {formatCents(t.amount, currencySymbol)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
