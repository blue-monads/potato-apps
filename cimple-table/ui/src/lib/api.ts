import { API_BASE_PATH } from "./base";

const getAuthToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    return (window as any).spaceGetToken?.('cimple-table') || null;
};

interface ApiResponse<T> {
    status: number;
    data: T;
    error?: string;
}

export async function apiRequest<T>(
    path: string, 
    options?: RequestInit
): Promise<ApiResponse<T>> {
    const token = getAuthToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options?.headers as Record<string, string> || {}),
    };

    if (token) {
        headers['Authorization'] = token;
    }

    const response = await fetch(`${API_BASE_PATH}${path}`, {
        ...options,
        headers,
    });

    const data = await response.json().catch(() => ({ error: 'Unknown error' }));

    return {
        status: response.status,
        data: response.ok ? data : undefined as T,
        error: response.ok ? undefined : (data.error || `HTTP ${response.status}`),
    };
}

// Types
export interface Datatable {
    id: number;
    name: string;
    info: string;
    icon: string;
    color?: string;
    created_at: string;
    updated_at: string;
    is_deleted: number;
    columns?: DatatableColumn[];
    rows?: DatatableRow[];
}

export interface DatatableColumn {
    id: number;
    table_id: number;
    name: string;
    slug: string;
    column_type: string;
    icon?: string;
    info: string;
    required: boolean;
    options: string;
    order_index?: number;
    created_at: string;
    updated_at: string;
}

export interface DatatableRow {
    id: number;
    created_at: string;
    updated_at: string;
    [slug: string]: any;
}

// Datatables API
export async function getActualTableData(id: number): Promise<ApiResponse<Record<string, any>[]>> {
    return apiRequest<Record<string, any>[]>(`/datatables/${id}/actual`, { method: 'GET' });
}

export async function listDatatables(): Promise<ApiResponse<Datatable[]>> {
    return apiRequest<Datatable[]>('/datatables', { method: 'GET' });
}

export async function getDatatable(id: number): Promise<ApiResponse<Datatable>> {
    return apiRequest<Datatable>(`/datatables/${id}`, { method: 'GET' });
}

export async function createDatatable(data: { name: string; info?: string; icon?: string; color?: string }): Promise<ApiResponse<Datatable>> {
    return apiRequest<Datatable>('/datatables', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateDatatable(id: number, data: { name?: string; info?: string; icon?: string; color?: string }): Promise<ApiResponse<Datatable>> {
    return apiRequest<Datatable>(`/datatables/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deleteDatatable(id: number): Promise<ApiResponse<{ message: string }>> {
    return apiRequest<{ message: string }>(`/datatables/${id}`, { method: 'DELETE' });
}

// Columns API
export async function listColumns(tableId: number): Promise<ApiResponse<DatatableColumn[]>> {
    return apiRequest<DatatableColumn[]>(`/datatables/${tableId}/columns`, { method: 'GET' });
}

export async function createColumn(data: { table_id: number; name: string; column_type: string; icon?: string; info?: string; required?: boolean; options?: string }): Promise<ApiResponse<DatatableColumn>> {
    return apiRequest<DatatableColumn>('/columns', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateColumn(id: number, data: { name?: string; column_type?: string; icon?: string; info?: string; required?: boolean; options?: string }): Promise<ApiResponse<DatatableColumn>> {
    return apiRequest<DatatableColumn>(`/columns/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deleteColumn(id: number): Promise<ApiResponse<{ message: string }>> {
    return apiRequest<{ message: string }>(`/columns/${id}`, { method: 'DELETE' });
}

// Rows & Query API
export type FilterOp =
    | 'contains'
    | 'not_contains'
    | 'equals'
    | 'not_equals'
    | 'empty'
    | 'not_empty'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte';

export interface FilterCondition {
    id?: string;
    columnId: number | null;
    op: FilterOp;
    value: string;
}

export interface DatatableQueryParams {
    offset?: number;
    limit?: number;
    sort?: { column: string; dir: 'asc' | 'desc' } | null;
    filter?: {
        column: string;
        op: FilterOp;
        value: string;
    } | null;
    filters?: Array<{
        column: string;
        op: FilterOp;
        value: string;
    }> | null;
    search?: string;
}

export interface DatatableQueryResult {
    rows: DatatableRow[];
    total: number;
    offset: number;
    limit: number;
    last_updated?: string;
}

export async function getTableLastUpdated(tableId: number): Promise<ApiResponse<{ table_id: number; last_updated: string }>> {
    return apiRequest<{ table_id: number; last_updated: string }>(`/datatables/${tableId}/last_updated`, { method: 'GET' });
}

export async function queryTable(
    tableId: number,
    params: DatatableQueryParams
): Promise<ApiResponse<DatatableQueryResult>> {
    return apiRequest<DatatableQueryResult>(`/datatables/${tableId}/query`, {
        method: 'POST',
        body: JSON.stringify(params),
    });
}

export async function listRows(tableId: number): Promise<ApiResponse<DatatableRow[]>> {
    return apiRequest<DatatableRow[]>(`/datatables/${tableId}/rows`, { method: 'GET' });
}

export async function createRow(data: { table_id: number; data?: Record<string, any>; [key: string]: any }): Promise<ApiResponse<DatatableRow>> {
    return apiRequest<DatatableRow>('/rows', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateRow(id: number, data: { table_id: number; data?: Record<string, any>; [key: string]: any }): Promise<ApiResponse<DatatableRow>> {
    return apiRequest<DatatableRow>(`/rows/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deleteRow(id: number, tableId?: number): Promise<ApiResponse<{ message: string }>> {
    const query = tableId ? `?table_id=${tableId}` : '';
    return apiRequest<{ message: string }>(`/rows/${id}${query}`, { method: 'DELETE' });
}

// Cells API
export async function upsertCell(data: { table_id: number; row_id: number; slug?: string; column_id?: number; value: string }): Promise<ApiResponse<{ row_id: number; slug: string; value: string }>> {
    return apiRequest<{ row_id: number; slug: string; value: string }>('/cells/upsert', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

// Seeder API
export async function seedTableRows(
    tableId: number,
    rows: Record<string, any>[]
): Promise<ApiResponse<{ success: boolean; inserted: number; total_requested: number }>> {
    return apiRequest<{ success: boolean; inserted: number; total_requested: number }>(`/datatables/${tableId}/seed`, {
        method: 'POST',
        body: JSON.stringify({ rows }),
    });
}

// Remote Ref API
export interface RefColumnOptions {
    target_table_id: number;
    identity_column?: string;
}

export interface ReverseRefColumnOptions {
    target_table_id: number;
    target_column_slug: string;
    identity_column?: string;
}

export async function resolveRefIds(
    tableId: number,
    ids: number[]
): Promise<ApiResponse<{ table_id: number; rows: DatatableRow[] }>> {
    return apiRequest<{ table_id: number; rows: DatatableRow[] }>(`/resolve_ref_ids`, {
        method: 'POST',
        body: JSON.stringify({ table_id: tableId, ids }),
    });
}

export async function resolveReverseRefs(
    targetTableId: number,
    targetColumnSlug: string,
    rowIds: number[]
): Promise<ApiResponse<{
    target_table_id: number;
    target_column_slug: string;
    mapping: Record<string, number[]>;
    rows: DatatableRow[];
}>> {
    return apiRequest<{
        target_table_id: number;
        target_column_slug: string;
        mapping: Record<string, number[]>;
        rows: DatatableRow[];
    }>(`/resolve_reverse_refs`, {
        method: 'POST',
        body: JSON.stringify({
            target_table_id: targetTableId,
            target_column_slug: targetColumnSlug,
            row_ids: rowIds,
        }),
    });
}

// AutoDash API
export interface AutoDash {
    id: number;
    name: string;
    base_prompt: string;
    created_at: string;
    updated_at: string;
}

export interface AutoDashItem {
    id: number;
    auto_dash_id: number;
    role: 'user' | 'assistant' | 'system';
    content: string;
    html_content?: string | null;
    created_at: string;
    updated_at: string;
}

export async function listAutoDashboards(): Promise<ApiResponse<{ dashboards: AutoDash[] }>> {
    return apiRequest<{ dashboards: AutoDash[] }>('/autodash');
}

export async function createAutoDashboard(data: { name?: string; base_prompt?: string }): Promise<ApiResponse<{ dashboard: AutoDash }>> {
    return apiRequest<{ dashboard: AutoDash }>('/autodash', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function getAutoDashboard(id: number): Promise<ApiResponse<{ dashboard: AutoDash; items: AutoDashItem[] }>> {
    return apiRequest<{ dashboard: AutoDash; items: AutoDashItem[] }>(`/autodash/${id}`);
}

export async function updateAutoDashboard(id: number, data: { name?: string; base_prompt?: string }): Promise<ApiResponse<{ dashboard: AutoDash }>> {
    return apiRequest<{ dashboard: AutoDash }>(`/autodash/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deleteAutoDashboard(id: number): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest<{ success: boolean }>(`/autodash/${id}`, {
        method: 'DELETE',
    });
}

export async function sendAutoDashChat(id: number, content: string, model?: string, apiKey?: string): Promise<ApiResponse<{
    message: string;
    html_content: string;
    item: AutoDashItem;
}>> {
    return apiRequest<{ message: string; html_content: string; item: AutoDashItem }>(`/autodash/${id}/chat`, {
        method: 'POST',
        body: JSON.stringify({ content, model, api_key: apiKey }),
    });
}

export async function saveAutoDashCode(id: number, html_content: string): Promise<ApiResponse<{ success: boolean; item: AutoDashItem }>> {
    return apiRequest<{ success: boolean; item: AutoDashItem }>(`/autodash/${id}/code`, {
        method: 'PUT',
        body: JSON.stringify({ html_content }),
    });
}

export async function runAutoDashQuery(sql: string, args?: any[]): Promise<ApiResponse<{ rows?: any[]; error?: string }>> {
    return apiRequest<{ rows?: any[]; error?: string }>('/autodash/query', {
        method: 'POST',
        body: JSON.stringify({ sql, args: args || [] }),
    });
}

export async function getAutoDashSchema(): Promise<ApiResponse<{ schema: string }>> {
    return apiRequest<{ schema: string }>('/autodash/schema');
}

export async function getAutoDashTemplate(): Promise<ApiResponse<{ template: string }>> {
    return apiRequest<{ template: string }>('/autodash/template');
}
