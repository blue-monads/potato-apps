import { useState, useEffect, useMemo, useRef } from "react";

const ICONS_PER_PAGE = 96;

let cachedIcons: string[] | null = null;
let fetchPromise: Promise<string[]> | null = null;

async function getIconList(): Promise<string[]> {
    if (cachedIcons) return cachedIcons;
    if (fetchPromise) return fetchPromise;

    fetchPromise = fetch("/zz/static/fontawesome/icon_map.json")
        .then((r) => {
            if (!r.ok) throw new Error("Failed to load icon map");
            return r.json();
        })
        .then((data: string[]) => {
            cachedIcons = data;
            return data;
        })
        .catch((err) => {
            console.error("Failed to load fontawesome icon map:", err);
            return [];
        });

    return fetchPromise;
}

export const POPULAR_ICONS = [
    "table",
    "tasks",
    "address-book",
    "boxes-stacked",
    "calendar",
    "receipt",
    "sticky-note",
    "users",
    "folder",
    "database",
    "chart-simple",
    "tag",
    "font",
    "hashtag",
    "envelope",
    "phone",
    "link",
    "image",
    "file",
    "check",
    "star",
    "bell",
    "gear",
    "magnifying-glass",
];

interface IconPickerModalProps {
    currentIcon?: string;
    defaultIcon?: string;
    onSelect: (icon: string) => void;
    onClose: () => void;
    title?: string;
}

export const IconPickerModal = ({
    currentIcon = "",
    defaultIcon = "table",
    onSelect,
    onClose,
    title = "Select Icon",
}: IconPickerModalProps) => {
    const [icons, setIcons] = useState<string[]>(cachedIcons || []);
    const [loading, setLoading] = useState<boolean>(!cachedIcons);
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<string>(currentIcon || "");
    const [page, setPage] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!cachedIcons) {
            getIconList().then((list) => {
                setIcons(list);
                setLoading(false);
            });
        }
    }, []);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return icons;
        return icons.filter((name) => name.toLowerCase().includes(query));
    }, [icons, search]);

    const totalPages = Math.ceil(filtered.length / ICONS_PER_PAGE);
    const pageIcons = useMemo(() => {
        return filtered.slice(page * ICONS_PER_PAGE, (page + 1) * ICONS_PER_PAGE);
    }, [filtered, page]);

    useEffect(() => {
        setPage(0);
    }, [search]);

    const handleConfirm = () => {
        onSelect(selected);
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-2xl border border-surface-200 w-full max-w-2xl overflow-hidden p-5 animate-scale-in flex flex-col max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-surface-200 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-accent-50 text-accent-600 flex items-center justify-center text-sm font-bold">
                            <i className={`fa-solid fa-${selected || defaultIcon}`} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-surface-900">{title}</h3>
                            <p className="text-[11px] text-surface-500">
                                Choose from FontAwesome icon library ({icons.length} available)
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-surface-400 hover:text-surface-600 transition-colors p-1 cursor-pointer"
                    >
                        <i className="fa-solid fa-xmark text-base" />
                    </button>
                </div>

                {/* Search & Suggestions */}
                <div className="space-y-2.5 pb-2 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs pointer-events-none" />
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Search icons (e.g. user, chart, tag, check)..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-8 pr-8 py-1.5 text-xs bg-white border border-surface-300 rounded outline-none focus:border-accent-600 focus:ring-1 focus:ring-accent-600 transition-all"
                                autoFocus
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch("")}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 cursor-pointer"
                                >
                                    <i className="fa-solid fa-xmark text-xs" />
                                </button>
                            )}
                        </div>

                        {selected && (
                            <button
                                type="button"
                                onClick={() => setSelected("")}
                                className="px-2.5 py-1.5 text-xs font-semibold text-coral-600 hover:bg-coral-50 border border-coral-200 rounded transition-colors cursor-pointer shrink-0"
                                title="Clear custom icon"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {/* Popular Quick Suggestions */}
                    {!search && (
                        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] scrollbar-thin">
                            <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mr-1 shrink-0">
                                Suggested:
                            </span>
                            {POPULAR_ICONS.slice(0, 16).map((name) => (
                                <button
                                    key={name}
                                    type="button"
                                    onClick={() => setSelected(name)}
                                    className={`w-6 h-6 rounded flex items-center justify-center text-xs shrink-0 transition-all cursor-pointer ${
                                        selected === name
                                            ? "bg-accent-600 text-white shadow-2xs"
                                            : "bg-surface-100 hover:bg-surface-200 text-surface-600"
                                    }`}
                                    title={name}
                                >
                                    <i className={`fa-solid fa-${name}`} />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Icons Grid */}
                <div className="border border-surface-200 rounded-lg p-2.5 flex-1 overflow-y-auto bg-surface-50/50 min-h-[220px]">
                    {loading ? (
                        <div className="py-16 text-center text-surface-400 text-xs">
                            <i className="fa-solid fa-spinner animate-spin mr-2 text-accent-600" />
                            Loading icons...
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-16 text-center text-surface-400 text-xs">
                            <i className="fa-solid fa-face-meh text-3xl mb-2 text-surface-300 block" />
                            No icons matching &ldquo;{search}&rdquo;
                        </div>
                    ) : (
                        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-1.5">
                            {pageIcons.map((name) => {
                                const isSelected = selected === name;
                                return (
                                    <button
                                        key={name}
                                        type="button"
                                        onClick={() => setSelected(name)}
                                        title={name}
                                        className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all cursor-pointer group ${
                                            isSelected
                                                ? "border-accent-600 bg-accent-50 text-accent-700 ring-2 ring-accent-400/50 shadow-xs"
                                                : "border-surface-200 bg-white hover:border-surface-300 hover:bg-surface-100/60 text-surface-600"
                                        }`}
                                    >
                                        <i className={`fa-solid fa-${name} text-base transition-transform group-hover:scale-110`} />
                                        <span className="text-[9px] text-surface-400 group-hover:text-surface-600 truncate w-full text-center mt-1 leading-none font-mono">
                                            {name}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer Controls & Pagination */}
                <div className="flex items-center justify-between pt-3 border-t border-surface-200 mt-3 text-xs shrink-0">
                    <div className="flex items-center gap-2">
                        {selected ? (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-accent-50 border border-accent-200 rounded text-accent-800 text-xs font-semibold">
                                <i className={`fa-solid fa-${selected} text-sm`} />
                                <span>Selected: <code className="font-mono text-[11px]">{selected}</code></span>
                            </div>
                        ) : (
                            <span className="text-surface-400 text-[11px]">
                                Default icon: <code className="font-mono text-surface-600">{defaultIcon}</code>
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {totalPages > 1 && (
                            <div className="flex items-center gap-1 mr-2">
                                <button
                                    type="button"
                                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                                    disabled={page === 0}
                                    className="w-6 h-6 flex items-center justify-center rounded border border-surface-200 bg-white hover:bg-surface-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    <i className="fa-solid fa-chevron-left text-[9px]" />
                                </button>
                                <span className="text-[11px] text-surface-500 font-medium px-1">
                                    {page + 1} / {totalPages}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                    disabled={page >= totalPages - 1}
                                    className="w-6 h-6 flex items-center justify-center rounded border border-surface-200 bg-white hover:bg-surface-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    <i className="fa-solid fa-chevron-right text-[9px]" />
                                </button>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-1.5 rounded bg-surface-100 hover:bg-surface-200 text-surface-700 font-semibold transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            className="px-4 py-1.5 rounded bg-accent-600 hover:bg-accent-700 text-white font-bold transition-colors cursor-pointer shadow-xs"
                        >
                            Select
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IconPickerModal;
