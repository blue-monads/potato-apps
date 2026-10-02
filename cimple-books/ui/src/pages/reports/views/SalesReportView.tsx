import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { BarChart3, ShoppingBag, Tag, Percent, DollarSign, Users, Package } from 'lucide-react';
import {
    getSalesReport,
    listSales,
    listProducts,
    listContacts,
    type SalesReportData
} from '../../../lib/api';
import { MetricCard } from '../components/MetricCard';
import { formatCents, downloadCsv } from '../components/ExportUtils';
import { BASE_PATH } from '../../../lib/base';

interface SalesReportViewProps {
    startDate: string;
    endDate: string;
    currencySymbol: string;
    onRegisterExport?: (exportFn: () => void) => void;
}

export const SalesReportView: React.FC<SalesReportViewProps> = ({
    startDate,
    endDate,
    currencySymbol,
    onRegisterExport,
}) => {
    const [data, setData] = useState<SalesReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const resp = await getSalesReport({ startDate, endDate });
            if (resp.status === 200 && resp.data) {
                setData({
                    ...resp.data,
                    top_products: Array.isArray(resp.data.top_products) ? resp.data.top_products : [],
                    top_customers: Array.isArray(resp.data.top_customers) ? resp.data.top_customers : [],
                    status_breakdown: Array.isArray(resp.data.status_breakdown) ? resp.data.status_breakdown : [],
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
            const [salesResp, productsResp, contactsResp] = await Promise.all([
                listSales(),
                listProducts(),
                listContacts(),
            ]);

            const sales = salesResp.data || [];
            const products = productsResp.data || [];
            const contacts = contactsResp.data || [];
            const prodMap = new Map(products.map((p) => [p.id, p.name]));
            const contMap = new Map(contacts.map((c) => [c.id, c.name]));

            let gross = 0;
            let discounts = 0;
            let tax = 0;
            let net = 0;
            let paid = 0;
            let unpaid = 0;
            let orders = 0;

            const statusCountMap: Record<string, { count: number; amount: number }> = {};
            const productSalesMap = new Map<string, { product_id?: number; product_name: string; qty: number; revenue: number }>();
            const customerSalesMap = new Map<string, { contact_id?: number; name: string; orders_count: number; total_spent: number }>();
            const dateMap = new Map<string, { date: string; order_count: number; revenue: number }>();

            sales.forEach((s) => {
                const sDate = (s.sales_date || '').substring(0, 10);
                if (startDate && sDate < startDate) return;
                if (endDate && sDate > endDate) return;

                const st = s.sales_status || 'draft';
                if (!statusCountMap[st]) statusCountMap[st] = { count: 0, amount: 0 };
                statusCountMap[st].count += 1;
                statusCountMap[st].amount += s.total || 0;

                if (st === 'confirmed') {
                    orders += 1;
                    gross += s.total_item_price || 0;
                    discounts += (s.total_item_discount_amount || 0) + (s.overall_discount_amount || 0);
                    tax += (s.total_item_tax_amount || 0) + (s.overall_tax_amount || 0);
                    net += s.total || 0;

                    if (s.payment_status === 'paid') paid += s.total || 0;
                    else unpaid += s.total || 0;

                    // Timeline
                    if (sDate) {
                        if (!dateMap.has(sDate)) dateMap.set(sDate, { date: sDate, order_count: 0, revenue: 0 });
                        const dm = dateMap.get(sDate)!;
                        dm.order_count += 1;
                        dm.revenue += s.total || 0;
                    }

                    // Customer
                    const cName = contMap.get(s.client_contact_id || 0) || s.client_alt_name || 'Guest Customer';
                    if (!customerSalesMap.has(cName)) {
                        customerSalesMap.set(cName, { contact_id: s.client_contact_id || undefined, name: cName, orders_count: 0, total_spent: 0 });
                    }
                    const cm = customerSalesMap.get(cName)!;
                    cm.orders_count += 1;
                    cm.total_spent += s.total || 0;

                    // Products from lines
                    (s.lines || []).forEach((l) => {
                        const pName = (l.product_id ? prodMap.get(l.product_id) : null) || l.info || 'Item';
                        if (!productSalesMap.has(pName)) {
                            productSalesMap.set(pName, { product_id: l.product_id || undefined, product_name: pName, qty: 0, revenue: 0 });
                        }
                        const pm = productSalesMap.get(pName)!;
                        pm.qty += l.qty || 0;
                        pm.revenue += l.total_amount || 0;
                    });
                }
            });

            const status_breakdown = Object.entries(statusCountMap).map(([status, val]) => ({
                status,
                count: val.count,
                amount: val.amount,
            }));

            const top_products = Array.from(productSalesMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
            const top_customers = Array.from(customerSalesMap.values()).sort((a, b) => b.total_spent - a.total_spent).slice(0, 10);
            const timeline = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

            setData({
                start_date: startDate || null,
                end_date: endDate || null,
                total_orders: orders,
                gross_sales: gross,
                total_discounts: discounts,
                total_tax: tax,
                net_sales: net,
                paid_sales: paid,
                unpaid_sales: unpaid,
                avg_order_value: orders > 0 ? Math.floor(net / orders) : 0,
                status_breakdown,
                top_products,
                top_customers,
                timeline,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to compute sales report');
        }
    };

    useEffect(() => {
        loadData();
    }, [startDate, endDate]);

    const topProducts = Array.isArray(data?.top_products) ? data.top_products : [];
    const topCustomers = Array.isArray(data?.top_customers) ? data.top_customers : [];

    useEffect(() => {
        if (!onRegisterExport || !data) return;
        onRegisterExport(() => {
            const rows: (string | number)[][] = [
                ['Sales Analytics Report'],
                ['Period', `${startDate || 'Start'} to ${endDate || 'Current'}`],
                ['Total Net Sales', (data.net_sales / 100).toFixed(2)],
                ['Gross Invoiced', (data.gross_sales / 100).toFixed(2)],
                ['Discounts Granted', (data.total_discounts / 100).toFixed(2)],
                ['Taxes Collected', (data.total_tax / 100).toFixed(2)],
                ['Total Orders', data.total_orders],
                ['Average Order Value', (data.avg_order_value / 100).toFixed(2)],
                [],
                ['TOP SELLING PRODUCTS', 'Product Name', 'Quantity Sold', 'Revenue ($)'],
                ...topProducts.map((p) => [p.product_name, p.qty, (p.revenue / 100).toFixed(2)]),
                [],
                ['TOP CUSTOMERS', 'Customer Name', 'Orders Count', 'Total Spent ($)'],
                ...topCustomers.map((c) => [c.name, c.orders_count, (c.total_spent / 100).toFixed(2)]),
            ];
            downloadCsv(`sales_report_${startDate || 'all'}_to_${endDate || 'today'}`, rows);
        });
    }, [data, onRegisterExport, topProducts, topCustomers]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-16">
                <div className="text-stone-500 font-sans text-sm animate-pulse">Analyzing sales performance...</div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
                {error || 'Unable to generate sales report'}
            </div>
        );
    }

    const maxTimelineRev = Math.max(...data.timeline.map((t) => t.revenue), 1);

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="Total Net Sales"
                    value={formatCents(data.net_sales, currencySymbol)}
                    subtitle={`Gross: ${formatCents(data.gross_sales, currencySymbol)}`}
                    icon={DollarSign}
                    color="emerald"
                />
                <MetricCard
                    title="Orders Completed"
                    value={String(data.total_orders)}
                    subtitle={`Avg order: ${formatCents(data.avg_order_value, currencySymbol)}`}
                    icon={ShoppingBag}
                    color="blue"
                />
                <MetricCard
                    title="Tax Collected"
                    value={formatCents(data.total_tax, currencySymbol)}
                    subtitle="Output VAT & Sales taxes"
                    icon={Percent}
                    color="purple"
                />
                <MetricCard
                    title="Discounts Given"
                    value={formatCents(data.total_discounts, currencySymbol)}
                    subtitle="Promotional reductions"
                    icon={Tag}
                    color="amber"
                />
            </div>

            {/* Sales Collection Status Banner */}
            <div className="bg-white rounded-xl border border-[#E1E3DB] p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                    <div>
                        <span className="text-xs font-semibold text-stone-500 uppercase">Paid Invoices</span>
                        <div className="text-xl font-bold text-emerald-700 font-display mt-0.5">
                            {formatCents(data.paid_sales, currencySymbol)}
                        </div>
                    </div>
                    <div className="h-8 w-px bg-stone-200" />
                    <div>
                        <span className="text-xs font-semibold text-stone-500 uppercase">Unpaid / In Credit</span>
                        <div className="text-xl font-bold text-amber-700 font-display mt-0.5">
                            {formatCents(data.unpaid_sales, currencySymbol)}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {data.status_breakdown.map((sb) => (
                        <div key={sb.status} className="px-3 py-1.5 bg-[#F8F9F6] border border-[#E1E3DB] rounded-lg text-xs">
                            <span className="text-stone-500 capitalize">{sb.status}: </span>
                            <span className="font-bold text-stone-900">{sb.count}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Sales Timeline Trend Visualization */}
            {data.timeline.length > 0 && (
                <div className="bg-white rounded-xl border border-[#E1E3DB] p-5 shadow-xs">
                    <h3 className="font-bold text-stone-900 text-sm mb-4 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-[#2E6E52]" />
                        Revenue Trend Over Period
                    </h3>
                    <div className="h-44 flex items-end gap-2 sm:gap-3 pt-6 pb-2 border-b border-stone-200 overflow-x-auto">
                        {data.timeline.map((point) => {
                            const heightPct = Math.max(8, (point.revenue / maxTimelineRev) * 100);
                            return (
                                <div key={point.date} className="flex-1 min-w-[36px] flex flex-col items-center gap-1 group relative">
                                    <div
                                        style={{ height: `${heightPct}%` }}
                                        className="w-full bg-[#2E6E52] hover:bg-[#255842] rounded-t-sm transition-all"
                                    />
                                    <span className="text-[10px] text-stone-400 truncate max-w-[40px]">
                                        {point.date.slice(5)}
                                    </span>

                                    {/* Tooltip on hover */}
                                    <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-stone-900 text-white text-[11px] px-2 py-1 rounded-md shadow-md pointer-events-none whitespace-nowrap z-10">
                                        <div>{point.date}</div>
                                        <div className="font-bold">{formatCents(point.revenue, currencySymbol)} ({point.order_count} orders)</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Top Products & Top Customers Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Products */}
                <div className="bg-white rounded-xl border border-[#E1E3DB] shadow-xs overflow-hidden">
                    <div className="px-5 py-4 bg-[#F8F9F6] border-b border-[#E1E3DB] flex items-center justify-between">
                        <h3 className="font-semibold text-stone-900 text-sm flex items-center gap-2">
                            <Package className="w-4 h-4 text-stone-500" />
                            Top Selling Products
                        </h3>
                        <span className="text-xs text-stone-500">By revenue</span>
                    </div>
                    <table className="min-w-full divide-y divide-[#E1E3DB]">
                        <thead className="bg-[#FAFBF9] text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                            <tr>
                                <th className="px-5 py-3 text-left">Product</th>
                                <th className="px-5 py-3 text-center">Qty Sold</th>
                                <th className="px-5 py-3 text-right">Revenue</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E1E3DB] text-xs">
                            {topProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-5 py-6 text-center text-stone-400">
                                        No sales lines recorded
                                    </td>
                                </tr>
                            ) : (
                                topProducts.map((p, idx) => (
                                    <tr key={`${p.product_name}-${idx}`} className="hover:bg-[#FAFBF9] transition-colors">
                                        <td className="px-5 py-3 font-medium text-stone-900">
                                            {p.product_id ? (
                                                <Link
                                                    to={`${BASE_PATH}products/${p.product_id}/edit`}
                                                    className="hover:text-[#2E6E52] hover:underline"
                                                >
                                                    {p.product_name}
                                                </Link>
                                            ) : (
                                                p.product_name
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-center text-stone-600 font-semibold">
                                            {p.qty}
                                        </td>
                                        <td className="px-5 py-3 text-right font-mono font-bold text-stone-900">
                                            {formatCents(p.revenue, currencySymbol)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Top Customers */}
                <div className="bg-white rounded-xl border border-[#E1E3DB] shadow-xs overflow-hidden">
                    <div className="px-5 py-4 bg-[#F8F9F6] border-b border-[#E1E3DB] flex items-center justify-between">
                        <h3 className="font-semibold text-stone-900 text-sm flex items-center gap-2">
                            <Users className="w-4 h-4 text-stone-500" />
                            Top Customers
                        </h3>
                        <span className="text-xs text-stone-500">By total spend</span>
                    </div>
                    <table className="min-w-full divide-y divide-[#E1E3DB]">
                        <thead className="bg-[#FAFBF9] text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                            <tr>
                                <th className="px-5 py-3 text-left">Customer</th>
                                <th className="px-5 py-3 text-center">Orders</th>
                                <th className="px-5 py-3 text-right">Total Spent</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E1E3DB] text-xs">
                            {topCustomers.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-5 py-6 text-center text-stone-400">
                                        No customer orders recorded
                                    </td>
                                </tr>
                            ) : (
                                topCustomers.map((c, idx) => (
                                    <tr key={`${c.name}-${idx}`} className="hover:bg-[#FAFBF9] transition-colors">
                                        <td className="px-5 py-3 font-medium text-stone-900">
                                            {c.name}
                                        </td>
                                        <td className="px-5 py-3 text-center text-stone-600 font-semibold">
                                            {c.orders_count}
                                        </td>
                                        <td className="px-5 py-3 text-right font-mono font-bold text-stone-900">
                                            {formatCents(c.total_spent, currencySymbol)}
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
