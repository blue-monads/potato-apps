import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { BASE_PATH } from '../../lib/base';
import { getCurrencySymbol, getSettings } from '../../lib/api';
import { ReportHeader } from './components/ReportHeader';
import { ReportFilterBar, type RangePreset } from './components/ReportFilterBar';

import { ProfitLossView } from './views/ProfitLossView';
import { BalanceSheetView } from './views/BalanceSheetView';
import { CashFlowView } from './views/CashFlowView';
import { TrialBalanceView } from './views/TrialBalanceView';
import { GeneralLedgerView } from './views/GeneralLedgerView';
import { AccountsReceivableView } from './views/AccountsReceivableView';
import { AccountsPayableView } from './views/AccountsPayableView';
import { SalesReportView } from './views/SalesReportView';
import { ExpenseReportView } from './views/ExpenseReportView';
import { TaxReportView } from './views/TaxReportView';

const REPORT_INFO: Record<string, { title: string; description: string; mode: 'range' | 'asOfDate' }> = {
    'profit-loss': {
        title: 'Profit & Loss Statement',
        description: 'Comprehensive statement of revenues, costs, expenses, and net profit over time',
        mode: 'range',
    },
    'balance-sheet': {
        title: 'Balance Sheet',
        description: 'Point-in-time summary of business assets, liabilities, and owner equity',
        mode: 'asOfDate',
    },
    'cash-flow': {
        title: 'Cash Flow Statement',
        description: 'Analysis of operating, investing, and financing cash inflows and outflows',
        mode: 'range',
    },
    'trial-balance': {
        title: 'Trial Balance',
        description: 'Verification of double-entry ledger balance: debits equal credits across all accounts',
        mode: 'range',
    },
    'general-ledger': {
        title: 'General Ledger',
        description: 'Complete audit trail of all transactions and running balances account by account',
        mode: 'range',
    },
    'accounts-receivable': {
        title: 'Accounts Receivable Aging',
        description: 'Tracking customer balances, unpaid invoices, and aging bucket distribution',
        mode: 'asOfDate',
    },
    'accounts-payable': {
        title: 'Accounts Payable Aging',
        description: 'Monitoring outstanding supplier bills and cash settlement obligations',
        mode: 'asOfDate',
    },
    sales: {
        title: 'Sales Report',
        description: 'Revenue analytics, order volumes, customer spend, and top products sold',
        mode: 'range',
    },
    expenses: {
        title: 'Expense Report',
        description: 'Detailed analysis of operating costs and spending distribution across accounts',
        mode: 'range',
    },
    tax: {
        title: 'Tax Report',
        description: 'Calculation of sales tax liabilities, tax collected, and taxable sales volume',
        mode: 'range',
    },
};

export const ReportViewer: React.FC = () => {
    const { reportId = 'profit-loss' } = useParams<{ reportId: string }>();

    // Currency symbol
    const [currencySymbol, setCurrencySymbol] = useState<string>(getCurrencySymbol());

    useEffect(() => {
        getSettings().then((res) => {
            if (res.status === 200 && res.data?.currency_symbol) {
                setCurrencySymbol(res.data.currency_symbol);
            }
        });
    }, []);

    // Filter states
    const [preset, setPreset] = useState<RangePreset>('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [asOfDate, setAsOfDate] = useState(() => {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    });

    // Refresh trigger
    const [refreshKey, setRefreshKey] = useState(0);

    // CSV export callback registry
    const exportCallbackRef = useRef<(() => void) | null>(null);

    const handleRegisterExport = (fn: () => void) => {
        exportCallbackRef.current = fn;
    };

    const handleExportCsv = () => {
        if (exportCallbackRef.current) {
            exportCallbackRef.current();
        }
    };

    const info = REPORT_INFO[reportId];

    if (!info) {
        return (
            <div className="min-h-screen bg-[#F4F5F1] p-6 lg:p-8 font-sans flex items-center justify-center">
                <div className="max-w-md bg-white p-8 rounded-2xl border border-[#E1E3DB] shadow-sm text-center">
                    <h2 className="text-xl font-bold text-stone-900 font-display mb-2">
                        Report Not Found
                    </h2>
                    <p className="text-stone-500 text-sm mb-6">
                        The requested report "{reportId}" does not exist.
                    </p>
                    <Link
                        to={`${BASE_PATH}reports`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#2E6E52] text-white rounded-lg text-sm font-semibold hover:bg-[#255842] transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Reports
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F4F5F1] p-6 lg:p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                {/* Print Header only visible when printing */}
                <div className="hidden print:block mb-6 border-b border-stone-800 pb-4">
                    <h1 className="text-2xl font-bold text-black font-display">{info.title}</h1>
                    <p className="text-xs text-stone-600 mt-1">
                        Cimple Books Accounting • Generated on {new Date().toLocaleDateString()}
                    </p>
                </div>

                {/* Report Header */}
                <ReportHeader
                    currentReportId={reportId}
                    title={info.title}
                    description={info.description}
                    onExportCsv={handleExportCsv}
                    onRefresh={() => setRefreshKey((k) => k + 1)}
                />

                {/* Filter Toolbar */}
                {info.mode === 'asOfDate' ? (
                    <ReportFilterBar
                        mode="asOfDate"
                        asOfDate={asOfDate}
                        onAsOfDateChange={setAsOfDate}
                    />
                ) : (
                    <ReportFilterBar
                        mode="range"
                        preset={preset}
                        startDate={startDate}
                        endDate={endDate}
                        onPresetChange={setPreset}
                        onStartDateChange={setStartDate}
                        onEndDateChange={setEndDate}
                    />
                )}

                {/* Report Views */}
                <div key={`${reportId}-${refreshKey}`}>
                    {reportId === 'profit-loss' && (
                        <ProfitLossView
                            startDate={startDate}
                            endDate={endDate}
                            currencySymbol={currencySymbol}
                            onRegisterExport={handleRegisterExport}
                        />
                    )}

                    {reportId === 'balance-sheet' && (
                        <BalanceSheetView
                            asOfDate={asOfDate}
                            currencySymbol={currencySymbol}
                            onRegisterExport={handleRegisterExport}
                        />
                    )}

                    {reportId === 'cash-flow' && (
                        <CashFlowView
                            startDate={startDate}
                            endDate={endDate}
                            currencySymbol={currencySymbol}
                            onRegisterExport={handleRegisterExport}
                        />
                    )}

                    {reportId === 'trial-balance' && (
                        <TrialBalanceView
                            asOfDate={info.mode === 'asOfDate' ? asOfDate : undefined}
                            startDate={startDate}
                            endDate={endDate}
                            currencySymbol={currencySymbol}
                            onRegisterExport={handleRegisterExport}
                        />
                    )}

                    {reportId === 'general-ledger' && (
                        <GeneralLedgerView
                            startDate={startDate}
                            endDate={endDate}
                            currencySymbol={currencySymbol}
                            onRegisterExport={handleRegisterExport}
                        />
                    )}

                    {reportId === 'accounts-receivable' && (
                        <AccountsReceivableView
                            asOfDate={asOfDate}
                            currencySymbol={currencySymbol}
                            onRegisterExport={handleRegisterExport}
                        />
                    )}

                    {reportId === 'accounts-payable' && (
                        <AccountsPayableView
                            asOfDate={asOfDate}
                            currencySymbol={currencySymbol}
                            onRegisterExport={handleRegisterExport}
                        />
                    )}

                    {reportId === 'sales' && (
                        <SalesReportView
                            startDate={startDate}
                            endDate={endDate}
                            currencySymbol={currencySymbol}
                            onRegisterExport={handleRegisterExport}
                        />
                    )}

                    {reportId === 'expenses' && (
                        <ExpenseReportView
                            startDate={startDate}
                            endDate={endDate}
                            currencySymbol={currencySymbol}
                            onRegisterExport={handleRegisterExport}
                        />
                    )}

                    {reportId === 'tax' && (
                        <TaxReportView
                            startDate={startDate}
                            endDate={endDate}
                            currencySymbol={currencySymbol}
                            onRegisterExport={handleRegisterExport}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportViewer;
