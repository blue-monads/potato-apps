import { useState, useMemo } from "react";
import {
    TABLE_GROUP_TEMPLATES,
    type TableGroupTemplate,
    type TableInGroupTemplate,
} from "../../../lib/templates";
import { getTypeIcon } from "./columnTypes";

interface GroupTemplatesViewProps {
    onSelectSingleTable: (table: TableInGroupTemplate) => void;
    onAddGroup: (group: TableGroupTemplate) => Promise<void>;
    onStartBlank?: () => void;
    isCreatingGroup?: boolean;
    creationProgress?: string;
    isModal?: boolean;
}

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; badge: string; btn: string; ring: string }> = {
    blue: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200", badge: "bg-blue-100 text-blue-700", btn: "bg-blue-600 hover:bg-blue-700", ring: "ring-blue-500/20" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200", badge: "bg-emerald-100 text-emerald-700", btn: "bg-emerald-600 hover:bg-emerald-700", ring: "ring-emerald-500/20" },
    indigo: { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-200", badge: "bg-indigo-100 text-indigo-700", btn: "bg-indigo-600 hover:bg-indigo-700", ring: "ring-indigo-500/20" },
    violet: { bg: "bg-violet-50", text: "text-violet-600", border: "border-violet-200", badge: "bg-violet-100 text-violet-700", btn: "bg-violet-600 hover:bg-violet-700", ring: "ring-violet-500/20" },
    teal: { bg: "bg-teal-50", text: "text-teal-600", border: "border-teal-200", badge: "bg-teal-100 text-teal-700", btn: "bg-teal-600 hover:bg-teal-700", ring: "ring-teal-500/20" },
    rose: { bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-200", badge: "bg-rose-100 text-rose-700", btn: "bg-rose-600 hover:bg-rose-700", ring: "ring-rose-500/20" },
    amber: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200", badge: "bg-amber-100 text-amber-700", btn: "bg-amber-600 hover:bg-amber-700", ring: "ring-amber-500/20" },
    orange: { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-200", badge: "bg-orange-100 text-orange-700", btn: "bg-orange-600 hover:bg-orange-700", ring: "ring-orange-500/20" },
    cyan: { bg: "bg-cyan-50", text: "text-cyan-600", border: "border-cyan-200", badge: "bg-cyan-100 text-cyan-700", btn: "bg-cyan-600 hover:bg-cyan-700", ring: "ring-cyan-500/20" },
    red: { bg: "bg-red-50", text: "text-red-600", border: "border-red-200", badge: "bg-red-100 text-red-700", btn: "bg-red-600 hover:bg-red-700", ring: "ring-red-500/20" },
    slate: { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", badge: "bg-slate-100 text-slate-700", btn: "bg-slate-600 hover:bg-slate-700", ring: "ring-slate-500/20" },
};

export default function GroupTemplatesView({
    onSelectSingleTable,
    onAddGroup,
    onStartBlank,
    isCreatingGroup = false,
    creationProgress = "",
    isModal = false,
}: GroupTemplatesViewProps) {
    const [selectedCategory, setSelectedCategory] = useState<string>("All");
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
    const [singlePickerGroupId, setSinglePickerGroupId] = useState<string | null>(null);

    // Extract unique categories
    const categories = useMemo(() => {
        const set = new Set<string>();
        TABLE_GROUP_TEMPLATES.forEach(g => set.add(g.category));
        return ["All", ...Array.from(set)];
    }, []);

    // Filter templates based on category and search query
    const filteredGroups = useMemo(() => {
        return TABLE_GROUP_TEMPLATES.filter(g => {
            const matchesCategory = selectedCategory === "All" || g.category === selectedCategory;
            const q = searchQuery.toLowerCase().trim();
            if (!q) return matchesCategory;

            const matchesText =
                g.name.toLowerCase().includes(q) ||
                g.description.toLowerCase().includes(q) ||
                g.category.toLowerCase().includes(q) ||
                g.tables.some(t => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));

            return matchesCategory && matchesText;
        });
    }, [selectedCategory, searchQuery]);

    return (
        <div className={`flex flex-col ${isModal ? "space-y-4" : "flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full"}`}>
            {/* Header / Intro banner */}
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isModal ? "border-b border-surface-200 pb-3" : "mb-6"}`}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent-50 text-accent-600 flex items-center justify-center shrink-0 shadow-2xs border border-accent-100">
                        <i className="fa-solid fa-layer-group text-lg" />
                    </div>
                    <div>
                        <h2 className={`${isModal ? "text-sm sm:text-base font-bold text-surface-900" : "text-xl font-bold text-surface-900"}`}>
                            Table Group Templates
                        </h2>
                        <p className="text-xs text-surface-500 mt-0.5">
                            Deploy full groups of interconnected tables, or pick any individual table.
                        </p>
                    </div>
                </div>

                {onStartBlank && (
                    <button
                        onClick={onStartBlank}
                        disabled={isCreatingGroup}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-100 hover:bg-surface-200 text-surface-700 transition-colors cursor-pointer self-start sm:self-auto shrink-0 disabled:opacity-50"
                        title="Create an empty custom table"
                    >
                        <i className="fa-solid fa-plus text-[10px]" />
                        <span>Start from Blank</span>
                    </button>
                )}
            </div>

            {/* Filter Bar: Categories + Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-1">
                {/* Category Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin pb-1 sm:pb-0 max-w-full">
                    {categories.map(cat => {
                        const isSelected = selectedCategory === cat;
                        return (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all whitespace-nowrap cursor-pointer ${
                                    isSelected
                                        ? "bg-surface-800 text-white shadow-2xs"
                                        : "bg-white text-surface-600 border border-surface-200 hover:bg-surface-100"
                                }`}
                            >
                                {cat}
                            </button>
                        );
                    })}
                </div>

                {/* Search Box */}
                <div className="relative min-w-[200px] sm:w-64 shrink-0">
                    <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-2.5 text-surface-400 text-xs" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search groups & tables..."
                        className="w-full pl-8 pr-7 py-1.5 text-xs bg-white rounded-lg border border-surface-200 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-2 top-2 text-surface-400 hover:text-surface-600 text-xs"
                        >
                            <i className="fa-solid fa-xmark" />
                        </button>
                    )}
                </div>
            </div>

            {/* In-Flight Creation Progress Banner */}
            {isCreatingGroup && (
                <div className="bg-accent-50 border border-accent-200 text-accent-800 rounded-xl p-3 flex items-center justify-between gap-3 text-xs animate-pulse">
                    <div className="flex items-center gap-2.5">
                        <i className="fa-solid fa-spinner fa-spin text-accent-600 text-sm" />
                        <span className="font-semibold">{creationProgress || "Creating tables and wiring relationships..."}</span>
                    </div>
                    <span className="text-[11px] text-accent-600 font-medium">Please wait...</span>
                </div>
            )}

            {/* Templates Grid */}
            <div className={`grid grid-cols-1 ${isModal ? "md:grid-cols-2 max-h-[58vh] overflow-y-auto pr-1" : "md:grid-cols-2 lg:grid-cols-3"} gap-4`}>
                {filteredGroups.map(group => {
                    const colors = COLOR_MAP[group.color] || COLOR_MAP.blue;
                    const isExpanded = expandedGroup === group.id;
                    const isPickingSingle = singlePickerGroupId === group.id;

                    return (
                        <div
                            key={group.id}
                            className={`bg-white border rounded-xl p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between group ${
                                isCreatingGroup ? "opacity-60 pointer-events-none" : ""
                            } ${isPickingSingle ? "ring-2 " + colors.ring : "border-surface-200 hover:border-surface-300"}`}
                        >
                            {/* Card Top */}
                            <div>
                                <div className="flex items-start justify-between gap-2.5 mb-2">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={`w-9 h-9 rounded-lg ${colors.bg} ${colors.text} flex items-center justify-center shrink-0 border ${colors.border}`}>
                                            <i className={`fa-solid fa-${group.icon} text-base`} />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-sm text-surface-900 truncate" title={group.name}>
                                                {group.name}
                                            </h3>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${colors.badge}`}>
                                                    {group.category}
                                                </span>
                                                <span className="text-[11px] text-surface-400">
                                                    • {group.tables.length} tables
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <p className="text-xs text-surface-500 line-clamp-2 mb-3 leading-relaxed">
                                    {group.description}
                                </p>

                                {/* Contained Tables List with Badges */}
                                <div className="space-y-1.5 mb-3.5">
                                    <div className="flex items-center justify-between text-[11px] text-surface-400 font-medium">
                                        <span>Included Tables:</span>
                                        <button
                                            type="button"
                                            onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                                            className="text-accent-600 hover:text-accent-800 text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                                        >
                                            <span>{isExpanded ? "Hide Fields" : "Preview Fields"}</span>
                                            <i className={`fa-solid fa-chevron-${isExpanded ? "up" : "down"} text-[9px]`} />
                                        </button>
                                    </div>

                                    <div className="flex flex-wrap gap-1.5">
                                        {group.tables.map(tbl => (
                                            <div
                                                key={tbl.id}
                                                onClick={() => onSelectSingleTable(tbl)}
                                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-50 hover:bg-accent-50 hover:text-accent-700 text-surface-700 border border-surface-200 hover:border-accent-200 text-[11px] font-medium transition-all cursor-pointer group/tbl"
                                                title={`Click to create only the "${tbl.name}" table`}
                                            >
                                                <i className={`fa-solid fa-${tbl.icon} text-[10px] text-surface-400 group-hover/tbl:text-accent-600`} />
                                                <span>{tbl.name}</span>
                                                <span className="text-[9px] text-surface-400 group-hover/tbl:text-accent-500">
                                                    ({tbl.columns.length})
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Expanded Schema Preview */}
                                    {isExpanded && (
                                        <div className="mt-2.5 p-2.5 rounded-lg bg-surface-50 border border-surface-200 space-y-2 animate-fade-in">
                                            {group.tables.map(tbl => (
                                                <div key={tbl.id} className="text-[11px]">
                                                    <div className="font-semibold text-surface-800 flex items-center justify-between">
                                                        <span className="flex items-center gap-1.5">
                                                            <i className={`fa-solid fa-${tbl.icon} text-[10px] text-accent-600`} />
                                                            {tbl.name}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => onSelectSingleTable(tbl)}
                                                            className="text-[10px] text-accent-600 hover:underline font-semibold"
                                                        >
                                                            Use this table →
                                                        </button>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {tbl.columns.map((c, i) => (
                                                            <span
                                                                key={i}
                                                                className="px-1.5 py-0.5 rounded text-[10px] bg-white border border-surface-200 text-surface-600 flex items-center gap-1"
                                                            >
                                                                <i className={`fa-solid fa-${getTypeIcon(c.column_type)} text-[8px] text-surface-400`} />
                                                                {c.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Card Footer Actions */}
                            <div className="pt-3 border-t border-surface-100 flex flex-col gap-2">
                                {/* If single picker mode active for this card */}
                                {isPickingSingle ? (
                                    <div className="p-2 bg-surface-50 border border-surface-200 rounded-lg space-y-1.5 animate-fade-in">
                                        <div className="flex items-center justify-between text-[11px] font-semibold text-surface-700">
                                            <span>Select one table to create:</span>
                                            <button
                                                onClick={() => setSinglePickerGroupId(null)}
                                                className="text-surface-400 hover:text-surface-700 text-xs"
                                            >
                                                <i className="fa-solid fa-xmark" />
                                            </button>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            {group.tables.map(tbl => (
                                                <button
                                                    key={tbl.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSinglePickerGroupId(null);
                                                        onSelectSingleTable(tbl);
                                                    }}
                                                    className="w-full text-left px-2 py-1.5 rounded bg-white hover:bg-accent-50 hover:text-accent-700 text-surface-800 border border-surface-200 hover:border-accent-300 text-xs font-medium flex items-center justify-between transition-colors cursor-pointer"
                                                >
                                                    <span className="flex items-center gap-1.5 truncate">
                                                        <i className={`fa-solid fa-${tbl.icon} text-xs text-accent-600`} />
                                                        {tbl.name}
                                                    </span>
                                                    <span className="text-[10px] text-surface-400">
                                                        {tbl.columns.length} columns →
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => onAddGroup(group)}
                                            disabled={isCreatingGroup}
                                            className={`flex-1 py-1.5 px-3 rounded-lg text-white font-semibold text-xs shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${colors.btn} disabled:opacity-50`}
                                        >
                                            <i className="fa-solid fa-layer-group text-[11px]" />
                                            <span>Add Group ({group.tables.length})</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setSinglePickerGroupId(group.id)}
                                            disabled={isCreatingGroup}
                                            className="px-2.5 py-1.5 rounded-lg bg-surface-100 hover:bg-surface-200 text-surface-700 font-semibold text-xs transition-colors flex items-center gap-1 cursor-pointer shrink-0 disabled:opacity-50"
                                            title="Pick a single table from this group"
                                        >
                                            <span>Pick Table</span>
                                            <i className="fa-solid fa-chevron-down text-[9px]" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {filteredGroups.length === 0 && (
                <div className="text-center py-12 text-surface-400 bg-white border border-surface-200 rounded-xl p-8">
                    <i className="fa-solid fa-magnifying-glass text-2xl mb-2 text-surface-300" />
                    <p className="text-xs font-medium">No templates match your search or category filter.</p>
                    <button
                        onClick={() => {
                            setSelectedCategory("All");
                            setSearchQuery("");
                        }}
                        className="mt-2 text-xs font-semibold text-accent-600 hover:underline cursor-pointer"
                    >
                        Reset filters
                    </button>
                </div>
            )}
        </div>
    );
}
