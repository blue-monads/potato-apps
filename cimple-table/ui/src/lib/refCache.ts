import { useState, useEffect } from "react";
import { resolveRefIds, type DatatableRow, type DatatableColumn, type RefColumnOptions } from "./api";

// Global in-memory cache: tableId -> (rowId -> DatatableRow)
const refCache: Record<number, Record<number, DatatableRow>> = {};

// In-flight requests: `${tableId}:${rowId}`
const pendingIds = new Set<string>();

// Subscribers notified when refCache updates
type CacheListener = () => void;
const listeners = new Set<CacheListener>();

const notifyListeners = () => {
    listeners.forEach(fn => fn());
};

/**
 * Parse JSON or string options for a ref column.
 * e.g. '{"target_table_id": 2, "identity_column": "name"}'
 */
export function parseRefOptions(options?: string): RefColumnOptions | null {
    if (!options || !options.trim()) return null;
    try {
        const parsed = JSON.parse(options);
        if (parsed && typeof parsed.target_table_id === 'number') {
            return {
                target_table_id: parsed.target_table_id,
                identity_column: parsed.identity_column || undefined,
            };
        }
    } catch {
        // Fallback for simple "tableId:columnSlug" string format
        const parts = options.split(':');
        const tid = parseInt(parts[0], 10);
        if (!isNaN(tid)) {
            return {
                target_table_id: tid,
                identity_column: parts[1] || undefined,
            };
        }
    }
    return null;
}

/**
 * Parse an ID or list of IDs from cell value (single number, comma-separated string, or JSON array).
 */
export function parseRefIds(val: any): number[] {
    if (val === undefined || val === null || val === "") return [];
    if (typeof val === 'number') return [val];
    if (Array.isArray(val)) {
        return val.map(v => typeof v === 'number' ? v : parseInt(String(v), 10)).filter(n => !isNaN(n) && n > 0);
    }
    const str = String(val).trim();
    if (!str) return [];
    if (str.startsWith('[') && str.endsWith(']')) {
        try {
            const parsed = JSON.parse(str);
            if (Array.isArray(parsed)) {
                return parsed.map(v => typeof v === 'number' ? v : parseInt(String(v), 10)).filter(n => !isNaN(n) && n > 0);
            }
        } catch {}
    }
    return str
        .split(',')
        .map(s => parseInt(s.trim(), 10))
        .filter(n => !isNaN(n) && n > 0);
}

/**
 * Automatically determine the identity column for a table.
 * Look for columns named name, title, label, etc., or fallback to first text column.
 */
export function getIdentityColumn(columns: DatatableColumn[]): DatatableColumn | undefined {
    if (!columns || columns.length === 0) return undefined;

    const priorityNames = ['name', 'title', 'label', 'task', 'product_name', 'item', 'member_name', 'summary'];
    
    // 1. Exact match on slug or lower-cased name
    for (const p of priorityNames) {
        const found = columns.find(c => c.slug?.toLowerCase() === p || c.name.toLowerCase() === p);
        if (found) return found;
    }

    // 2. Partial match containing name/title
    const partial = columns.find(c => 
        c.slug?.toLowerCase().includes('name') || 
        c.name.toLowerCase().includes('name') ||
        c.slug?.toLowerCase().includes('title') ||
        c.name.toLowerCase().includes('title')
    );
    if (partial) return partial;

    // 3. First text or link column
    const firstText = columns.find(c => c.column_type === 'text' || c.column_type === 'link');
    if (firstText) return firstText;

    // 4. First column that is not 'id'
    const nonId = columns.find(c => c.slug !== 'id');
    return nonId || columns[0];
}

/**
 * Extract display text from a resolved referenced row.
 */
export function getRowIdentityText(
    row?: DatatableRow,
    identityColumnSlug?: string,
    columns?: DatatableColumn[]
): string {
    if (!row) return "";

    if (identityColumnSlug && row[identityColumnSlug] !== undefined && row[identityColumnSlug] !== null) {
        const v = String(row[identityColumnSlug]).trim();
        if (v) return v;
    }

    if (columns && columns.length > 0) {
        const idCol = getIdentityColumn(columns);
        if (idCol && row[idCol.slug] !== undefined && row[idCol.slug] !== null) {
            const v = String(row[idCol.slug]).trim();
            if (v) return v;
        }
    }

    // Common fallbacks
    for (const key of ['name', 'title', 'label', 'product_name', 'task_name']) {
        if (row[key] !== undefined && row[key] !== null) {
            const v = String(row[key]).trim();
            if (v) return v;
        }
    }

    return `#${row.id}`;
}

/**
 * Fetch referenced row IDs lazily in batch.
 */
export async function batchResolveRefs(tableId: number, ids: (number | string)[]) {
    if (!tableId) return;

    const numericIds = Array.from(new Set(
        ids
            .map(id => typeof id === 'number' ? id : parseInt(String(id), 10))
            .filter(id => !isNaN(id) && id > 0)
    ));

    const tableCache = refCache[tableId] || {};
    const needed = numericIds.filter(id => {
        const key = `${tableId}:${id}`;
        return !tableCache[id] && !pendingIds.has(key);
    });

    if (needed.length === 0) return;

    needed.forEach(id => pendingIds.add(`${tableId}:${id}`));

    try {
        const res = await resolveRefIds(tableId, needed);
        if (res.data && Array.isArray(res.data.rows)) {
            if (!refCache[tableId]) {
                refCache[tableId] = {};
            }
            res.data.rows.forEach(r => {
                const rId = typeof r.id === 'number' ? r.id : parseInt(String(r.id), 10);
                if (!isNaN(rId)) {
                    refCache[tableId][rId] = r;
                }
            });
            notifyListeners();
        }
    } catch (err) {
        console.error("Failed to batch resolve refs:", err);
    } finally {
        needed.forEach(id => pendingIds.delete(`${tableId}:${id}`));
    }
}

/**
 * Synchronously get a cached row if available.
 */
export function getCachedRefRow(tableId: number, rowId: number | string): DatatableRow | undefined {
    const n = typeof rowId === 'number' ? rowId : parseInt(String(rowId), 10);
    if (isNaN(n)) return undefined;
    return refCache[tableId]?.[n];
}

/**
 * Hook to subscribe to ref cache updates and trigger lazy loading.
 */
export function useRefResolution(tableId?: number, rowId?: number | string): DatatableRow | undefined {
    const [, setTick] = useState(0);

    const nRowId = rowId !== undefined ? (typeof rowId === 'number' ? rowId : parseInt(String(rowId), 10)) : NaN;
    const isValid = !!tableId && !isNaN(nRowId) && nRowId > 0;

    useEffect(() => {
        const handleChange = () => setTick(t => t + 1);
        listeners.add(handleChange);
        return () => {
            listeners.delete(handleChange);
        };
    }, []);

    useEffect(() => {
        if (isValid && tableId && nRowId) {
            if (!refCache[tableId]?.[nRowId]) {
                batchResolveRefs(tableId, [nRowId]);
            }
        }
    }, [tableId, nRowId, isValid]);

    if (!isValid || !tableId) return undefined;
    return refCache[tableId]?.[nRowId];
}
