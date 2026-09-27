import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router";
import { BASE_PATH } from "../../lib/base";
import {
    listAutoDashboards,
    createAutoDashboard,
    getAutoDashboard,
    deleteAutoDashboard,
    sendAutoDashChat,
    saveAutoDashCode,
    runAutoDashQuery,
    listDatatables,
    getAutoDashTemplate,
} from "../../lib/api";
import type {
    AutoDash as AutoDashType,
    AutoDashItem,
    Datatable,
} from "../../lib/api";

export type ActiveTab = "chat" | "code" | "preview";

export const normalizeArray = <T,>(val: any): T[] => {
    if (Array.isArray(val)) return val;
    if (val && typeof val === "object") return Object.values(val);
    return [];
};

export interface AutoDashPanelProps {
    dashId?: number | null;
    onSelectDashId?: (dashId: number | null) => void;
    isSidebar?: boolean;
    onClose?: () => void;
    currentTable?: Datatable | null;
}

export default function AutoDashPanel({
    dashId: propDashId,
    onSelectDashId,
    isSidebar = false,
    onClose,
    currentTable,
}: AutoDashPanelProps) {
    const navigate = useNavigate();
    const [localDashId, setLocalDashId] = useState<number | null>(propDashId ?? null);
    const [dashboards, setDashboards] = useState<AutoDashType[]>([]);
    const [loadingDashboards, setLoadingDashboards] = useState<boolean>(true);

    // Synchronize local state with propDashId if prop changes
    useEffect(() => {
        if (propDashId !== undefined) {
            setLocalDashId(propDashId);
        }
    }, [propDashId]);

    // Fetch dashboard list to support switcher and auto-selection
    const refreshDashboards = async () => {
        try {
            setLoadingDashboards(true);
            const res = await listAutoDashboards();
            const list = normalizeArray<AutoDashType>(res.data?.dashboards);
            setDashboards(list);
            return list;
        } catch {
            return [];
        } finally {
            setLoadingDashboards(false);
        }
    };

    useEffect(() => {
        refreshDashboards();
    }, []);

    const handleSelectDashboard = (id: number | null) => {
        setLocalDashId(id);
        onSelectDashId?.(id);
    };

    const handleOpenSeparatePage = () => {
        if (localDashId) {
            navigate(`${BASE_PATH}autodash/${localDashId}`);
        } else {
            navigate(`${BASE_PATH}autodash`);
        }
    };

    if (localDashId != null) {
        return (
            <AutoDashDetailView
                dashId={localDashId}
                isSidebar={isSidebar}
                dashboards={dashboards}
                onSelectDashboard={handleSelectDashboard}
                onBack={() => handleSelectDashboard(null)}
                onClose={onClose}
                onOpenSeparatePage={handleOpenSeparatePage}
                currentTable={currentTable}
                onDashboardCreated={(newDash) => {
                    setDashboards(prev => [...prev, newDash]);
                    handleSelectDashboard(newDash.id);
                }}
            />
        );
    }

    return (
        <AutoDashListView
            isSidebar={isSidebar}
            dashboards={dashboards}
            loading={loadingDashboards}
            onRefreshDashboards={refreshDashboards}
            onSelectDashboard={handleSelectDashboard}
            onClose={onClose}
            onOpenSeparatePage={handleOpenSeparatePage}
            currentTable={currentTable}
        />
    );
}

// ==========================================
// 1. DASHBOARD LIST VIEW
// ==========================================
interface AutoDashListViewProps {
    isSidebar?: boolean;
    dashboards: AutoDashType[];
    loading?: boolean;
    onRefreshDashboards: () => Promise<AutoDashType[]>;
    onSelectDashboard: (dashId: number) => void;
    onClose?: () => void;
    onOpenSeparatePage?: () => void;
    currentTable?: Datatable | null;
}

export function AutoDashListView({
    isSidebar = false,
    dashboards,
    loading = false,
    onRefreshDashboards,
    onSelectDashboard,
    onClose,
    onOpenSeparatePage,
    currentTable: _currentTable,
}: AutoDashListViewProps) {
    const navigate = useNavigate();
    const [localDashboards, setLocalDashboards] = useState<AutoDashType[]>(dashboards);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>("");

    // Create Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
    const [modalName, setModalName] = useState<string>("");
    const [modalPrompt, setModalPrompt] = useState<string>("");
    const [isCreating, setIsCreating] = useState<boolean>(false);

    useEffect(() => {
        setLocalDashboards(dashboards);
    }, [dashboards]);

    const openCreateModal = () => {
        setModalName("");
        setModalPrompt("");
        setIsCreateModalOpen(true);
    };

    const handleCreate = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!modalName.trim() || isCreating) return;

        setIsCreating(true);
        setErrorMsg(null);

        try {
            const res = await createAutoDashboard({
                name: modalName.trim(),
                base_prompt: modalPrompt.trim(),
            });

            if (res.error) {
                setErrorMsg(res.error);
                setIsCreating(false);
                return;
            }

            if (res.data?.dashboard) {
                setIsCreateModalOpen(false);
                const newDash = res.data.dashboard;
                await onRefreshDashboards();
                if (isSidebar) {
                    onSelectDashboard(newDash.id);
                } else {
                    navigate(`${BASE_PATH}autodash/${newDash.id}`);
                }
            }
        } catch (err: any) {
            setErrorMsg(err.message || "Failed to create dashboard");
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async (id: number, name: string) => {
        if (!window.confirm(`Are you sure you want to delete dashboard "${name}"?`)) {
            return;
        }

        try {
            const res = await deleteAutoDashboard(id);
            if (res.error) {
                setErrorMsg(res.error);
            } else {
                setLocalDashboards(prev => prev.filter(d => d.id !== id));
                onRefreshDashboards();
            }
        } catch (err: any) {
            setErrorMsg(err.message || "Failed to delete dashboard");
        }
    };

    const safeDashboards = normalizeArray<AutoDashType>(localDashboards);
    const filteredDashboards = safeDashboards.filter(d =>
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.base_prompt && d.base_prompt.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className={`flex flex-col bg-surface-50 text-surface-800 ${isSidebar ? "h-full w-full overflow-hidden" : "min-h-screen"}`}>
            {/* Header */}
            <header className="flex items-center justify-between gap-3 bg-surface-800 text-white px-4 py-2.5 shrink-0 shadow-sm border-b border-surface-700">
                <div className="flex items-center gap-2.5 min-w-0">
                    {!isSidebar && (
                        <>
                            <Link
                                to={`${BASE_PATH}table`}
                                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded text-surface-300 hover:text-white hover:bg-surface-700 transition-colors"
                                title="Back to Table"
                            >
                                <i className="fa-solid fa-arrow-left text-[11px]" />
                                <span>Tables</span>
                            </Link>
                            <div className="h-4 w-px bg-surface-700" />
                        </>
                    )}

                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
                            <i className="fa-solid fa-chart-line text-xs" />
                        </div>
                        <div className="min-w-0">
                            <span className="font-semibold text-xs sm:text-sm tracking-tight truncate block">
                                AutoDash
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {/* New Dashboard Button */}
                    <button
                        onClick={openCreateModal}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-accent-600 hover:bg-accent-700 text-white shadow-sm transition-colors cursor-pointer"
                        title="New Dashboard"
                    >
                        <i className="fa-solid fa-plus text-[10px]" />
                        <span className="hidden sm:inline">New</span>
                    </button>

                    {isSidebar && (
                        <>
                            <button
                                onClick={onOpenSeparatePage}
                                className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded text-surface-300 hover:text-white hover:bg-surface-700 transition-colors cursor-pointer"
                                title="Open in separate page"
                            >
                                <i className="fa-solid fa-arrow-up-right-from-square text-[11px]" />
                                <span className="text-[11px] hidden md:inline">Separate page</span>
                            </button>

                            {onClose && (
                                <button
                                    onClick={onClose}
                                    className="w-7 h-7 flex items-center justify-center rounded text-surface-400 hover:text-white hover:bg-surface-700 transition-colors cursor-pointer"
                                    title="Close sidebar"
                                >
                                    <i className="fa-solid fa-xmark text-sm" />
                                </button>
                            )}
                        </>
                    )}
                </div>
            </header>

            {/* Error Banner */}
            {errorMsg && (
                <div className="bg-red-50 border-b border-red-200 text-red-700 px-4 py-2 text-xs flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <i className="fa-solid fa-triangle-exclamation" />
                        <span>{errorMsg}</span>
                    </div>
                    <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-800">
                        <i className="fa-solid fa-xmark" />
                    </button>
                </div>
            )}

            {/* Content Body */}
            <main className={`flex-1 min-h-0 overflow-y-auto ${isSidebar ? "p-3 space-y-3" : "max-w-6xl w-full mx-auto p-6"}`}>
                <div className="flex items-center justify-between gap-3 mb-2">
                    <div>
                        <h1 className="text-sm sm:text-base font-bold text-surface-900">Dashboards</h1>
                        <p className="text-[11px] text-surface-500">
                            AI-powered interactive dashboards
                        </p>
                    </div>

                    <span className="text-[11px] text-surface-400">
                        {safeDashboards.length} {safeDashboards.length === 1 ? "dashboard" : "dashboards"}
                    </span>
                </div>

                {safeDashboards.length > 3 && (
                    <div className="relative mb-3">
                        <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-surface-400 text-xs" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Filter dashboards..."
                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white rounded-lg border border-surface-200 focus:outline-none focus:border-accent-500"
                        />
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-16 text-surface-400">
                        <i className="fa-solid fa-spinner fa-spin text-lg mr-2 text-accent-600" />
                        <span className="text-xs">Loading dashboards...</span>
                    </div>
                ) : safeDashboards.length === 0 ? (
                    <div className="bg-white border border-surface-200 rounded-xl p-6 text-center max-w-sm mx-auto shadow-2xs my-4">
                        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl">
                            <i className="fa-solid fa-chart-pie" />
                        </div>
                        <h2 className="text-xs font-semibold text-surface-800">No dashboards yet</h2>
                        <p className="text-[11px] text-surface-500 mt-1 mb-4 leading-relaxed">
                            Create your first dashboard to visualize data from your tables with interactive charts and KPI cards.
                        </p>
                        <button
                            onClick={openCreateModal}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent-600 hover:bg-accent-700 text-white shadow-xs transition-colors cursor-pointer"
                        >
                            <i className="fa-solid fa-plus text-[10px]" />
                            <span>Create Dashboard</span>
                        </button>
                    </div>
                ) : (
                    <div className={isSidebar ? "flex flex-col gap-2.5" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"}>
                        {filteredDashboards.map(dash => (
                            <div
                                key={dash.id}
                                onClick={() => {
                                    if (isSidebar) {
                                        onSelectDashboard(dash.id);
                                    } else {
                                        navigate(`${BASE_PATH}autodash/${dash.id}`);
                                    }
                                }}
                                className="bg-white border border-surface-200 rounded-xl p-3.5 shadow-2xs hover:shadow-xs hover:border-accent-400 transition-all flex flex-col justify-between group cursor-pointer"
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-2 mb-1.5">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                                <i className="fa-solid fa-chart-simple text-xs" />
                                            </div>
                                            <h3 className="font-semibold text-xs text-surface-900 truncate" title={dash.name}>
                                                {dash.name}
                                            </h3>
                                        </div>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(dash.id, dash.name);
                                            }}
                                            className="text-surface-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                            title="Delete dashboard"
                                        >
                                            <i className="fa-regular fa-trash-can text-xs" />
                                        </button>
                                    </div>

                                    <div className="text-[10px] text-surface-400 flex items-center gap-2 mb-2">
                                        <span>
                                            <i className="fa-regular fa-calendar mr-1" />
                                            {dash.created_at ? new Date(dash.created_at).toLocaleDateString() : "Recently"}
                                        </span>
                                        <span>•</span>
                                        <span>ID: {dash.id}</span>
                                    </div>

                                    {dash.base_prompt ? (
                                        <div className="text-[11px] text-surface-700 bg-surface-50 p-2 rounded-lg border border-surface-200/60 leading-relaxed italic line-clamp-2">
                                            "{dash.base_prompt}"
                                        </div>
                                    ) : (
                                        <div className="text-[11px] text-surface-400 italic bg-surface-50/50 p-2 rounded-lg border border-dashed border-surface-200">
                                            No initial prompt specified
                                        </div>
                                    )}
                                </div>

                                <div className="mt-3 pt-2 border-t border-surface-100 flex items-center justify-between text-xs">
                                    <span className="text-[10px] text-accent-600 font-medium group-hover:underline">
                                        View dashboard
                                    </span>
                                    <i className="fa-solid fa-chevron-right text-[10px] text-surface-400 group-hover:text-accent-600 group-hover:translate-x-0.5 transition-all" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* CREATE DASHBOARD MODAL */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-surface-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl border border-surface-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-5 py-3.5 border-b border-surface-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-accent-50 text-accent-600 flex items-center justify-center">
                                    <i className="fa-solid fa-plus text-xs" />
                                </div>
                                <h3 className="font-semibold text-xs sm:text-sm text-surface-900">Create New Dashboard</h3>
                            </div>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="text-surface-400 hover:text-surface-700 text-sm p-1 rounded"
                            >
                                <i className="fa-solid fa-xmark" />
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="p-5 overflow-y-auto space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-surface-700 mb-1">
                                    Dashboard Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={modalName}
                                    onChange={e => setModalName(e.target.value)}
                                    placeholder="e.g. Sales & Orders Overview"
                                    className="w-full text-xs px-3 py-2 rounded-lg border border-surface-300 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 outline-none transition-all"
                                    autoFocus
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-surface-700 mb-1 flex items-center justify-between">
                                    <span>Prompt / Description</span>
                                    <span className="text-[11px] font-normal text-surface-400">What should Dashy build?</span>
                                </label>
                                <textarea
                                    value={modalPrompt}
                                    onChange={e => setModalPrompt(e.target.value)}
                                    rows={3}
                                    placeholder="e.g. Generate average basket price of an order grouped by week"
                                    className="w-full text-xs p-2.5 rounded-lg border border-surface-300 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 outline-none transition-all resize-none leading-relaxed text-surface-800 placeholder-surface-400"
                                />
                            </div>

                            <div className="pt-3 border-t border-surface-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-3.5 py-1.5 text-xs font-medium rounded-lg text-surface-600 hover:bg-surface-100 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!modalName.trim() || isCreating}
                                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                    {isCreating ? (
                                        <>
                                            <i className="fa-solid fa-spinner fa-spin text-xs" />
                                            <span>Creating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Create & Open</span>
                                            <i className="fa-solid fa-arrow-right text-[10px]" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// ==========================================
// 2. DASHBOARD DETAIL / CHAT VIEW
// ==========================================
interface AutoDashDetailViewProps {
    dashId: number;
    isSidebar?: boolean;
    dashboards?: AutoDashType[];
    onSelectDashboard?: (dashId: number) => void;
    onBack?: () => void;
    onClose?: () => void;
    onOpenSeparatePage?: () => void;
    currentTable?: Datatable | null;
    onDashboardCreated?: (dashboard: AutoDashType) => void;
}

export function AutoDashDetailView({
    dashId,
    isSidebar = false,
    dashboards = [],
    onSelectDashboard,
    onBack,
    onClose,
    onOpenSeparatePage,
    currentTable,
}: AutoDashDetailViewProps) {
    // Data State
    const [currentDash, setCurrentDash] = useState<AutoDashType | null>(null);
    const [items, setItems] = useState<AutoDashItem[]>([]);
    const [activeTab, setActiveTab] = useState<ActiveTab>("chat");
    const [loading, setLoading] = useState<boolean>(true);

    // Code & Preview
    const [htmlCode, setHtmlCode] = useState<string>("");
    const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
    const [isSavingCode, setIsSavingCode] = useState<boolean>(false);
    const [saveCodeSuccess, setSaveCodeSuccess] = useState<boolean>(false);
    const [previewKey, setPreviewKey] = useState<number>(0);

    // Chat
    const [inputMessage, setInputMessage] = useState<string>("");
    const [isSending, setIsSending] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Table context
    const [datatables, setDatatables] = useState<Datatable[]>([]);

    const chatEndRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Load available tables
    useEffect(() => {
        listDatatables().then(res => {
            if (res.data) setDatatables(normalizeArray<Datatable>(res.data));
        });
    }, []);

    // Load specific dashboard details on mount or dashId change
    useEffect(() => {
        loadDashboard(dashId);
    }, [dashId]);

    const loadDashboard = async (id: number) => {
        setLoading(true);
        setErrorMsg(null);
        try {
            const res = await getAutoDashboard(id);
            if (res.error) {
                setErrorMsg(res.error);
                return;
            }

            if (res.data) {
                setCurrentDash(res.data.dashboard);
                const itemsList = normalizeArray<AutoDashItem>(res.data.items);
                setItems(itemsList);

                // Find version items and set latest
                const vItems = itemsList.filter(it => Boolean(it.html_content && it.html_content.trim() !== ""));
                if (vItems.length > 0) {
                    const latest = vItems[vItems.length - 1];
                    setSelectedVersionId(latest.id);
                    setHtmlCode(latest.html_content || "");
                } else {
                    setSelectedVersionId(null);
                    try {
                        const tmplRes = await getAutoDashTemplate();
                        setHtmlCode(tmplRes.data?.template || "");
                    } catch {
                        setHtmlCode("");
                    }
                }
                setPreviewKey(k => k + 1);

                // If dashboard has a user prompt and has no user messages sent yet, automatically trigger Dashy
                const hasUserMessage = itemsList.some(it => it.role === "user");
                if (!hasUserMessage && res.data.dashboard.base_prompt && res.data.dashboard.base_prompt.trim()) {
                    triggerInitialPrompt(res.data.dashboard.id, res.data.dashboard.base_prompt.trim(), itemsList);
                }
            }
        } catch (err: any) {
            setErrorMsg(err.message || "Failed to fetch dashboard");
        } finally {
            setLoading(false);
        }
    };

    const triggerInitialPrompt = async (targetDashId: number, promptText: string, currentItems: AutoDashItem[]) => {
        const optimisticItem: AutoDashItem = {
            id: Date.now(),
            auto_dash_id: targetDashId,
            role: "user",
            content: promptText,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        setItems([...currentItems, optimisticItem]);
        setIsSending(true);
        setErrorMsg(null);

        try {
            const res = await sendAutoDashChat(targetDashId, promptText);
            if (res.error) {
                setErrorMsg(res.error);
            } else if (res.data) {
                setItems([...currentItems, optimisticItem, res.data.item]);
                if (res.data.html_content) {
                    setSelectedVersionId(res.data.item.id);
                    setHtmlCode(res.data.html_content);
                    setPreviewKey(k => k + 1);
                }
            }
        } catch (err: any) {
            setErrorMsg(err.message || "Failed to communicate with Dashy");
        } finally {
            setIsSending(false);
        }
    };

    // Auto-scroll chat to bottom
    useEffect(() => {
        if (activeTab === "chat") {
            chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [items, isSending, activeTab]);

    // Handle iframe postMessage bridge (ddash_query <-> ddash_result)
    useEffect(() => {
        const handleMessage = async (event: MessageEvent) => {
            const d = event.data;
            if (!d || d.type !== "ddash_query") return;

            const { id, sqlQuery, args } = d;
            try {
                const res = await runAutoDashQuery(sqlQuery, args);
                if (iframeRef.current && iframeRef.current.contentWindow) {
                    if (res.error) {
                        iframeRef.current.contentWindow.postMessage({
                            type: "ddash_result",
                            id,
                            error: res.error
                        }, "*");
                    } else {
                        iframeRef.current.contentWindow.postMessage({
                            type: "ddash_result",
                            id,
                            rows: normalizeArray(res.data?.rows)
                        }, "*");
                    }
                }
            } catch (err: any) {
                if (iframeRef.current && iframeRef.current.contentWindow) {
                    iframeRef.current.contentWindow.postMessage({
                        type: "ddash_result",
                        id,
                        error: err.message || "Query execution error"
                    }, "*");
                }
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    // Send chat message
    const handleSendMessage = async (msgToSend?: string) => {
        const text = msgToSend || inputMessage;
        if (!text.trim() || !currentDash || isSending) return;

        const optimisticItem: AutoDashItem = {
            id: Date.now(),
            auto_dash_id: currentDash.id,
            role: "user",
            content: text.trim(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        setItems(prev => [...normalizeArray<AutoDashItem>(prev), optimisticItem]);
        setInputMessage("");
        setIsSending(true);
        setErrorMsg(null);

        try {
            const res = await sendAutoDashChat(currentDash.id, text.trim());
            if (res.error) {
                setErrorMsg(res.error);
            } else if (res.data) {
                setItems(prev => [...normalizeArray<AutoDashItem>(prev), res.data!.item]);
                if (res.data.html_content) {
                    setSelectedVersionId(res.data.item.id);
                    setHtmlCode(res.data.html_content);
                    setPreviewKey(k => k + 1);
                }
            }
        } catch (err: any) {
            setErrorMsg(err.message || "Failed to communicate with Dashy");
        } finally {
            setIsSending(false);
        }
    };

    // Save manual code edits
    const handleSaveCode = async () => {
        if (!currentDash || isSavingCode) return;
        setIsSavingCode(true);
        setSaveCodeSuccess(false);
        try {
            const res = await saveAutoDashCode(currentDash.id, htmlCode);
            if (res.data?.item) {
                setItems(prev => [...normalizeArray<AutoDashItem>(prev), res.data!.item]);
                setSelectedVersionId(res.data.item.id);
                setSaveCodeSuccess(true);
                setPreviewKey(k => k + 1);
                setTimeout(() => setSaveCodeSuccess(false), 3000);
            }
        } catch (err: any) {
            setErrorMsg(err.message || "Failed to save code");
        } finally {
            setIsSavingCode(false);
        }
    };

    const promptSuggestions = currentTable ? [
        `Show KPI metric cards for table ${currentTable.name}`,
        `Build a breakdown chart of records in ${currentTable.name}`,
        `Analyze distributions and totals for ${currentTable.name}`,
        "Make a modern executive summary dashboard with Chart.js"
    ] : [
        "Create KPI metric cards with totals from tables",
        "Build a bar chart grouped by category",
        "Add a monthly timeline trend and summary table",
        "Make a modern executive summary dashboard with Chart.js"
    ];

    const safeItems = normalizeArray<AutoDashItem>(items);
    const safeDatatables = normalizeArray<Datatable>(datatables);

    // Compute version items (items with non-empty html_content)
    const versionItems = safeItems.filter(it => Boolean(it.html_content && it.html_content.trim() !== ""));
    const activeVersionItem = versionItems.find(it => String(it.id) === String(selectedVersionId)) || versionItems[versionItems.length - 1];
    const isLatestVersion = Boolean(activeVersionItem && versionItems.length > 0 && String(activeVersionItem.id) === String(versionItems[versionItems.length - 1].id));
    const isModified = activeVersionItem ? (activeVersionItem.html_content || "") !== htmlCode : false;

    // Switch selected version and update htmlCode and previewKey
    const handleSelectVersion = (versionId: number | string) => {
        const vIdStr = String(versionId);
        const target = versionItems.find(it => String(it.id) === vIdStr);
        if (target) {
            setSelectedVersionId(target.id);
            setHtmlCode(target.html_content || "");
            setPreviewKey(k => k + 1);
        }
    };

    // Version selector component rendered in Code & Preview tabs
    const renderVersionSelector = (variant: "code" | "preview") => {
        if (versionItems.length === 0) return null;

        const currentVal = selectedVersionId != null
            ? String(selectedVersionId)
            : (versionItems.length > 0 ? String(versionItems[versionItems.length - 1].id) : "");

        return (
            <div className={`flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs border ${
                variant === "preview"
                    ? "bg-white border-surface-300 shadow-2xs"
                    : "bg-surface-100 border-surface-200"
            }`}>
                <i className="fa-solid fa-clock-rotate-left text-surface-400 text-[10px]" />
                <span className="text-surface-500 font-medium text-[10px]">v:</span>
                <select
                    value={currentVal}
                    onChange={e => handleSelectVersion(e.target.value)}
                    className="bg-transparent text-surface-800 font-semibold text-xs outline-none cursor-pointer pr-1 max-w-[140px] sm:max-w-[220px] truncate"
                >
                    {versionItems.map((vItem, idx) => {
                        const vNum = idx + 1;
                        const vIdStr = String(vItem.id);
                        const isLatest = idx === versionItems.length - 1;

                        let desc = "";
                        if (vItem.role === "system") {
                            desc = "Manual edit";
                        } else {
                            const itemIndex = safeItems.findIndex(it => String(it.id) === vIdStr);
                            if (itemIndex > 0) {
                                for (let p = itemIndex - 1; p >= 0; p--) {
                                    if (safeItems[p].role === "user") {
                                        const prompt = safeItems[p].content.trim();
                                        desc = prompt.length > 20 ? `${prompt.substring(0, 20)}...` : prompt;
                                        break;
                                    }
                                }
                            }
                            if (!desc) desc = "Dashy generated";
                        }

                        const timeStr = vItem.created_at
                            ? new Date(vItem.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : "";

                        const label = `v${vNum}${isLatest ? " (Latest)" : ""}: ${desc}${timeStr ? ` • ${timeStr}` : ""}`;

                        return (
                            <option key={vIdStr} value={vIdStr}>
                                {label}
                            </option>
                        );
                    })}
                </select>
            </div>
        );
    };

    if (loading) {
        return (
            <div className={`flex items-center justify-center bg-surface-50 text-surface-500 ${isSidebar ? "h-full" : "min-h-screen"}`}>
                <i className="fa-solid fa-spinner fa-spin text-xl mr-2 text-accent-600" />
                <span className="text-xs font-medium">Loading dashboard...</span>
            </div>
        );
    }

    return (
        <div className={`flex flex-col bg-surface-50 text-surface-800 overflow-hidden ${isSidebar ? "h-full w-full" : "h-screen h-[100dvh]"}`}>
            {/* Top Navigation Bar */}
            <header className="flex flex-col bg-surface-800 text-white shrink-0 shadow-sm border-b border-surface-700">
                <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 border-b border-surface-700/60">
                    <div className="flex items-center gap-2 min-w-0">
                        {isSidebar ? (
                            <button
                                onClick={onBack}
                                className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded text-surface-300 hover:text-white hover:bg-surface-700 transition-colors cursor-pointer"
                                title="Back to Dashboards List"
                            >
                                <i className="fa-solid fa-arrow-left text-[11px]" />
                                <span className="hidden sm:inline">All</span>
                            </button>
                        ) : (
                            <Link
                                to={`${BASE_PATH}autodash`}
                                className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded text-surface-300 hover:text-white hover:bg-surface-700 transition-colors"
                                title="Back to Dashboards List"
                            >
                                <i className="fa-solid fa-arrow-left text-[11px]" />
                                <span>Dashboards</span>
                            </Link>
                        )}

                        <div className="h-3.5 w-px bg-surface-700" />

                        {dashboards.length > 1 && onSelectDashboard ? (
                            <select
                                value={dashId}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    if (!isNaN(val)) onSelectDashboard(val);
                                }}
                                className="bg-surface-900 text-surface-100 border border-surface-600 rounded px-2 py-0.5 text-xs font-semibold max-w-[150px] sm:max-w-[200px] truncate outline-none cursor-pointer"
                            >
                                {dashboards.map(d => (
                                    <option key={d.id} value={d.id}>
                                        {d.name}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <div className="flex items-center gap-1.5 min-w-0">
                                <div className="w-6 h-6 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
                                    <i className="fa-solid fa-chart-line text-xs" />
                                </div>
                                <span className="font-semibold text-xs tracking-tight truncate max-w-[140px] sm:max-w-xs" title={currentDash?.name}>
                                    {currentDash?.name || "Auto Dashboard"}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Right action controls */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        {isSidebar && (
                            <>
                                <button
                                    onClick={onOpenSeparatePage}
                                    className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded text-surface-300 hover:text-white hover:bg-surface-700 transition-colors cursor-pointer"
                                    title="Open in separate page"
                                >
                                    <i className="fa-solid fa-arrow-up-right-from-square text-[11px]" />
                                    <span className="text-[11px] hidden md:inline">Separate page</span>
                                </button>

                                {onClose && (
                                    <button
                                        onClick={onClose}
                                        className="w-7 h-7 flex items-center justify-center rounded text-surface-400 hover:text-white hover:bg-surface-700 transition-colors cursor-pointer"
                                        title="Close sidebar"
                                    >
                                        <i className="fa-solid fa-xmark text-sm" />
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Second row: Segmented tab controls & reload */}
                <div className="flex items-center justify-between px-3 py-1.5 gap-2 bg-surface-850">
                    <div className="flex items-center bg-surface-900/90 p-0.5 rounded-lg border border-surface-700/80">
                        <button
                            onClick={() => setActiveTab("chat")}
                            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                                activeTab === "chat"
                                    ? "bg-accent-600 text-white shadow-xs"
                                    : "text-surface-300 hover:text-white hover:bg-surface-800"
                            }`}
                        >
                            <i className="fa-solid fa-comments text-[10px]" />
                            <span>Chat</span>
                        </button>
                        <button
                            onClick={() => setActiveTab("code")}
                            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                                activeTab === "code"
                                    ? "bg-accent-600 text-white shadow-xs"
                                    : "text-surface-300 hover:text-white hover:bg-surface-800"
                            }`}
                        >
                            <i className="fa-solid fa-code text-[10px]" />
                            <span>Code</span>
                        </button>
                        <button
                            onClick={() => setActiveTab("preview")}
                            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                                activeTab === "preview"
                                    ? "bg-accent-600 text-white shadow-xs"
                                    : "text-surface-300 hover:text-white hover:bg-surface-800"
                            }`}
                        >
                            <i className="fa-solid fa-chart-pie text-[10px]" />
                            <span>Preview</span>
                        </button>
                    </div>

                    <button
                        onClick={() => setPreviewKey(k => k + 1)}
                        className="px-2 py-1 text-xs bg-surface-700 hover:bg-surface-600 text-surface-200 rounded flex items-center gap-1 transition-colors cursor-pointer"
                        title="Reload Dashboard"
                    >
                        <i className="fa-solid fa-rotate-right text-[10px]" />
                        <span className="hidden sm:inline text-[11px]">Reload</span>
                    </button>
                </div>
            </header>

            {/* Error Banner */}
            {errorMsg && (
                <div className="bg-red-50 border-b border-red-200 text-red-700 px-4 py-2 text-xs flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <i className="fa-solid fa-triangle-exclamation" />
                        <span>{errorMsg}</span>
                    </div>
                    <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-800">
                        <i className="fa-solid fa-xmark" />
                    </button>
                </div>
            )}

            {/* Main Area based on activeTab */}
            <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {/* 1. CHAT TAB */}
                {activeTab === "chat" && (
                    <div className="flex-1 min-h-0 flex flex-col w-full h-full p-3 sm:p-4 overflow-hidden">
                        {/* Messages List */}
                        <div className="flex-1 min-h-0 overflow-y-auto space-y-3.5 pr-1.5 [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent]">
                            {safeItems.length === 0 && (
                                <div className="text-center py-10 text-surface-400">
                                    <div className="w-12 h-12 mx-auto mb-2 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
                                        <i className="fa-solid fa-wand-magic-sparkles" />
                                    </div>
                                    <h3 className="text-sm font-semibold text-surface-700">Dashy Assistant</h3>
                                    <p className="text-xs text-surface-400 max-w-sm mx-auto mt-1">
                                        Ask Dashy to create or update charts, KPI cards, and metrics from your database tables.
                                    </p>
                                </div>
                            )}

                            {safeItems.map((item, idx) => (
                                <div
                                    key={item.id || idx}
                                    className={`flex gap-2 min-w-0 ${item.role === "user" ? "justify-end" : "justify-start"}`}
                                >
                                    {item.role !== "user" && (
                                        <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs self-start mt-0.5">
                                            <i className="fa-solid fa-chart-simple text-[11px]" />
                                        </div>
                                    )}

                                    <div
                                        className={`max-w-[88%] sm:max-w-xl rounded-2xl p-3 text-xs shadow-2xs leading-relaxed min-w-0 overflow-hidden ${
                                            item.role === "user"
                                                ? "bg-accent-600 text-white rounded-br-none"
                                                : "bg-white text-surface-800 border border-surface-200 rounded-bl-none"
                                        }`}
                                    >
                                        <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] overflow-x-auto text-xs leading-relaxed max-w-full">
                                            {item.content}
                                        </div>

                                        {/* If assistant generated/updated HTML, provide quick preview card */}
                                        {item.role === "assistant" && item.html_content && item.html_content.trim() !== "" && (
                                            <div className="mt-2.5 pt-2.5 border-t border-surface-100 flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                                                    <i className="fa-solid fa-circle-check text-[10px]" />
                                                    <span>Updated</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => {
                                                            handleSelectVersion(item.id);
                                                            setActiveTab("preview");
                                                        }}
                                                        className="px-2 py-0.5 rounded bg-surface-100 hover:bg-surface-200 text-surface-700 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                                                    >
                                                        <i className="fa-solid fa-eye text-[10px]" />
                                                        <span>Preview</span>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            handleSelectVersion(item.id);
                                                            setActiveTab("code");
                                                        }}
                                                        className="px-2 py-0.5 rounded bg-surface-100 hover:bg-surface-200 text-surface-700 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                                                    >
                                                        <i className="fa-solid fa-code text-[10px]" />
                                                        <span>Code</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {item.role === "user" && (
                                        <div className="w-7 h-7 rounded-full bg-surface-700 text-white flex items-center justify-center shrink-0 shadow-2xs self-start mt-0.5">
                                            <i className="fa-solid fa-user text-[11px]" />
                                        </div>
                                    )}
                                </div>
                            ))}

                            {isSending && (
                                <div className="flex gap-2 justify-start items-center">
                                    <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 animate-pulse self-start mt-0.5">
                                        <i className="fa-solid fa-chart-simple text-[11px]" />
                                    </div>
                                    <div className="bg-white border border-surface-200 rounded-2xl px-3 py-2 shadow-2xs flex items-center gap-2 text-xs text-surface-500">
                                        <i className="fa-solid fa-spinner fa-spin text-accent-600" />
                                        <span>Dashy is querying tables and updating dashboard...</span>
                                    </div>
                                </div>
                            )}

                            <div ref={chatEndRef} />
                        </div>

                        {/* Suggestions */}
                        {safeItems.length <= 2 && (
                            <div className="py-2 flex flex-wrap gap-1 shrink-0">
                                {promptSuggestions.map((sug, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSendMessage(sug)}
                                        className="text-[11px] bg-white hover:bg-surface-100 text-surface-600 hover:text-surface-900 border border-surface-200 px-2.5 py-1 rounded-full transition-colors flex items-center gap-1 cursor-pointer"
                                    >
                                        <i className="fa-regular fa-lightbulb text-amber-500 text-[10px]" />
                                        <span>{sug}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Input Box */}
                        <div className="pt-2 border-t border-surface-200 shrink-0">
                            <div className="relative bg-white rounded-xl border border-surface-200 shadow-2xs focus-within:border-accent-500 focus-within:ring-2 focus-within:ring-accent-500/20 transition-all p-2">
                                <textarea
                                    value={inputMessage}
                                    onChange={e => setInputMessage(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }
                                    }}
                                    placeholder="Describe the dashboard (e.g. 'Show revenue by category and total orders')..."
                                    className="w-full text-xs text-surface-800 placeholder-surface-400 outline-none resize-none min-h-[48px] max-h-32 pr-9"
                                    rows={2}
                                />
                                <button
                                    onClick={() => handleSendMessage()}
                                    disabled={!inputMessage.trim() || isSending}
                                    className="absolute right-2.5 bottom-2.5 w-7 h-7 rounded-lg bg-accent-600 hover:bg-accent-700 disabled:bg-surface-300 text-white flex items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed"
                                >
                                    <i className="fa-solid fa-arrow-up text-xs" />
                                </button>
                            </div>
                            <div className="flex justify-between items-center px-1 mt-1 text-[10px] text-surface-400">
                                <span>Enter to send, Shift+Enter for newline</span>
                                <span className="truncate max-w-[200px]">
                                    Tables: {safeDatatables.map(d => `Actual${d.id}`).join(", ") || "None"}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. CODE TAB */}
                {activeTab === "code" && (
                    <div className="flex-1 min-h-0 flex flex-col p-3 overflow-hidden w-full h-full">
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-surface-200 shrink-0 gap-2 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-surface-700">Code</span>
                                {renderVersionSelector("code")}
                                {saveCodeSuccess && (
                                    <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                                        <i className="fa-solid fa-check" />Saved
                                    </span>
                                )}
                                {isModified && (
                                    <span className="text-[10px] text-amber-600 font-medium flex items-center gap-1 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                                        <i className="fa-solid fa-circle-dot text-[7px]" />Unsaved
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5">
                                {isModified && (
                                    <button
                                        onClick={() => {
                                            if (activeVersionItem?.html_content) {
                                                setHtmlCode(activeVersionItem.html_content);
                                            }
                                        }}
                                        className="px-2 py-1 bg-white hover:bg-surface-100 text-surface-600 border border-surface-200 rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                                        title="Revert edits"
                                    >
                                        <i className="fa-solid fa-rotate-left text-[10px]" />
                                        <span>Revert</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => navigator.clipboard.writeText(htmlCode)}
                                    className="px-2 py-1 bg-white hover:bg-surface-100 text-surface-700 border border-surface-200 rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                    <i className="fa-regular fa-copy text-xs" />
                                    <span className="hidden sm:inline">Copy</span>
                                </button>
                                <button
                                    onClick={handleSaveCode}
                                    disabled={isSavingCode}
                                    className="px-2.5 py-1 bg-accent-600 hover:bg-accent-700 text-white rounded text-xs font-medium flex items-center gap-1 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                                >
                                    <i className="fa-solid fa-floppy-disk text-[11px]" />
                                    <span>{isSavingCode ? "Saving..." : !isLatestVersion ? "Save As New" : "Save"}</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab("preview")}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                                >
                                    <i className="fa-solid fa-play text-[10px]" />
                                    <span>Run</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 min-h-0 bg-surface-900 rounded-lg overflow-hidden border border-surface-800 shadow-inner flex flex-col">
                            <textarea
                                value={htmlCode}
                                onChange={e => setHtmlCode(e.target.value)}
                                className="w-full flex-1 min-h-0 p-3 bg-transparent text-emerald-400 font-mono text-xs outline-none resize-none leading-relaxed selection:bg-surface-700 overflow-y-auto"
                                spellCheck={false}
                            />
                        </div>
                    </div>
                )}

                {/* 3. PREVIEW TAB */}
                {activeTab === "preview" && (
                    <div className="flex-1 min-h-0 flex flex-col w-full h-full bg-white relative overflow-hidden">
                        <div className="bg-surface-100 border-b border-surface-200 px-3 py-1 flex items-center justify-between text-xs text-surface-600 shrink-0 gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="font-medium text-[11px]">Preview</span>
                                </div>
                                {renderVersionSelector("preview")}
                                {!isLatestVersion && versionItems.length > 0 && (
                                    <button
                                        onClick={() => handleSelectVersion(versionItems[versionItems.length - 1].id)}
                                        className="text-[10px] text-accent-600 hover:text-accent-800 font-semibold underline flex items-center gap-0.5 cursor-pointer"
                                    >
                                        Jump Latest
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setPreviewKey(k => k + 1)}
                                    className="px-1.5 py-0.5 hover:bg-surface-200 rounded text-[10px] text-surface-700 flex items-center gap-1 transition-colors cursor-pointer"
                                    title="Refresh preview"
                                >
                                    <i className="fa-solid fa-arrow-rotate-right text-[9px]" />
                                    <span>Refresh</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab("code")}
                                    className="px-1.5 py-0.5 hover:bg-surface-200 rounded text-[10px] text-surface-700 flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                    <i className="fa-solid fa-code text-[9px]" />
                                    <span>Code</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 w-full h-full relative">
                            {htmlCode ? (
                                <iframe
                                    key={previewKey}
                                    ref={iframeRef}
                                    title="AutoDash Preview"
                                    srcDoc={htmlCode}
                                    className="w-full h-full border-0 absolute inset-0"
                                    sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-surface-400 p-4">
                                    <i className="fa-solid fa-chart-simple text-2xl mb-2 text-surface-300" />
                                    <p className="text-xs text-center">No dashboard generated yet. Go to Chat tab to ask Dashy!</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
