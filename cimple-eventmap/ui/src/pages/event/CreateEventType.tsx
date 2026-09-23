import { useState } from 'react';
import { useNavigate } from 'react-router';
import { eventTypesApi } from '../../lib/eventTypesApi';
import { ArrowLeft, Tag, Sparkles, Check, AlertCircle } from 'lucide-react';
import { BASE_PATH } from '../../lib/base';
import { Header } from '../../components/Header';

const POPULAR_ICONS = [
    { icon: 'fa-location-dot', name: 'Pin' },
    { icon: 'fa-calendar', name: 'Calendar' },
    { icon: 'fa-flag', name: 'Flag' },
    { icon: 'fa-fire', name: 'Trending' },
    { icon: 'fa-triangle-exclamation', name: 'Alert' },
    { icon: 'fa-music', name: 'Music' },
    { icon: 'fa-champagne-glasses', name: 'Party' },
    { icon: 'fa-utensils', name: 'Dining' },
    { icon: 'fa-mug-hot', name: 'Coffee' },
    { icon: 'fa-basket-shopping', name: 'Market' },
    { icon: 'fa-car', name: 'Traffic' },
    { icon: 'fa-bicycle', name: 'Cycling' },
    { icon: 'fa-person-running', name: 'Sports' },
    { icon: 'fa-landmark', name: 'Landmark' },
    { icon: 'fa-graduation-cap', name: 'Education' },
    { icon: 'fa-hospital', name: 'Medical' },
    { icon: 'fa-paw', name: 'Pets' },
    { icon: 'fa-star', name: 'Featured' },
    { icon: 'fa-heart', name: 'Charity' },
    { icon: 'fa-bullhorn', name: 'Announcement' },
    { icon: 'fa-camera', name: 'Photography' },
    { icon: 'fa-tree', name: 'Nature' },
    { icon: 'fa-bolt', name: 'Energy' },
    { icon: 'fa-cloud-sun', name: 'Weather' },
];

const PRESET_COLORS = [
    { name: 'Indigo', hex: '#6366f1' },
    { name: 'Violet', hex: '#8b5cf6' },
    { name: 'Rose', hex: '#f43f5e' },
    { name: 'Amber', hex: '#f59e0b' },
    { name: 'Emerald', hex: '#10b981' },
    { name: 'Teal', hex: '#14b8a6' },
    { name: 'Cyan', hex: '#06b6d4' },
    { name: 'Sky', hex: '#0ea5e9' },
    { name: 'Fuchsia', hex: '#d946ef' },
    { name: 'Pink', hex: '#ec4899' },
];

const CreateEventType = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        event_type: 'e',
        icon: 'fa-location-dot',
        color: '#6366f1',
    });
    const [customIcon, setCustomIcon] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const activeIcon = customIcon.trim() 
        ? (customIcon.startsWith('fa-') ? customIcon : `fa-${customIcon}`)
        : formData.icon;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            if (!formData.name.trim()) {
                setError('Category name is required');
                setLoading(false);
                return;
            }

            if (!activeIcon.trim()) {
                setError('Icon is required');
                setLoading(false);
                return;
            }

            const normalizedIcon = activeIcon.startsWith('fa-') ? activeIcon : `fa-${activeIcon}`;
            
            await eventTypesApi.create({
                name: formData.name.trim(),
                event_type: formData.event_type || 'e',
                icon: normalizedIcon,
                color: formData.color || '#6366f1',
            });

            setSuccess(true);
            setTimeout(() => {
                navigate(`${BASE_PATH}events`);
            }, 1000);
        } catch (err: any) {
            setError(err.message || 'Failed to create event type');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen w-full flex flex-col bg-[#f7f8fa] text-gray-900 overflow-hidden font-sans">
            <Header />

            <div className="flex-1 overflow-y-auto p-4 md:p-8 flex items-center justify-center">
                <div className="max-w-3xl w-full grid grid-cols-1 md:grid-cols-5 gap-5">
                    {/* Left Form Card */}
                    <div className="md:col-span-3 bg-white border border-gray-200 rounded-xl p-5 shadow-xs flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                                    <Tag className="w-4 h-4" />
                                </div>
                                <div>
                                    <h1 className="text-sm font-bold text-gray-900 tracking-tight">Create Event Category</h1>
                                    <p className="text-xs text-gray-500">Design icon badges for your event feed</p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => navigate(`${BASE_PATH}events`)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium border border-gray-200 shadow-2xs transition-colors cursor-pointer"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                <span>Back</span>
                            </button>
                        </div>

                        {error && (
                            <div className="mb-3.5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                                <span>{error}</span>
                            </div>
                        )}

                        {success && (
                            <div className="mb-3.5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                                <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                                <span>Category created! Redirecting to events...</span>
                            </div>
                        )}

                        <form id="category-form" onSubmit={handleSubmit} className="space-y-4 flex-1">
                            {/* Category Name */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                    Category Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="e.g. Music Festival, Tech Conference, Flash Sale"
                                    required
                                />
                            </div>

                            {/* Color Palette */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                    Color Theme
                                </label>
                                <div className="flex flex-wrap items-center gap-2">
                                    {PRESET_COLORS.map((c) => (
                                        <button
                                            key={c.hex}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, color: c.hex })}
                                            className={`w-7 h-7 rounded-full border-2 transition-all cursor-pointer flex items-center justify-center ${
                                                formData.color === c.hex
                                                    ? 'border-gray-800 scale-110 shadow-xs'
                                                    : 'border-transparent hover:scale-105'
                                            }`}
                                            style={{ backgroundColor: c.hex }}
                                            title={c.name}
                                        >
                                            {formData.color === c.hex && (
                                                <Check className="w-3.5 h-3.5 text-white" />
                                            )}
                                        </button>
                                    ))}
                                    <input
                                        type="color"
                                        value={formData.color}
                                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                        className="w-7 h-7 rounded-full overflow-hidden border border-gray-300 cursor-pointer bg-transparent"
                                        title="Custom Color"
                                    />
                                </div>
                            </div>

                            {/* Icon Picker Grid */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                    Choose Icon
                                </label>
                                <div className="grid grid-cols-6 gap-1.5 max-h-40 overflow-y-auto p-1.5 bg-gray-50 rounded-lg border border-gray-200">
                                    {POPULAR_ICONS.map((item) => {
                                        const isSelected = activeIcon === item.icon;
                                        return (
                                            <button
                                                key={item.icon}
                                                type="button"
                                                onClick={() => {
                                                    setFormData({ ...formData, icon: item.icon });
                                                    setCustomIcon('');
                                                }}
                                                className={`p-2 rounded-md flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold'
                                                        : 'hover:bg-gray-200/60 text-gray-600 hover:text-gray-900 border border-transparent'
                                                }`}
                                                title={item.name}
                                            >
                                                <i className={`fa ${item.icon} text-sm`}></i>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="mt-2">
                                    <input
                                        type="text"
                                        value={customIcon}
                                        onChange={(e) => setCustomIcon(e.target.value)}
                                        className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        placeholder="Or type custom FontAwesome icon (e.g. fa-rocket)"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full mt-2 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-2xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                            >
                                {loading ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <Sparkles className="w-3.5 h-3.5" />
                                        <span>Create Category</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* Right Live Preview Card */}
                    <div className="md:col-span-2 flex flex-col gap-4">
                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs flex flex-col items-center justify-center text-center">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3.5 self-start">
                                Real-Time Preview
                            </h3>

                            {/* Badge Preview */}
                            <div className="p-5 rounded-xl bg-gray-50 border border-gray-200 w-full flex flex-col items-center justify-center mb-4">
                                <div
                                    className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl shadow-md transition-all duration-300 transform hover:scale-105"
                                    style={{ 
                                        backgroundColor: formData.color,
                                    }}
                                >
                                    <i className={`fa ${activeIcon}`}></i>
                                </div>

                                <h4 className="font-bold text-sm text-gray-900 mt-3 truncate max-w-[200px]">
                                    {formData.name.trim() || 'Category Name'}
                                </h4>

                                <div className="mt-1 flex items-center gap-1.5">
                                    <span 
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: formData.color }}
                                    ></span>
                                    <span className="text-[11px] font-mono text-gray-500 uppercase">
                                        {formData.color}
                                    </span>
                                </div>
                            </div>

                            {/* Map Pin Preview */}
                            <div className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-left">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 block mb-2">
                                    Map Marker Appearance
                                </span>

                                <div className="flex items-center gap-3">
                                    <div 
                                        className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm shrink-0"
                                        style={{ border: `3px solid ${formData.color}` }}
                                    >
                                        <i className={`fa ${activeIcon}`} style={{ color: formData.color, fontSize: '13px' }}></i>
                                    </div>

                                    <div className="text-xs text-gray-600">
                                        Rendered with white base and {formData.color} halo border.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateEventType;
