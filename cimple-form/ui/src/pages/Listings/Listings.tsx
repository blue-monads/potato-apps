import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import type { Form } from '../Builder/sub/ftype';
import { 
    PlusIcon, 
    TrashIcon, 
    EditIcon, 
    FileTextIcon,
    XIcon
} from 'lucide-react';
import api from '../../lib/api';
import { basePath } from '../../lib/base';

const Listings = () => {
    const navigate = useNavigate();
    const [forms, setForms] = useState<Form[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingForm, setEditingForm] = useState<Form | null>(null);
    const [formName, setFormName] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formStatus, setFormStatus] = useState<'draft' | 'published' | 'archived'>('draft');
    const [saving, setSaving] = useState(false);

    const loadForms = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await api.getForms();
            setForms(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load forms');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadForms();
    }, []);

    const handleDelete = async (formId: number) => {
        if (!confirm('Are you sure you want to delete this form?')) {
            return;
        }

        try {
            setDeletingId(formId);
            await api.deleteForm(formId);
            await loadForms();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete form');
        } finally {
            setDeletingId(null);
        }
    };

    const openCreateModal = () => {
        setEditingForm(null);
        setFormName('');
        setFormDescription('');
        setFormStatus('draft');
        setShowModal(true);
    };

    const openEditModal = (form: Form) => {
        setEditingForm(form);
        setFormName(form.name);
        setFormDescription(form.description);
        setFormStatus(form.status);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingForm(null);
        setFormName('');
        setFormDescription('');
        setFormStatus('draft');
    };

    const handleSaveForm = async () => {
        try {
            setSaving(true);
            setError(null);

            if (editingForm) {
                // Update existing form
                await api.updateForm(editingForm.id, {
                    name: formName,
                    description: formDescription,
                    status: formStatus,
                });
            } else {
                // Create new form
                const { id } = await api.createForm({
                    name: formName,
                    description: formDescription,
                    status: formStatus,
                });
                // Navigate to builder with new form
                closeModal();
                navigate(`${basePath}forms/${id}`);
                return;
            }

            closeModal();
            await loadForms();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save form');
        } finally {
            setSaving(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'published':
                return 'bg-green-100 text-green-800';
            case 'draft':
                return 'bg-gray-100 text-gray-800';
            case 'archived':
                return 'bg-yellow-100 text-yellow-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="flex flex-col min-h-screen">
            <div className="bg-white border-b border-gray-200 py-4 px-6 flex shadow-sm justify-between items-center">
                <div className="flex items-center gap-3">
                    <FileTextIcon className="w-6 h-6 text-gray-600" />
                    <h1 className="text-2xl font-bold text-gray-800">Forms</h1>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md"
                >
                    <PlusIcon className="w-5 h-5" />
                    New Form
                </button>
            </div>

            <main className="flex-1 overflow-auto p-6 bg-gray-50">
                {loading && (
                    <div className="flex items-center justify-center py-12">
                        <div className="text-gray-500">Loading forms...</div>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                        {error}
                    </div>
                )}

                {!loading && !error && forms.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                        <FileTextIcon className="w-16 h-16 mb-4 opacity-50" />
                        <p className="text-lg mb-2">No forms yet</p>
                        <p className="text-sm mb-4">Create your first form to get started</p>
                        <button
                            onClick={openCreateModal}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <PlusIcon className="w-5 h-5" />
                            Create Form
                        </button>
                    </div>
                )}

                {!loading && !error && forms.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {forms.map((form) => (
                            <div
                                key={form.id}
                                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-lg hover:border-blue-300 transition-all"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold text-gray-800 mb-1">
                                            {form.name || 'Untitled Form'}
                                        </h3>
                                        {form.description && (
                                            <p className="text-sm text-gray-600 line-clamp-2">
                                                {form.description}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mb-4">
                                    <span
                                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(form.status)}`}
                                    >
                                        {form.status}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => openEditModal(form)}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors text-sm font-medium shadow-sm hover:shadow-md"
                                    >
                                        <EditIcon className="w-4 h-4" />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => navigate(`${basePath}forms/${form.id}`)}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-50 text-green-600 rounded-md hover:bg-green-100 transition-colors text-sm font-medium shadow-sm hover:shadow-md"
                                    >
                                        <FileTextIcon className="w-4 h-4" />
                                        Build
                                    </button>
                                    <button
                                        onClick={() => handleDelete(form.id)}
                                        disabled={deletingId === form.id}
                                        className="flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors text-sm font-medium disabled:opacity-50 shadow-sm hover:shadow-md"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                        {deletingId === form.id ? 'Deleting...' : 'Delete'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Form Modal */}
            {showModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            closeModal();
                        }
                    }}
                >
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-gray-800">
                                {editingForm ? 'Edit Form' : 'Create New Form'}
                            </h2>
                            <button
                                onClick={closeModal}
                                className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex flex-col gap-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">
                                    Form Name
                                </label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                                    placeholder="Enter form name"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">
                                    Description
                                </label>
                                <textarea
                                    value={formDescription}
                                    onChange={(e) => setFormDescription(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                                    rows={3}
                                    placeholder="Enter form description"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">
                                    Status
                                </label>
                                <select
                                    value={formStatus}
                                    onChange={(e) => setFormStatus(e.target.value as 'draft' | 'published' | 'archived')}
                                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                                >
                                    <option value="draft">Draft</option>
                                    <option value="published">Published</option>
                                    <option value="archived">Archived</option>
                                </select>
                            </div>

                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="flex items-center gap-2 justify-end">
                                <button
                                    onClick={closeModal}
                                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveForm}
                                    disabled={saving || !formName.trim()}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {saving ? 'Saving...' : editingForm ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Listings;