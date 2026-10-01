import { API_BASE_PATH } from "./base";

export interface Account {
    id: number;
    name: string;
    info: string;
    acc_type: string;
    parent_id: number;
    contact_id: number;
    created_at: string;
    updated_at: string;
    is_deleted: boolean;
}

export interface Transaction {
    id: number;
    title: string;
    notes: string;
    txn_type: string;
    reference_id: string;
    attachments: string;
    created_by: number;
    updated_by: number;
    txn_date: string;
    created_at: string;
    updated_at: string;
    is_editable: boolean;
    is_deleted: boolean;
    lines?: TransactionLine[];
}

export interface TransactionLine {
    id: number;
    account_id: number;
    txn_id: number;
    debit_amount: number;
    credit_amount: number;
    created_by: number;
    updated_by: number;
    created_at: string;
    updated_at: string;
    linked_sales_id: number;
    linked_stockin_id: number;
}

const getAuthToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    return (window as any).spaceGetToken?.('cimple-books') || null;
};

interface ApiResponse<T> {
    status: number;
    data: T;
    error?: string;
}

async function apiRequest<T>(
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

// Accounts API
export const listAccounts = async (): Promise<ApiResponse<Account[]>> => {
    const resp = await apiRequest<Account[]>('/accounts', { method: 'GET' });
    if (resp.status === 200 && Array.isArray(resp.data)) {
        return resp;
    }
    return { ...resp, data: [] };
};

export const createAccount = async (account: Partial<Account>): Promise<ApiResponse<Account>> => {
    return apiRequest<Account>('/accounts', {
        method: 'POST',
        body: JSON.stringify(account),
    });
};

export const updateAccount = async (accountId: number, account: Partial<Account>): Promise<ApiResponse<Account>> => {
    return apiRequest<Account>(`/accounts/${accountId}`, {
        method: 'PUT',
        body: JSON.stringify(account),
    });
};

export const deleteAccount = async (accountId: number): Promise<ApiResponse<{ message: string }>> => {
    return apiRequest<{ message: string }>(`/accounts/${accountId}`, {
        method: 'DELETE',
    });
};

// Transactions API
export interface ListTransactionsParams {
    page?: number;
    pageSize?: number;
    search?: string;
    accountId?: string | number;
    txnType?: string;
    datePreset?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
}

export interface TransactionMetrics {
    total_entries: number;
    total_debit: number;
    total_credit: number;
    accounts_count: number;
    is_balanced: boolean;
}

export interface PaginatedTransactionsResponse {
    items: Transaction[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
    metrics: TransactionMetrics;
    account_counts?: Record<string, number>;
}

export const listTransactions = async (
    params?: ListTransactionsParams
): Promise<ApiResponse<PaginatedTransactionsResponse>> => {
    const queryParts: string[] = [];
    if (params) {
        if (params.page !== undefined) queryParts.push(`page=${encodeURIComponent(params.page)}`);
        if (params.pageSize !== undefined) queryParts.push(`pageSize=${encodeURIComponent(params.pageSize)}`);
        if (params.search) queryParts.push(`search=${encodeURIComponent(params.search)}`);
        if (params.accountId && params.accountId !== 'all') queryParts.push(`accountId=${encodeURIComponent(params.accountId)}`);
        if (params.txnType && params.txnType !== 'all') queryParts.push(`txnType=${encodeURIComponent(params.txnType)}`);
        if (params.datePreset && params.datePreset !== 'all') queryParts.push(`datePreset=${encodeURIComponent(params.datePreset)}`);
        if (params.startDate) queryParts.push(`startDate=${encodeURIComponent(params.startDate)}`);
        if (params.endDate) queryParts.push(`endDate=${encodeURIComponent(params.endDate)}`);
        if (params.sortBy) queryParts.push(`sortBy=${encodeURIComponent(params.sortBy)}`);
    }
    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    const resp = await apiRequest<any>(`/transactions${queryString}`, { method: 'GET' });

    if (resp.status >= 200 && resp.status < 300 && resp.data) {
        if (Array.isArray(resp.data)) {
            const arr = resp.data as Transaction[];
            return {
                ...resp,
                data: {
                    items: arr,
                    total: arr.length,
                    page: 1,
                    page_size: arr.length,
                    total_pages: 1,
                    metrics: {
                        total_entries: arr.length,
                        total_debit: 0,
                        total_credit: 0,
                        accounts_count: 0,
                        is_balanced: true,
                    },
                },
            };
        }
        return {
            ...resp,
            data: resp.data as PaginatedTransactionsResponse,
        };
    }

    return {
        ...resp,
        data: {
            items: [],
            total: 0,
            page: 1,
            page_size: params?.pageSize || 15,
            total_pages: 1,
            metrics: {
                total_entries: 0,
                total_debit: 0,
                total_credit: 0,
                accounts_count: 0,
                is_balanced: true,
            },
        },
    };
};

export const createTransaction = async (transaction: {
    title?: string;
    notes?: string;
    txn_type?: string;
    reference_id?: string;
    attachments?: string;
    txn_date?: number;
    is_editable?: boolean;
    lines: Array<{
        account_id: number;
        debit_amount?: number;
        credit_amount?: number;
        linked_sales_id?: number;
        linked_stockin_id?: number;
    }>;
}): Promise<ApiResponse<Transaction>> => {
    return apiRequest<Transaction>('/transactions', {
        method: 'POST',
        body: JSON.stringify(transaction),
    });
};

export const updateTransaction = async (
    txnId: number,
    transaction: {
        title?: string;
        notes?: string;
        txn_type?: string;
        reference_id?: string;
        attachments?: string;
        txn_date?: number;
        is_editable?: boolean;
        lines?: Array<{
            account_id: number;
            debit_amount?: number;
            credit_amount?: number;
            linked_sales_id?: number;
            linked_stockin_id?: number;
        }>;
    }
): Promise<ApiResponse<Transaction>> => {
    return apiRequest<Transaction>(`/transactions/${txnId}`, {
        method: 'PUT',
        body: JSON.stringify(transaction),
    });
};

export const deleteTransaction = async (txnId: number): Promise<ApiResponse<{ message: string }>> => {
    return apiRequest<{ message: string }>(`/transactions/${txnId}`, {
        method: 'DELETE',
    });
};

// Categories API
export interface Category {
    id: number;
    name: string;
    info: string;
    product_class: string;
    parent_id: number;
    image: string;
    created_by: number;
    updated_by: number;
    created_at: string;
    updated_at: string;
    is_deleted: boolean;
}

export const listCategories = async (): Promise<ApiResponse<Category[]>> => {
    const resp = await apiRequest<Category[]>('/categories', { method: 'GET' });
    if (resp.status === 200 && Array.isArray(resp.data)) {
        return resp;
    }
    return { ...resp, data: [] };
};

export const createCategory = async (category: Partial<Category>): Promise<ApiResponse<Category>> => {
    return apiRequest<Category>('/categories', {
        method: 'POST',
        body: JSON.stringify(category),
    });
};

export const updateCategory = async (categoryId: number, category: Partial<Category>): Promise<ApiResponse<Category>> => {
    return apiRequest<Category>(`/categories/${categoryId}`, {
        method: 'PUT',
        body: JSON.stringify(category),
    });
};

export const deleteCategory = async (categoryId: number): Promise<ApiResponse<{ message: string }>> => {
    return apiRequest<{ message: string }>(`/categories/${categoryId}`, {
        method: 'DELETE',
    });
};

// Contacts API
export type ContactType = 'individual' | 'company';
export type ContactRelationType = 'customer' | 'supplier' | 'general';

export interface Contact {
    id: number;
    name: string;
    parent_contact_id?: number | null;
    info: string;
    images?: string;
    contact_type: ContactType;
    relation_type: ContactRelationType;
    primary_email: string;
    primary_phone: string;
    primary_address: string;
    notes: string;
    extra_data?: string;
    created_by?: number;
    updated_by?: number;
    created_at?: string;
    updated_at?: string;
    is_deleted?: boolean;
}

export const listContacts = async (): Promise<ApiResponse<Contact[]>> => {
    const resp = await apiRequest<Contact[]>('/contacts', { method: 'GET' });
    if (resp.status === 200 && Array.isArray(resp.data)) {
        return resp;
    }
    return { ...resp, data: [] };
};

export const getContact = async (contactId: number): Promise<ApiResponse<Contact>> => {
    return apiRequest<Contact>(`/contacts/${contactId}`, { method: 'GET' });
};

export const createContact = async (contact: Partial<Contact>): Promise<ApiResponse<Contact>> => {
    return apiRequest<Contact>('/contacts', {
        method: 'POST',
        body: JSON.stringify(contact),
    });
};

export const updateContact = async (contactId: number, contact: Partial<Contact>): Promise<ApiResponse<Contact>> => {
    return apiRequest<Contact>(`/contacts/${contactId}`, {
        method: 'PUT',
        body: JSON.stringify(contact),
    });
};

export const deleteContact = async (contactId: number): Promise<ApiResponse<{ message: string }>> => {
    return apiRequest<{ message: string }>(`/contacts/${contactId}`, {
        method: 'DELETE',
    });
};

// Products & Variants API
export interface ProductVariant {
    id: number;
    product_id: number;
    name: string;
    description: string;
    sales_price: number;
    stock_count?: number;
    images?: string;
    created_by?: number;
    updated_by?: number;
    created_at?: string;
    updated_at?: string;
    is_deleted?: boolean;
}

export interface Product {
    id: number;
    name: string;
    info: string;
    catagory_id: number;
    sales_price: number;
    image?: string;
    images?: string;
    alt_images?: string;
    epoch?: number;
    stock_count: number;
    track_inventory?: boolean;
    has_variants?: boolean;
    sales_account_id?: number | null;
    purchase_account_id?: number | null;
    tax_id?: number | null;
    created_by?: number;
    updated_by?: number;
    created_at?: string;
    updated_at?: string;
    is_deleted?: boolean;
    variants?: ProductVariant[];
}

export const listProducts = async (): Promise<ApiResponse<Product[]>> => {
    const resp = await apiRequest<Product[]>('/products', { method: 'GET' });
    if (resp.status === 200 && Array.isArray(resp.data)) {
        return resp;
    }
    return { ...resp, data: [] };
};

export const getProduct = async (productId: number): Promise<ApiResponse<Product>> => {
    return apiRequest<Product>(`/products/${productId}`, { method: 'GET' });
};

export const createProduct = async (product: Partial<Product>): Promise<ApiResponse<Product>> => {
    return apiRequest<Product>('/products', {
        method: 'POST',
        body: JSON.stringify(product),
    });
};

export const updateProduct = async (productId: number, product: Partial<Product>): Promise<ApiResponse<Product>> => {
    return apiRequest<Product>(`/products/${productId}`, {
        method: 'PUT',
        body: JSON.stringify(product),
    });
};

export const deleteProduct = async (productId: number): Promise<ApiResponse<{ message: string }>> => {
    return apiRequest<{ message: string }>(`/products/${productId}`, {
        method: 'DELETE',
    });
};

export const listProductVariants = async (productId: number): Promise<ApiResponse<ProductVariant[]>> => {
    const resp = await apiRequest<ProductVariant[]>(`/products/${productId}/variants`, { method: 'GET' });
    if (resp.status === 200 && Array.isArray(resp.data)) {
        return resp;
    }
    return { ...resp, data: [] };
};

export const createProductVariant = async (productId: number, variant: Partial<ProductVariant>): Promise<ApiResponse<ProductVariant>> => {
    return apiRequest<ProductVariant>(`/products/${productId}/variants`, {
        method: 'POST',
        body: JSON.stringify(variant),
    });
};

export const updateProductVariant = async (variantId: number, variant: Partial<ProductVariant>): Promise<ApiResponse<ProductVariant>> => {
    return apiRequest<ProductVariant>(`/variants/${variantId}`, {
        method: 'PUT',
        body: JSON.stringify(variant),
    });
};

export const deleteProductVariant = async (variantId: number): Promise<ApiResponse<{ message: string }>> => {
    return apiRequest<{ message: string }>(`/variants/${variantId}`, {
        method: 'DELETE',
    });
};

export const uploadProductImage = async (file: File): Promise<string> => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('files', file);
    formData.append('filename', file.name);

    const url = new URL('/zz/api/core/space_file/upload', window.location.origin);
    url.searchParams.set('path', 'cimple-books/products');

    const headers: Record<string, string> = {};
    if (token) {
        headers['Authorization'] = token;
    }

    const response = await fetch(url.toString(), {
        method: 'POST',
        headers,
        body: formData,
    });

    if (!response.ok) {
        throw new Error('Failed to upload image');
    }

    const data = await response.json();
    const fileId = data.file_id || data.id || file.name;
    const cleanId = typeof fileId === 'string' && fileId.startsWith('/') ? fileId.substring(1) : fileId;
    return `/zz/api/core/space_file/preview/${cleanId}`;
};

// Stock In API
export interface ProductStockInLine {
    id?: number;
    info?: string;
    product_stockin_id?: number;
    product_id: number;
    product_name?: string;
    variant_id?: number;
    variant_name?: string;
    qty: number;
    price?: number;
    amount?: number;
    created_by?: number;
    updated_by?: number;
    created_at?: string;
    updated_at?: string;
}

export interface ProductStockIn {
    id: number;
    info: string;
    amount: number;
    vendor_contact_id?: number | null;
    vendor_alt_name?: string;
    vendor_id?: number;
    vendor_name?: string;
    reference_id?: string;
    stockin_date?: string;
    created_by: number;
    updated_by: number;
    created_at: string;
    updated_at: string;
    is_deleted?: boolean;
    lines?: ProductStockInLine[];
}

export const listStockIn = async (): Promise<ApiResponse<ProductStockIn[]>> => {
    const resp = await apiRequest<ProductStockIn[]>('/stockin', { method: 'GET' });
    if (resp.status === 200 && Array.isArray(resp.data)) {
        return resp;
    }
    return { ...resp, data: [] };
};

export const getStockIn = async (stockinId: number): Promise<ApiResponse<ProductStockIn>> => {
    return apiRequest<ProductStockIn>(`/stockin/${stockinId}`, { method: 'GET' });
};

export const createStockIn = async (stockin: Partial<ProductStockIn>): Promise<ApiResponse<ProductStockIn>> => {
    return apiRequest<ProductStockIn>('/stockin', {
        method: 'POST',
        body: JSON.stringify(stockin),
    });
};

export const updateStockIn = async (stockinId: number, stockin: Partial<ProductStockIn>): Promise<ApiResponse<ProductStockIn>> => {
    return apiRequest<ProductStockIn>(`/stockin/${stockinId}`, {
        method: 'PUT',
        body: JSON.stringify(stockin),
    });
};

export const deleteStockIn = async (stockinId: number): Promise<ApiResponse<{ message: string }>> => {
    return apiRequest<{ message: string }>(`/stockin/${stockinId}`, {
        method: 'DELETE',
    });
};

// Taxes API
export interface Tax {
    id: number;
    name: string;
    ttype: string;
    info: string;
    rate: number;
    strict: boolean;
    created_by: number;
    updated_by: number;
    created_at: string;
    updated_at: string;
    is_deleted: boolean;
}

export const listTaxes = async (): Promise<ApiResponse<Tax[]>> => {
    const resp = await apiRequest<Tax[]>('/taxes', { method: 'GET' });
    if (resp.status === 200 && Array.isArray(resp.data)) {
        return resp;
    }
    return { ...resp, data: [] };
};

export const createTax = async (tax: Partial<Tax>): Promise<ApiResponse<Tax>> => {
    return apiRequest<Tax>('/taxes', {
        method: 'POST',
        body: JSON.stringify(tax),
    });
};

export const updateTax = async (taxId: number, tax: Partial<Tax>): Promise<ApiResponse<Tax>> => {
    return apiRequest<Tax>(`/taxes/${taxId}`, {
        method: 'PUT',
        body: JSON.stringify(tax),
    });
};

export const deleteTax = async (taxId: number): Promise<ApiResponse<{ message: string }>> => {
    return apiRequest<{ message: string }>(`/taxes/${taxId}`, {
        method: 'DELETE',
    });
};

// Sales API
export interface SalesLine {
    id: number;
    info: string;
    qty: number;
    sale_id: number;
    product_id: number;
    variant_id?: number;
    price: number;
    tax_amount: number;
    discount_amount: number;
    total_amount: number;
    created_by: number;
    updated_by: number;
    created_at: string;
    updated_at: string;
}

export interface Sale {
    id: number;
    title: string;
    client_contact_id?: number | null;
    client_alt_name?: string;
    client_id?: number;
    client_name?: string;
    notes: string;
    attachments: string;
    total_item_price: number;
    total_item_tax_amount: number;
    total_item_discount_amount: number;
    sub_total: number;
    overall_discount_amount: number;
    overall_tax_amount: number;
    total: number;
    created_by: number;
    updated_by: number;
    sales_date: string;
    created_at: string;
    updated_at: string;
    invalidated_reason: string;
    payment_status: string;
    is_deleted: boolean;
    lines?: SalesLine[];
}

export const listSales = async (): Promise<ApiResponse<Sale[]>> => {
    const resp = await apiRequest<Sale[]>('/sales', { method: 'GET' });
    if (resp.status === 200 && Array.isArray(resp.data)) {
        return resp;
    }
    return { ...resp, data: [] };
};

export const getSale = async (saleId: number): Promise<ApiResponse<Sale>> => {
    return apiRequest<Sale>(`/sales/${saleId}`, { method: 'GET' });
};

export const createSale = async (sale: {
    title?: string;
    client_id?: number;
    client_name?: string;
    notes?: string;
    attachments?: string;
    total_item_price?: number;
    total_item_tax_amount?: number;
    total_item_discount_amount?: number;
    sub_total?: number;
    overall_discount_amount?: number;
    overall_tax_amount?: number;
    total?: number;
    sales_date?: string | number;
    payment_status?: string;
    lines: Array<{
        info?: string;
        qty?: number;
        product_id?: number;
        price?: number;
        tax_amount?: number;
        discount_amount?: number;
        total_amount?: number;
    }>;
}): Promise<ApiResponse<Sale>> => {
    return apiRequest<Sale>('/sales', {
        method: 'POST',
        body: JSON.stringify(sale),
    });
};

export const updateSale = async (
    saleId: number,
    sale: {
        title?: string;
        client_id?: number;
        client_name?: string;
        notes?: string;
        attachments?: string;
        total_item_price?: number;
        total_item_tax_amount?: number;
        total_item_discount_amount?: number;
        sub_total?: number;
        overall_discount_amount?: number;
        overall_tax_amount?: number;
        total?: number;
        sales_date?: string | number;
        payment_status?: string;
        lines?: Array<{
            info?: string;
            qty?: number;
            product_id?: number;
            price?: number;
            tax_amount?: number;
            discount_amount?: number;
            total_amount?: number;
        }>;
    }
): Promise<ApiResponse<Sale>> => {
    return apiRequest<Sale>(`/sales/${saleId}`, {
        method: 'PUT',
        body: JSON.stringify(sale),
    });
};

export const deleteSale = async (saleId: number): Promise<ApiResponse<{ message: string }>> => {
    return apiRequest<{ message: string }>(`/sales/${saleId}`, {
        method: 'DELETE',
    });
};

// Settings API
export interface AppSettings {
    currency_symbol?: string | null;
    default_tax_rate_id?: number | null;
    default_sales_account_id?: number | null;
    default_purchase_account_id?: number | null;
}

export const getCurrencySymbol = (): string => {
    try {
        return localStorage.getItem('cimple_books_currency_symbol') || '$';
    } catch {
        return '$';
    }
};

export const getSettings = async (): Promise<ApiResponse<AppSettings>> => {
    const resp = await apiRequest<AppSettings>('/settings', { method: 'GET' });
    if (resp.status === 200 && resp.data?.currency_symbol) {
        try {
            localStorage.setItem('cimple_books_currency_symbol', resp.data.currency_symbol);
        } catch {
            // ignore
        }
    }
    return resp;
};

export const updateSettings = async (settings: AppSettings): Promise<ApiResponse<AppSettings>> => {
    const resp = await apiRequest<AppSettings>('/settings', {
        method: 'POST',
        body: JSON.stringify(settings),
    });
    if (resp.status === 200 && resp.data?.currency_symbol) {
        try {
            localStorage.setItem('cimple_books_currency_symbol', resp.data.currency_symbol);
        } catch {
            // ignore
        }
    }
    return resp;
};