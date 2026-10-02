import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { FileText, Percent, Landmark, ReceiptText, ShieldCheck } from 'lucide-react';
import {
    getTaxReport,
    listTaxes,
    listSales,
    listAccounts,
    type TaxReportData
} from '../../../lib/api';
import { MetricCard } from '../components/MetricCard';
import { formatCents, downloadCsv, formatDate } from '../components/ExportUtils';
import { BASE_PATH } from '../../../lib/base';

interface TaxReportViewProps {
    startDate: string;
    endDate: string;
    currencySymbol: string;
    onRegisterExport?: (exportFn: () => void) => void;
}

export const TaxReportView: React.FC<TaxReportViewProps> = ({
    startDate,
    endDate,
    currencySymbol,
    onRegisterExport,
}) => {
    const [data, setData] = useState<TaxReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const resp = await getTaxReport({ startDate, endDate });
            if (resp.status === 200 && resp.data) {
                setData({
                    ...resp.data,
                    tax_rates: Array.isArray(resp.data.tax_rates) ? resp.data.tax_rates : [],
                    items: Array.isArray(resp.data.items) ? resp.data.items : [],
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
            const [taxResp, salesResp, accResp] = await Promise.all([
                listTaxes(),
                listSales(),
                listAccounts(),
            ]);

            const taxes = taxResp.data || [];
            const sales = salesResp.data || [];
            const accounts = accResp.data || [];

            let taxColl = 0;
            let taxable = 0;
            let salesCount = 0;
            const items: TaxReportData['items'] = [];

            sales.forEach((s) => {
                const sDate = (s.sales_date || '').substring(0, 10);
                if (startDate && sDate < startDate) return;
                if (endDate && sDate > endDate) return;

                if (s.sales_status === 'confirmed') {
                    const tAmt = (s.total_item_tax_amount || 0) + (s.overall_tax_amount || 0);
                    if (tAmt > 0 || s.total_item_price > 0) {
                        salesCount += 1;
                        taxColl += tAmt;
                        taxable += s.total_item_price || 0;

                        items.push({
                            id: s.id,
                            title: s.title,
                            date: s.sales_date,
                            customer: s.client_alt_name || 'Customer',
                            taxable_amount: s.total_item_price || 0,
                            tax_amount: tAmt,
                            total: s.total || 0,
                        });
                    }
                }
            });

            // Tax liability accounts
            const taxAccs = accounts.filter(
                (a) => a.is_deleted !== true && (a.name.toLowerCase().includes('tax') || a.acc_type === 'liabilities')
            );

            setData({
                start_date: startDate || null,
                end_date: endDate || null,
                tax_collected: taxColl,
                taxable_sales: taxable,
                sales_count: salesCount,
                tax_payable_balance: taxColl,
                tax_rates: taxes.map((t) => ({
                    id: t.id,
                    name: t.name,
                    ttype: t.ttype,
                    rate: t.rate,
                    info: t.info,
                })),
                tax_accounts: taxAccs.map((a) => ({
                    id: a.id,
                    name: a.name,
                    balance: 0,
                    total_credited: 0,
                    total_debited: 0,
                })),
                items: items.slice(0, 50),
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to compute tax report');
        }
    };

    useEffect(() => {
        loadData();
    }, [startDate, endDate]);

    const taxRatesList = Array.isArray(data?.tax_rates) ? data.tax_rates : [];
    const itemsList = Array.isArray(data?.items) ? data.items : [];

    useEffect(() => {
        if (!onRegisterExport || !data) return;
        onRegisterExport(() => {
            const rows: (string | number)[][] = [
                ['Tax Summary Report'],
                ['Period', `${startDate || 'Start'} to ${endDate || 'Current'}`],
                ['Total Tax Collected', (data.tax_collected / 100).toFixed(2)],
                ['Taxable Sales Base', (data.taxable_sales / 100).toFixed(2)],
                ['Tax Transactions Count', data.sales_count],
                ['Net Tax Payable Balance', (data.tax_payable_balance / 100).toFixed(2)],
                [],
                ['CONFIGURED TAX RATES', 'Type', 'Rate (%)', 'Details'],
                ...taxRatesList.map((r) => [r.name, r.ttype, `${(r.rate / 100).toFixed(2)}%`, r.info]),
                [],
                ['TAXABLE SALES LOG', 'Invoice #', 'Customer', 'Date', 'Taxable Base ($)', 'Tax Amount ($)', 'Total ($)'],
                ...itemsList.map((i) => [
                    i.title,
                    i.customer,
                    formatDate(i.date),
                    (i.taxable_amount / 100).toFixed(2),
                    (i.tax_amount / 100).toFixed(2),
                    (i.total / 100).toFixed(2),
                ]),
            ];
            downloadCsv(`tax_report_${startDate || 'all'}_to_${endDate || 'today'}`, rows);
        });
    }, [data, onRegisterExport, taxRatesList, itemsList]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-16">
                <div className="text-stone-500 font-sans text-sm animate-pulse">Computing tax obligations...</div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
                {error || 'Unable to generate tax report'}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="Sales Tax Collected"
                    value={formatCents(data.tax_collected, currencySymbol)}
                    subtitle="Output VAT & sales tax collected"
                    icon={Percent}
                    color="purple"
                />
                <MetricCard
                    title="Taxable Sales Base"
                    value={formatCents(data.taxable_sales, currencySymbol)}
                    subtitle={`Across ${data.sales_count} taxable sales`}
                    icon={ReceiptText}
                    color="blue"
                />
                <MetricCard
                    title="Net Tax Due"
                    value={formatCents(data.tax_payable_balance, currencySymbol)}
                    subtitle="Current liability to tax authorities"
                    icon={Landmark}
                    color={data.tax_payable_balance > 0 ? 'amber' : 'emerald'}
                    badgeText={data.tax_payable_balance > 0 ? 'Payable' : 'Clear'}
                    badgeVariant={data.tax_payable_balance > 0 ? 'warning' : 'success'}
                />
                <MetricCard
                    title="Configured Rates"
                    value={`${data.tax_rates.length} Rules`}
                    subtitle="Active VAT and sales tax rates"
                    icon={ShieldCheck}
                    color="stone"
                />
            </div>

            {/* Configured Tax Rates Table */}
            <div className="bg-white rounded-xl border border-[#E1E3DB] shadow-xs overflow-hidden">
                <div className="px-5 py-4 bg-[#F8F9F6] border-b border-[#E1E3DB] flex items-center justify-between">
                    <h3 className="font-semibold text-stone-900 text-sm flex items-center gap-2">
                        <Percent className="w-4 h-4 text-stone-500" />
                        Configured Tax Rates
                    </h3>
                    <Link
                        to={`${BASE_PATH}taxes`}
                        className="text-xs font-semibold text-[#2E6E52] hover:underline"
                    >
                        Manage Rates &rarr;
                    </Link>
                </div>
                <table className="min-w-full divide-y divide-[#E1E3DB]">
                    <thead className="bg-[#FAFBF9] text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                        <tr>
                            <th className="px-5 py-3 text-left">Tax Name</th>
                            <th className="px-5 py-3 text-left">Category</th>
                            <th className="px-5 py-3 text-center">Rate</th>
                            <th className="px-5 py-3 text-left">Description</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E1E3DB] text-xs">
                        {taxRatesList.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-5 py-6 text-center text-stone-400">
                                    No tax rates configured
                                </td>
                            </tr>
                        ) : (
                            taxRatesList.map((tax) => (
                                <tr key={tax.id} className="hover:bg-[#FAFBF9] transition-colors">
                                    <td className="px-5 py-3.5 font-medium text-stone-900">
                                        {tax.name}
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                                            tax.ttype === 'sales' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                                        }`}>
                                            {tax.ttype}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3.5 text-center font-bold font-mono text-stone-900">
                                        {(tax.rate / 100).toFixed(1)}%
                                    </td>
                                    <td className="px-5 py-3.5 text-stone-500 max-w-xs truncate">
                                        {tax.info || '—'}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Detailed Tax Transactions */}
            <div className="bg-white rounded-xl border border-[#E1E3DB] shadow-xs overflow-hidden">
                <div className="px-5 py-4 bg-[#F8F9F6] border-b border-[#E1E3DB] flex items-center justify-between">
                    <h3 className="font-semibold text-stone-900 text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4 text-stone-500" />
                        Tax Collected on Sales
                    </h3>
                    <span className="text-xs text-stone-500">{itemsList.length} records</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-[#E1E3DB]">
                        <thead className="bg-[#FAFBF9] text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                            <tr>
                                <th className="px-5 py-3 text-left w-24">Date</th>
                                <th className="px-5 py-3 text-left">Invoice</th>
                                <th className="px-5 py-3 text-left">Customer</th>
                                <th className="px-5 py-3 text-right">Taxable Base</th>
                                <th className="px-5 py-3 text-right">Tax Collected</th>
                                <th className="px-5 py-3 text-right">Gross Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E1E3DB] text-xs">
                            {itemsList.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-stone-400">
                                        No taxable sales recorded for this period
                                    </td>
                                </tr>
                            ) : (
                                itemsList.map((item) => (
                                    <tr key={item.id} className="hover:bg-[#FAFBF9] transition-colors">
                                        <td className="px-5 py-3 whitespace-nowrap text-stone-500">
                                            {formatDate(item.date)}
                                        </td>
                                        <td className="px-5 py-3 font-medium text-stone-900">
                                            <Link
                                                to={`${BASE_PATH}sales/${item.id}/edit`}
                                                className="hover:text-[#2E6E52] hover:underline"
                                            >
                                                {item.title}
                                            </Link>
                                        </td>
                                        <td className="px-5 py-3 text-stone-700">
                                            {item.customer}
                                        </td>
                                        <td className="px-5 py-3 text-right font-mono text-stone-700">
                                            {formatCents(item.taxable_amount, currencySymbol)}
                                        </td>
                                        <td className="px-5 py-3 text-right font-mono font-bold text-purple-700">
                                            {formatCents(item.tax_amount, currencySymbol)}
                                        </td>
                                        <td className="px-5 py-3 text-right font-mono font-semibold text-stone-900">
                                            {formatCents(item.total, currencySymbol)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        <tfoot className="bg-[#FAFBF9] border-t-2 border-[#E1E3DB] font-bold text-xs text-stone-900">
                            <tr>
                                <td colSpan={3} className="px-5 py-3.5 uppercase tracking-wider text-[11px]">Period Total</td>
                                <td className="px-5 py-3.5 text-right font-mono">{formatCents(data.taxable_sales, currencySymbol)}</td>
                                <td className="px-5 py-3.5 text-right font-mono text-purple-800 font-display text-sm">
                                    {formatCents(data.tax_collected, currencySymbol)}
                                </td>
                                <td className="px-5 py-3.5 text-right font-mono">
                                    {formatCents(data.taxable_sales + data.tax_collected, currencySymbol)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
};
