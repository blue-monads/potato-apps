import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Clock, Users, FileText } from 'lucide-react';
import {
    getAccountsReceivableReport,
    listSales,
    listContacts,
    type AccountsReceivableReportData
} from '../../../lib/api';
import { MetricCard } from '../components/MetricCard';
import { formatCents, downloadCsv, formatDate } from '../components/ExportUtils';
import { BASE_PATH } from '../../../lib/base';

interface AccountsReceivableViewProps {
    asOfDate: string;
    currencySymbol: string;
    onRegisterExport?: (exportFn: () => void) => void;
}

const BUCKET_BADGES: Record<string, string> = {
    current: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    '31_60': 'bg-amber-50 text-amber-800 border-amber-200',
    '61_90': 'bg-orange-50 text-orange-800 border-orange-200',
    over_90: 'bg-rose-50 text-rose-800 border-rose-200',
};

const BUCKET_LABELS: Record<string, string> = {
    current: '0 - 30 Days (Current)',
    '31_60': '31 - 60 Days',
    '61_90': '61 - 90 Days',
    over_90: '90+ Days Overdue',
};

export const AccountsReceivableView: React.FC<AccountsReceivableViewProps> = ({
    asOfDate,
    currencySymbol,
    onRegisterExport,
}) => {
    const [data, setData] = useState<AccountsReceivableReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'customers' | 'invoices'>('customers');

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const resp = await getAccountsReceivableReport({ asOfDate });
            if (resp.status === 200 && resp.data) {
                setData({
                    ...resp.data,
                    contacts: Array.isArray(resp.data.contacts) ? resp.data.contacts : [],
                    invoices: Array.isArray(resp.data.invoices) ? resp.data.invoices : [],
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
            const [salesResp, contactsResp] = await Promise.all([
                listSales(),
                listContacts(),
            ]);

            const sales = salesResp.data || [];
            const contacts = contactsResp.data || [];
            const contactMap = new Map(contacts.map((c) => [c.id, c]));

            const asOfTime = asOfDate ? new Date(asOfDate).getTime() : Date.now();

            let total = 0;
            let cur = 0;
            let b31 = 0;
            let b61 = 0;
            let b90 = 0;

            const cGroupMap = new Map<string, AccountsReceivableReportData['contacts'][0]>();
            const invoices: AccountsReceivableReportData['invoices'] = [];

            sales.forEach((s) => {
                if (s.sales_status === 'confirmed' && s.payment_status !== 'paid') {
                    const saleTime = new Date(s.sales_date).getTime();
                    const days = Math.max(0, Math.floor((asOfTime - saleTime) / (1000 * 60 * 60 * 24)));
                    const amt = s.total || 0;

                    total += amt;
                    let bucket = 'current';
                    if (days <= 30) {
                        cur += amt;
                        bucket = 'current';
                    } else if (days <= 60) {
                        b31 += amt;
                        bucket = '31_60';
                    } else if (days <= 90) {
                        b61 += amt;
                        bucket = '61_90';
                    } else {
                        b90 += amt;
                        bucket = 'over_90';
                    }

                    const contact = s.client_contact_id ? contactMap.get(s.client_contact_id) : null;
                    const cName = contact?.name || s.client_alt_name || `Customer #${s.client_contact_id || 'Unknown'}`;

                    if (!cGroupMap.has(cName)) {
                        cGroupMap.set(cName, {
                            contact_id: s.client_contact_id || 0,
                            contact_name: cName,
                            email: contact?.primary_email || '',
                            phone: contact?.primary_phone || '',
                            total_due: 0,
                            current: 0,
                            days_31_60: 0,
                            days_61_90: 0,
                            days_over_90: 0,
                            invoices_count: 0,
                        });
                    }

                    const cg = cGroupMap.get(cName)!;
                    cg.total_due += amt;
                    cg.invoices_count += 1;
                    if (bucket === 'current') cg.current += amt;
                    else if (bucket === '31_60') cg.days_31_60 += amt;
                    else if (bucket === '61_90') cg.days_61_90 += amt;
                    else cg.days_over_90 += amt;

                    invoices.push({
                        id: s.id,
                        title: s.title,
                        sales_date: s.sales_date,
                        contact_name: cName,
                        amount: amt,
                        payment_status: s.payment_status || 'unpaid',
                        days_overdue: days,
                        bucket,
                    });
                }
            });

            const contactList = Array.from(cGroupMap.values()).sort((a, b) => b.total_due - a.total_due);

            setData({
                as_of_date: asOfDate,
                total_receivables: total,
                bucket_current: cur,
                bucket_31_60: b31,
                bucket_61_90: b61,
                bucket_over_90: b90,
                contacts: contactList,
                invoices,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to compute Accounts Receivable report');
        }
    };

    useEffect(() => {
        loadData();
    }, [asOfDate]);

    const contactsList = Array.isArray(data?.contacts) ? data.contacts : [];
    const invoicesList = Array.isArray(data?.invoices) ? data.invoices : [];

    useEffect(() => {
        if (!onRegisterExport || !data) return;
        onRegisterExport(() => {
            const rows: (string | number)[][] = [
                ['Accounts Receivable Aging Report'],
                ['As of Date', formatDate(data.as_of_date)],
                ['Total Outstanding Receivables', (data.total_receivables / 100).toFixed(2)],
                [],
                ['CUSTOMER SUMMARY', 'Invoices', 'Current (0-30)', '31-60 Days', '61-90 Days', '90+ Days', 'Total Due ($)'],
                ...contactsList.map((c) => [
                    c.contact_name,
                    c.invoices_count,
                    (c.current / 100).toFixed(2),
                    (c.days_31_60 / 100).toFixed(2),
                    (c.days_61_90 / 100).toFixed(2),
                    (c.days_over_90 / 100).toFixed(2),
                    (c.total_due / 100).toFixed(2),
                ]),
                [],
                ['DETAILED INVOICES', 'Invoice #', 'Customer', 'Date', 'Age (Days)', 'Bucket', 'Amount ($)', 'Status'],
                ...invoicesList.map((inv) => [
                    inv.title,
                    inv.id,
                    inv.contact_name,
                    formatDate(inv.sales_date),
                    inv.days_overdue,
                    inv.bucket,
                    (inv.amount / 100).toFixed(2),
                    inv.payment_status,
                ]),
            ];
            downloadCsv(`ar_aging_${asOfDate || 'today'}`, rows);
        });
    }, [data, onRegisterExport, contactsList, invoicesList]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-16">
                <div className="text-stone-500 font-sans text-sm animate-pulse">Computing Accounts Receivable aging...</div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
                {error || 'Unable to generate A/R report'}
            </div>
        );
    }

    const curPct = data.total_receivables > 0 ? (data.bucket_current / data.total_receivables) * 100 : 0;
    const b31Pct = data.total_receivables > 0 ? (data.bucket_31_60 / data.total_receivables) * 100 : 0;
    const b61Pct = data.total_receivables > 0 ? (data.bucket_61_90 / data.total_receivables) * 100 : 0;
    const b90Pct = data.total_receivables > 0 ? (data.bucket_over_90 / data.total_receivables) * 100 : 0;

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <MetricCard
                    title="Total Receivables"
                    value={formatCents(data.total_receivables, currencySymbol)}
                    subtitle="Outstanding customer balances"
                    icon={Clock}
                    color="blue"
                />
                <MetricCard
                    title="0 - 30 Days"
                    value={formatCents(data.bucket_current, currencySymbol)}
                    subtitle="Current / Not past due"
                    color="emerald"
                />
                <MetricCard
                    title="31 - 60 Days"
                    value={formatCents(data.bucket_31_60, currencySymbol)}
                    subtitle="Moderately overdue"
                    color="amber"
                />
                <MetricCard
                    title="61 - 90 Days"
                    value={formatCents(data.bucket_61_90, currencySymbol)}
                    subtitle="Significantly overdue"
                    color="purple"
                />
                <MetricCard
                    title="90+ Days"
                    value={formatCents(data.bucket_over_90, currencySymbol)}
                    subtitle="High risk default"
                    color="rose"
                    badgeText={data.bucket_over_90 > 0 ? 'Critical' : 'Clear'}
                    badgeVariant={data.bucket_over_90 > 0 ? 'danger' : 'success'}
                />
            </div>

            {/* Visual Aging Bar */}
            {data.total_receivables > 0 && (
                <div className="bg-white rounded-xl border border-[#E1E3DB] p-5 shadow-xs">
                    <div className="flex items-center justify-between text-xs font-semibold text-stone-700 mb-2">
                        <span>Aging Distribution</span>
                        <span>Current: {curPct.toFixed(1)}% | Overdue: {(100 - curPct).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-stone-100 h-3 rounded-full overflow-hidden flex">
                        <div style={{ width: `${curPct}%` }} className="bg-emerald-500 h-full" title={`Current: ${formatCents(data.bucket_current, currencySymbol)}`} />
                        <div style={{ width: `${b31Pct}%` }} className="bg-amber-400 h-full" title={`31-60d: ${formatCents(data.bucket_31_60, currencySymbol)}`} />
                        <div style={{ width: `${b61Pct}%` }} className="bg-orange-500 h-full" title={`61-90d: ${formatCents(data.bucket_61_90, currencySymbol)}`} />
                        <div style={{ width: `${b90Pct}%` }} className="bg-rose-500 h-full" title={`90+d: ${formatCents(data.bucket_over_90, currencySymbol)}`} />
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500 mt-2.5">
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Current (0-30d)</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> 31-60d</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> 61-90d</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> 90+d Overdue</span>
                    </div>
                </div>
            )}

            {/* Toggle Tabs */}
            <div className="flex items-center gap-2 border-b border-[#E1E3DB] pb-2 print:hidden">
                <button
                    type="button"
                    onClick={() => setActiveTab('customers')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        activeTab === 'customers'
                            ? 'bg-[#2E6E52] text-white shadow-xs'
                            : 'bg-white text-stone-600 hover:bg-stone-50 border border-[#E1E3DB]'
                    }`}
                >
                    <Users className="w-3.5 h-3.5" />
                    By Customer ({contactsList.length})
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('invoices')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        activeTab === 'invoices'
                            ? 'bg-[#2E6E52] text-white shadow-xs'
                            : 'bg-white text-stone-600 hover:bg-stone-50 border border-[#E1E3DB]'
                    }`}
                >
                    <FileText className="w-3.5 h-3.5" />
                    Individual Invoices ({invoicesList.length})
                </button>
            </div>

            {/* View by Customer */}
            {activeTab === 'customers' && (
                <div className="bg-white rounded-xl border border-[#E1E3DB] shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-[#E1E3DB]">
                            <thead className="bg-[#F8F9F6] text-[11px] font-semibold text-stone-600 uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-3.5 text-left">Customer</th>
                                    <th className="px-5 py-3.5 text-center">Invoices</th>
                                    <th className="px-5 py-3.5 text-right">Current (0-30)</th>
                                    <th className="px-5 py-3.5 text-right">31-60 Days</th>
                                    <th className="px-5 py-3.5 text-right">61-90 Days</th>
                                    <th className="px-5 py-3.5 text-right">90+ Days</th>
                                    <th className="px-5 py-3.5 text-right">Total Outstanding</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E1E3DB] text-xs">
                                {contactsList.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-stone-400">
                                            No outstanding customer invoices found as of {formatDate(data.as_of_date)}
                                        </td>
                                    </tr>
                                ) : (
                                    contactsList.map((c) => (
                                        <tr key={c.contact_name} className="hover:bg-[#FAFBF9] transition-colors">
                                            <td className="px-5 py-3.5 font-medium text-stone-900">
                                                <div>{c.contact_name}</div>
                                                {(c.email || c.phone) && (
                                                    <div className="text-[11px] text-stone-400">
                                                        {[c.email, c.phone].filter(Boolean).join(' • ')}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 text-center text-stone-600">
                                                {c.invoices_count}
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-mono text-emerald-700">
                                                {c.current > 0 ? formatCents(c.current, currencySymbol) : '—'}
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-mono text-amber-700">
                                                {c.days_31_60 > 0 ? formatCents(c.days_31_60, currencySymbol) : '—'}
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-mono text-orange-700">
                                                {c.days_61_90 > 0 ? formatCents(c.days_61_90, currencySymbol) : '—'}
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-mono text-rose-700">
                                                {c.days_over_90 > 0 ? formatCents(c.days_over_90, currencySymbol) : '—'}
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-mono font-bold text-stone-900 bg-stone-50/50">
                                                {formatCents(c.total_due, currencySymbol)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot className="bg-[#FAFBF9] border-t-2 border-[#E1E3DB] font-bold text-xs text-stone-900">
                                <tr>
                                    <td className="px-5 py-4">Grand Total</td>
                                    <td className="px-5 py-4 text-center">{invoicesList.length}</td>
                                    <td className="px-5 py-4 text-right font-mono text-emerald-800">{formatCents(data.bucket_current, currencySymbol)}</td>
                                    <td className="px-5 py-4 text-right font-mono text-amber-800">{formatCents(data.bucket_31_60, currencySymbol)}</td>
                                    <td className="px-5 py-4 text-right font-mono text-orange-800">{formatCents(data.bucket_61_90, currencySymbol)}</td>
                                    <td className="px-5 py-4 text-right font-mono text-rose-800">{formatCents(data.bucket_over_90, currencySymbol)}</td>
                                    <td className="px-5 py-4 text-right font-mono text-blue-950 font-display text-sm bg-blue-50/50">
                                        {formatCents(data.total_receivables, currencySymbol)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {/* View by Invoices */}
            {activeTab === 'invoices' && (
                <div className="bg-white rounded-xl border border-[#E1E3DB] shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-[#E1E3DB]">
                            <thead className="bg-[#F8F9F6] text-[11px] font-semibold text-stone-600 uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-3.5 text-left w-20">ID</th>
                                    <th className="px-5 py-3.5 text-left">Invoice Title</th>
                                    <th className="px-5 py-3.5 text-left">Customer</th>
                                    <th className="px-5 py-3.5 text-left">Invoice Date</th>
                                    <th className="px-5 py-3.5 text-center">Overdue Days</th>
                                    <th className="px-5 py-3.5 text-center">Aging Bucket</th>
                                    <th className="px-5 py-3.5 text-right">Amount Due</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E1E3DB] text-xs">
                                {invoicesList.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-stone-400">
                                            No outstanding customer invoices found
                                        </td>
                                    </tr>
                                ) : (
                                    invoicesList.map((inv) => (
                                        <tr key={inv.id} className="hover:bg-[#FAFBF9] transition-colors">
                                            <td className="px-5 py-3.5 font-mono text-stone-400">
                                                #{inv.id}
                                            </td>
                                            <td className="px-5 py-3.5 font-medium text-stone-900">
                                                <Link
                                                    to={`${BASE_PATH}sales/${inv.id}/edit`}
                                                    className="hover:text-[#2E6E52] hover:underline"
                                                >
                                                    {inv.title}
                                                </Link>
                                            </td>
                                            <td className="px-5 py-3.5 text-stone-700">
                                                {inv.contact_name}
                                            </td>
                                            <td className="px-5 py-3.5 text-stone-500 whitespace-nowrap">
                                                {formatDate(inv.sales_date)}
                                            </td>
                                            <td className="px-5 py-3.5 text-center whitespace-nowrap font-medium text-stone-700">
                                                {inv.days_overdue} days
                                            </td>
                                            <td className="px-5 py-3.5 text-center whitespace-nowrap">
                                                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                                                    BUCKET_BADGES[inv.bucket] || 'bg-stone-50 text-stone-700'
                                                }`}>
                                                    {BUCKET_LABELS[inv.bucket] || inv.bucket}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-mono font-bold text-stone-900">
                                                {formatCents(inv.amount, currencySymbol)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
