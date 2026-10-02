import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Calculator, CheckCircle2, AlertTriangle, Search, Scale } from 'lucide-react';
import {
    getTrialBalanceReport,
    listAccounts,
    listTransactions,
    type TrialBalanceReportData,
    type TrialBalanceItem
} from '../../../lib/api';
import { MetricCard } from '../components/MetricCard';
import { formatCents, downloadCsv, formatDate } from '../components/ExportUtils';
import { BASE_PATH } from '../../../lib/base';

interface TrialBalanceViewProps {
    asOfDate?: string;
    startDate?: string;
    endDate?: string;
    currencySymbol: string;
    onRegisterExport?: (exportFn: () => void) => void;
}

const TYPE_BADGES: Record<string, string> = {
    assets: 'bg-blue-50 text-blue-800 border-blue-200',
    liabilities: 'bg-amber-50 text-amber-800 border-amber-200',
    equity: 'bg-purple-50 text-purple-800 border-purple-200',
    revenue: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    expenses: 'bg-rose-50 text-rose-800 border-rose-200',
};

export const TrialBalanceView: React.FC<TrialBalanceViewProps> = ({
    asOfDate,
    startDate,
    endDate,
    currencySymbol,
    onRegisterExport,
}) => {
    const [data, setData] = useState<TrialBalanceReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const resp = await getTrialBalanceReport({ asOfDate, startDate, endDate });
            if (resp.status === 200 && resp.data) {
                setData(resp.data);
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

            const accounts = accResp.data || [];
            const transactions = txnResp.data?.items || [];

            const map = new Map<number, { debit: number; credit: number }>();
            accounts.forEach((a) => map.set(a.id, { debit: 0, credit: 0 }));

            transactions.forEach((t) => {
                (t.lines || []).forEach((l) => {
                    if (map.has(l.account_id)) {
                        const cur = map.get(l.account_id)!;
                        cur.debit += l.debit_amount || 0;
                        cur.credit += l.credit_amount || 0;
                    }
                });
            });

            let total_debits = 0;
            let total_credits = 0;
            let total_net_debits = 0;
            let total_net_credits = 0;

            const items: TrialBalanceItem[] = accounts.map((a) => {
                const bal = map.get(a.id) || { debit: 0, credit: 0 };
                total_debits += bal.debit;
                total_credits += bal.credit;

                const net_debit = bal.debit > bal.credit ? bal.debit - bal.credit : 0;
                const net_credit = bal.credit > bal.debit ? bal.credit - bal.debit : 0;
                total_net_debits += net_debit;
                total_net_credits += net_credit;

                return {
                    id: a.id,
                    name: a.name,
                    acc_type: a.acc_type,
                    debit: bal.debit,
                    credit: bal.credit,
                    net_debit,
                    net_credit,
                };
            });

            const difference = total_debits - total_credits;
            const is_balanced = Math.abs(difference) <= 1;

            setData({
                as_of_date: asOfDate || null,
                start_date: startDate || null,
                end_date: endDate || null,
                total_debits,
                total_credits,
                total_net_debits,
                total_net_credits,
                difference,
                is_balanced,
                items,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to compute Trial Balance');
        }
    };

    useEffect(() => {
        loadData();
    }, [asOfDate, startDate, endDate]);

    useEffect(() => {
        if (!onRegisterExport || !data) return;
        onRegisterExport(() => {
            const rows: (string | number)[][] = [
                ['Trial Balance'],
                ['Date', asOfDate ? formatDate(asOfDate) : `${startDate || 'Start'} to ${endDate || 'Current'}`],
                [],
                ['Account ID', 'Account Name', 'Type', 'Debit ($)', 'Credit ($)', 'Net Debit ($)', 'Net Credit ($)'],
                ...data.items.map((i) => [
                    i.id,
                    i.name,
                    i.acc_type,
                    (i.debit / 100).toFixed(2),
                    (i.credit / 100).toFixed(2),
                    (i.net_debit / 100).toFixed(2),
                    (i.net_credit / 100).toFixed(2),
                ]),
                [],
                ['TOTALS', '', '', (data.total_debits / 100).toFixed(2), (data.total_credits / 100).toFixed(2), (data.total_net_debits / 100).toFixed(2), (data.total_net_credits / 100).toFixed(2)],
                ['Balanced', '', '', data.is_balanced ? 'YES' : 'NO', '', '', ''],
            ];
            downloadCsv(`trial_balance_${asOfDate || endDate || 'all'}`, rows);
        });
    }, [data, onRegisterExport]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-16">
                <div className="text-stone-500 font-sans text-sm animate-pulse">Calculating Trial Balance...</div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
                {error || 'Unable to generate trial balance'}
            </div>
        );
    }

    const filteredItems = data.items.filter((item) => {
        const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || String(item.id).includes(search);
        const matchesType = typeFilter === 'all' || item.acc_type === typeFilter;
        return matchesSearch && matchesType;
    });

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="Total Debits"
                    value={formatCents(data.total_debits, currencySymbol)}
                    subtitle="Sum of all debit journal postings"
                    icon={Calculator}
                    color="blue"
                />
                <MetricCard
                    title="Total Credits"
                    value={formatCents(data.total_credits, currencySymbol)}
                    subtitle="Sum of all credit journal postings"
                    icon={Calculator}
                    color="purple"
                />
                <MetricCard
                    title="Net Balance Total"
                    value={formatCents(data.total_net_debits, currencySymbol)}
                    subtitle={`Net Debits = Net Credits (${formatCents(data.total_net_credits, currencySymbol)})`}
                    icon={Scale}
                    color="stone"
                />
                <MetricCard
                    title="Audit Status"
                    value={data.is_balanced ? 'Balanced' : 'Discrepancy'}
                    subtitle={data.is_balanced ? 'Total Debits = Total Credits' : `Difference: ${formatCents(data.difference, currencySymbol)}`}
                    icon={data.is_balanced ? CheckCircle2 : AlertTriangle}
                    color={data.is_balanced ? 'emerald' : 'rose'}
                    badgeText={data.is_balanced ? 'Verified' : 'Check Entries'}
                    badgeVariant={data.is_balanced ? 'success' : 'danger'}
                />
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-[#E1E3DB] shadow-xs print:hidden">
                <div className="flex items-center gap-2 flex-1 max-w-sm">
                    <div className="relative w-full">
                        <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search account name or ID..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full text-xs pl-8 pr-3 py-1.5 bg-[#F8F9F6] border border-[#E1E3DB] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#2E6E52]"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-500 font-medium">Type:</span>
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="text-xs bg-[#F8F9F6] border border-[#E1E3DB] rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-[#2E6E52]"
                    >
                        <option value="all">All Account Types</option>
                        <option value="assets">Assets</option>
                        <option value="liabilities">Liabilities</option>
                        <option value="equity">Equity</option>
                        <option value="revenue">Revenue</option>
                        <option value="expenses">Expenses</option>
                    </select>
                </div>
            </div>

            {/* Trial Balance Table */}
            <div className="bg-white rounded-xl border border-[#E1E3DB] shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-[#E1E3DB]">
                        <thead className="bg-[#F8F9F6] text-[11px] font-semibold text-stone-600 uppercase tracking-wider">
                            <tr>
                                <th className="px-5 py-3.5 text-left w-16">ID</th>
                                <th className="px-5 py-3.5 text-left">Account Name</th>
                                <th className="px-5 py-3.5 text-left w-28">Type</th>
                                <th className="px-5 py-3.5 text-right">Debit Postings</th>
                                <th className="px-5 py-3.5 text-right">Credit Postings</th>
                                <th className="px-5 py-3.5 text-right">Net Debit</th>
                                <th className="px-5 py-3.5 text-right">Net Credit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E1E3DB] text-xs">
                            {filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-stone-400">
                                        No accounts match your search filter
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-[#FAFBF9] transition-colors">
                                        <td className="px-5 py-3.5 text-stone-400 font-mono">
                                            #{item.id}
                                        </td>
                                        <td className="px-5 py-3.5 font-medium text-stone-900">
                                            <Link
                                                to={`${BASE_PATH}txns?accountId=${item.id}`}
                                                className="hover:text-[#2E6E52] hover:underline"
                                                title="View journal entries"
                                            >
                                                {item.name}
                                            </Link>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                                TYPE_BADGES[item.acc_type] || 'bg-stone-50 text-stone-700'
                                            }`}>
                                                {item.acc_type}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-right font-mono text-stone-700">
                                            {item.debit > 0 ? formatCents(item.debit, currencySymbol) : '—'}
                                        </td>
                                        <td className="px-5 py-3.5 text-right font-mono text-stone-700">
                                            {item.credit > 0 ? formatCents(item.credit, currencySymbol) : '—'}
                                        </td>
                                        <td className="px-5 py-3.5 text-right font-mono font-semibold text-blue-900 bg-blue-50/20">
                                            {item.net_debit > 0 ? formatCents(item.net_debit, currencySymbol) : '—'}
                                        </td>
                                        <td className="px-5 py-3.5 text-right font-mono font-semibold text-purple-900 bg-purple-50/20">
                                            {item.net_credit > 0 ? formatCents(item.net_credit, currencySymbol) : '—'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        <tfoot className="bg-[#FAFBF9] border-t-2 border-[#E1E3DB] text-xs font-bold text-stone-900">
                            <tr>
                                <td colSpan={3} className="px-5 py-4 uppercase tracking-wider text-[11px]">
                                    Grand Totals
                                </td>
                                <td className="px-5 py-4 text-right font-mono text-stone-900">
                                    {formatCents(data.total_debits, currencySymbol)}
                                </td>
                                <td className="px-5 py-4 text-right font-mono text-stone-900">
                                    {formatCents(data.total_credits, currencySymbol)}
                                </td>
                                <td className="px-5 py-4 text-right font-mono text-blue-950 bg-blue-50/50 font-display text-sm">
                                    {formatCents(data.total_net_debits, currencySymbol)}
                                </td>
                                <td className="px-5 py-4 text-right font-mono text-purple-950 bg-purple-50/50 font-display text-sm">
                                    {formatCents(data.total_net_credits, currencySymbol)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
};
