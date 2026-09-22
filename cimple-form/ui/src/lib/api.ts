import type { Form, FormField, FormSection, FormSubmission } from '../pages/Builder/sub/ftype';

const API_BASE = '/zz/api/space/cimple-form';

// Get auth token from libspace.js
const getAuthToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    return (window as any).spaceGetToken?.('cimple-form') || null;
};

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
    const token = getAuthToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options?.headers as Record<string, string> || {}),
    };

    if (token) {
        headers['Authorization'] = token;
    }

    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
}

const getForms = async (): Promise<Form[]> => {
    return apiRequest<Form[]>('/api/forms');
}

const getForm = async (formId: number): Promise<{ form: Form; sections: FormSection[]; fields: FormField[] }> => {
    return apiRequest<{ form: Form; sections: FormSection[]; fields: FormField[] }>(`/api/form?form_id=${formId}`);
}

const getPublicForm = async (formId: number): Promise<{ form: Form; sections: FormSection[]; fields: FormField[] }> => {
    return apiRequest<{ form: Form; sections: FormSection[]; fields: FormField[] }>(`/api/public/form?form_id=${formId}`);
}

const createForm = async (form: Omit<Form, 'id'>): Promise<{ id: number }> => {
    return apiRequest<{ id: number }>('/api/form/create', {
        method: 'POST',
        body: JSON.stringify(form),
    });
}

const updateForm = async (formId: number, form: Partial<Form>): Promise<void> => {
    await apiRequest(`/api/form/update?form_id=${formId}`, {
        method: 'PUT',
        body: JSON.stringify(form),
    });
}

const deleteForm = async (formId: number): Promise<void> => {
    await apiRequest(`/api/form/delete?form_id=${formId}`, {
        method: 'DELETE',
    });
}

const bulkUpsertSections = async (sections: FormSection[]): Promise<{ results: Array<{ id: number; action: string }> }> => {
    return apiRequest<{ results: Array<{ id: number; action: string }> }>('/api/sections/bulk_upsert', {
        method: 'POST',
        body: JSON.stringify({ sections }),
    });
}

const bulkUpsertFields = async (fields: FormField[]): Promise<{ results: Array<{ id: number; action: string }> }> => {
    return apiRequest<{ results: Array<{ id: number; action: string }> }>('/api/fields/bulk_upsert', {
        method: 'POST',
        body: JSON.stringify({ fields }),
    });
}

const deleteSection = async (sectionId: number): Promise<void> => {
    await apiRequest(`/api/section/delete?section_id=${sectionId}`, {
        method: 'DELETE',
    });
}

const deleteField = async (fieldId: number): Promise<void> => {
    await apiRequest(`/api/field/delete?field_id=${fieldId}`, {
        method: 'DELETE',
    });
}

const getSubmissions = async (formId?: number): Promise<FormSubmission[]> => {
    const query = formId ? `?form_id=${formId}` : '';
    return apiRequest<FormSubmission[]>(`/api/submissions${query}`);
}

const addSubmission = async (sub: {
    form_id: number;
    data: Record<string, any>;
    status?: string;
    response_messages?: string;
    extrameta?: Record<string, any>;
}): Promise<{ id: number }> => {
    return apiRequest<{ id: number }>('/api/form/submit', {
        method: 'POST',
        body: JSON.stringify(sub),
    });
}

const clearSubmissions = async (formId: number): Promise<void> => {
    await apiRequest(`/api/submissions/clear?form_id=${formId}`, {
        method: 'DELETE',
    });
}

const deleteSubmission = async (submissionId: number): Promise<void> => {
    await apiRequest(`/api/submission?id=${submissionId}`, {
        method: 'DELETE',
    });
}

export default {
    getForms,
    getForm,
    getPublicForm,
    createForm,
    updateForm,
    deleteForm,
    bulkUpsertSections,
    bulkUpsertFields,
    deleteSection,
    deleteField,
    getSubmissions,
    addSubmission,
    clearSubmissions,
    deleteSubmission,
}