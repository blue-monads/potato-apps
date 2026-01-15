import { API_BASE_PATH } from "./base";

export interface Account {
    id: number;
    name: string;
    info: string;
    acc_type: string;
    parent_id: number;
    total_debit: number;
    total_credit: number;
    contact_id: number;
    calculated_at: string;
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
export const listTransactions = async (): Promise<ApiResponse<Transaction[]>> => {
    const resp = await apiRequest<Transaction[]>('/transactions', { method: 'GET' });
    if (resp.status === 200 && Array.isArray(resp.data)) {
        return resp;
    }
    return { ...resp, data: [] };
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

// Products API
export interface Product {
    id: number;
    name: string;
    info: string;
    variant_id: string;
    catagory_id: number;
    price: number;
    parent_id: number;
    image: string;
    alt_images: string;
    epoch: number;
    stock_count: number;
    created_by: number;
    updated_by: number;
    created_at: string;
    updated_at: string;
    is_deleted: boolean;
}

export const listProducts = async (): Promise<ApiResponse<Product[]>> => {
    const resp = await apiRequest<Product[]>('/products', { method: 'GET' });
    if (resp.status === 200 && Array.isArray(resp.data)) {
        return resp;
    }
    return { ...resp, data: [] };
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
    client_id: number;
    client_name: string;
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