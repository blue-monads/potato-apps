import { Link, useLocation } from 'react-router';
import { BookOpen, Wallet, ShoppingCart, Receipt, FileText, ReceiptText, BarChart3 } from 'lucide-react';
import { BASE_PATH } from '../lib/base';

const Sidebar = () => {
    const location = useLocation();
    const currentPath = location.pathname;

    const navItems = [
        {
            href: `${BASE_PATH}accounts`,
            label: 'Accounts',
            icon: Wallet,
            path: 'accounts',
        },
        {
            href: `${BASE_PATH}txns`,
            label: 'Transactions',
            icon: Receipt,
            path: 'txns',
        },
        {
            href: `${BASE_PATH}products`,
            label: 'Products',
            icon: ShoppingCart,
            path: 'products',
        },
        {
            href: `${BASE_PATH}sales`,
            label: 'Sales',
            icon: BookOpen,
            path: 'sales',
        },
        {
            href: `${BASE_PATH}estimates`,
            label: 'Estimates',
            icon: FileText,
            path: 'estimates',
        },
        {
            href: `${BASE_PATH}taxes`,
            label: 'Taxes',
            icon: ReceiptText,
            path: 'taxes',
        },
        {
            href: `${BASE_PATH}reports`,
            label: 'Reports',
            icon: BarChart3,
            path: 'reports',
        },
    ];

    const isActive = (path: string) => {
        return currentPath.includes(`/${path}`);
    };

    return (
        <aside className="fixed left-0 top-0 h-full w-32 md:w-48 bg-gray-100 text-gray-900 flex flex-col border-r border-gray-200">


            <div className="pt-2 px-2">
                <h1 className="text-lg font-semibold uppercase">Simple Books</h1>
            </div>

            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    return (
                        <Link
                            key={item.path}
                            to={item.href}
                            className={`flex items-center gap-1 px-2 py-2 rounded-lg transition-colors text-sm ${
                                active
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-700 hover:bg-gray-200 hover:text-gray-900'
                            }`}
                        >
                            <Icon className="w-5 h-5" />
                            <span className="font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

        </aside>
    );
};

export default Sidebar;

