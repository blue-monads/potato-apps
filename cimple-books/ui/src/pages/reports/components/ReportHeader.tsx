import React from 'react';
import { Link, useNavigate } from 'react-router';
import {
    ArrowLeft,
    Printer,
    Download,
    RefreshCw,
    FileSpreadsheet,
    TrendingUp,
    FileText,
    DollarSign,
    Calculator,
    Receipt,
    Clock,
    Wallet,
    BarChart3,
    PieChart,
} from 'lucide-react';
import { BASE_PATH } from '../../../lib/base';

export interface ReportOption {
    id: string;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
}

export const ALL_REPORTS: ReportOption[] = [
    { id: 'profit-loss', title: 'Profit & Loss Statement', icon: TrendingUp },
    { id: 'balance-sheet', title: 'Balance Sheet', icon: FileText },
    { id: 'cash-flow', title: 'Cash Flow Statement', icon: DollarSign },
    { id: 'trial-balance', title: 'Trial Balance', icon: Calculator },
    { id: 'general-ledger', title: 'General Ledger', icon: Receipt },
    { id: 'accounts-receivable', title: 'Accounts Receivable Aging', icon: Clock },
    { id: 'accounts-payable', title: 'Accounts Payable Aging', icon: Wallet },
    { id: 'sales', title: 'Sales Report', icon: BarChart3 },
    { id: 'expenses', title: 'Expense Report', icon: PieChart },
    { id: 'tax', title: 'Tax Report', icon: FileSpreadsheet },
];

interface ReportHeaderProps {
    currentReportId: string;
    title: string;
    description: string;
    onExportCsv?: () => void;
    onRefresh?: () => void;
    isLoading?: boolean;
}

export const ReportHeader: React.FC<ReportHeaderProps> = ({
    currentReportId,
    title,
    description,
    onExportCsv,
    onRefresh,
    isLoading = false,
}) => {
    const navigate = useNavigate();

    return (
        <div className="mb-6 print:hidden">
            {/* Top Breadcrumb & Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E1E3DB]">
                <div className="flex items-center gap-3">
                    <Link
                        to={`${BASE_PATH}reports`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-[#2E6E52] bg-white px-3 py-1.5 rounded-lg border border-[#E1E3DB] shadow-xs transition-colors"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        All Reports
                    </Link>

                    <span className="text-stone-300">/</span>

                    {/* Quick report switcher */}
                    <div className="relative inline-block text-left">
                        <select
                            value={currentReportId}
                            onChange={(e) => navigate(`${BASE_PATH}reports/${e.target.value}`)}
                            className="text-xs font-semibold text-stone-800 bg-white border border-[#E1E3DB] rounded-lg py-1.5 pl-3 pr-8 shadow-xs cursor-pointer hover:border-stone-400 focus:outline-hidden focus:ring-1 focus:ring-[#2E6E52]"
                        >
                            {ALL_REPORTS.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.title}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    {onRefresh && (
                        <button
                            type="button"
                            onClick={onRefresh}
                            disabled={isLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-stone-50 text-stone-700 rounded-lg text-xs font-semibold border border-[#E1E3DB] shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                            title="Refresh data"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                    )}

                    {onExportCsv && (
                        <button
                            type="button"
                            onClick={onExportCsv}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-stone-50 text-stone-700 rounded-lg text-xs font-semibold border border-[#E1E3DB] shadow-xs transition-colors cursor-pointer"
                            title="Export to CSV"
                        >
                            <Download className="w-3.5 h-3.5 text-stone-600" />
                            <span>Export CSV</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                        title="Print or save as PDF"
                    >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print</span>
                    </button>
                </div>
            </div>

            {/* Title & Description */}
            <div className="mt-4">
                <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 font-display">
                    {title}
                </h1>
                <p className="text-stone-500 text-sm mt-1">
                    {description}
                </p>
            </div>
        </div>
    );
};
