import { Link } from 'react-router';
import { 
    FileText, 
    BarChart3, 
    TrendingUp, 
    DollarSign, 
    Receipt, 
    Calculator,
    Clock,
    ArrowRight,
    PieChart,
    Wallet
} from 'lucide-react';
import { BASE_PATH } from '../../lib/base';

interface ReportItem {
    id: string;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
}

const REPORTS: ReportItem[] = [
    {
        id: 'profit-loss',
        title: 'Profit & Loss Statement',
        description: 'View your income, expenses, and net profit over a period',
        icon: TrendingUp,
        color: 'text-green-600',
        bgColor: 'bg-green-50 hover:bg-green-100',
    },
    {
        id: 'balance-sheet',
        title: 'Balance Sheet',
        description: 'See your assets, liabilities, and equity at a point in time',
        icon: FileText,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50 hover:bg-blue-100',
    },
    {
        id: 'cash-flow',
        title: 'Cash Flow Statement',
        description: 'Track cash inflows and outflows from operations, investing, and financing',
        icon: DollarSign,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50 hover:bg-purple-100',
    },
    {
        id: 'trial-balance',
        title: 'Trial Balance',
        description: 'Verify that total debits equal total credits for all accounts',
        icon: Calculator,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50 hover:bg-orange-100',
    },
    {
        id: 'general-ledger',
        title: 'General Ledger',
        description: 'Complete record of all financial transactions by account',
        icon: Receipt,
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-50 hover:bg-indigo-100',
    },
    {
        id: 'accounts-receivable',
        title: 'Accounts Receivable Aging',
        description: 'Track outstanding customer invoices and payment status',
        icon: Clock,
        color: 'text-cyan-600',
        bgColor: 'bg-cyan-50 hover:bg-cyan-100',
    },
    {
        id: 'accounts-payable',
        title: 'Accounts Payable Aging',
        description: 'Monitor outstanding bills and vendor payment obligations',
        icon: Wallet,
        color: 'text-red-600',
        bgColor: 'bg-red-50 hover:bg-red-100',
    },
    {
        id: 'sales',
        title: 'Sales Report',
        description: 'Analyze sales performance, revenue trends, and top products',
        icon: BarChart3,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50 hover:bg-emerald-100',
    },
    {
        id: 'expenses',
        title: 'Expense Report',
        description: 'Break down expenses by category, account, or time period',
        icon: PieChart,
        color: 'text-pink-600',
        bgColor: 'bg-pink-50 hover:bg-pink-100',
    },
    {
        id: 'tax',
        title: 'Tax Report',
        description: 'Summary of tax obligations and tax-related transactions',
        icon: FileText,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50 hover:bg-amber-100',
    },
];

const ReportsList = () => {
    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
                    <p className="text-gray-600 mt-2">
                        View and analyze your financial data with comprehensive accounting reports
                    </p>
                </div>

                {/* Reports Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {REPORTS.map((report) => {
                        const Icon = report.icon;
                        return (
                            <Link
                                key={report.id}
                                to={`${BASE_PATH}reports/${report.id}`}
                                className={`${report.bgColor} rounded-lg p-6 border border-gray-200 transition-all duration-200 hover:shadow-md group`}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className={`${report.color} p-3 rounded-lg bg-white`}>
                                        <Icon className="w-6 h-6" />
                                    </div>
                                    <ArrowRight className={`w-5 h-5 ${report.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                    {report.title}
                                </h3>
                                <p className="text-sm text-gray-600">
                                    {report.description}
                                </p>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default ReportsList;

