import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Percent } from 'lucide-react';
import {
    getProfitLossReport,
    listAccounts,
    listTransactions,
    type ProfitLossReportData
} from '../../../lib/api';
import { MetricCard } from '../components/MetricCard';
import { formatCents, downloadCsv } from '../components/ExportUtils';
import { BASE_PATH } from '../../../lib/base';

interface ProfitLossViewProps {
    startDate: string;
    endDate: string;
    currencySymbol: string;
    onRegisterExport?: (exportFn: () => void) => void;
}

export const ProfitLossView: React.FC<ProfitLossViewProps> = ({
    startDate,
    endDate,
    currencySymbol,
    onRegisterExport,
}) => {
    const [data, setData] = useState<ProfitLossReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const resp = await getProfitLossReport({ startDate, endDate });
            if (resp.status === 200 && resp.data) {
                setData(resp.data);
            } else {
                // Fallback computation
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

            const revMap = new Map<number, { id: number; name: string; acc_type: string; amount: number }>();
            const expMap = new Map<number, { id: number; name: string; acc_type: string; amount: number }>();

            accounts.forEach((a) => {
                if (a.acc_type === 'revenue') revMap.set(a.id, { id: a.id, name: a.name, acc_type: a.acc_type, amount: 0 });
                if (a.acc_type === 'expenses') expMap.set(a.id, { id: a.id, name: a.name, acc_type: a.acc_type, amount: 0 });
            });

            transactions.forEach((t) => {
                (t.lines || []).forEach((l) => {
                    if (revMap.has(l.account_id)) {
                        const item = revMap.get(l.account_id)!;
                        item.amount += (l.credit_amount || 0) - (l.debit_amount || 0);
                    }
                    if (expMap.has(l.account_id)) {
                        const item = expMap.get(l.account_id)!;
                        item.amount += (l.debit_amount || 0) - (l.credit_amount || 0);
                    }
                });
            });

            const revenue = Array.from(revMap.values()).sort((a, b) => b.amount - a.amount);
            const expenses = Array.from(expMap.values()).sort((a, b) => b.amount - a.amount);

            const total_revenue = revenue.reduce((sum, r) => sum + r.amount, 0);
            const total_expenses = expenses.reduce((sum, e) => sum + e.amount, 0);
            const net_profit = total_revenue - total_expenses;
            const net_margin_pct = total_revenue > 0 ? (net_profit / total_revenue) * 100 : 0;

            setData({
                start_date: startDate || null,
                end_date: endDate || null,
                total_revenue,
                total_expenses,
                net_profit,
                net_margin_pct,
                revenue,
                expenses,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to compute Profit & Loss statement');
        }
    };

    useEffect(() => {
        loadData();
    }, [startDate, endDate]);

    useEffect(() => {
        if (!onRegisterExport || !data) return;
        onRegisterExport(() => {
            const rows: (string | number)[][] = [
                ['Profit & Loss Statement'],
                ['Period', `${startDate || 'Start'} to ${endDate || 'Current'}`],
                [],
                ['REVENUE ACCOUNTS', 'Account Type', 'Amount ($)'],
                ...data.revenue.map((r) => [r.name, r.acc_type, (r.amount / 100).toFixed(2)]),
                ['Total Revenue', '', (data.total_revenue / 100).toFixed(2)],
                [],
                ['EXPENSE ACCOUNTS', 'Account Type', 'Amount ($)'],
                ...data.expenses.map((e) => [e.name, e.acc_type, (e.amount / 100).toFixed(2)]),
                ['Total Expenses', '', (data.total_expenses / 100).toFixed(2)],
                [],
                ['Net Profit / (Loss)', '', (data.net_profit / 100).toFixed(2)],
                ['Net Margin %', '', `${data.net_margin_pct.toFixed(2)}%`],
            ];
            downloadCsv(`profit_loss_${startDate || 'all'}_to_${endDate || 'today'}`, rows);
        });
    }, [data, onRegisterExport]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-16">
                <div className="text-stone-500 font-sans text-sm animate-pulse">Calculating Profit & Loss statement...</div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
                {error || 'Unable to generate statement'}
            </div>
        );
    }

    const isProfitable = data.net_profit >= 0;

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="Total Revenue"
                    value={formatCents(data.total_revenue, currencySymbol)}
                    subtitle="Gross earned income"
                    icon={TrendingUp}
                    color="emerald"
                />
                <MetricCard
                    title="Total Expenses"
                    value={formatCents(data.total_expenses, currencySymbol)}
                    subtitle="Cost of operations & goods"
                    icon={TrendingDown}
                    color="rose"
                />
                <MetricCard
                    title="Net Profit / (Loss)"
                    value={formatCents(data.net_profit, currencySymbol)}
                    subtitle={isProfitable ? 'Positive net income' : 'Net deficit'}
                    icon={isProfitable ? ArrowUpRight : ArrowDownRight}
                    color={isProfitable ? 'emerald' : 'rose'}
                    badgeText={isProfitable ? 'Profitable' : 'Deficit'}
                    badgeVariant={isProfitable ? 'success' : 'danger'}
                />
                <MetricCard
                    title="Net Profit Margin"
                    value={`${data.net_margin_pct.toFixed(1)}%`}
                    subtitle="Of total revenue"
                    icon={Percent}
                    color="blue"
                />
            </div>

            {/* Income Distribution Visual Progress */}
            {data.total_revenue > 0 && (
                <div className="bg-white rounded-xl border border-[#E1E3DB] p-5 shadow-xs">
                    <div className="flex items-center justify-between text-xs font-semibold text-stone-700 mb-2">
                        <span>Revenue Breakdown</span>
                        <span>
                            Expenses: {((data.total_expenses / data.total_revenue) * 100).toFixed(1)}% | Net Margin: {data.net_margin_pct.toFixed(1)}%
                        </span>
                    </div>
                    <div className="w-full bg-stone-100 h-3 rounded-full overflow-hidden flex">
                        <div
                            style={{ width: `${Math.min(100, Math.max(0, (data.total_expenses / data.total_revenue) * 100))}%` }}
                            className="bg-rose-500 h-full transition-all"
                            title={`Expenses: ${formatCents(data.total_expenses, currencySymbol)}`}
                        />
                        {isProfitable && (
                            <div
                                style={{ width: `${Math.min(100, data.net_margin_pct)}%` }}
                                className="bg-emerald-500 h-full transition-all"
                                title={`Net Profit: ${formatCents(data.net_profit, currencySymbol)}`}
                            />
                        )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-stone-500 mt-2.5">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                            Operating Expenses
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            Net Profit
                        </span>
                    </div>
                </div>
            )}

            {/* Detailed Tables: Revenue & Expenses */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Table */}
                <div className="bg-white rounded-xl border border-[#E1E3DB] shadow-xs overflow-hidden flex flex-col justify-between">
                    <div>
                        <div className="px-5 py-4 bg-[#F8F9F6] border-b border-[#E1E3DB] flex items-center justify-between">
                            <h3 className="font-semibold text-stone-900 text-sm flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                Revenue (Income)
                            </h3>
                            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                {formatCents(data.total_revenue, currencySymbol)}
                            </span>
                        </div>

                        <table className="min-w-full divide-y divide-[#E1E3DB]">
                            <thead className="bg-[#FAFBF9] text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-3 text-left">Account</th>
                                    <th className="px-5 py-3 text-right">Share</th>
                                    <th className="px-5 py-3 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E1E3DB] text-xs">
                                {data.revenue.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-5 py-6 text-center text-stone-400">
                                            No revenue recorded in this period
                                        </td>
                                    </tr>
                                ) : (
                                    data.revenue.map((acc) => {
                                        const share = data.total_revenue > 0 ? (acc.amount / data.total_revenue) * 100 : 0;
                                        return (
                                            <tr key={acc.id} className="hover:bg-[#FAFBF9] transition-colors">
                                                <td className="px-5 py-3.5 font-medium text-stone-900">
                                                    <Link
                                                        to={`${BASE_PATH}txns?accountId=${acc.id}`}
                                                        className="hover:text-[#2E6E52] hover:underline"
                                                        title="View account ledger"
                                                    >
                                                        {acc.name}
                                                    </Link>
                                                </td>
                                                <td className="px-5 py-3.5 text-right text-stone-500">
                                                    {share.toFixed(1)}%
                                                </td>
                                                <td className="px-5 py-3.5 text-right font-semibold text-emerald-700">
                                                    {formatCents(acc.amount, currencySymbol)}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="px-5 py-3.5 bg-[#FAFBF9] border-t border-[#E1E3DB] flex items-center justify-between font-bold text-xs text-stone-900">
                        <span>Total Revenue</span>
                        <span className="text-emerald-700 font-display text-sm">
                            {formatCents(data.total_revenue, currencySymbol)}
                        </span>
                    </div>
                </div>

                {/* Expenses Table */}
                <div className="bg-white rounded-xl border border-[#E1E3DB] shadow-xs overflow-hidden flex flex-col justify-between">
                    <div>
                        <div className="px-5 py-4 bg-[#F8F9F6] border-b border-[#E1E3DB] flex items-center justify-between">
                            <h3 className="font-semibold text-stone-900 text-sm flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-rose-500" />
                                Operating Expenses
                            </h3>
                            <span className="text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                                {formatCents(data.total_expenses, currencySymbol)}
                            </span>
                        </div>

                        <table className="min-w-full divide-y divide-[#E1E3DB]">
                            <thead className="bg-[#FAFBF9] text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-3 text-left">Account</th>
                                    <th className="px-5 py-3 text-right">Share</th>
                                    <th className="px-5 py-3 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E1E3DB] text-xs">
                                {data.expenses.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-5 py-6 text-center text-stone-400">
                                            No expenses recorded in this period
                                        </td>
                                    </tr>
                                ) : (
                                    data.expenses.map((acc) => {
                                        const share = data.total_expenses > 0 ? (acc.amount / data.total_expenses) * 100 : 0;
                                        return (
                                            <tr key={acc.id} className="hover:bg-[#FAFBF9] transition-colors">
                                                <td className="px-5 py-3.5 font-medium text-stone-900">
                                                    <Link
                                                        to={`${BASE_PATH}txns?accountId=${acc.id}`}
                                                        className="hover:text-[#2E6E52] hover:underline"
                                                        title="View account ledger"
                                                    >
                                                        {acc.name}
                                                    </Link>
                                                </td>
                                                <td className="px-5 py-3.5 text-right text-stone-500">
                                                    {share.toFixed(1)}%
                                                </td>
                                                <td className="px-5 py-3.5 text-right font-semibold text-rose-700">
                                                    {formatCents(acc.amount, currencySymbol)}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="px-5 py-3.5 bg-[#FAFBF9] border-t border-[#E1E3DB] flex items-center justify-between font-bold text-xs text-stone-900">
                        <span>Total Expenses</span>
                        <span className="text-rose-700 font-display text-sm">
                            {formatCents(data.total_expenses, currencySymbol)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Net Income Summary Card */}
            <div
                className={`rounded-xl border p-6 flex flex-col sm:flex-row items-center justify-between gap-4 ${
                    isProfitable
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                        : 'bg-rose-50/70 border-rose-200 text-rose-950'
                }`}
            >
                <div>
                    <h4 className="text-lg font-bold font-display">
                        Net Operating Income: {formatCents(data.net_profit, currencySymbol)}
                    </h4>
                    <p className="text-xs opacity-80 mt-1">
                        {isProfitable
                            ? `Strong profitability of ${data.net_margin_pct.toFixed(1)}% over total earned revenues.`
                            : `Net deficit for selected period. Expenses exceeded revenues by ${formatCents(Math.abs(data.net_profit), currencySymbol)}.`}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        to={`${BASE_PATH}reports/balance-sheet`}
                        className="px-4 py-2 bg-white hover:bg-stone-50 border border-stone-200 rounded-lg text-xs font-semibold text-stone-800 shadow-xs transition-colors"
                    >
                        View Balance Sheet
                    </Link>
                    <Link
                        to={`${BASE_PATH}reports/general-ledger`}
                        className="px-4 py-2 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                    >
                        View General Ledger
                    </Link>
                </div>
            </div>
        </div>
    );
};
