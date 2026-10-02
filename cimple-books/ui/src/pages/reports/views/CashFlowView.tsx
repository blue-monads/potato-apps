import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { DollarSign, ArrowUpRight, ArrowDownRight, Wallet, Activity, ArrowRightLeft } from 'lucide-react';
import {
    getCashFlowReport,
    listAccounts,
    listTransactions,
    type CashFlowReportData
} from '../../../lib/api';
import { MetricCard } from '../components/MetricCard';
import { formatCents, downloadCsv, formatDate } from '../components/ExportUtils';
import { BASE_PATH } from '../../../lib/base';

interface CashFlowViewProps {
    startDate: string;
    endDate: string;
    currencySymbol: string;
    onRegisterExport?: (exportFn: () => void) => void;
}

export const CashFlowView: React.FC<CashFlowViewProps> = ({
    startDate,
    endDate,
    currencySymbol,
    onRegisterExport,
}) => {
    const [data, setData] = useState<CashFlowReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const resp = await getCashFlowReport({ startDate, endDate });
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

            const cashAccounts = accounts.filter(
                (a) =>
                    a.acc_type === 'assets' &&
                    (a.name.toLowerCase().includes('cash') ||
                        a.name.toLowerCase().includes('bank') ||
                        a.name.toLowerCase().includes('wallet'))
            );
            const cashIds = new Set(cashAccounts.map((a) => a.id));

            let opening = 0;
            let opIn = 0;
            let opOut = 0;
            let finIn = 0;
            let finOut = 0;
            let invIn = 0;
            let invOut = 0;

            const items: CashFlowReportData['items'] = [];

            transactions.forEach((t) => {
                const lines = t.lines || [];
                const cashLines = lines.filter((l) => cashIds.has(l.account_id));
                const otherLines = lines.filter((l) => !cashIds.has(l.account_id));

                cashLines.forEach((cl) => {
                    const deb = cl.debit_amount || 0;
                    const cred = cl.credit_amount || 0;
                    const net = deb - cred;

                    const cp = otherLines[0];
                    const cpAccount = cp ? accounts.find((a) => a.id === cp.account_id) : null;
                    const category = cpAccount?.acc_type === 'equity' ? 'financing' : 'operating';

                    if (net > 0) {
                        if (category === 'financing') finIn += net;
                        else opIn += net;
                    } else if (net < 0) {
                        const amt = -net;
                        if (category === 'financing') finOut += amt;
                        else opOut += amt;
                    }

                    const accName = accounts.find((a) => a.id === cl.account_id)?.name || 'Cash';
                    items.push({
                        line_id: cl.id,
                        txn_id: t.id,
                        date: t.txn_date,
                        title: t.title,
                        reference_id: t.reference_id,
                        account_name: accName,
                        counterpart_account: cpAccount?.name || '',
                        category,
                        inflow: net > 0 ? net : 0,
                        outflow: net < 0 ? -net : 0,
                        net,
                    });
                });
            });

            const net_operating = opIn - opOut;
            const net_investing = invIn - invOut;
            const net_financing = finIn - finOut;
            const total_inflows = opIn + invIn + finIn;
            const total_outflows = opOut + invOut + finOut;
            const net_cash_change = total_inflows - total_outflows;
            const closing_balance = opening + net_cash_change;

            setData({
                start_date: startDate || null,
                end_date: endDate || null,
                opening_balance: opening,
                operating_inflows: opIn,
                operating_outflows: opOut,
                net_operating,
                investing_inflows: invIn,
                investing_outflows: invOut,
                net_investing,
                financing_inflows: finIn,
                financing_outflows: finOut,
                net_financing,
                total_inflows,
                total_outflows,
                net_cash_change,
                closing_balance,
                cash_accounts: cashAccounts.map((c) => ({ id: c.id, name: c.name, balance: 0 })),
                items,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to compute Cash Flow statement');
        }
    };

    useEffect(() => {
        loadData();
    }, [startDate, endDate]);

    useEffect(() => {
        if (!onRegisterExport || !data) return;
        onRegisterExport(() => {
            const rows: (string | number)[][] = [
                ['Cash Flow Statement'],
                ['Period', `${startDate || 'Start'} to ${endDate || 'Current'}`],
                [],
                ['OPERATING ACTIVITIES', 'Inflow ($)', 'Outflow ($)', 'Net ($)'],
                ['Cash from Operations', (data.operating_inflows / 100).toFixed(2), (data.operating_outflows / 100).toFixed(2), (data.net_operating / 100).toFixed(2)],
                [],
                ['FINANCING ACTIVITIES', 'Inflow ($)', 'Outflow ($)', 'Net ($)'],
                ['Owner Equity & Financing', (data.financing_inflows / 100).toFixed(2), (data.financing_outflows / 100).toFixed(2), (data.net_financing / 100).toFixed(2)],
                [],
                ['INVESTING ACTIVITIES', 'Inflow ($)', 'Outflow ($)', 'Net ($)'],
                ['Capital & Equipment Investments', (data.investing_inflows / 100).toFixed(2), (data.investing_outflows / 100).toFixed(2), (data.net_investing / 100).toFixed(2)],
                [],
                ['SUMMARY', '', '', 'Amount ($)'],
                ['Opening Cash Balance', '', '', (data.opening_balance / 100).toFixed(2)],
                ['Net Cash Flow Change', '', '', (data.net_cash_change / 100).toFixed(2)],
                ['Closing Cash Balance', '', '', (data.closing_balance / 100).toFixed(2)],
                [],
                ['CASH TRANSACTIONS LOG', 'Date', 'Cash Account', 'Counterpart Account', 'Category', 'Net ($)'],
                ...data.items.map((i) => [i.title, formatDate(i.date), i.account_name, i.counterpart_account, i.category, (i.net / 100).toFixed(2)]),
            ];
            downloadCsv(`cash_flow_${startDate || 'all'}_to_${endDate || 'today'}`, rows);
        });
    }, [data, onRegisterExport]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-16">
                <div className="text-stone-500 font-sans text-sm animate-pulse">Calculating Cash Flow statement...</div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
                {error || 'Unable to generate cash flow statement'}
            </div>
        );
    }

    const isPositiveFlow = data.net_cash_change >= 0;

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="Opening Cash"
                    value={formatCents(data.opening_balance, currencySymbol)}
                    subtitle="Cash & bank at start of period"
                    icon={Wallet}
                    color="stone"
                />
                <MetricCard
                    title="Operating Cash Flow"
                    value={formatCents(data.net_operating, currencySymbol)}
                    subtitle={`+${formatCents(data.operating_inflows, currencySymbol)} in / -${formatCents(data.operating_outflows, currencySymbol)} out`}
                    icon={Activity}
                    color={data.net_operating >= 0 ? 'emerald' : 'rose'}
                />
                <MetricCard
                    title="Net Cash Change"
                    value={formatCents(data.net_cash_change, currencySymbol)}
                    subtitle={isPositiveFlow ? 'Net cash expansion' : 'Net cash contraction'}
                    icon={isPositiveFlow ? ArrowUpRight : ArrowDownRight}
                    color={isPositiveFlow ? 'emerald' : 'rose'}
                    badgeText={isPositiveFlow ? 'Positive' : 'Deficit'}
                    badgeVariant={isPositiveFlow ? 'success' : 'danger'}
                />
                <MetricCard
                    title="Closing Cash"
                    value={formatCents(data.closing_balance, currencySymbol)}
                    subtitle="Total liquid funds at period end"
                    icon={DollarSign}
                    color="blue"
                />
            </div>

            {/* Activities Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Operating */}
                <div className="bg-white rounded-xl border border-[#E1E3DB] p-5 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between pb-3 border-b border-[#E1E3DB]">
                            <h3 className="font-semibold text-stone-900 text-sm flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                Operating Activities
                            </h3>
                            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                {formatCents(data.net_operating, currencySymbol)}
                            </span>
                        </div>
                        <div className="mt-4 space-y-2.5 text-xs">
                            <div className="flex items-center justify-between text-stone-600">
                                <span>Customer Receipts & Sales</span>
                                <span className="font-semibold text-emerald-700">+{formatCents(data.operating_inflows, currencySymbol)}</span>
                            </div>
                            <div className="flex items-center justify-between text-stone-600">
                                <span>Supplier & Operating Payments</span>
                                <span className="font-semibold text-rose-700">-{formatCents(data.operating_outflows, currencySymbol)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="mt-5 pt-3 border-t border-stone-100 flex items-center justify-between text-xs font-bold text-stone-900">
                        <span>Net Operating Cash</span>
                        <span className={data.net_operating >= 0 ? 'text-emerald-700 font-display' : 'text-rose-700 font-display'}>
                            {formatCents(data.net_operating, currencySymbol)}
                        </span>
                    </div>
                </div>

                {/* Financing */}
                <div className="bg-white rounded-xl border border-[#E1E3DB] p-5 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between pb-3 border-b border-[#E1E3DB]">
                            <h3 className="font-semibold text-stone-900 text-sm flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                                Financing Activities
                            </h3>
                            <span className="text-xs font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                                {formatCents(data.net_financing, currencySymbol)}
                            </span>
                        </div>
                        <div className="mt-4 space-y-2.5 text-xs">
                            <div className="flex items-center justify-between text-stone-600">
                                <span>Owner Capital Deposits</span>
                                <span className="font-semibold text-emerald-700">+{formatCents(data.financing_inflows, currencySymbol)}</span>
                            </div>
                            <div className="flex items-center justify-between text-stone-600">
                                <span>Owner Drawings & Distributions</span>
                                <span className="font-semibold text-rose-700">-{formatCents(data.financing_outflows, currencySymbol)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="mt-5 pt-3 border-t border-stone-100 flex items-center justify-between text-xs font-bold text-stone-900">
                        <span>Net Financing Cash</span>
                        <span className="text-purple-700 font-display">
                            {formatCents(data.net_financing, currencySymbol)}
                        </span>
                    </div>
                </div>

                {/* Cash Accounts Summary */}
                <div className="bg-white rounded-xl border border-[#E1E3DB] p-5 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between pb-3 border-b border-[#E1E3DB]">
                            <h3 className="font-semibold text-stone-900 text-sm flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                Cash & Bank Accounts
                            </h3>
                            <span className="text-xs font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                                {data.cash_accounts.length} accounts
                            </span>
                        </div>
                        <div className="mt-4 space-y-2.5 text-xs">
                            {data.cash_accounts.map((ca) => (
                                <div key={ca.id} className="flex items-center justify-between text-stone-700">
                                    <Link
                                        to={`${BASE_PATH}txns?accountId=${ca.id}`}
                                        className="hover:text-[#2E6E52] hover:underline truncate max-w-[160px]"
                                    >
                                        {ca.name}
                                    </Link>
                                    <span className="font-semibold text-stone-900">
                                        {formatCents(ca.balance, currencySymbol)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="mt-5 pt-3 border-t border-stone-100 flex items-center justify-between text-xs font-bold text-stone-900">
                        <span>Closing Cash Balance</span>
                        <span className="text-blue-900 font-display">
                            {formatCents(data.closing_balance, currencySymbol)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Cash Transactions Table */}
            <div className="bg-white rounded-xl border border-[#E1E3DB] shadow-xs overflow-hidden">
                <div className="px-5 py-4 bg-[#F8F9F6] border-b border-[#E1E3DB] flex items-center justify-between">
                    <h3 className="font-semibold text-stone-900 text-sm flex items-center gap-2">
                        <ArrowRightLeft className="w-4 h-4 text-stone-600" />
                        Cash Movement Entries
                    </h3>
                    <span className="text-xs text-stone-500">
                        {data.items.length} cash events in period
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-[#E1E3DB]">
                        <thead className="bg-[#FAFBF9] text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                            <tr>
                                <th className="px-5 py-3 text-left">Date</th>
                                <th className="px-5 py-3 text-left">Description</th>
                                <th className="px-5 py-3 text-left">Cash Account</th>
                                <th className="px-5 py-3 text-left">Counterpart</th>
                                <th className="px-5 py-3 text-center">Category</th>
                                <th className="px-5 py-3 text-right">Inflow</th>
                                <th className="px-5 py-3 text-right">Outflow</th>
                                <th className="px-5 py-3 text-right">Net Flow</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E1E3DB] text-xs">
                            {data.items.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-5 py-8 text-center text-stone-400">
                                        No cash transactions found for this period
                                    </td>
                                </tr>
                            ) : (
                                data.items.map((item) => (
                                    <tr key={`${item.txn_id}-${item.line_id}`} className="hover:bg-[#FAFBF9] transition-colors">
                                        <td className="px-5 py-3.5 whitespace-nowrap text-stone-500">
                                            {formatDate(item.date)}
                                        </td>
                                        <td className="px-5 py-3.5 font-medium text-stone-900 max-w-xs truncate">
                                            <Link
                                                to={`${BASE_PATH}txns?search=${encodeURIComponent(item.title)}`}
                                                className="hover:text-[#2E6E52] hover:underline"
                                            >
                                                {item.title}
                                            </Link>
                                        </td>
                                        <td className="px-5 py-3.5 whitespace-nowrap text-stone-700">
                                            {item.account_name}
                                        </td>
                                        <td className="px-5 py-3.5 whitespace-nowrap text-stone-500">
                                            {item.counterpart_account || '—'}
                                        </td>
                                        <td className="px-5 py-3.5 whitespace-nowrap text-center">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                                                item.category === 'financing'
                                                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                            }`}>
                                                {item.category}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 whitespace-nowrap text-right font-medium text-emerald-700">
                                            {item.inflow > 0 ? formatCents(item.inflow, currencySymbol) : '—'}
                                        </td>
                                        <td className="px-5 py-3.5 whitespace-nowrap text-right font-medium text-rose-700">
                                            {item.outflow > 0 ? formatCents(item.outflow, currencySymbol) : '—'}
                                        </td>
                                        <td className="px-5 py-3.5 whitespace-nowrap text-right font-bold">
                                            <span className={item.net >= 0 ? 'text-emerald-800' : 'text-rose-800'}>
                                                {formatCents(item.net, currencySymbol)}
                                            </span>
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
