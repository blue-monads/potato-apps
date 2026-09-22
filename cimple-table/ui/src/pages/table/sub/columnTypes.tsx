import { type DatatableColumn, type DatatableRow } from "../../../lib/api";
import { parseRefOptions, parseRefIds, getRowIdentityText, useRefResolution } from "../../../lib/refCache";

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
    date: 'calendar',
    checkbox: 'square-check',
    image: 'image',
    file: 'paperclip',
    link: 'link',
    dropdown: 'caret-down',
    radio: 'circle-dot',
    multiselect: 'tags',
    ref: 'arrow-up-right-from-square',
    multiref: 'layer-group',
};

export const getTypeIcon = (type: string) => TYPE_ICONS[type] || 'font';

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

export const CellValue = ({ value, column }: { value: string; column: DatatableColumn }) => {
    const type = column.column_type;

    if (!value) return <span className="text-surface-300">—</span>;

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

    if (type === 'date') {
        return <span className="font-mono tabular-nums text-surface-600 text-[12px]">{value}</span>;
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

    if (type === 'image') {
        return (
            <img
                src={value}
                alt=""
                className="h-6 w-10 object-cover rounded border border-surface-200"
                onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}
            />
        );
    }

    if (type === 'file') {
        return (
            <span className="flex items-center gap-1.5 text-surface-600 truncate">
                <i className="fa-solid fa-paperclip text-[10px] text-surface-400" />
                <span className="truncate">{value}</span>
            </span>
        );
    }

    return <span className="text-surface-800 truncate">{value}</span>;
};

export const summarize = (column: DatatableColumn, values: string[]): string => {
    const filled = values.filter(v => v !== "");

    if (column.column_type === 'number') {
        const sum = filled.reduce((acc, v) => acc + (Number(v) || 0), 0);
        return `Sum ${Number(sum.toFixed(4))}`;
    }

    if (isBoolType(column.column_type)) {
        return `${values.filter(isTruthy).length} checked`;
    }

    if (isTagType(column.column_type)) {
        return `${new Set(filled).size} unique`;
    }

    return `${filled.length} filled`;
};
