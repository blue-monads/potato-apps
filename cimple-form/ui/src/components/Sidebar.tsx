import { Link, useLocation } from 'react-router';
import { FileText, Inbox } from 'lucide-react';
import { basePath } from '../lib/base';

const Sidebar = () => {
    const location = useLocation();
    const currentPath = location.pathname;

    const navItems = [
        {
            href: `${basePath}forms`,
            label: 'Forms',
            icon: FileText,
            path: 'forms',
        },
        {
            href: `${basePath}submissions`,
            label: 'Submissions',
            icon: Inbox,
            path: 'submissions',
        },
    ];

    const isActive = (path: string) => {
        return currentPath.includes(`/${path}`);
    };

    return (
        <aside className="fixed left-0 top-0 h-full w-32 md:w-48 bg-gray-100 text-gray-900 flex flex-col border-r border-gray-200">

            <div className="pt-2 px-2">
                <h1 className="text-lg font-semibold uppercase">Simple Form</h1>
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


