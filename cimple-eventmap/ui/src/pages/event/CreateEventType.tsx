import { useState } from 'react';
import { useNavigate } from 'react-router';
import { eventTypesApi } from '../../lib/eventTypesApi';
import { Save, X } from 'lucide-react';
import { BASE_PATH } from '../../lib/base';

const CreateEventType = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        event_type: 'e',
        icon: '',
        color: '#3B82F6',
    });
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            if (!formData.name.trim()) {
                setError('Name is required');
                setLoading(false);
                return;
            }

            if (!formData.icon.trim()) {
                setError('Icon is required (e.g., fa-circle, fa-exclamation-triangle)');
                setLoading(false);
                return;
            }

            // Normalize icon format: ensure it starts with 'fa-'
            const normalizedIcon = formData.icon.startsWith('fa-') ? formData.icon : `fa-${formData.icon}`;
            
            await eventTypesApi.create({
                name: formData.name,
                event_type: formData.event_type,
                icon: normalizedIcon,
                color: formData.color,
            });

            setSuccess(true);
            setTimeout(() => {
                navigate(`${BASE_PATH}events`);
            }, 1500);
        } catch (err: any) {
            setError(err.message || 'Failed to create event type');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Create New Event Type</h1>
                <button
                    onClick={() => navigate(`${BASE_PATH}events`)}
                    className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <X className="w-4 h-4" />
                    Cancel
                </button>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                    {error}
                </div>
            )}

            {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg">
                    Event type created successfully! Redirecting...
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                        Name *
                    </label>
                    <input
                        type="text"
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., Accident, Alert, Incident"
                        required
                    />
                </div>

                <div>
                    <label htmlFor="event_type" className="block text-sm font-medium text-gray-700 mb-2">
                        Event Type Code
                    </label>
                    <input
                        type="text"
                        id="event_type"
                        value={formData.event_type}
                        onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., e, a, i"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        Short code for the event type (default: 'e')
                    </p>
                </div>

                <div>
                    <label htmlFor="icon" className="block text-sm font-medium text-gray-700 mb-2">
                        FontAwesome Icon *
                    </label>
                    <input
                        type="text"
                        id="icon"
                        value={formData.icon}
                        onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., fa-circle, fa-exclamation-triangle, fa-map-marker-alt"
                        required
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        FontAwesome icon class name (e.g., 'fa-circle' or 'circle' - both formats accepted)
                    </p>
                    {formData.icon && (
                        <div className="mt-2 flex items-center gap-2">
                            <span className="text-sm text-gray-600">Preview:</span>
                            <i className={`fa ${formData.icon.startsWith('fa-') ? formData.icon : `fa-${formData.icon}`} text-2xl`} style={{ color: formData.color }}></i>
                        </div>
                    )}
                </div>

                <div>
                    <label htmlFor="color" className="block text-sm font-medium text-gray-700 mb-2">
                        Color
                    </label>
                    <div className="flex items-center gap-4">
                        <input
                            type="color"
                            id="color"
                            value={formData.color}
                            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                            className="w-20 h-10 border border-gray-300 rounded-lg cursor-pointer"
                        />
                        <input
                            type="text"
                            value={formData.color}
                            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="#3B82F6"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                    <button
                        type="button"
                        onClick={() => navigate(`${BASE_PATH}events`)}
                        className="px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Save className="w-4 h-4" />
                        {loading ? 'Creating...' : 'Create Event Type'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreateEventType;
