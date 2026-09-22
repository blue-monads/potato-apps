export interface TableColorConfig {
    id: string;
    name: string;
    hex: string;          // Main brand color
    headerBg: string;     // Header background
    navBg: string;        // Nav / tabs background
    activeTabBorder: string;
    activeTabText: string;
    badgeBg: string;
}

export const TABLE_COLOR_PRESETS: TableColorConfig[] = [
    {
        id: "blue",
        name: "Blue",
        hex: "#2563eb",
        headerBg: "#1e40af",
        navBg: "#172554",
        activeTabBorder: "#2563eb",
        activeTabText: "text-blue-600",
        badgeBg: "bg-blue-500",
    },
    {
        id: "emerald",
        name: "Emerald",
        hex: "#059669",
        headerBg: "#065f46",
        navBg: "#022c22",
        activeTabBorder: "#059669",
        activeTabText: "text-emerald-600",
        badgeBg: "bg-emerald-500",
    },
    {
        id: "violet",
        name: "Violet",
        hex: "#7c3aed",
        headerBg: "#5b21b6",
        navBg: "#2e1065",
        activeTabBorder: "#7c3aed",
        activeTabText: "text-violet-600",
        badgeBg: "bg-violet-500",
    },
    {
        id: "rose",
        name: "Rose",
        hex: "#e11d48",
        headerBg: "#9f1239",
        navBg: "#4c0519",
        activeTabBorder: "#e11d48",
        activeTabText: "text-rose-600",
        badgeBg: "bg-rose-500",
    },
    {
        id: "amber",
        name: "Amber",
        hex: "#d97706",
        headerBg: "#92400e",
        navBg: "#451a03",
        activeTabBorder: "#d97706",
        activeTabText: "text-amber-600",
        badgeBg: "bg-amber-500",
    },
    {
        id: "cyan",
        name: "Cyan",
        hex: "#0891b2",
        headerBg: "#155e75",
        navBg: "#083344",
        activeTabBorder: "#0891b2",
        activeTabText: "text-cyan-600",
        badgeBg: "bg-cyan-500",
    },
    {
        id: "indigo",
        name: "Indigo",
        hex: "#4f46e5",
        headerBg: "#3730a3",
        navBg: "#1e1b4b",
        activeTabBorder: "#4f46e5",
        activeTabText: "text-indigo-600",
        badgeBg: "bg-indigo-500",
    },
    {
        id: "slate",
        name: "Slate (Grey-Blue)",
        hex: "#475569",
        headerBg: "#1e293b",
        navBg: "#0f172a",
        activeTabBorder: "#3b82f6",
        activeTabText: "text-accent-600",
        badgeBg: "bg-surface-500",
    },
];

export const DEFAULT_TABLE_COLOR = TABLE_COLOR_PRESETS[0]; // Blue

export function getTableColorConfig(colorId?: string): TableColorConfig {
    if (!colorId) return TABLE_COLOR_PRESETS.find(c => c.id === "slate") || DEFAULT_TABLE_COLOR;
    const found = TABLE_COLOR_PRESETS.find(c => c.id.toLowerCase() === colorId.toLowerCase());
    return found || TABLE_COLOR_PRESETS.find(c => c.id === "slate") || DEFAULT_TABLE_COLOR;
}
