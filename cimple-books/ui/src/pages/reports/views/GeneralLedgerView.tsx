import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Receipt, Search, Filter, BookOpen } from 'lucide-react';
import {
    getGeneralLedgerReport,
    listAccounts,
    listTransactions,
    type GeneralLedgerReportData,
    type Account
} from '../../../lib/api';
import { MetricCard } from '../components/MetricCard';
import { formatCents, downloadCsv, formatDate } from '../components/ExportUtils';
import { BASE_PATH } from '../../../lib/base';

interface GeneralLedgerViewProps {
    startDate: string;
    endDate: string;
    currencySymbol: string;
    onRegisterExport?: (exportFn: () => void) => void;
}

export const GeneralLedgerView: React.FC<GeneralLedgerViewProps> = ({
    startDate,
    endDate,
    currencySymbol,
    onRegisterExport,
}) => {
    const [data, setData] = useState<GeneralLedgerReportData | null>(null);
    const [accountsList, setAccountsList] = useState<Account[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        listAccounts().then((res) => {
            if (res.status === 200) setAccountsList(res.data || []);
        });
    }, []);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const resp = await getGeneralLedgerReport({
                accountId: selectedAccountId,
                startDate,
                endDate,
                search,
            });
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
                listTransactions({
                    accountId: selectedAccountId !== 'all' ? selectedAccountId : undefined,
                    startDate,
                    endDate,
                    pageSize: 500,
                    search,
                }),
            ]);

            const allAccs = accResp.data || [];
            const targetAccs = selectedAccountId !== 'all'
                ? allAccs.filter((a) => String(a.id) === selectedAccountId)
                : allAccs;

            const transactions = txnResp.data?.items || [];
            const resultAccs: GeneralLedgerReportData['accounts'] = [];
            let grandDebits = 0;
            let grandCredits = 0;

            targetAccs.forEach((acc) => {
                const is_debit_normal = acc.acc_type === 'assets' || acc.acc_type === 'expenses';
                const entries: GeneralLedgerReportData['accounts'][0]['entries'] = [];
                let running = 0;
                let accDeb = 0;
                let accCred = 0;

                transactions.forEach((t) => {
                    const lines = (t.lines || []).filter((l) => l.account_id === acc.id);
                    lines.forEach((l) => {
                        const deb = l.debit_amount || 0;
                        const cred = l.credit_amount || 0;
                        accDeb += deb;
                        accCred += cred;
                        if (is_debit_normal) running = running + deb - cred;
                        else running = running + cred - deb;

                        entries.push({
                            line_id: l.id,
                            txn_id: t.id,
                            date: t.txn_date,
                            title: t.title,
                            notes: t.notes,
                            txn_type: t.txn_type,
                            reference_id: t.reference_id,
                            debit: deb,
                            credit: cred,
                            running_balance: running,
                        });
                    });
                });

                if (entries.length > 0 || selectedAccountId !== 'all') {
                    grandDebits += accDeb;
                    grandCredits += accCred;
                    resultAccs.push({
                        id: acc.id,
                        name: acc.name,
                        acc_type: acc.acc_type,
                        is_debit_normal,
                        opening_balance: 0,
                        total_debit: accDeb,
                        total_credit: accCred,
                        closing_balance: running,
                        entries,
                    });
                }
            });

            setData({
                start_date: startDate || null,
                end_date: endDate || null,
                total_accounts: resultAccs.length,
                total_debits: grandDebits,
                total_credits: grandCredits,
                accounts: resultAccs,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load general ledger');
        }
    };

    useEffect(() => {
        loadData();
    }, [startDate, endDate, selectedAccountId, search]);

    useEffect(() => {
        if (!onRegisterExport || !data) return;
        onRegisterExport(() => {
            const rows: (string | number)[][] = [
                ['General Ledger'],
                ['Period', `${startDate || 'Start'} to ${endDate || 'Current'}`],
                ['Account Filter', selectedAccountId],
                [],
                ['Account', 'Date', 'Txn #', 'Description', 'Reference', 'Debit ($)', 'Credit ($)', 'Running Balance ($)'],
            ];

            data.accounts.forEach((acc) => {
                rows.push([`>>> ${acc.name} (${acc.acc_type})`, '', '', '', '', '', '', '']);
                rows.push(['Opening Balance', '', '', '', '', '', '', (acc.opening_balance / 100).toFixed(2)]);
                acc.entries.forEach((e) => {
                    rows.push([
                        acc.name,
                        formatDate(e.date),
                        `TXN-${e.txn_id}`,
                        e.title,
                        e.reference_id,
                        (e.debit / 100).toFixed(2),
                        (e.credit / 100).toFixed(2),
                        (e.running_balance / 100).toFixed(2),
                    ]);
                });
                rows.push(['Closing Balance', '', '', '', '', (acc.total_debit / 100).toFixed(2), (acc.total_credit / 100).toFixed(2), (acc.closing_balance / 100).toFixed(2)]);
                rows.push([]);
            });

            downloadCsv(`general_ledger_${selectedAccountId}_${startDate || 'all'}`, rows);
        });
    }, [data, selectedAccountId, onRegisterExport]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-16">
                <div className="text-stone-500 font-sans text-sm animate-pulse">Loading General Ledger entries...</div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
                {error || 'Unable to generate general ledger'}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <MetricCard
                    title="Active Accounts"
                    value={String(data.total_accounts)}
                    subtitle="Accounts with activity in period"
                    icon={BookOpen}
                    color="stone"
                />
                <MetricCard
                    title="Total Debits Posted"
                    value={formatCents(data.total_debits, currencySymbol)}
                    subtitle="Sum of period debits"
                    icon={Receipt}
                    color="blue"
                />
                <MetricCard
                    title="Total Credits Posted"
                    value={formatCents(data.total_credits, currencySymbol)}
                    subtitle="Sum of period credits"
                    icon={Receipt}
                    color="purple"
                />
            </div>

            {/* Account & Search Filter Bar */}
            <div className="bg-white rounded-xl border border-[#E1E3DB] p-4 shadow-xs flex flex-wrap items-center justify-between gap-4 print:hidden">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-600">
                        <Filter className="w-3.5 h-3.5 text-stone-400" />
                        <span>Filter Account:</span>
                    </div>

                    <select
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                        className="text-xs bg-[#F8F9F6] border border-[#E1E3DB] rounded-lg px-3 py-1.5 text-stone-800 font-medium focus:outline-hidden focus:ring-1 focus:ring-[#2E6E52] max-w-xs"
                    >
                        <option value="all">All Chart of Accounts</option>
                        {accountsList.map((a) => (
                            <option key={a.id} value={a.id}>
                                #{a.id} - {a.name} ({a.acc_type})
                            </option>
                        ))}
                    </select>

                    <div className="relative min-w-[200px] flex-1 max-w-sm">
                        <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search description, reference..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full text-xs pl-8 pr-3 py-1.5 bg-[#F8F9F6] border border-[#E1E3DB] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#2E6E52]"
                        />
                    </div>
                </div>
            </div>

            {/* Accounts Ledgers */}
            {data.accounts.length === 0 ? (
                <div className="bg-white rounded-xl border border-[#E1E3DB] p-12 text-center text-stone-400 shadow-xs">
                    No transactions found for the selected account and date filters
                </div>
            ) : (
                <div className="space-y-6">
                    {data.accounts.map((acc) => (
                        <div key={acc.id} className="bg-white rounded-xl border border-[#E1E3DB] shadow-xs overflow-hidden">
                            {/* Account Ledger Header */}
                            <div className="px-5 py-4 bg-[#F8F9F6] border-b border-[#E1E3DB] flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-stone-900 text-sm">
                                            #{acc.id} - {acc.name}
                                        </h3>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-stone-100 text-stone-700 border border-stone-200">
                                            {acc.acc_type}
                                        </span>
                                    </div>
                                    <p className="text-xs text-stone-500 mt-0.5">
                                        Normal balance: {acc.is_debit_normal ? 'Debit' : 'Credit'} | Opening Balance: {formatCents(acc.opening_balance, currencySymbol)}
                                    </p>
                                </div>

                                <div className="flex items-center gap-4 text-xs font-semibold">
                                    <div className="text-stone-600">
                                        Period Debits: <span className="text-blue-700 font-mono">{formatCents(acc.total_debit, currencySymbol)}</span>
                                    </div>
                                    <div className="text-stone-600">
                                        Period Credits: <span className="text-purple-700 font-mono">{formatCents(acc.total_credit, currencySymbol)}</span>
                                    </div>
                                    <div className="bg-[#EEF0EA] px-2.5 py-1 rounded-md text-stone-900">
                                        Closing: <span className="font-bold font-mono">{formatCents(acc.closing_balance, currencySymbol)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Entries Table */}
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-[#E1E3DB]">
                                    <thead className="bg-[#FAFBF9] text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                                        <tr>
                                            <th className="px-5 py-3 text-left w-24">Date</th>
                                            <th className="px-5 py-3 text-left w-20">Txn #</th>
                                            <th className="px-5 py-3 text-left">Description</th>
                                            <th className="px-5 py-3 text-left w-28">Reference</th>
                                            <th className="px-5 py-3 text-right">Debit</th>
                                            <th className="px-5 py-3 text-right">Credit</th>
                                            <th className="px-5 py-3 text-right">Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#E1E3DB] text-xs">
                                        {acc.entries.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="px-5 py-6 text-center text-stone-400">
                                                    No activity in this period. Opening balance remains {formatCents(acc.opening_balance, currencySymbol)}.
                                                </td>
                                            </tr>
                                        ) : (
                                            acc.entries.map((e) => (
                                                <tr key={e.line_id} className="hover:bg-[#FAFBF9] transition-colors">
                                                    <td className="px-5 py-3 whitespace-nowrap text-stone-500">
                                                        {formatDate(e.date)}
                                                    </td>
                                                    <td className="px-5 py-3 whitespace-nowrap text-stone-400 font-mono">
                                                        <Link
                                                            to={`${BASE_PATH}txns?search=${e.txn_id}`}
                                                            className="hover:text-[#2E6E52] hover:underline"
                                                        >
                                                            #{e.txn_id}
                                                        </Link>
                                                    </td>
                                                    <td className="px-5 py-3 font-medium text-stone-900 max-w-xs truncate">
                                                        {e.title}
                                                    </td>
                                                    <td className="px-5 py-3 whitespace-nowrap text-stone-500 font-mono text-[11px]">
                                                        {e.reference_id || '—'}
                                                    </td>
                                                    <td className="px-5 py-3 whitespace-nowrap text-right font-mono text-stone-700">
                                                        {e.debit > 0 ? formatCents(e.debit, currencySymbol) : '—'}
                                                    </td>
                                                    <td className="px-5 py-3 whitespace-nowrap text-right font-mono text-stone-700">
                                                        {e.credit > 0 ? formatCents(e.credit, currencySymbol) : '—'}
                                                    </td>
                                                    <td className="px-5 py-3 whitespace-nowrap text-right font-mono font-bold text-stone-900 bg-[#FAFBF9]">
                                                        {formatCents(e.running_balance, currencySymbol)}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
