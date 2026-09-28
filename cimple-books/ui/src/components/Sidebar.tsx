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
        <aside className="fixed left-0 top-0 h-full w-36 md:w-52 bg-[#EEF0EA] text-[#1C1E1A] flex flex-col border-r border-[#E1E3DB] z-10">
            <div className="p-4 flex items-center gap-2.5 border-b border-[#E1E3DB]">
                <div className="w-8 h-8 rounded-lg bg-[#2E6E52] text-white flex items-center justify-center font-bold shadow-xs">
                    <i className="fa-solid fa-book-bookmark text-sm"></i>
                </div>
                <div>
                    <h1 className="font-heading text-sm font-bold text-[#1C1E1A] leading-tight">Cimple Books</h1>
                    <span className="text-[10px] font-semibold text-[#6B6E63] uppercase tracking-wider">Accounting</span>
                </div>
            </div>

            <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    return (
                        <Link
                            key={item.path}
                            to={item.href}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-xs font-semibold ${
                                active
                                    ? 'bg-[#2E6E52] text-white shadow-xs'
                                    : 'text-[#3E4139] hover:bg-[#E1EFE7] hover:text-[#205C41]'
                            }`}
                        >
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-3 border-t border-[#E1E3DB] text-[11px] text-[#6B6E63] flex items-center justify-between">
                <span className="font-mono">v26-7-alpha</span>
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            </div>
        </aside>
    );
};

export default Sidebar;
