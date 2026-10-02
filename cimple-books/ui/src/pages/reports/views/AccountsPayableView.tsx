import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Wallet, Users, ArrowDownToLine } from 'lucide-react';
import {
    getAccountsPayableReport,
    listStockIn,
    listContacts,
    type AccountsPayableReportData
} from '../../../lib/api';
import { MetricCard } from '../components/MetricCard';
import { formatCents, downloadCsv, formatDate } from '../components/ExportUtils';
import { BASE_PATH } from '../../../lib/base';

interface AccountsPayableViewProps {
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

export const AccountsPayableView: React.FC<AccountsPayableViewProps> = ({
    asOfDate,
    currencySymbol,
    onRegisterExport,
}) => {
    const [data, setData] = useState<AccountsPayableReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'vendors' | 'bills'>('vendors');

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const resp = await getAccountsPayableReport({ asOfDate });
            if (resp.status === 200 && resp.data) {
                setData({
                    ...resp.data,
                    vendors: Array.isArray(resp.data.vendors) ? resp.data.vendors : [],
                    bills: Array.isArray(resp.data.bills) ? resp.data.bills : [],
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
            const [stockResp, contactsResp] = await Promise.all([
                listStockIn(),
                listContacts(),
            ]);

            const stockIns = stockResp.data || [];
            const contacts = contactsResp.data || [];
            const contactMap = new Map(contacts.map((c) => [c.id, c]));

            const asOfTime = asOfDate ? new Date(asOfDate).getTime() : Date.now();

            let total = 0;
            let cur = 0;
            let b31 = 0;
            let b61 = 0;
            let b90 = 0;

            const vGroupMap = new Map<string, AccountsPayableReportData['vendors'][0]>();
            const bills: AccountsPayableReportData['bills'] = [];

            stockIns.forEach((s) => {
                if (s.stockin_status === 'confirmed' && s.payment_status !== 'paid') {
                    const sTime = s.stockin_date ? new Date(s.stockin_date).getTime() : Date.now();
                    const days = Math.max(0, Math.floor((asOfTime - sTime) / (1000 * 60 * 60 * 24)));
                    const amt = s.amount || 0;

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

                    const contact = s.vendor_contact_id ? contactMap.get(s.vendor_contact_id) : null;
                    const vName = contact?.name || s.vendor_alt_name || `Vendor #${s.vendor_contact_id || 'Unknown'}`;

                    if (!vGroupMap.has(vName)) {
                        vGroupMap.set(vName, {
                            contact_id: s.vendor_contact_id || 0,
                            contact_name: vName,
                            email: contact?.primary_email || '',
                            phone: contact?.primary_phone || '',
                            total_payable: 0,
                            current: 0,
                            days_31_60: 0,
                            days_61_90: 0,
                            days_over_90: 0,
                            bills_count: 0,
                        });
                    }

                    const vg = vGroupMap.get(vName)!;
                    vg.total_payable += amt;
                    vg.bills_count += 1;
                    if (bucket === 'current') vg.current += amt;
                    else if (bucket === '31_60') vg.days_31_60 += amt;
                    else if (bucket === '61_90') vg.days_61_90 += amt;
                    else vg.days_over_90 += amt;

                    bills.push({
                        id: s.id,
                        info: s.info || `Stock Intake #${s.id}`,
                        reference_id: s.reference_id || '',
                        stockin_date: s.stockin_date || '',
                        vendor_name: vName,
                        amount: amt,
                        payment_status: s.payment_status || 'unpaid',
                        days_overdue: days,
                        bucket,
                    });
                }
            });

            const vendorList = Array.from(vGroupMap.values()).sort((a, b) => b.total_payable - a.total_payable);

            setData({
                as_of_date: asOfDate,
                total_payables: total,
                bucket_current: cur,
                bucket_31_60: b31,
                bucket_61_90: b61,
                bucket_over_90: b90,
                vendors: vendorList,
                bills,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to compute Accounts Payable report');
        }
    };

    useEffect(() => {
        loadData();
    }, [asOfDate]);

    const vendorsList = Array.isArray(data?.vendors) ? data.vendors : [];
    const billsList = Array.isArray(data?.bills) ? data.bills : [];

    useEffect(() => {
        if (!onRegisterExport || !data) return;
        onRegisterExport(() => {
            const rows: (string | number)[][] = [
                ['Accounts Payable Aging Report'],
                ['As of Date', formatDate(data.as_of_date)],
                ['Total Outstanding Payables', (data.total_payables / 100).toFixed(2)],
                [],
                ['VENDOR SUMMARY', 'Bills', 'Current (0-30)', '31-60 Days', '61-90 Days', '90+ Days', 'Total Payable ($)'],
                ...vendorsList.map((v) => [
                    v.contact_name,
                    v.bills_count,
                    (v.current / 100).toFixed(2),
                    (v.days_31_60 / 100).toFixed(2),
                    (v.days_61_90 / 100).toFixed(2),
                    (v.days_over_90 / 100).toFixed(2),
                    (v.total_payable / 100).toFixed(2),
                ]),
                [],
                ['DETAILED BILLS', 'Intake ID', 'Info', 'Vendor', 'Date', 'Age (Days)', 'Bucket', 'Amount ($)', 'Status'],
                ...billsList.map((b) => [
                    b.id,
                    b.info,
                    b.vendor_name,
                    formatDate(b.stockin_date),
                    b.days_overdue,
                    b.bucket,
                    (b.amount / 100).toFixed(2),
                    b.payment_status,
                ]),
            ];
            downloadCsv(`ap_aging_${asOfDate || 'today'}`, rows);
        });
    }, [data, onRegisterExport, vendorsList, billsList]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-16">
                <div className="text-stone-500 font-sans text-sm animate-pulse">Computing Accounts Payable aging...</div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
                {error || 'Unable to generate A/P report'}
            </div>
        );
    }

    const curPct = data.total_payables > 0 ? (data.bucket_current / data.total_payables) * 100 : 0;
    const b31Pct = data.total_payables > 0 ? (data.bucket_31_60 / data.total_payables) * 100 : 0;
    const b61Pct = data.total_payables > 0 ? (data.bucket_61_90 / data.total_payables) * 100 : 0;
    const b90Pct = data.total_payables > 0 ? (data.bucket_over_90 / data.total_payables) * 100 : 0;

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <MetricCard
                    title="Total Payables"
                    value={formatCents(data.total_payables, currencySymbol)}
                    subtitle="Obligations owed to vendors"
                    icon={Wallet}
                    color="amber"
                />
                <MetricCard
                    title="0 - 30 Days"
                    value={formatCents(data.bucket_current, currencySymbol)}
                    subtitle="Current / Standard terms"
                    color="emerald"
                />
                <MetricCard
                    title="31 - 60 Days"
                    value={formatCents(data.bucket_31_60, currencySymbol)}
                    subtitle="Due soon or overdue"
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
                    subtitle="Critical overdue obligations"
                    color="rose"
                    badgeText={data.bucket_over_90 > 0 ? 'Urgent' : 'Clear'}
                    badgeVariant={data.bucket_over_90 > 0 ? 'danger' : 'success'}
                />
            </div>

            {/* Visual Aging Bar */}
            {data.total_payables > 0 && (
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
                    onClick={() => setActiveTab('vendors')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        activeTab === 'vendors'
                            ? 'bg-[#2E6E52] text-white shadow-xs'
                            : 'bg-white text-stone-600 hover:bg-stone-50 border border-[#E1E3DB]'
                    }`}
                >
                    <Users className="w-3.5 h-3.5" />
                    By Vendor ({vendorsList.length})
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('bills')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        activeTab === 'bills'
                            ? 'bg-[#2E6E52] text-white shadow-xs'
                            : 'bg-white text-stone-600 hover:bg-stone-50 border border-[#E1E3DB]'
                    }`}
                >
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                    Individual Stock In Bills ({billsList.length})
                </button>
            </div>

            {/* View by Vendor */}
            {activeTab === 'vendors' && (
                <div className="bg-white rounded-xl border border-[#E1E3DB] shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-[#E1E3DB]">
                            <thead className="bg-[#F8F9F6] text-[11px] font-semibold text-stone-600 uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-3.5 text-left">Vendor / Supplier</th>
                                    <th className="px-5 py-3.5 text-center">Bills Count</th>
                                    <th className="px-5 py-3.5 text-right">Current (0-30)</th>
                                    <th className="px-5 py-3.5 text-right">31-60 Days</th>
                                    <th className="px-5 py-3.5 text-right">61-90 Days</th>
                                    <th className="px-5 py-3.5 text-right">90+ Days</th>
                                    <th className="px-5 py-3.5 text-right">Total Payable</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E1E3DB] text-xs">
                                {vendorsList.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-stone-400">
                                            No outstanding vendor payables found as of {formatDate(data.as_of_date)}
                                        </td>
                                    </tr>
                                ) : (
                                    vendorsList.map((v) => (
                                        <tr key={v.contact_name} className="hover:bg-[#FAFBF9] transition-colors">
                                            <td className="px-5 py-3.5 font-medium text-stone-900">
                                                <div>{v.contact_name}</div>
                                                {(v.email || v.phone) && (
                                                    <div className="text-[11px] text-stone-400">
                                                        {[v.email, v.phone].filter(Boolean).join(' • ')}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 text-center text-stone-600">
                                                {v.bills_count}
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-mono text-emerald-700">
                                                {v.current > 0 ? formatCents(v.current, currencySymbol) : '—'}
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-mono text-amber-700">
                                                {v.days_31_60 > 0 ? formatCents(v.days_31_60, currencySymbol) : '—'}
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-mono text-orange-700">
                                                {v.days_61_90 > 0 ? formatCents(v.days_61_90, currencySymbol) : '—'}
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-mono text-rose-700">
                                                {v.days_over_90 > 0 ? formatCents(v.days_over_90, currencySymbol) : '—'}
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-mono font-bold text-stone-900 bg-stone-50/50">
                                                {formatCents(v.total_payable, currencySymbol)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot className="bg-[#FAFBF9] border-t-2 border-[#E1E3DB] font-bold text-xs text-stone-900">
                                <tr>
                                    <td className="px-5 py-4">Grand Total</td>
                                    <td className="px-5 py-4 text-center">{billsList.length}</td>
                                    <td className="px-5 py-4 text-right font-mono text-emerald-800">{formatCents(data.bucket_current, currencySymbol)}</td>
                                    <td className="px-5 py-4 text-right font-mono text-amber-800">{formatCents(data.bucket_31_60, currencySymbol)}</td>
                                    <td className="px-5 py-4 text-right font-mono text-orange-800">{formatCents(data.bucket_61_90, currencySymbol)}</td>
                                    <td className="px-5 py-4 text-right font-mono text-rose-800">{formatCents(data.bucket_over_90, currencySymbol)}</td>
                                    <td className="px-5 py-4 text-right font-mono text-amber-950 font-display text-sm bg-amber-50/50">
                                        {formatCents(data.total_payables, currencySymbol)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {/* View by Bills */}
            {activeTab === 'bills' && (
                <div className="bg-white rounded-xl border border-[#E1E3DB] shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-[#E1E3DB]">
                            <thead className="bg-[#F8F9F6] text-[11px] font-semibold text-stone-600 uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-3.5 text-left w-20">ID</th>
                                    <th className="px-5 py-3.5 text-left">Description</th>
                                    <th className="px-5 py-3.5 text-left">Vendor</th>
                                    <th className="px-5 py-3.5 text-left">Bill Date</th>
                                    <th className="px-5 py-3.5 text-center">Overdue Days</th>
                                    <th className="px-5 py-3.5 text-center">Aging Bucket</th>
                                    <th className="px-5 py-3.5 text-right">Amount Payable</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E1E3DB] text-xs">
                                {billsList.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-stone-400">
                                            No outstanding vendor bills found
                                        </td>
                                    </tr>
                                ) : (
                                    billsList.map((b) => (
                                        <tr key={b.id} className="hover:bg-[#FAFBF9] transition-colors">
                                            <td className="px-5 py-3.5 font-mono text-stone-400">
                                                #{b.id}
                                            </td>
                                            <td className="px-5 py-3.5 font-medium text-stone-900">
                                                <Link
                                                    to={`${BASE_PATH}stockin/${b.id}/edit`}
                                                    className="hover:text-[#2E6E52] hover:underline"
                                                >
                                                    {b.info || `Stock Intake #${b.id}`}
                                                </Link>
                                            </td>
                                            <td className="px-5 py-3.5 text-stone-700">
                                                {b.vendor_name}
                                            </td>
                                            <td className="px-5 py-3.5 text-stone-500 whitespace-nowrap">
                                                {formatDate(b.stockin_date)}
                                            </td>
                                            <td className="px-5 py-3.5 text-center whitespace-nowrap font-medium text-stone-700">
                                                {b.days_overdue} days
                                            </td>
                                            <td className="px-5 py-3.5 text-center whitespace-nowrap">
                                                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                                                    BUCKET_BADGES[b.bucket] || 'bg-stone-50 text-stone-700'
                                                }`}>
                                                    {BUCKET_LABELS[b.bucket] || b.bucket}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-mono font-bold text-stone-900">
                                                {formatCents(b.amount, currencySymbol)}
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
