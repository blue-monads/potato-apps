import { useState } from "react";
import { type DatatableColumn, type DatatableRow } from "../../../lib/api";
import {
    parseRefOptions,
    parseRefIds,
    parseReverseRefOptions,
    getRowIdentityText,
    useRefResolution,
    useReverseRefResolution,
} from "../../../lib/refCache";
import { parseFileValue, formatFileSize, getFileIconClass, getFileDownloadUrl } from "../../../lib/spaceFile";
import BarcodeModal from "./BarcodeModal";

const PILL_COLORS = [
    { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
    { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
    { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
    { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
];

const getColorForString = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return PILL_COLORS[Math.abs(hash) % PILL_COLORS.length];
};

export const TYPE_ICONS: Record<string, string> = {
    text: 'font',
    textarea: 'align-left',
    number: 'hashtag',
    email: 'envelope',
    percent: 'percent',
    rating: 'star',
    date: 'calendar',
    datetime: 'calendar-days',
    time: 'clock',
    duration: 'stopwatch',
    checkbox: 'square-check',
    image: 'image',
    file: 'paperclip',
    link: 'link',
    dropdown: 'caret-down',
    radio: 'circle-dot',
    multiselect: 'tags',
    barcode: 'barcode',
    ref: 'arrow-up-right-from-square',
    multiref: 'layer-group',
    reverse_ref: 'reply',
};

export const getTypeIcon = (type: string) => TYPE_ICONS[type] || 'font';

export interface TextPatternConfig {
    pattern?: string;
    description?: string;
}

export const parseTextPatternConfig = (options?: string): TextPatternConfig => {
    if (!options) return {};
    try {
        if (options.startsWith('{')) {
            const parsed = JSON.parse(options);
            if (parsed && typeof parsed === 'object') {
                return {
                    pattern: parsed.pattern || '',
                    description: parsed.description || parsed.pattern_error || '',
                };
            }
        }
    } catch {}
    return { pattern: options, description: '' };
};

export const formatDuration = (totalSeconds: number | string | null | undefined): string => {
    if (totalSeconds === null || totalSeconds === undefined || totalSeconds === "") return "";
    const sec = Math.round(Number(totalSeconds));
    if (isNaN(sec)) return String(totalSeconds);
    if (sec === 0) return "0s";

    const isNegative = sec < 0;
    let s = Math.abs(sec);

    const days = Math.floor(s / 86400);
    s %= 86400;
    const hours = Math.floor(s / 3600);
    s %= 3600;
    const minutes = Math.floor(s / 60);
    const seconds = s % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

    return (isNegative ? "-" : "") + parts.join(" ");
};

export const formatDateTime = (value: string): string => {
    if (!value) return "";
    try {
        const d = new Date(value);
        if (isNaN(d.getTime())) return value;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const hours = String(d.getHours()).padStart(2, "0");
        const mins = String(d.getMinutes()).padStart(2, "0");
        return `${y}-${m}-${day} ${hours}:${mins}`;
    } catch {
        return value;
    }
};

export const isTagType = (type: string) =>
    type === 'dropdown' || type === 'multiselect' || type === 'radio';

export const isBoolType = (type: string) => type === 'checkbox';

export const isTruthy = (value: string) =>
    value.toLowerCase() === 'true' || value === '1';

export const getCellValue = (
    row: DatatableRow,
    column: DatatableColumn
): string => {
    if (!row || !column || !column.slug) return "";
    const val = row[column.slug];
    return val !== undefined && val !== null ? String(val) : "";
};

const SingleRefBadge = ({
    tableId,
    rowId,
    identityColSlug,
}: {
    tableId: number;
    rowId: number;
    identityColSlug?: string;
}) => {
    const resolvedRow = useRefResolution(tableId, rowId);
    const identityText = getRowIdentityText(resolvedRow, identityColSlug);

    return (
        <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors shrink-0"
            title={`Referenced record #${rowId} in table ${tableId}`}
        >
            <i className="fa-solid fa-arrow-up-right-from-square text-[9px] text-slate-400" />
            <span className="font-medium truncate max-w-[130px]">{identityText || `#${rowId}`}</span>
            {identityText && <span className="text-[10px] text-slate-400 font-mono">#{rowId}</span>}
        </span>
    );
};

const RefCellValue = ({ value, column }: { value: string; column: DatatableColumn }) => {
    const opts = parseRefOptions(column.options);
    const targetTableId = opts?.target_table_id;
    const ids = parseRefIds(value);

    if (ids.length === 0) return <span className="text-surface-300">—</span>;

    if (!targetTableId) {
        return (
            <span className="font-mono text-[11px] text-surface-500">
                {ids.map(id => `#${id}`).join(', ')}
            </span>
        );
    }

    return (
        <div className="flex items-center gap-1 overflow-hidden flex-wrap py-0.5">
            {ids.map(id => (
                <SingleRefBadge
                    key={id}
                    tableId={targetTableId}
                    rowId={id}
                    identityColSlug={opts.identity_column}
                />
            ))}
        </div>
    );
};

const ReverseRefCellValue = ({ row, column }: { row?: DatatableRow; column: DatatableColumn }) => {
    const opts = parseReverseRefOptions(column.options);
    const targetTableId = opts?.target_table_id;
    const targetColSlug = opts?.target_column_slug;

    if (!row || !targetTableId || !targetColSlug) {
        return <span className="text-surface-300">—</span>;
    }

    const { loading, refIds } = useReverseRefResolution(
        column.table_id,
        column.slug,
        row.id,
        targetTableId,
        targetColSlug
    );

    if (loading) {
        return (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium text-surface-400 bg-surface-50 border border-surface-200 animate-pulse">
                <i className="fa-solid fa-spinner fa-spin text-[10px] text-accent-500" />
                <span>Loading...</span>
            </span>
        );
    }

    const ids = Array.isArray(refIds) ? refIds : [];
    if (ids.length === 0) {
        return <span className="text-surface-300">—</span>;
    }

    return (
        <div className="flex items-center gap-1 overflow-hidden flex-wrap py-0.5">
            {ids.map(id => (
                <SingleRefBadge
                    key={id}
                    tableId={targetTableId}
                    rowId={id}
                    identityColSlug={opts?.identity_column}
                />
            ))}
        </div>
    );
};

const ImageCellValue = ({ value }: { value: string }) => {
    const file = parseFileValue(value);
    if (!file || !file.url) return <span className="text-surface-300">—</span>;

    return (
        <div className="flex items-center gap-2 group/img max-w-full">
            <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="relative shrink-0 w-7 h-7 rounded border border-surface-200 overflow-hidden bg-surface-50 flex items-center justify-center hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                title={`View ${file.name}`}
            >
                <img
                    src={file.url}
                    alt={file.name || 'image'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                            parent.innerHTML = '<i class="fa-solid fa-image text-surface-400 text-xs"></i>';
                        }
                    }}
                />
            </a>
            <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title={file.name}
                className="truncate text-xs text-surface-700 hover:text-accent-600 hover:underline"
            >
                {file.name}
            </a>
        </div>
    );
};

const FileCellValue = ({ value }: { value: string }) => {
    const file = parseFileValue(value);
    if (!file) return <span className="text-surface-300">—</span>;

    const iconClass = getFileIconClass(file.mime || file.name);
    const sizeStr = formatFileSize(file.size);
    const targetUrl = file.download_url || file.url || getFileDownloadUrl(file.id);

    return (
        <a
            href={targetUrl}
            target="_blank"
            download={file.name}
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title={`Download ${file.name}${sizeStr ? ` (${sizeStr})` : ''}`}
            className="inline-flex items-center gap-1.5 max-w-full px-2 py-0.5 rounded text-xs text-surface-700 hover:bg-surface-100 hover:text-accent-700 transition-colors group/file truncate"
        >
            <i className={`${iconClass} text-[11px] shrink-0`} />
            <span className="truncate font-medium">{file.name}</span>
            {sizeStr && (
                <span className="text-[10px] text-surface-400 font-mono shrink-0">
                    {sizeStr}
                </span>
            )}
            <i className="fa-solid fa-arrow-down text-[9px] text-surface-400 opacity-0 group-hover/file:opacity-100 transition-opacity shrink-0 ml-0.5" />
        </a>
    );
};

const BarcodeCellValue = ({ value, columnName }: { value: string; columnName?: string }) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    if (!value) return <span className="text-surface-300">—</span>;

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <>
            <div className="inline-flex items-center gap-1.5 max-w-full group/barcode">
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-100 hover:bg-surface-200 border border-surface-200 text-surface-800 font-mono text-[11px] tracking-wider transition-colors cursor-pointer truncate"
                    title={`Click to view barcode: ${value}`}
                >
                    <i className="fa-solid fa-barcode text-surface-500 text-[10px] shrink-0" />
                    <span className="truncate font-medium">{value}</span>
                </button>

                <button
                    type="button"
                    onClick={handleCopy}
                    className="w-5 h-5 rounded hover:bg-surface-200 text-surface-400 hover:text-surface-700 flex items-center justify-center opacity-0 group-hover/barcode:opacity-100 transition-opacity cursor-pointer shrink-0"
                    title="Copy barcode text"
                >
                    <i className={`fa-solid ${copied ? 'fa-check text-emerald-600' : 'fa-copy'} text-[10px]`} />
                </button>
            </div>

            {modalOpen && (
                <BarcodeModal
                    value={value}
                    columnName={columnName}
                    onClose={() => setModalOpen(false)}
                />
            )}
        </>
    );
};

export const CellValue = ({ value, column, row }: { value: string; column: DatatableColumn; row?: DatatableRow }) => {
    const type = column.column_type;

    if (type === 'reverse_ref') {
        return <ReverseRefCellValue row={row} column={column} />;
    }

    if (!value) return <span className="text-surface-300">—</span>;

    if (type === 'barcode') {
        return <BarcodeCellValue value={value} columnName={column.name} />;
    }

    if (type === 'ref' || type === 'multiref') {
        return <RefCellValue value={value} column={column} />;
    }

    if (isTagType(type)) {
        const values = type === 'multiselect'
            ? value.split(',').map(v => v.trim()).filter(Boolean)
            : [value];
        return (
            <div className="flex items-center gap-1 overflow-hidden">
                {values.map((v, i) => {
                    const c = getColorForString(v);
                    return (
                        <span
                            key={i}
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${c.bg} ${c.text} ${c.border}`}
                        >
                            {v}
                        </span>
                    );
                })}
            </div>
        );
    }

    if (isBoolType(type)) {
        const on = isTruthy(value);
        return (
            <i className={`fa-solid fa-${on ? 'square-check text-accent-600' : 'square text-surface-300'} text-sm`} />
        );
    }

    if (type === 'number') {
        return <span className="font-mono tabular-nums text-surface-800">{value}</span>;
    }

    if (type === 'duration') {
        const formatted = formatDuration(value);
        const rawNum = Number(value);
        return (
            <span
                className="font-mono tabular-nums text-surface-700 text-xs inline-flex items-center gap-1.5"
                title={!isNaN(rawNum) ? `${rawNum.toLocaleString()} seconds` : value}
            >
                <i className="fa-solid fa-stopwatch text-[10px] text-surface-400 shrink-0" />
                <span>{formatted || value}</span>
            </span>
        );
    }

    if (type === 'date') {
        return <span className="font-mono tabular-nums text-surface-600 text-[12px]">{value}</span>;
    }

    if (type === 'datetime' || type === 'date_time' || type === 'date-time') {
        const formatted = formatDateTime(value);
        return (
            <span
                className="font-mono tabular-nums text-surface-600 text-[12px] inline-flex items-center gap-1.5"
                title={value}
            >
                <i className="fa-solid fa-calendar-days text-[10px] text-surface-400 shrink-0" />
                <span>{formatted || value}</span>
            </span>
        );
    }

    if (type === 'time') {
        return (
            <span
                className="font-mono tabular-nums text-surface-600 text-[12px] inline-flex items-center gap-1.5"
                title={value}
            >
                <i className="fa-regular fa-clock text-[10px] text-surface-400 shrink-0" />
                <span>{value}</span>
            </span>
        );
    }

    if (type === 'link') {
        return (
            <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-accent-600 hover:underline truncate"
            >
                {value}
            </a>
        );
    }

    if (type === 'email') {
        return (
            <a
                href={`mailto:${value}`}
                onClick={(e) => e.stopPropagation()}
                className="text-accent-600 hover:underline truncate inline-flex items-center gap-1.5"
            >
                <i className="fa-solid fa-envelope text-[10px] text-surface-400 shrink-0" />
                <span className="truncate">{value}</span>
            </a>
        );
    }

    if (type === 'percent') {
        const num = Number(value);
        const valid = value !== "" && !isNaN(num);
        const clamped = valid ? Math.min(100, Math.max(0, num)) : null;
        return (
            <div className="flex items-center gap-2 max-w-[130px] w-full">
                <div className="flex-1 h-2 bg-surface-100 rounded-full overflow-hidden border border-surface-200 min-w-[36px]">
                    <div
                        className={`h-full rounded-full transition-all ${
                            clamped !== null && clamped >= 100
                                ? 'bg-emerald-500'
                                : clamped !== null && clamped >= 50
                                ? 'bg-accent-500'
                                : 'bg-amber-500'
                        }`}
                        style={{ width: `${clamped ?? 0}%` }}
                    />
                </div>
                <span className="font-mono tabular-nums text-xs font-semibold text-surface-700 shrink-0">
                    {value}%
                </span>
            </div>
        );
    }

    if (type === 'rating') {
        const num = Number(value);
        if (isNaN(num) || value === "") return <span className="text-surface-300">—</span>;
        const clamped = Math.min(5, Math.max(0, num));
        return (
            <div className="inline-flex items-center gap-1.5" title={`${value} / 5`}>
                <div className="flex items-center gap-0.5 text-xs text-amber-400 shrink-0">
                    {[1, 2, 3, 4, 5].map((star) => {
                        if (clamped >= star) {
                            return <i key={star} className="fa-solid fa-star" />;
                        } else if (clamped >= star - 0.5) {
                            return <i key={star} className="fa-solid fa-star-half-stroke" />;
                        } else {
                            return <i key={star} className="fa-regular fa-star text-surface-200" />;
                        }
                    })}
                </div>
                <span className="font-mono tabular-nums text-xs font-semibold text-surface-700">
                    {value}
                </span>
            </div>
        );
    }

    if (type === 'image') {
        return <ImageCellValue value={value} />;
    }

    if (type === 'file') {
        return <FileCellValue value={value} />;
    }

    return <span className="text-surface-800 truncate">{value}</span>;
};

export const summarize = (column: DatatableColumn, values: string[]): string => {
    const filled = values.filter(v => v !== "");

    if (column.column_type === 'number') {
        const sum = filled.reduce((acc, v) => acc + (Number(v) || 0), 0);
        return `Sum ${Number(sum.toFixed(4))}`;
    }

    if (column.column_type === 'duration') {
        const validNumbers = filled.map(Number).filter(n => !isNaN(n));
        if (validNumbers.length === 0) return `${filled.length} filled`;
        const sum = validNumbers.reduce((a, b) => a + b, 0);
        return `Total ${formatDuration(sum)}`;
    }

    if (column.column_type === 'percent') {
        const validNumbers = filled.map(Number).filter(n => !isNaN(n));
        if (validNumbers.length === 0) return `${filled.length} filled`;
        const sum = validNumbers.reduce((a, b) => a + b, 0);
        const avg = sum / validNumbers.length;
        return `Avg ${Number(avg.toFixed(1))}%`;
    }

    if (column.column_type === 'rating') {
        const validNumbers = filled.map(Number).filter(n => !isNaN(n));
        if (validNumbers.length === 0) return `${filled.length} filled`;
        const sum = validNumbers.reduce((a, b) => a + b, 0);
        const avg = sum / validNumbers.length;
        return `★ ${Number(avg.toFixed(1))}/5`;
    }

    if (isBoolType(column.column_type)) {
        return `${values.filter(isTruthy).length} checked`;
    }

    if (isTagType(column.column_type)) {
        return `${new Set(filled).size} unique`;
    }

    return `${filled.length} filled`;
};
