import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router";
import { BASE_PATH } from "../../lib/base";
import {
    listAutoForms,
    createAutoForm,
    getAutoForm,
    deleteAutoForm,
    sendAutoFormChat,
    saveAutoFormCode,
    runAutoFormQuery,
    runAutoFormCrud,
    getAutoFormSchema,
    getAutoFormTemplate,
} from "../../lib/api";
import type {
    AutoForm as AutoFormType,
    AutoFormItem,
    Datatable,
} from "../../lib/api";

export type ActiveTab = "chat" | "code" | "preview";

export const normalizeArray = <T,>(val: any): T[] => {
    if (Array.isArray(val)) return val;
    if (val && typeof val === "object") return Object.values(val);
    return [];
};

export interface AutoFormPanelProps {
    formId?: number | null;
    onSelectFormId?: (formId: number | null) => void;
    isSidebar?: boolean;
    onClose?: () => void;
    currentTable?: Datatable | null;
}

export default function AutoFormPanel({
    formId: propFormId,
    onSelectFormId,
    isSidebar = false,
    onClose,
    currentTable,
}: AutoFormPanelProps) {
    const navigate = useNavigate();
    const [localFormId, setLocalFormId] = useState<number | null>(propFormId ?? null);
    const [forms, setForms] = useState<AutoFormType[]>([]);
    const [loadingForms, setLoadingForms] = useState<boolean>(true);

    // Synchronize local state with propFormId if prop changes
    useEffect(() => {
        if (propFormId !== undefined) {
            setLocalFormId(propFormId);
        }
    }, [propFormId]);

    // Fetch form list
    const refreshForms = async () => {
        try {
            setLoadingForms(true);
            const res = await listAutoForms();
            const list = normalizeArray<AutoFormType>(res.data?.forms);
            setForms(list);
            return list;
        } catch {
            return [];
        } finally {
            setLoadingForms(false);
        }
    };

    useEffect(() => {
        refreshForms();
    }, []);

    const handleSelectForm = (id: number | null) => {
        setLocalFormId(id);
        onSelectFormId?.(id);
    };

    const handleOpenSeparatePage = () => {
        if (localFormId) {
            navigate(`${BASE_PATH}autoform/${localFormId}`);
        } else {
            navigate(`${BASE_PATH}autoform`);
        }
    };

    if (localFormId != null) {
        return (
            <AutoFormDetailView
                formId={localFormId}
                isSidebar={isSidebar}
                forms={forms}
                onSelectForm={handleSelectForm}
                onBack={() => handleSelectForm(null)}
                onClose={onClose}
                onOpenSeparatePage={handleOpenSeparatePage}
                currentTable={currentTable}
                onFormCreated={(newForm) => {
                    setForms(prev => [...prev, newForm]);
                    handleSelectForm(newForm.id);
                }}
            />
        );
    }

    return (
        <AutoFormListView
            isSidebar={isSidebar}
            forms={forms}
            loading={loadingForms}
            onRefreshForms={refreshForms}
            onSelectForm={handleSelectForm}
            onClose={onClose}
            onOpenSeparatePage={handleOpenSeparatePage}
            currentTable={currentTable}
        />
    );
}

// ==========================================
// 1. LIST VIEW COMPONENT
// ==========================================

interface AutoFormListViewProps {
    isSidebar?: boolean;
    forms: AutoFormType[];
    loading: boolean;
    onRefreshForms: () => Promise<AutoFormType[]>;
    onSelectForm: (id: number) => void;
    onClose?: () => void;
    onOpenSeparatePage: () => void;
    currentTable?: Datatable | null;
}

function AutoFormListView({
    isSidebar = false,
    forms,
    loading,
    onRefreshForms,
    onSelectForm,
    onClose,
    onOpenSeparatePage,
    currentTable: _currentTable,
}: AutoFormListViewProps) {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");
    const [localForms, setLocalForms] = useState<AutoFormType[]>(forms);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Modal state for creating a new form
    const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
    const [modalName, setModalName] = useState<string>("");
    const [modalPrompt, setModalPrompt] = useState<string>("");
    const [isCreating, setIsCreating] = useState<boolean>(false);

    useEffect(() => {
        setLocalForms(forms);
    }, [forms]);

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
            const res = await createAutoForm({
                name: modalName.trim(),
                base_prompt: modalPrompt.trim(),
            });

            if (res.error) {
                setErrorMsg(res.error);
                setIsCreating(false);
                return;
            }

            if (res.data?.form) {
                setIsCreateModalOpen(false);
                const newForm = res.data.form;
                await onRefreshForms();
                if (isSidebar) {
                    onSelectForm(newForm.id);
                } else {
                    navigate(`${BASE_PATH}autoform/${newForm.id}`);
                }
            }
        } catch (err: any) {
            setErrorMsg(err.message || "Failed to create form");
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async (id: number, name: string) => {
        if (!window.confirm(`Are you sure you want to delete form "${name}"?`)) {
            return;
        }

        try {
            const res = await deleteAutoForm(id);
            if (res.error) {
                setErrorMsg(res.error);
            } else {
                setLocalForms(prev => prev.filter(f => f.id !== id));
                onRefreshForms();
            }
        } catch (err: any) {
            setErrorMsg(err.message || "Failed to delete form");
        }
    };

    const safeForms = normalizeArray<AutoFormType>(localForms);
    const filteredForms = safeForms.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.base_prompt && f.base_prompt.toLowerCase().includes(searchQuery.toLowerCase()))
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
                        <div className="w-7 h-7 rounded-lg bg-violet-600/20 text-violet-400 border border-violet-500/30 flex items-center justify-center shrink-0">
                            <i className="fa-solid fa-rectangle-list text-xs" />
                        </div>
                        <div className="min-w-0">
                            <span className="font-semibold text-xs sm:text-sm tracking-tight truncate block">
                                AutoForm
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={openCreateModal}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white shadow-sm transition-colors"
                    >
                        <i className="fa-solid fa-plus text-[10px]" />
                        <span>Create Form</span>
                    </button>

                    {isSidebar && (
                        <>
                            <button
                                onClick={onOpenSeparatePage}
                                className="p-1.5 text-surface-400 hover:text-white hover:bg-surface-700 rounded transition-colors"
                                title="Open in dedicated page"
                            >
                                <i className="fa-solid fa-arrow-up-right-from-square text-xs" />
                            </button>
                            {onClose && (
                                <button
                                    onClick={onClose}
                                    className="p-1.5 text-surface-400 hover:text-white hover:bg-surface-700 rounded transition-colors"
                                    title="Close panel"
                                >
                                    <i className="fa-solid fa-xmark text-sm" />
                                </button>
                            )}
                        </>
                    )}
                </div>
            </header>

            {/* Error banner */}
            {errorMsg && (
                <div className="bg-red-500/10 border-b border-red-500/20 text-red-600 px-4 py-2 text-xs flex items-center justify-between">
                    <span>{errorMsg}</span>
                    <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-700">
                        <i className="fa-solid fa-xmark" />
                    </button>
                </div>
            )}

            {/* Content Container */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                {/* Search & Intro */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="text-sm sm:text-base font-bold text-surface-900 tracking-tight">
                            Interactive Mini-Apps & Forms
                        </h2>
                        <p className="text-xs text-surface-500">
                            Build live forms with CRUD data binding, filters, and records management via Formy AI.
                        </p>
                    </div>

                    <div className="relative w-full sm:w-64 shrink-0">
                        <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs" />
                        <input
                            type="text"
                            placeholder="Search forms..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-surface-200 bg-white placeholder-surface-400 text-surface-800 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
                        />
                    </div>
                </div>

                {/* Quick Templates Suggestion */}
                <div className="bg-gradient-to-r from-violet-500/10 via-purple-500/5 to-indigo-500/10 border border-violet-200/60 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2 text-violet-800 font-semibold text-xs">
                        <i className="fa-solid fa-wand-magic-sparkles text-violet-600" />
                        <span>Quick Start Templates</span>
                    </div>
                    <p className="text-[11px] text-surface-600 mb-3">
                        Choose a template to quickly initialize an interactive form connected to your data:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <button
                            onClick={() => {
                                setModalName("CRUD Entry & Records List");
                                setModalPrompt("Create a responsive data submission form with client-side validation and live records table underneath with edit and delete capabilities.");
                                setIsCreateModalOpen(true);
                            }}
                            className="flex flex-col items-start p-2.5 rounded-lg bg-white border border-surface-200/80 hover:border-violet-300 hover:shadow-sm transition-all text-left group"
                        >
                            <span className="font-semibold text-xs text-surface-800 group-hover:text-violet-600 flex items-center gap-1.5 mb-1">
                                <i className="fa-solid fa-file-pen text-violet-500 text-[11px]" />
                                CRUD Entry & List
                            </span>
                            <span className="text-[10px] text-surface-500 line-clamp-2">
                                Form on top for adding rows, responsive data table below with search, edit, and delete.
                            </span>
                        </button>

                        <button
                            onClick={() => {
                                setModalName("Filter & Update Manager");
                                setModalPrompt("Build a search and filter mini-app allowing the user to inspect existing records, click a row to open an edit form, and save changes.");
                                setIsCreateModalOpen(true);
                            }}
                            className="flex flex-col items-start p-2.5 rounded-lg bg-white border border-surface-200/80 hover:border-violet-300 hover:shadow-sm transition-all text-left group"
                        >
                            <span className="font-semibold text-xs text-surface-800 group-hover:text-violet-600 flex items-center gap-1.5 mb-1">
                                <i className="fa-solid fa-filter text-purple-500 text-[11px]" />
                                Filter & Batch Update
                            </span>
                            <span className="text-[10px] text-surface-500 line-clamp-2">
                                Searchable directory layout with quick edit modal and status toggle badges.
                            </span>
                        </button>

                        <button
                            onClick={() => {
                                setModalName("Multi-Step Intake Form");
                                setModalPrompt("Build a polished multi-step wizard form with steps for contact details, categories, and review before final submission.");
                                setIsCreateModalOpen(true);
                            }}
                            className="flex flex-col items-start p-2.5 rounded-lg bg-white border border-surface-200/80 hover:border-violet-300 hover:shadow-sm transition-all text-left group"
                        >
                            <span className="font-semibold text-xs text-surface-800 group-hover:text-violet-600 flex items-center gap-1.5 mb-1">
                                <i className="fa-solid fa-list-check text-indigo-500 text-[11px]" />
                                Step Wizard Form
                            </span>
                            <span className="text-[10px] text-surface-500 line-clamp-2">
                                3-step progress bar wizard that inserts a complete row into the active database table.
                            </span>
                        </button>
                    </div>
                </div>

                {/* Form Cards Grid */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 text-surface-400 space-y-2">
                        <i className="fa-solid fa-circle-notch fa-spin text-2xl text-violet-500" />
                        <span className="text-xs">Loading forms...</span>
                    </div>
                ) : filteredForms.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-surface-200 rounded-2xl bg-white p-8">
                        <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mb-3">
                            <i className="fa-solid fa-rectangle-list text-xl" />
                        </div>
                        <h3 className="text-sm font-semibold text-surface-800 mb-1">No forms found</h3>
                        <p className="text-xs text-surface-500 max-w-sm mb-4">
                            {searchQuery
                                ? "No forms match your search criteria. Try a different query."
                                : "Create your first interactive form or mini-app with Formy AI."}
                        </p>
                        <button
                            onClick={openCreateModal}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white shadow-sm transition-colors flex items-center gap-1.5"
                        >
                            <i className="fa-solid fa-plus text-[10px]" />
                            <span>Create New Form</span>
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredForms.map((form) => (
                            <div
                                key={form.id}
                                onClick={() => {
                                    if (isSidebar) {
                                        onSelectForm(form.id);
                                    } else {
                                        navigate(`${BASE_PATH}autoform/${form.id}`);
                                    }
                                }}
                                className="group relative bg-white border border-surface-200 hover:border-violet-400 rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 border border-violet-100 flex items-center justify-center shrink-0">
                                                <i className="fa-solid fa-file-lines text-sm" />
                                            </div>
                                            <h3 className="font-semibold text-xs sm:text-sm text-surface-900 truncate group-hover:text-violet-600 transition-colors">
                                                {form.name}
                                            </h3>
                                        </div>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(form.id, form.name);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 text-surface-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                            title="Delete form"
                                        >
                                            <i className="fa-regular fa-trash-can text-xs" />
                                        </button>
                                    </div>

                                    {form.base_prompt ? (
                                        <p className="text-[11px] text-surface-500 line-clamp-3 mb-3">
                                            {form.base_prompt}
                                        </p>
                                    ) : (
                                        <p className="text-[11px] text-surface-400 italic mb-3">
                                            No objective description provided
                                        </p>
                                    )}
                                </div>

                                <div className="pt-3 border-t border-surface-100 flex items-center justify-between text-[10px] text-surface-400">
                                    <span>
                                        Updated {new Date(form.updated_at || form.created_at).toLocaleDateString()}
                                    </span>
                                    <span className="text-violet-600 font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                                        Open Form
                                        <i className="fa-solid fa-chevron-right text-[8px]" />
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Form Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-surface-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <form onSubmit={handleCreate}>
                            <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
                                        <i className="fa-solid fa-wand-sparkles text-xs" />
                                    </div>
                                    <h3 className="font-bold text-sm text-surface-900">Create New AutoForm</h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="text-surface-400 hover:text-surface-600 p-1"
                                >
                                    <i className="fa-solid fa-xmark text-sm" />
                                </button>
                            </div>

                            <div className="p-5 space-y-4 text-xs">
                                <div>
                                    <label className="block font-semibold text-surface-700 mb-1">
                                        Form Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Order Processing Form, Student Registration, Task Manager..."
                                        value={modalName}
                                        onChange={(e) => setModalName(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-surface-300 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
                                    />
                                </div>

                                <div>
                                    <label className="block font-semibold text-surface-700 mb-1">
                                        What should this form do? (Objective / Prompt)
                                    </label>
                                    <textarea
                                        rows={4}
                                        placeholder="Describe what form or mini-app to build (e.g. 'Build an order form that saves customer details and multiple line items into Orders and OrderItems')..."
                                        value={modalPrompt}
                                        onChange={(e) => setModalPrompt(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-surface-300 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
                                    />
                                </div>

                                <div className="p-2.5 rounded-lg bg-violet-50/70 border border-violet-100 flex items-start gap-2.5 text-violet-900 text-[11px] leading-relaxed">
                                    <i className="fa-solid fa-database text-violet-600 text-xs shrink-0 mt-0.5" />
                                    <span>
                                        <strong>Full schema loaded:</strong> Formy understands all tables in your database and can build forms that query and insert across multiple tables (e.g. Orders and OrderItems).
                                    </span>
                                </div>
                            </div>

                            <div className="px-5 py-3.5 bg-surface-50 border-t border-surface-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-3 py-1.5 rounded-lg border border-surface-300 text-surface-700 hover:bg-surface-100 font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!modalName.trim() || isCreating}
                                    className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium shadow-sm transition-colors flex items-center gap-1.5"
                                >
                                    {isCreating ? (
                                        <>
                                            <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                                            <span>Creating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-wand-magic-sparkles text-xs" />
                                            <span>Generate Form</span>
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
// 2. DETAIL VIEW COMPONENT
// ==========================================

interface AutoFormDetailViewProps {
    formId: number;
    isSidebar?: boolean;
    forms: AutoFormType[];
    onSelectForm: (id: number | null) => void;
    onBack: () => void;
    onClose?: () => void;
    onOpenSeparatePage: () => void;
    currentTable?: Datatable | null;
    onFormCreated?: (newForm: AutoFormType) => void;
}

function AutoFormDetailView({
    formId,
    isSidebar = false,
    forms,
    onSelectForm,
    onBack,
    onClose,
    onOpenSeparatePage,
    currentTable: _currentTable,
    onFormCreated: _onFormCreated,
}: AutoFormDetailViewProps) {
    const [currentForm, setCurrentForm] = useState<AutoFormType | null>(null);
    const [items, setItems] = useState<AutoFormItem[]>([]);
    const [activeTab, setActiveTab] = useState<ActiveTab>("preview");
    const [loading, setLoading] = useState<boolean>(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Chat State
    const [inputMessage, setInputMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Code State
    const [htmlCode, setHtmlCode] = useState<string>("");
    const [isSavingCode, setIsSavingCode] = useState(false);
    const [saveCodeSuccess, setSaveCodeSuccess] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);

    // Preview State
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [previewKey, setPreviewKey] = useState<number>(1);
    const [previewDevice, setPreviewDevice] = useState<"full" | "tablet" | "mobile">("full");
    const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);

    // Fetch form details
    const fetchFormDetails = async () => {
        try {
            setLoading(true);
            setErrorMsg(null);
            const res = await getAutoForm(formId);
            if (res.error) {
                setErrorMsg(res.error);
                return;
            }
            if (res.data) {
                setCurrentForm(res.data.form);
                const itemList = normalizeArray<AutoFormItem>(res.data.items);
                setItems(itemList);

                // Find version items and set latest
                const vItems = itemList.filter(it => Boolean(it.html_content && it.html_content.trim() !== ""));
                if (vItems.length > 0) {
                    const latest = vItems[vItems.length - 1];
                    setSelectedVersionId(latest.id);
                    setHtmlCode(latest.html_content || "");
                } else {
                    setSelectedVersionId(null);
                    try {
                        const tmplRes = await getAutoFormTemplate();
                        setHtmlCode(tmplRes.data?.template || "");
                    } catch {
                        setHtmlCode("");
                    }
                }
                setPreviewKey(k => k + 1);

                // If form has a base_prompt and no user message was sent yet, automatically trigger Formy
                const hasUserMessage = itemList.some(it => it.role === "user");
                if (!hasUserMessage && res.data.form.base_prompt && res.data.form.base_prompt.trim()) {
                    triggerInitialPrompt(res.data.form.id, res.data.form.base_prompt.trim(), itemList);
                }
            }
        } catch (err: any) {
            setErrorMsg(err.message || "Failed to load form");
        } finally {
            setLoading(false);
        }
    };

    const triggerInitialPrompt = async (targetFormId: number, promptText: string, currentItems: AutoFormItem[]) => {
        const optimisticItem: AutoFormItem = {
            id: Date.now(),
            auto_form_id: targetFormId,
            role: "user",
            content: promptText,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        setItems([...currentItems, optimisticItem]);
        setIsSending(true);
        setErrorMsg(null);

        try {
            const res = await sendAutoFormChat(targetFormId, promptText);
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
            setErrorMsg(err.message || "Failed to communicate with Formy");
        } finally {
            setIsSending(false);
        }
    };

    useEffect(() => {
        fetchFormDetails();
    }, [formId]);

    // Auto-scroll chat to bottom
    useEffect(() => {
        if (activeTab === "chat") {
            chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [items, isSending, activeTab]);

    // Handle iframe postMessage bridge (aform_query, aform_insert, aform_update, aform_delete, aform_list, aform_schema <-> aform_result)
    useEffect(() => {
        const handleMessage = async (event: MessageEvent) => {
            const d = event.data;
            if (!d || typeof d !== "object" || !d.type || !d.type.startsWith("aform_")) return;

            const sendResponse = (payload: any) => {
                if (iframeRef.current && iframeRef.current.contentWindow) {
                    iframeRef.current.contentWindow.postMessage(payload, "*");
                }
            };

            const { id, type } = d;

            try {
                if (type === "aform_query") {
                    const res = await runAutoFormQuery(d.sqlQuery || d.sql, d.args);
                    if (res.error) {
                        sendResponse({ type: "aform_result", id, error: res.error });
                    } else {
                        sendResponse({ type: "aform_result", id, data: res.data?.rows, rows: res.data?.rows });
                    }
                } else if (type === "aform_insert") {
                    const res = await runAutoFormCrud({
                        action: "insert",
                        table: d.table,
                        data: d.data
                    });
                    if (res.error) {
                        sendResponse({ type: "aform_result", id, error: res.error });
                    } else {
                        sendResponse({
                            type: "aform_result",
                            id,
                            data: res.data?.row || res.data,
                            row: res.data?.row,
                            inserted_id: res.data?.id
                        });
                    }
                } else if (type === "aform_update") {
                    const res = await runAutoFormCrud({
                        action: "update",
                        table: d.table,
                        row_id: d.rowId || d.row_id,
                        data: d.data
                    });
                    if (res.error) {
                        sendResponse({ type: "aform_result", id, error: res.error });
                    } else {
                        sendResponse({
                            type: "aform_result",
                            id,
                            data: res.data?.row || res.data,
                            row: res.data?.row
                        });
                    }
                } else if (type === "aform_delete") {
                    const res = await runAutoFormCrud({
                        action: "delete",
                        table: d.table,
                        row_id: d.rowId || d.row_id
                    });
                    if (res.error) {
                        sendResponse({ type: "aform_result", id, error: res.error });
                    } else {
                        sendResponse({ type: "aform_result", id, data: { success: true } });
                    }
                } else if (type === "aform_list") {
                    const opts = d.options || {};
                    const res = await runAutoFormCrud({
                        action: "list",
                        table: d.table,
                        limit: opts.limit,
                        offset: opts.offset,
                        order_by: opts.orderBy || opts.order_by
                    });
                    if (res.error) {
                        sendResponse({ type: "aform_result", id, error: res.error });
                    } else {
                        sendResponse({ type: "aform_result", id, data: res.data?.rows, rows: res.data?.rows });
                    }
                } else if (type === "aform_get") {
                    const res = await runAutoFormCrud({
                        action: "get",
                        table: d.table,
                        row_id: d.rowId || d.row_id
                    });
                    if (res.error) {
                        sendResponse({ type: "aform_result", id, error: res.error });
                    } else {
                        sendResponse({ type: "aform_result", id, data: res.data?.row, row: res.data?.row });
                    }
                } else if (type === "aform_schema") {
                    const res = await getAutoFormSchema();
                    if (res.error) {
                        sendResponse({ type: "aform_result", id, error: res.error });
                    } else {
                        sendResponse({ type: "aform_result", id, data: res.data?.schema, schema: res.data?.schema });
                    }
                }
            } catch (err: any) {
                sendResponse({
                    type: "aform_result",
                    id,
                    error: err.message || "AutoForm execution error"
                });
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    // Send chat message to Formy
    const handleSendMessage = async (msgToSend?: string) => {
        const text = msgToSend || inputMessage;
        if (!text.trim() || !currentForm || isSending) return;

        const optimisticItem: AutoFormItem = {
            id: Date.now(),
            auto_form_id: currentForm.id,
            role: "user",
            content: text.trim(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        setItems(prev => [...normalizeArray<AutoFormItem>(prev), optimisticItem]);
        setInputMessage("");
        setIsSending(true);
        setErrorMsg(null);

        try {
            const res = await sendAutoFormChat(currentForm.id, text.trim());
            if (res.error) {
                setErrorMsg(res.error);
            } else if (res.data) {
                setItems(prev => [...normalizeArray<AutoFormItem>(prev), res.data!.item]);
                if (res.data.html_content) {
                    setSelectedVersionId(res.data.item.id);
                    setHtmlCode(res.data.html_content);
                    setPreviewKey(k => k + 1);
                }
            }
        } catch (err: any) {
            setErrorMsg(err.message || "Failed to communicate with Formy");
        } finally {
            setIsSending(false);
        }
    };

    // Save manual code edits
    const handleSaveCode = async () => {
        if (!currentForm || isSavingCode) return;
        setIsSavingCode(true);
        setSaveCodeSuccess(false);
        try {
            const res = await saveAutoFormCode(currentForm.id, htmlCode);
            if (res.data?.item) {
                setItems(prev => [...normalizeArray<AutoFormItem>(prev), res.data!.item]);
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

    const handleCopyCode = () => {
        navigator.clipboard.writeText(htmlCode);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    if (loading && !currentForm) {
        return (
            <div className={`flex flex-col items-center justify-center bg-surface-50 text-surface-400 ${isSidebar ? "h-full w-full" : "h-screen"}`}>
                <i className="fa-solid fa-circle-notch fa-spin text-2xl text-violet-500 mb-2" />
                <span className="text-xs">Loading form...</span>
            </div>
        );
    }

    return (
        <div className={`flex flex-col bg-surface-50 text-surface-800 ${isSidebar ? "h-full w-full overflow-hidden" : "h-screen"}`}>
            {/* Header */}
            <header className="flex items-center justify-between gap-3 bg-surface-800 text-white px-4 py-2 shrink-0 border-b border-surface-700 shadow-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded text-surface-300 hover:text-white hover:bg-surface-700 transition-colors"
                        title="Back to all forms"
                    >
                        <i className="fa-solid fa-arrow-left text-[11px]" />
                        <span className="hidden sm:inline">Forms</span>
                    </button>

                    <div className="h-4 w-px bg-surface-700" />

                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded bg-violet-600/30 text-violet-400 border border-violet-500/40 flex items-center justify-center shrink-0">
                            <i className="fa-solid fa-rectangle-list text-[11px]" />
                        </div>
                        <span className="font-semibold text-xs sm:text-sm tracking-tight truncate max-w-[140px] sm:max-w-xs">
                            {currentForm?.name || "AutoForm"}
                        </span>
                    </div>

                    {/* Forms dropdown switcher */}
                    {forms.length > 1 && (
                        <select
                            value={formId}
                            onChange={(e) => onSelectForm(Number(e.target.value))}
                            className="text-[11px] bg-surface-700 text-surface-200 border border-surface-600 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-violet-500"
                        >
                            {forms.map(f => (
                                <option key={f.id} value={f.id}>
                                    {f.name}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Tabs switcher in header */}
                <div className="flex items-center bg-surface-900/60 p-0.5 rounded-lg border border-surface-700">
                    <button
                        onClick={() => setActiveTab("chat")}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
                            activeTab === "chat"
                                ? "bg-violet-600 text-white shadow-sm"
                                : "text-surface-300 hover:text-white"
                        }`}
                    >
                        <i className="fa-solid fa-comments text-[10px]" />
                        <span>Chat</span>
                    </button>

                    <button
                        onClick={() => setActiveTab("code")}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
                            activeTab === "code"
                                ? "bg-violet-600 text-white shadow-sm"
                                : "text-surface-300 hover:text-white"
                        }`}
                    >
                        <i className="fa-solid fa-code text-[10px]" />
                        <span>Code</span>
                    </button>

                    <button
                        onClick={() => setActiveTab("preview")}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
                            activeTab === "preview"
                                ? "bg-violet-600 text-white shadow-sm"
                                : "text-surface-300 hover:text-white"
                        }`}
                    >
                        <i className="fa-solid fa-play text-[10px]" />
                        <span>Preview</span>
                    </button>
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-1.5 shrink-0">
                    <button
                        onClick={() => setPreviewKey(k => k + 1)}
                        className="p-1.5 text-surface-400 hover:text-white hover:bg-surface-700 rounded transition-colors"
                        title="Reload preview"
                    >
                        <i className="fa-solid fa-rotate-right text-xs" />
                    </button>

                    {isSidebar && (
                        <>
                            <button
                                onClick={onOpenSeparatePage}
                                className="p-1.5 text-surface-400 hover:text-white hover:bg-surface-700 rounded transition-colors"
                                title="Open in dedicated page"
                            >
                                <i className="fa-solid fa-arrow-up-right-from-square text-xs" />
                            </button>
                            {onClose && (
                                <button
                                    onClick={onClose}
                                    className="p-1.5 text-surface-400 hover:text-white hover:bg-surface-700 rounded transition-colors"
                                    title="Close panel"
                                >
                                    <i className="fa-solid fa-xmark text-sm" />
                                </button>
                            )}
                        </>
                    )}
                </div>
            </header>

            {/* Error banner */}
            {errorMsg && (
                <div className="bg-red-500/10 border-b border-red-500/20 text-red-600 px-4 py-2 text-xs flex items-center justify-between">
                    <span>{errorMsg}</span>
                    <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-700">
                        <i className="fa-solid fa-xmark" />
                    </button>
                </div>
            )}

            {/* Main Tab Area */}
            <div className="flex-1 relative overflow-hidden flex flex-col">
                {/* 1. PREVIEW TAB */}
                <div className={`h-full w-full flex flex-col ${activeTab === "preview" ? "flex" : "hidden"}`}>
                    {/* Viewport Toolbar */}
                    <div className="bg-white border-b border-surface-200 px-3 py-1.5 flex items-center justify-between text-xs text-surface-600 shrink-0">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-medium text-surface-500">Viewport:</span>
                            <div className="flex items-center bg-surface-100 p-0.5 rounded border border-surface-200">
                                <button
                                    onClick={() => setPreviewDevice("full")}
                                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                                        previewDevice === "full" ? "bg-white text-surface-800 shadow-xs" : "text-surface-500 hover:text-surface-800"
                                    }`}
                                >
                                    Full
                                </button>
                                <button
                                    onClick={() => setPreviewDevice("tablet")}
                                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                                        previewDevice === "tablet" ? "bg-white text-surface-800 shadow-xs" : "text-surface-500 hover:text-surface-800"
                                    }`}
                                >
                                    Tablet
                                </button>
                                <button
                                    onClick={() => setPreviewDevice("mobile")}
                                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                                        previewDevice === "mobile" ? "bg-white text-surface-800 shadow-xs" : "text-surface-500 hover:text-surface-800"
                                    }`}
                                >
                                    Mobile
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-surface-400">
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                postMessage Bridge Active
                            </span>
                            <button
                                onClick={() => setActiveTab("chat")}
                                className="text-violet-600 hover:text-violet-700 font-medium ml-2"
                            >
                                Iterate with Formy &rarr;
                            </button>
                        </div>
                    </div>

                    {/* Preview frame container */}
                    <div className="flex-1 bg-surface-100/70 p-2 sm:p-4 overflow-auto flex items-center justify-center">
                        <div
                            className={`h-full bg-white rounded-xl shadow-md border border-surface-200 overflow-hidden transition-all duration-200 ${
                                previewDevice === "mobile"
                                    ? "w-[375px] max-w-full"
                                    : previewDevice === "tablet"
                                    ? "w-[768px] max-w-full"
                                    : "w-full"
                            }`}
                        >
                            <iframe
                                ref={iframeRef}
                                key={previewKey}
                                srcDoc={htmlCode}
                                title="AutoForm Preview"
                                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                                className="w-full h-full border-none"
                            />
                        </div>
                    </div>
                </div>

                {/* 2. CHAT TAB */}
                <div className={`h-full w-full flex flex-col bg-surface-50 ${activeTab === "chat" ? "flex" : "hidden"}`}>
                    {/* Message history */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-surface-400 text-center">
                                <div className="w-12 h-12 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center mb-3">
                                    <i className="fa-solid fa-robot text-xl" />
                                </div>
                                <h4 className="font-semibold text-xs text-surface-700 mb-1">Meet Formy</h4>
                                <p className="text-[11px] max-w-xs text-surface-500">
                                    Ask Formy to add fields, validations, search bars, edit flows, or redesign your mini-app.
                                </p>
                            </div>
                        ) : (
                            items.map((item) => (
                                <div
                                    key={item.id}
                                    className={`flex gap-3 max-w-3xl ${
                                        item.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                                    }`}
                                >
                                    <div
                                        className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-xs ${
                                            item.role === "user"
                                                ? "bg-violet-600 text-white"
                                                : "bg-surface-800 text-violet-400 border border-surface-700"
                                        }`}
                                    >
                                        <i className={`fa-solid ${item.role === "user" ? "fa-user" : "fa-wand-magic-sparkles"}`} />
                                    </div>

                                    <div
                                        className={`rounded-2xl px-4 py-2.5 text-xs shadow-xs ${
                                            item.role === "user"
                                                ? "bg-violet-600 text-white rounded-tr-xs"
                                                : "bg-white text-surface-800 border border-surface-200 rounded-tl-xs"
                                        }`}
                                    >
                                        <p className="whitespace-pre-wrap leading-relaxed">{item.content}</p>

                                        {item.role === "assistant" && item.html_content && item.html_content.trim() !== "" && (
                                            <div className="mt-2.5 pt-2 border-t border-surface-100 flex items-center justify-between gap-3 text-[10px]">
                                                <span className="text-violet-600 font-semibold flex items-center gap-1">
                                                    <i className="fa-solid fa-code" />
                                                    Updated Form Code
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedVersionId(item.id);
                                                            setHtmlCode(item.html_content!);
                                                            setActiveTab("code");
                                                        }}
                                                        className="px-2 py-0.5 rounded bg-surface-100 hover:bg-surface-200 text-surface-700 font-medium transition-colors cursor-pointer flex items-center gap-1"
                                                    >
                                                        <i className="fa-solid fa-code text-[10px]" />
                                                        Code
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedVersionId(item.id);
                                                            setHtmlCode(item.html_content!);
                                                            setActiveTab("preview");
                                                            setPreviewKey(k => k + 1);
                                                        }}
                                                        className="px-2 py-0.5 rounded bg-violet-50 text-violet-700 hover:bg-violet-100 font-medium transition-colors cursor-pointer flex items-center gap-1"
                                                    >
                                                        <i className="fa-solid fa-play text-[9px]" />
                                                        Preview &rarr;
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}

                        {isSending && (
                            <div className="flex gap-3 max-w-md mr-auto">
                                <div className="w-7 h-7 rounded-lg bg-surface-800 text-violet-400 border border-surface-700 flex items-center justify-center text-xs">
                                    <i className="fa-solid fa-wand-magic-sparkles fa-spin" />
                                </div>
                                <div className="bg-white text-surface-600 border border-surface-200 rounded-2xl rounded-tl-xs px-4 py-2.5 text-xs flex items-center gap-2">
                                    <i className="fa-solid fa-circle-notch fa-spin text-violet-500" />
                                    <span>Formy is writing form code and updating queries...</span>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Quick suggestion pills */}
                    <div className="px-4 py-2 bg-white border-t border-surface-100 flex items-center gap-1.5 overflow-x-auto text-[11px] text-surface-600 shrink-0">
                        <span className="text-surface-400 text-[10px] shrink-0">Try asking:</span>
                        <button
                            onClick={() => handleSendMessage("Add client-side form validation with nice error highlights on empty required inputs.")}
                            className="px-2 py-0.5 rounded-full bg-surface-100 hover:bg-violet-50 hover:text-violet-700 border border-surface-200/80 transition-colors shrink-0"
                        >
                            + Add input validations
                        </button>
                        <button
                            onClick={() => handleSendMessage("Add an instant search and filter bar above the records list.")}
                            className="px-2 py-0.5 rounded-full bg-surface-100 hover:bg-violet-50 hover:text-violet-700 border border-surface-200/80 transition-colors shrink-0"
                        >
                            + Search filter for records
                        </button>
                        <button
                            onClick={() => handleSendMessage("Add inline editing on rows so clicking a row allows updating it in-place.")}
                            className="px-2 py-0.5 rounded-full bg-surface-100 hover:bg-violet-50 hover:text-violet-700 border border-surface-200/80 transition-colors shrink-0"
                        >
                            + Inline row editing
                        </button>
                    </div>

                    {/* Chat input form */}
                    <div className="p-3 bg-white border-t border-surface-200 shrink-0">
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="Tell Formy what changes or features to build..."
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                                disabled={isSending}
                                className="flex-1 px-3 py-2 text-xs rounded-xl border border-surface-300 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
                            />
                            <button
                                onClick={() => handleSendMessage()}
                                disabled={!inputMessage.trim() || isSending}
                                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
                            >
                                <span>Send</span>
                                <i className="fa-solid fa-paper-plane text-[10px]" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* 3. CODE TAB */}
                <div className={`h-full w-full flex flex-col bg-surface-900 text-surface-100 ${activeTab === "code" ? "flex" : "hidden"}`}>
                    {/* Code Editor Header */}
                    <div className="flex items-center justify-between px-4 py-2 bg-surface-800 border-b border-surface-700 text-xs shrink-0">
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-violet-400 font-semibold text-[11px]">index.html</span>
                            {selectedVersionId && (
                                <span className="text-[10px] text-surface-400 bg-surface-700/60 px-2 py-0.5 rounded">
                                    Version #{selectedVersionId}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleCopyCode}
                                className="px-2.5 py-1 rounded bg-surface-700 hover:bg-surface-600 text-surface-200 text-xs font-medium transition-colors flex items-center gap-1.5"
                            >
                                <i className={`fa-solid ${copySuccess ? "fa-check text-emerald-400" : "fa-copy"}`} />
                                <span>{copySuccess ? "Copied!" : "Copy"}</span>
                            </button>

                            <button
                                onClick={handleSaveCode}
                                disabled={isSavingCode}
                                className="px-3 py-1 rounded bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
                            >
                                {isSavingCode ? (
                                    <>
                                        <i className="fa-solid fa-circle-notch fa-spin text-[10px]" />
                                        <span>Saving...</span>
                                    </>
                                ) : saveCodeSuccess ? (
                                    <>
                                        <i className="fa-solid fa-check text-[10px]" />
                                        <span>Saved!</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-floppy-disk text-[10px]" />
                                        <span>Save & Preview</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Code Textarea */}
                    <div className="flex-1 p-2 bg-surface-950 font-mono text-xs overflow-hidden">
                        <textarea
                            value={htmlCode}
                            onChange={(e) => setHtmlCode(e.target.value)}
                            spellCheck={false}
                            className="w-full h-full p-3 bg-transparent text-emerald-400 font-mono text-xs resize-none focus:outline-none leading-relaxed selection:bg-violet-900 selection:text-white"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
