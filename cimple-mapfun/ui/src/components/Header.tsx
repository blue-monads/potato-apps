import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { 
    LayoutGrid, 
    Calendar, 
    Radio, 
    Tag, 
    Layers, 
    MapPin, 
    Maximize2, 
    Download, 
    Upload, 
    Trash2, 
    CheckCircle2, 
    ExternalLink,
    PanelLeft,
    X
} from 'lucide-react';
import { BASE_PATH } from '../lib/base';

interface HeaderProps {
    onToggleSidebar?: () => void;
    sidebarOpen?: boolean;
    onToggleEvents?: () => void;
    eventsOpen?: boolean;
    eventsCount?: number;
    featuresCount?: number;
    statusText?: string;
    onFitBounds?: () => void;
    onExport?: () => void;
    onImport?: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onClear?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
    onToggleSidebar,
    sidebarOpen = true,
    onToggleEvents,
    eventsOpen = false,
    eventsCount = 0,
    featuresCount = 0,
    statusText = 'Ready',
    onFitBounds,
    onExport,
    onImport,
    onClear,
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [appsMenuOpen, setAppsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Close apps menu when clicked outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setAppsMenuOpen(false);
            }
        };
        if (appsMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [appsMenuOpen]);

    const apps = [
        {
            name: 'Map Workspace',
            description: 'Interactive map editor & viewer',
            icon: MapPin,
            color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
            path: `${BASE_PATH}maps`,
        },
        {
            name: 'Events Publisher',
            description: 'Publish new geotagged events',
            icon: Radio,
            color: 'bg-rose-50 text-rose-600 border-rose-200',
            path: `${BASE_PATH}create-event`,
        },
        {
            name: 'Events Explorer',
            description: 'Browse, search & manage feed',
            icon: Calendar,
            color: 'bg-blue-50 text-blue-600 border-blue-200',
            path: `${BASE_PATH}events`,
        },
        {
            name: 'Event Types',
            description: 'Configure event categories & icons',
            icon: Tag,
            color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
            path: `${BASE_PATH}create-event-type`,
        },
        {
            name: 'Feature Library',
            description: 'Manage markers, lines & areas',
            icon: Layers,
            color: 'bg-amber-50 text-amber-600 border-amber-200',
            path: `${BASE_PATH}features`,
        },
    ];

    const isCurrentPage = (path: string) => {
        if (path.endsWith('maps') && (location.pathname === BASE_PATH || location.pathname.endsWith('maps'))) {
            return true;
        }
        return location.pathname.includes(path.replace(BASE_PATH, ''));
    };

    return (
        <header className="h-14 bg-white/95 backdrop-blur-md border-b border-gray-200 px-3 md:px-4 flex items-center justify-between z-[1001] select-none relative">
            {/* Left: Brand & Sidebar toggle */}
            <div className="flex items-center gap-2 md:gap-3">
                {onToggleSidebar && (
                    <button
                        onClick={onToggleSidebar}
                        className={`p-1.5 rounded-lg border text-gray-600 hover:text-gray-900 transition-colors ${
                            sidebarOpen 
                                ? 'bg-gray-100 border-gray-300 text-gray-900' 
                                : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                        title={sidebarOpen ? 'Hide tools sidebar' : 'Show tools sidebar'}
                    >
                        <PanelLeft className="w-4 h-4" />
                    </button>
                )}

                <div 
                    onClick={() => navigate(`${BASE_PATH}maps`)}
                    className="flex items-center gap-2.5 cursor-pointer group"
                >
                    <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-sm group-hover:bg-indigo-600 transition-colors">
                        <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <span className="font-bold text-sm tracking-tight text-gray-900">EVENTMAP</span>
                            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                                2.0
                            </span>
                        </div>
                    </div>
                </div>

                {/* Status Pill */}
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium ml-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{statusText}</span>
                    {(eventsCount > 0 || featuresCount > 0) && (
                        <span className="text-emerald-600/70 border-l border-emerald-200 pl-1.5 ml-0.5 text-[11px]">
                            {eventsCount} events · {featuresCount} features
                        </span>
                    )}
                </div>
            </div>

            {/* Center / Quick actions */}
            <div className="flex items-center gap-1.5">
                {onFitBounds && (
                    <button
                        onClick={onFitBounds}
                        className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 shadow-2xs transition-colors"
                        title="Fit all map features"
                    >
                        <Maximize2 className="w-3.5 h-3.5 text-gray-500" />
                        <span>Fit View</span>
                    </button>
                )}

                {onExport && (
                    <button
                        onClick={onExport}
                        className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 shadow-2xs transition-colors"
                        title="Export map data as JSON"
                    >
                        <Download className="w-3.5 h-3.5 text-gray-500" />
                        <span>Export</span>
                    </button>
                )}

                {onImport && (
                    <label
                        className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 shadow-2xs cursor-pointer transition-colors"
                        title="Import map JSON"
                    >
                        <Upload className="w-3.5 h-3.5 text-gray-500" />
                        <span>Import</span>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".json,application/json"
                            onChange={onImport}
                            className="hidden"
                        />
                    </label>
                )}

                {onClear && (
                    <button
                        onClick={onClear}
                        className="hidden md:inline-flex p-1.5 text-gray-500 hover:text-red-600 bg-white border border-gray-200 hover:border-red-200 hover:bg-red-50 rounded-lg transition-colors"
                        title="Clear map objects"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Right: Events toggle & Apps Launcher (4-dot / 9-dot Google-style menu) */}
            <div className="flex items-center gap-2">
                {/* Events Drawer Toggle Button */}
                {onToggleEvents && (
                    <button
                        onClick={onToggleEvents}
                        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all shadow-2xs ${
                            eventsOpen
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-100'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                        }`}
                        title={eventsOpen ? 'Close events panel' : 'Open events panel'}
                    >
                        <Calendar className={`w-3.5 h-3.5 ${eventsOpen ? 'text-white' : 'text-indigo-600'}`} />
                        <span>Events</span>
                        {eventsCount > 0 && (
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                                eventsOpen 
                                    ? 'bg-white text-indigo-700' 
                                    : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                            }`}>
                                {eventsCount}
                            </span>
                        )}
                    </button>
                )}

                {/* 4-dot / 9-dot Bento App Launcher Button */}
                <div className="relative" ref={menuRef}>
                    <button
                        onClick={() => setAppsMenuOpen(!appsMenuOpen)}
                        className={`p-2 rounded-lg border transition-all ${
                            appsMenuOpen
                                ? 'bg-indigo-50 border-indigo-300 text-indigo-600 shadow-inner'
                                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100 hover:text-gray-900 shadow-2xs'
                        }`}
                        title="EventMap Apps & Pages"
                        aria-label="Apps launcher"
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>

                    {/* Apps Launcher Popover (Gmail / Google style) */}
                    {appsMenuOpen && (
                        <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                            <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-gray-100">
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">EventMap Apps</h4>
                                    <p className="text-[11px] text-gray-400">Jump to application tools & pages</p>
                                </div>
                                <button
                                    onClick={() => setAppsMenuOpen(false)}
                                    className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                {apps.map((app) => {
                                    const Icon = app.icon;
                                    const active = isCurrentPage(app.path);
                                    return (
                                        <button
                                            key={app.path}
                                            onClick={() => {
                                                setAppsMenuOpen(false);
                                                navigate(app.path);
                                            }}
                                            className={`p-3 rounded-xl border text-left flex flex-col items-start transition-all hover:scale-[1.02] ${
                                                active
                                                    ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-200'
                                                    : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50 hover:shadow-xs'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between w-full mb-2">
                                                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${app.color}`}>
                                                    <Icon className="w-4 h-4" />
                                                </div>
                                                {active && (
                                                    <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                                                )}
                                            </div>
                                            <div className="font-semibold text-xs text-gray-900 truncate w-full">
                                                {app.name}
                                            </div>
                                            <div className="text-[10px] text-gray-500 line-clamp-1 mt-0.5">
                                                {app.description}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Footer links / Quick publish highlight */}
                            <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between px-1">
                                <span className="text-[11px] text-gray-400">Need to broadcast an event?</span>
                                <button
                                    onClick={() => {
                                        setAppsMenuOpen(false);
                                        navigate(`${BASE_PATH}create-event`);
                                    }}
                                    className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 hover:underline"
                                >
                                    <span>Open Publisher</span>
                                    <ExternalLink className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
