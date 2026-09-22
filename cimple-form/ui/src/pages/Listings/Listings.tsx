import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import type { Form } from '../Builder/sub/ftype';
import api from '../../lib/api';
import { basePath } from '../../lib/base';
import { ACCENTS } from '../Builder/sub/FormBuilder';

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
            const mapped = (Array.isArray(data) ? data : Object.values(data || {})).map((f: any) => {
                let accent = 'teal';
                if (f.extrameta) {
                    try {
                        const parsed = typeof f.extrameta === 'string' ? JSON.parse(f.extrameta) : f.extrameta;
                        if (parsed.accent) accent = parsed.accent;
                    } catch {}
                }
                return { ...f, accent };
            });
            setForms(mapped);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load forms');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadForms();
    }, []);

    const handleDelete = async (e: React.MouseEvent, formId: number) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this form? This cannot be undone.')) {
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

    const closeModal = () => {
        setShowModal(false);
        setEditingForm(null);
        setFormName('');
        setFormDescription('');
        setFormStatus('draft');
    };

    const handleSaveForm = async () => {
        if (!formName.trim()) {
            alert('Form name is required');
            return;
        }

        try {
            setSaving(true);
            setError(null);

            if (editingForm) {
                await api.updateForm(editingForm.id, {
                    name: formName,
                    description: formDescription,
                    status: formStatus,
                });
            } else {
                const { id } = await api.createForm({
                    name: formName,
                    description: formDescription,
                    status: formStatus,
                });
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

    return (
        <div className="flex flex-col min-h-screen bg-[var(--bg)]">
            <header className="bg-white border-b border-[#E1E3DB] py-3.5 px-8 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-[#2E6E52] text-white flex items-center justify-center text-sm shadow-sm">
                        <i className="fa-solid fa-file-lines"></i>
                    </span>
                    <div>
                        <h1 className="text-lg font-bold font-heading text-gray-900 tracking-tight">Simple Form</h1>
                    </div>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-3.5 py-1.5 bg-[#2E6E52] text-white rounded-lg hover:brightness-105 transition-all text-xs font-semibold shadow-sm"
                >
                    <i className="fa-solid fa-plus text-xs"></i>
                    <span>New Form</span>
                </button>
            </header>

            <main className="flex-1 overflow-auto p-8 max-w-6xl mx-auto w-full">
                <div className="mb-6 flex items-baseline justify-between">
                    <div>
                        <h2 className="text-2xl font-bold font-heading text-gray-900">All Forms</h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {forms.length} form{forms.length === 1 ? '' : 's'} created
                        </p>
                    </div>
                </div>

                {loading && (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                        <i className="fa-solid fa-circle-notch fa-spin text-2xl text-[#2E6E52]"></i>
                        <span className="text-xs font-medium">Loading your forms...</span>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm flex items-center gap-2">
                        <i className="fa-solid fa-circle-exclamation"></i>
                        <span>{error}</span>
                    </div>
                )}

                {!loading && !error && forms.length === 0 && (
                    <div className="bg-white border border-[#E1E3DB] rounded-2xl p-16 text-center flex flex-col items-center justify-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-[#EEF0EA] flex items-center justify-center text-gray-400 text-2xl mb-2">
                            <i className="fa-solid fa-file-lines"></i>
                        </div>
                        <h3 className="font-heading font-bold text-lg text-gray-900">No forms yet</h3>
                        <p className="text-xs text-gray-500 max-w-sm mb-4">
                            Create your first form — it only takes thirty seconds to start gathering responses.
                        </p>
                        <button
                            onClick={openCreateModal}
                            className="flex items-center gap-2 px-4 py-2 bg-[#2E6E52] text-white rounded-lg hover:brightness-105 transition-all text-xs font-bold shadow-sm"
                        >
                            <i className="fa-solid fa-plus"></i>
                            <span>Create a Form</span>
                        </button>
                    </div>
                )}

                {!loading && !error && forms.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {/* Existing forms */}
                        {forms.map((form) => {
                            const accentColor = ACCENTS[form.accent || 'teal']?.main || ACCENTS.teal.main;

                            return (
                                <div
                                    key={form.id}
                                    onClick={() => navigate(`${basePath}forms/${form.id}`)}
                                    className="bg-white rounded-xl border border-[#E1E3DB] p-5 hover:border-[#CBCEC3] hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                                >
                                    <div>
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span
                                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: accentColor }}
                                                ></span>
                                                <h3 className="font-heading font-bold text-base text-gray-900 truncate group-hover:text-[#2E6E52] transition-colors">
                                                    {form.name || 'Untitled Form'}
                                                </h3>
                                            </div>
                                            <button
                                                onClick={(e) => handleDelete(e, form.id)}
                                                disabled={deletingId === form.id}
                                                className="w-7 h-7 rounded-md text-gray-300 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                                                title="Delete form"
                                            >
                                                {deletingId === form.id ? (
                                                    <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                                                ) : (
                                                    <i className="fa-regular fa-trash-can text-xs"></i>
                                                )}
                                            </button>
                                        </div>

                                        <p className="text-xs text-gray-500 line-clamp-2 min-h-[32px] mb-4">
                                            {form.description || <span className="italic text-gray-300">No description provided</span>}
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between pt-3 border-t border-[#E1E3DB] text-[11px] text-gray-400 font-medium">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                            form.status === 'published'
                                                ? 'bg-green-50 text-green-700 border border-green-200'
                                                : 'bg-gray-100 text-gray-600 border border-gray-200'
                                        }`}>
                                            {form.status || 'draft'}
                                        </span>

                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`${basePath}forms/${form.id}?tab=responses`);
                                                }}
                                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FAFAF7] hover:bg-[#EEF0EA] border border-[#E1E3DB] text-gray-700 text-[11px] font-semibold transition-colors cursor-pointer"
                                                title="View Submissions"
                                            >
                                                <i className="fa-solid fa-inbox text-[10px] text-gray-500"></i>
                                                <span>Submissions</span>
                                            </button>

                                            <span className="flex items-center gap-1 text-gray-600 group-hover:text-[#2E6E52] font-semibold text-xs">
                                                <span>Build</span>
                                                <i className="fa-solid fa-arrow-right text-[10px]"></i>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* New form dashed card (placed last) */}
                        <button
                            onClick={openCreateModal}
                            className="border-2 border-dashed border-[#CBCEC3] hover:border-[#2E6E52] rounded-xl p-6 flex flex-col items-center justify-center gap-2.5 text-gray-400 hover:text-[#2E6E52] hover:bg-[#E1EFE7]/40 transition-all min-h-[160px] group cursor-pointer"
                        >
                            <div className="w-10 h-10 rounded-full bg-white border border-[#CBCEC3] group-hover:border-[#2E6E52] flex items-center justify-center text-sm shadow-sm transition-colors">
                                <i className="fa-solid fa-plus"></i>
                            </div>
                            <span className="font-heading font-semibold text-sm">New form</span>
                        </button>
                    </div>
                )}
            </main>

            {/* Create Form Modal */}
            {showModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            closeModal();
                        }
                    }}
                >
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-[#E1E3DB] animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="font-heading text-lg font-bold text-gray-900">
                                Create New Form
                            </h2>
                            <button
                                onClick={closeModal}
                                className="w-7 h-7 rounded-md hover:bg-[#EEF0EA] text-gray-400 hover:text-gray-900 flex items-center justify-center transition-colors"
                            >
                                <i className="fa-solid fa-xmark text-xs"></i>
                            </button>
                        </div>

                        <div className="flex flex-col gap-4">
                            <div>
                                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                                    Form Name
                                </label>
                                <input
                                    type="text"
                                    className="w-full text-xs p-2.5 border border-[#CBCEC3] rounded-lg focus:border-[#2E6E52] outline-none transition-colors"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="e.g. Autumn Meetup RSVP"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveForm();
                                    }}
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                                    Description (optional)
                                </label>
                                <textarea
                                    className="w-full text-xs p-2.5 border border-[#CBCEC3] rounded-lg focus:border-[#2E6E52] outline-none resize-none transition-colors"
                                    rows={3}
                                    value={formDescription}
                                    onChange={(e) => setFormDescription(e.target.value)}
                                    placeholder="Brief description of what this form is for..."
                                />
                            </div>

                            <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E1E3DB]">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-[#EEF0EA] rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveForm}
                                    disabled={saving}
                                    className="px-5 py-2 bg-[#2E6E52] hover:brightness-105 text-white rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-50 flex items-center gap-2"
                                >
                                    {saving && <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>}
                                    <span>Create & Open</span>
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