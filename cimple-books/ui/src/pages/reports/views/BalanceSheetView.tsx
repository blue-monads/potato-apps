import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, AlertTriangle, ShieldCheck, Landmark, Scale, Briefcase } from 'lucide-react';
import {
    getBalanceSheetReport,
    listAccounts,
    listTransactions,
    type BalanceSheetReportData
} from '../../../lib/api';
import { MetricCard } from '../components/MetricCard';
import { formatCents, downloadCsv, formatDate } from '../components/ExportUtils';
import { BASE_PATH } from '../../../lib/base';

interface BalanceSheetViewProps {
    asOfDate: string;
    currencySymbol: string;
    onRegisterExport?: (exportFn: () => void) => void;
}

export const BalanceSheetView: React.FC<BalanceSheetViewProps> = ({
    asOfDate,
    currencySymbol,
    onRegisterExport,
}) => {
    const [data, setData] = useState<BalanceSheetReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const resp = await getBalanceSheetReport({ asOfDate });
            if (resp.status === 200 && resp.data) {
                setData({
                    ...resp.data,
                    assets: Array.isArray(resp.data.assets) ? resp.data.assets : [],
                    liabilities: Array.isArray(resp.data.liabilities) ? resp.data.liabilities : [],
                    equity: Array.isArray(resp.data.equity) ? resp.data.equity : [],
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
                listTransactions({ endDate: asOfDate, pageSize: 500 }),
            ]);

            const accounts = accResp.data || [];
            const transactions = txnResp.data?.items || [];

            const assetMap = new Map<number, { id: number; name: string; acc_type: string; amount: number }>();
            const liabMap = new Map<number, { id: number; name: string; acc_type: string; amount: number }>();
            const eqMap = new Map<number, { id: number; name: string; acc_type: string; amount: number }>();
            let cumRev = 0;
            let cumExp = 0;

            const accLookup = new Map<number, string>();
            accounts.forEach((a) => {
                accLookup.set(a.id, a.acc_type);
                if (a.acc_type === 'assets') assetMap.set(a.id, { id: a.id, name: a.name, acc_type: a.acc_type, amount: 0 });
                if (a.acc_type === 'liabilities') liabMap.set(a.id, { id: a.id, name: a.name, acc_type: a.acc_type, amount: 0 });
                if (a.acc_type === 'equity') eqMap.set(a.id, { id: a.id, name: a.name, acc_type: a.acc_type, amount: 0 });
            });

            transactions.forEach((t) => {
                (t.lines || []).forEach((l) => {
                    const atype = accLookup.get(l.account_id);
                    if (atype === 'assets' && assetMap.has(l.account_id)) {
                        assetMap.get(l.account_id)!.amount += (l.debit_amount || 0) - (l.credit_amount || 0);
                    } else if (atype === 'liabilities' && liabMap.has(l.account_id)) {
                        liabMap.get(l.account_id)!.amount += (l.credit_amount || 0) - (l.debit_amount || 0);
                    } else if (atype === 'equity' && eqMap.has(l.account_id)) {
                        eqMap.get(l.account_id)!.amount += (l.credit_amount || 0) - (l.debit_amount || 0);
                    } else if (atype === 'revenue') {
                        cumRev += (l.credit_amount || 0) - (l.debit_amount || 0);
                    } else if (atype === 'expenses') {
                        cumExp += (l.debit_amount || 0) - (l.credit_amount || 0);
                    }
                });
            });

            const assets = Array.from(assetMap.values()).sort((a, b) => b.amount - a.amount);
            const liabilities = Array.from(liabMap.values()).sort((a, b) => b.amount - a.amount);
            const equity = Array.from(eqMap.values()).sort((a, b) => b.amount - a.amount);

            const total_assets = assets.reduce((sum, a) => sum + a.amount, 0);
            const total_liabilities = liabilities.reduce((sum, l) => sum + l.amount, 0);
            const retained_earnings = cumRev - cumExp;
            const equity_acc_total = equity.reduce((sum, e) => sum + e.amount, 0);
            const total_equity = equity_acc_total + retained_earnings;
            const total_liabilities_equity = total_liabilities + total_equity;
            const difference = total_assets - total_liabilities_equity;
            const is_balanced = Math.abs(difference) <= 1;

            setData({
                as_of_date: asOfDate,
                assets,
                total_assets,
                liabilities,
                total_liabilities,
                equity,
                retained_earnings,
                total_equity,
                total_liabilities_equity,
                difference,
                is_balanced,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to compute Balance Sheet');
        }
    };

    useEffect(() => {
        loadData();
    }, [asOfDate]);

    const assetsList = Array.isArray(data?.assets) ? data.assets : [];
    const liabilitiesList = Array.isArray(data?.liabilities) ? data.liabilities : [];
    const equityList = Array.isArray(data?.equity) ? data.equity : [];

    useEffect(() => {
        if (!onRegisterExport || !data) return;
        onRegisterExport(() => {
            const rows: (string | number)[][] = [
                ['Balance Sheet'],
                ['As of Date', formatDate(data.as_of_date)],
                [],
                ['ASSETS', 'Type', 'Balance ($)'],
                ...assetsList.map((a) => [a.name, a.acc_type, (a.amount / 100).toFixed(2)]),
                ['Total Assets', '', (data.total_assets / 100).toFixed(2)],
                [],
                ['LIABILITIES', 'Type', 'Balance ($)'],
                ...liabilitiesList.map((l) => [l.name, l.acc_type, (l.amount / 100).toFixed(2)]),
                ['Total Liabilities', '', (data.total_liabilities / 100).toFixed(2)],
                [],
                ['EQUITY', 'Type', 'Balance ($)'],
                ...equityList.map((e) => [e.name, e.acc_type, (e.amount / 100).toFixed(2)]),
                ['Retained / Current Earnings', 'equity', (data.retained_earnings / 100).toFixed(2)],
                ['Total Equity', '', (data.total_equity / 100).toFixed(2)],
                [],
                ['Total Liabilities & Equity', '', (data.total_liabilities_equity / 100).toFixed(2)],
                ['Balanced', '', data.is_balanced ? 'YES' : 'NO'],
                ['Difference', '', (data.difference / 100).toFixed(2)],
            ];
            downloadCsv(`balance_sheet_${asOfDate || 'today'}`, rows);
        });
    }, [data, onRegisterExport, assetsList, liabilitiesList, equityList]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-16">
                <div className="text-stone-500 font-sans text-sm animate-pulse">Calculating Balance Sheet...</div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
                {error || 'Unable to generate balance sheet'}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="Total Assets"
                    value={formatCents(data.total_assets, currencySymbol)}
                    subtitle="Cash, receivables, inventory"
                    icon={Landmark}
                    color="blue"
                />
                <MetricCard
                    title="Total Liabilities"
                    value={formatCents(data.total_liabilities, currencySymbol)}
                    subtitle="Payables, taxes owed"
                    icon={Scale}
                    color="amber"
                />
                <MetricCard
                    title="Total Equity"
                    value={formatCents(data.total_equity, currencySymbol)}
                    subtitle="Capital + Retained earnings"
                    icon={Briefcase}
                    color="purple"
                />
                <MetricCard
                    title="Balance Equation"
                    value={data.is_balanced ? 'Balanced' : 'Unbalanced'}
                    subtitle={data.is_balanced ? 'Assets = Liab + Equity' : `Difference: ${formatCents(data.difference, currencySymbol)}`}
                    icon={data.is_balanced ? ShieldCheck : AlertTriangle}
                    color={data.is_balanced ? 'emerald' : 'rose'}
                    badgeText={data.is_balanced ? 'In Balance' : 'Discrepancy'}
                    badgeVariant={data.is_balanced ? 'success' : 'danger'}
                />
            </div>

            {/* Assets vs Liab+Equity Comparison Bar */}
            <div className="bg-white rounded-xl border border-[#E1E3DB] p-5 shadow-xs">
                <div className="flex items-center justify-between text-xs font-semibold text-stone-700 mb-2">
                    <span className="flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-[#2E6E52]" />
                        Accounting Equation Integrity
                    </span>
                    <span className={data.is_balanced ? 'text-emerald-700' : 'text-rose-600'}>
                        {formatCents(data.total_assets, currencySymbol)} Assets = {formatCents(data.total_liabilities, currencySymbol)} Liabilities + {formatCents(data.total_equity, currencySymbol)} Equity
                    </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-100 flex items-center justify-between">
                        <span className="text-xs font-medium text-blue-900">Total Assets</span>
                        <span className="text-sm font-bold text-blue-950 font-display">{formatCents(data.total_assets, currencySymbol)}</span>
                    </div>
                    <div className="p-3 bg-purple-50/60 rounded-lg border border-purple-100 flex items-center justify-between">
                        <span className="text-xs font-medium text-purple-900">Liabilities ({formatCents(data.total_liabilities, currencySymbol)}) + Equity ({formatCents(data.total_equity, currencySymbol)})</span>
                        <span className="text-sm font-bold text-purple-950 font-display">{formatCents(data.total_liabilities_equity, currencySymbol)}</span>
                    </div>
                </div>
            </div>

            {/* Assets Table */}
            <div className="bg-white rounded-xl border border-[#E1E3DB] shadow-xs overflow-hidden">
                <div className="px-5 py-4 bg-[#F8F9F6] border-b border-[#E1E3DB] flex items-center justify-between">
                    <h3 className="font-semibold text-stone-900 text-sm flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        Assets
                    </h3>
                    <span className="text-xs font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md">
                        {formatCents(data.total_assets, currencySymbol)}
                    </span>
                </div>
                <table className="min-w-full divide-y divide-[#E1E3DB]">
                    <thead className="bg-[#FAFBF9] text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                        <tr>
                            <th className="px-5 py-3 text-left">Asset Account</th>
                            <th className="px-5 py-3 text-right">Share of Assets</th>
                            <th className="px-5 py-3 text-right">Balance</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E1E3DB] text-xs">
                        {assetsList.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="px-5 py-6 text-center text-stone-400">
                                    No assets recorded
                                </td>
                            </tr>
                        ) : (
                            assetsList.map((acc) => {
                                const share = data.total_assets > 0 ? (acc.amount / data.total_assets) * 100 : 0;
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
                                        <td className="px-5 py-3.5 text-right font-semibold text-blue-900">
                                            {formatCents(acc.amount, currencySymbol)}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                    <tfoot className="bg-[#FAFBF9] border-t border-[#E1E3DB] font-bold text-xs text-stone-900">
                        <tr>
                            <td className="px-5 py-3.5" colSpan={2}>Total Assets</td>
                            <td className="px-5 py-3.5 text-right text-blue-900 font-display text-sm">
                                {formatCents(data.total_assets, currencySymbol)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Liabilities & Equity Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Liabilities Table */}
                <div className="bg-white rounded-xl border border-[#E1E3DB] shadow-xs overflow-hidden flex flex-col justify-between">
                    <div>
                        <div className="px-5 py-4 bg-[#F8F9F6] border-b border-[#E1E3DB] flex items-center justify-between">
                            <h3 className="font-semibold text-stone-900 text-sm flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                Liabilities
                            </h3>
                            <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                                {formatCents(data.total_liabilities, currencySymbol)}
                            </span>
                        </div>
                        <table className="min-w-full divide-y divide-[#E1E3DB]">
                            <thead className="bg-[#FAFBF9] text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-3 text-left">Liability Account</th>
                                    <th className="px-5 py-3 text-right">Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E1E3DB] text-xs">
                                {liabilitiesList.length === 0 ? (
                                    <tr>
                                        <td colSpan={2} className="px-5 py-6 text-center text-stone-400">
                                            No liabilities recorded
                                        </td>
                                    </tr>
                                ) : (
                                    liabilitiesList.map((acc) => (
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
                                            <td className="px-5 py-3.5 text-right font-semibold text-amber-900">
                                                {formatCents(acc.amount, currencySymbol)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-5 py-3.5 bg-[#FAFBF9] border-t border-[#E1E3DB] flex items-center justify-between font-bold text-xs text-stone-900">
                        <span>Total Liabilities</span>
                        <span className="text-amber-900 font-display text-sm">
                            {formatCents(data.total_liabilities, currencySymbol)}
                        </span>
                    </div>
                </div>

                {/* Equity Table */}
                <div className="bg-white rounded-xl border border-[#E1E3DB] shadow-xs overflow-hidden flex flex-col justify-between">
                    <div>
                        <div className="px-5 py-4 bg-[#F8F9F6] border-b border-[#E1E3DB] flex items-center justify-between">
                            <h3 className="font-semibold text-stone-900 text-sm flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-purple-500" />
                                Owner's Equity
                            </h3>
                            <span className="text-xs font-bold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">
                                {formatCents(data.total_equity, currencySymbol)}
                            </span>
                        </div>
                        <table className="min-w-full divide-y divide-[#E1E3DB]">
                            <thead className="bg-[#FAFBF9] text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-3 text-left">Equity Item</th>
                                    <th className="px-5 py-3 text-right">Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E1E3DB] text-xs">
                                {equityList.map((acc) => (
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
                                        <td className="px-5 py-3.5 text-right font-semibold text-purple-900">
                                            {formatCents(acc.amount, currencySymbol)}
                                        </td>
                                    </tr>
                                ))}
                                <tr className="hover:bg-[#FAFBF9] transition-colors bg-purple-50/20">
                                    <td className="px-5 py-3.5 font-medium text-stone-900 flex items-center gap-1.5">
                                        Retained Earnings / Current Period Net Earnings
                                    </td>
                                    <td className="px-5 py-3.5 text-right font-semibold text-purple-900">
                                        {formatCents(data.retained_earnings, currencySymbol)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="px-5 py-3.5 bg-[#FAFBF9] border-t border-[#E1E3DB] flex items-center justify-between font-bold text-xs text-stone-900">
                        <span>Total Equity</span>
                        <span className="text-purple-900 font-display text-sm">
                            {formatCents(data.total_equity, currencySymbol)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Total Liabilities & Equity Verification */}
            <div className="bg-[#F8F9F6] border border-[#E1E3DB] rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <h4 className="font-bold text-stone-900 text-sm">
                        Total Liabilities & Equity: {formatCents(data.total_liabilities_equity, currencySymbol)}
                    </h4>
                    <p className="text-xs text-stone-500 mt-0.5">
                        {data.is_balanced
                            ? 'Book balance verified: Total assets exactly equal total liabilities and owner equity.'
                            : `Warning: A difference of ${formatCents(data.difference, currencySymbol)} exists.`}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                        data.is_balanced ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                        {data.is_balanced ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                        {data.is_balanced ? 'Balanced Equation' : 'Unbalanced'}
                    </span>
                </div>
            </div>
        </div>
    );
};
