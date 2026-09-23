import { useState, useEffect } from "react";
import {
    resolveRefIds,
    resolveReverseRefs,
    type DatatableRow,
    type DatatableColumn,
    type RefColumnOptions,
    type ReverseRefColumnOptions,
} from "./api";

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
    if (typeof val === 'object') {
        const values = Object.values(val);
        if (values.length === 0) return [];
        return values.map(v => typeof v === 'number' ? v : parseInt(String(v), 10)).filter(n => !isNaN(n) && n > 0);
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

    // 3. First text, link, email, or barcode column
    const firstText = columns.find(c => c.column_type === 'text' || c.column_type === 'link' || c.column_type === 'email' || c.column_type === 'barcode');
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

// Global in-memory cache for reverse refs: `${currentTableId}:${colSlug}:${rowId}` -> array of referencing row IDs
const reverseRefCache: Record<string, number[]> = {};
const reverseRefPending = new Set<string>();

interface StagedReverseQueueItem {
    currentTableId: number;
    colSlug: string;
    targetTableId: number;
    targetColSlug: string;
    rowIds: Set<number>;
}
const stagedReverseQueues: Map<string, StagedReverseQueueItem> = new Map();
let stagedTimer: any = null;

/**
 * Parse JSON or string options for a reverse ref column.
 * e.g. '{"target_table_id": 2, "target_column_slug": "author", "identity_column": "title"}'
 */
export function parseReverseRefOptions(options?: string): ReverseRefColumnOptions | null {
    if (!options || !options.trim()) return null;
    try {
        const parsed = JSON.parse(options);
        if (parsed && typeof parsed.target_table_id === 'number' && parsed.target_column_slug) {
            return {
                target_table_id: parsed.target_table_id,
                target_column_slug: String(parsed.target_column_slug),
                identity_column: parsed.identity_column || undefined,
            };
        }
    } catch {
        // Fallback for simple "tableId:columnSlug:identityCol" string format
        const parts = options.split(':');
        const tid = parseInt(parts[0], 10);
        if (!isNaN(tid) && parts[1]) {
            return {
                target_table_id: tid,
                target_column_slug: parts[1],
                identity_column: parts[2] || undefined,
            };
        }
    }
    return null;
}

export function getReverseRefIds(currentTableId: number, colSlug: string, rowId: number | string): number[] | undefined {
    const key = `${currentTableId}:${colSlug}:${rowId}`;
    return reverseRefCache[key];
}

export function isReverseRefLoading(currentTableId: number, colSlug: string, rowId: number | string): boolean {
    const key = `${currentTableId}:${colSlug}:${rowId}`;
    return reverseRefPending.has(key);
}

function flushStagedReverseRefs() {
    stagedTimer = null;
    const queues = Array.from(stagedReverseQueues.values());
    stagedReverseQueues.clear();

    for (const queue of queues) {
        const allIds = Array.from(queue.rowIds);
        if (allIds.length === 0) continue;

        // Process in chunks of 100 to keep SQL IN clauses clean and bounded
        const chunkSize = 100;
        for (let i = 0; i < allIds.length; i += chunkSize) {
            const chunk = allIds.slice(i, i + chunkSize);
            (async () => {
                try {
                    const res = await resolveReverseRefs(queue.targetTableId, queue.targetColSlug, chunk);
                    if (res.data) {
                        // 1. Cache returned rows into refCache
                        if (Array.isArray(res.data.rows)) {
                            if (!refCache[queue.targetTableId]) {
                                refCache[queue.targetTableId] = {};
                            }
                            res.data.rows.forEach(r => {
                                const rId = typeof r.id === 'number' ? r.id : parseInt(String(r.id), 10);
                                if (!isNaN(rId)) {
                                    refCache[queue.targetTableId][rId] = r;
                                }
                            });
                        }

                        // 2. Cache mappings for all requested IDs in this chunk
                        const mapping = res.data.mapping || {};
                        chunk.forEach(id => {
                            const raw = mapping[String(id)] ?? mapping[Number(id)];
                            const refIds = parseRefIds(raw);
                            reverseRefCache[`${queue.currentTableId}:${queue.colSlug}:${id}`] = refIds;
                        });

                        notifyListeners();
                    }
                } catch (err) {
                    console.error("Failed to resolve reverse refs:", err);
                } finally {
                    chunk.forEach(id => {
                        reverseRefPending.delete(`${queue.currentTableId}:${queue.colSlug}:${id}`);
                    });
                    notifyListeners();
                }
            })();
        }
    }
}

/**
 * Stage and batch-resolve reverse references across multiple rows.
 */
export function stageBatchResolveReverseRefs(
    currentTableId: number,
    colSlug: string,
    targetTableId: number,
    targetColSlug: string,
    rowIds: (number | string)[]
) {
    if (!currentTableId || !colSlug || !targetTableId || !targetColSlug) return;

    const numericIds = Array.from(new Set(
        rowIds
            .map(id => typeof id === 'number' ? id : parseInt(String(id), 10))
            .filter(id => !isNaN(id) && id > 0)
    ));

    const needed = numericIds.filter(id => {
        const key = `${currentTableId}:${colSlug}:${id}`;
        return reverseRefCache[key] === undefined && !reverseRefPending.has(key);
    });

    if (needed.length === 0) return;

    needed.forEach(id => reverseRefPending.add(`${currentTableId}:${colSlug}:${id}`));

    const queueKey = `${currentTableId}:${colSlug}:${targetTableId}:${targetColSlug}`;
    let queue = stagedReverseQueues.get(queueKey);
    if (!queue) {
        queue = {
            currentTableId,
            colSlug,
            targetTableId,
            targetColSlug,
            rowIds: new Set<number>(),
        };
        stagedReverseQueues.set(queueKey, queue);
    }
    needed.forEach(id => queue!.rowIds.add(id));

    if (!stagedTimer) {
        stagedTimer = setTimeout(flushStagedReverseRefs, 50);
    }
}

/**
 * Hook to subscribe to reverse ref updates and trigger staged lazy loading.
 */
export function useReverseRefResolution(
    currentTableId?: number,
    colSlug?: string,
    rowId?: number | string,
    targetTableId?: number,
    targetColSlug?: string
): { loading: boolean; refIds: number[] } {
    const [, setTick] = useState(0);

    const nRowId = rowId !== undefined ? (typeof rowId === 'number' ? rowId : parseInt(String(rowId), 10)) : NaN;
    const isValid = !!currentTableId && !!colSlug && !isNaN(nRowId) && nRowId > 0 && !!targetTableId && !!targetColSlug;

    useEffect(() => {
        const handleChange = () => setTick(t => t + 1);
        listeners.add(handleChange);
        return () => {
            listeners.delete(handleChange);
        };
    }, []);

    useEffect(() => {
        if (isValid && currentTableId && colSlug && nRowId && targetTableId && targetColSlug) {
            const cached = getReverseRefIds(currentTableId, colSlug, nRowId);
            if (cached === undefined) {
                stageBatchResolveReverseRefs(currentTableId, colSlug, targetTableId, targetColSlug, [nRowId]);
            }
        }
    }, [isValid, currentTableId, colSlug, nRowId, targetTableId, targetColSlug]);

    if (!isValid || !currentTableId || !colSlug || !nRowId) {
        return { loading: false, refIds: [] };
    }

    const cached = getReverseRefIds(currentTableId, colSlug, nRowId);
    if (cached !== undefined) {
        return { loading: false, refIds: Array.isArray(cached) ? cached : [] };
    }

    return { loading: true, refIds: [] };
}
