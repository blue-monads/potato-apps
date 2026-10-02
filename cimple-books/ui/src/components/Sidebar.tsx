import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { 
    Box, 
    Wallet, 
    ShoppingCart, 
    Receipt, 
    ReceiptText, 
    BarChart3,
    Settings,
    PanelLeftClose,
    PanelLeftOpen,
    ArrowDownToLine,
    Users
} from 'lucide-react';
import { BASE_PATH } from '../lib/base';

interface SidebarProps {
    isCollapsed?: boolean;
    onToggle?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed: propCollapsed, onToggle }) => {
    const location = useLocation();
    const currentPath = location.pathname;

    const [internalCollapsed, setInternalCollapsed] = useState(() => {
        return localStorage.getItem('cimple_books_sidebar_collapsed') === 'true';
    });

    const isCollapsed = propCollapsed !== undefined ? propCollapsed : internalCollapsed;

    const handleToggle = () => {
        if (onToggle) {
            onToggle();
        } else {
            setInternalCollapsed((prev) => {
                const next = !prev;
                localStorage.setItem('cimple_books_sidebar_collapsed', String(next));
                return next;
            });
        }
    };

    useEffect(() => {
        if (propCollapsed !== undefined) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
                e.preventDefault();
                handleToggle();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [propCollapsed, handleToggle]);

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
            href: `${BASE_PATH}contacts`,
            label: 'Contacts',
            icon: Users,
            path: 'contacts',
        },
        {
            href: `${BASE_PATH}products`,
            label: 'Products',
            icon: Box,
            path: 'products',
        },
        {
            href: `${BASE_PATH}stockin`,
            label: 'Stock In',
            icon: ArrowDownToLine,
            path: 'stockin',
        },
        {
            href: `${BASE_PATH}sales`,
            label: 'Sales',
            icon: ShoppingCart,
            path: 'sales',
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
        {
            href: `${BASE_PATH}settings`,
            label: 'Settings',
            icon: Settings,
            path: 'settings',
        },
    ];

    const isActive = (path: string) => {
        const trimmedPath = currentPath.replace(BASE_PATH, '');
        return trimmedPath.startsWith(`${path}`);
    };

    return (
        <aside
            className={`fixed left-0 top-0 h-full ${
                isCollapsed ? 'w-16' : 'w-36 md:w-52'
            } bg-[#EEF0EA] text-[#1C1E1A] flex flex-col border-r border-[#E1E3DB] z-10 transition-all duration-200 select-none`}
        >
            {isCollapsed ? (
                <div className="p-3 flex items-center justify-center border-b border-[#E1E3DB] h-[65px]">
                    <button
                        type="button"
                        onClick={handleToggle}
                        className="p-2 rounded-lg text-[#6B6E63] hover:text-[#1C1E1A] hover:bg-[#DCE0D4] transition-colors cursor-pointer"
                        title="Expand sidebar (Ctrl+\)"
                        aria-label="Expand sidebar"
                    >
                        <PanelLeftOpen className="w-5 h-5" />
                    </button>
                </div>
            ) : (
                <div className="p-3 md:p-4 flex items-center justify-between border-b border-[#E1E3DB] h-[65px]">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#2E6E52] text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                            <i className="fa-solid fa-book-bookmark text-sm"></i>
                        </div>
                        <div className="min-w-0">
                            <h1 className="font-heading text-sm font-bold text-[#1C1E1A] leading-tight truncate">Cimple Books</h1>
                            <span className="text-[10px] font-semibold text-[#6B6E63] uppercase tracking-wider block truncate">Accounting</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleToggle}
                        className="p-1.5 rounded-lg text-[#6B6E63] hover:text-[#1C1E1A] hover:bg-[#DCE0D4] transition-colors cursor-pointer shrink-0 ml-1"
                        title="Collapse sidebar (Ctrl+\)"
                        aria-label="Collapse sidebar"
                    >
                        <PanelLeftClose className="w-4 h-4" />
                    </button>
                </div>
            )}

            <nav className="flex-1 p-2 md:p-3 space-y-1.5 overflow-y-auto">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    return (
                        <Link
                            key={item.path}
                            to={item.href}
                            title={isCollapsed ? item.label : undefined}
                            className={`flex items-center ${
                                isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-2.5 px-3 py-2'
                            } rounded-lg transition-all text-xs font-semibold ${
                                active
                                    ? 'bg-[#2E6E52] text-white shadow-xs'
                                    : 'text-[#3E4139] hover:bg-[#E1EFE7] hover:text-[#205C41]'
                            }`}
                        >
                            <Icon className={`${isCollapsed ? 'w-5 h-5' : 'w-4 h-4'} flex-shrink-0`} />
                            {!isCollapsed && <span className="truncate">{item.label}</span>}
                        </Link>
                    );
                })}
            </nav>

            <div
                className={`p-3 border-t border-[#E1E3DB] text-[11px] text-[#6B6E63] flex items-center ${
                    isCollapsed ? 'justify-center' : 'justify-between'
                }`}
            >
                {!isCollapsed && <span className="font-mono truncate">v26-7-alpha</span>}
                <span
                    className="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0"
                    title={isCollapsed ? 'v26-7-alpha' : undefined}
                ></span>
            </div>
        </aside>
    );
};

export default Sidebar;
