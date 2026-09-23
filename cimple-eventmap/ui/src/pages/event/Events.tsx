import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { 
    Plus, 
    Calendar, 
    Tag, 
    Search, 
    MapPin, 
    Image as ImageIcon, 
    Trash2, 
    Compass,
    Grid,
    List
} from 'lucide-react';
import { BASE_PATH } from '../../lib/base';
import { eventsApi, type Event } from '../../lib/eventsApi';
import { eventTypesApi, type EventType } from '../../lib/eventTypesApi';
import { Header } from '../../components/Header';

type TabType = 'events' | 'event-types';

const Events = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabType>('events');
    const [events, setEvents] = useState<Event[]>([]);
    const [eventTypes, setEventTypes] = useState<EventType[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [deletingId, setDeletingId] = useState<number | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [evts, types] = await Promise.all([
                eventsApi.query().catch(() => []),
                eventTypesApi.list().catch(() => []),
            ]);
            setEvents(Array.isArray(evts) ? evts : []);
            setEventTypes(Array.isArray(types) ? types : []);
        } catch (err) {
            console.error('Failed to load events data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteEvent = async (id: number) => {
        if (!confirm('Are you sure you want to delete this event?')) return;
        try {
            setDeletingId(id);
            await eventsApi.delete(id);
            setEvents((prev) => prev.filter((e) => e.id !== id));
        } catch (err) {
            console.error('Failed to delete event:', err);
            alert('Failed to delete event');
        } finally {
            setDeletingId(null);
        }
    };

    const handleDeleteType = async (id: number) => {
        if (!confirm('Delete this event type? Events using it may lose their categorization.')) return;
        try {
            await eventTypesApi.delete(id);
            setEventTypes((prev) => prev.filter((t) => t.id !== id));
        } catch (err) {
            console.error('Failed to delete event type:', err);
            alert('Failed to delete event type');
        }
    };

    const filteredEvents = useMemo(() => {
        return events.filter((e) => {
            const matchesSearch = 
                e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                e.info.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesType = selectedTypeId === null || e.event_type_id === selectedTypeId;
            return matchesSearch && matchesType;
        });
    }, [events, searchQuery, selectedTypeId]);

    const geotaggedCount = events.filter((e) => e.lat !== 0 && e.lng !== 0).length;

    return (
        <div className="h-screen w-full flex flex-col bg-[#f7f8fa] text-gray-900 overflow-hidden font-sans">
            <Header />

            {/* Subheader & Stats Bar */}
            <div className="border-b border-gray-200 bg-white px-6 py-3.5 shrink-0 shadow-2xs">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                                <Calendar className="w-4 h-4" />
                            </div>
                            <div>
                                <h1 className="text-sm font-bold text-gray-900 tracking-tight">Events Hub</h1>
                                <p className="text-xs text-gray-500">Manage broadcasts, live feeds, and event categories</p>
                            </div>
                        </div>
                    </div>

                    {/* Stats pills */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 flex items-center gap-2">
                            <span className="text-xs text-gray-500">Total Events:</span>
                            <span className="text-xs font-bold text-gray-900">{events.length}</span>
                        </div>
                        <div className="px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 flex items-center gap-2">
                            <span className="text-xs text-gray-500">Geotagged:</span>
                            <span className="text-xs font-bold text-emerald-600">{geotaggedCount}</span>
                        </div>
                        <div className="px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 flex items-center gap-2">
                            <span className="text-xs text-gray-500">Categories:</span>
                            <span className="text-xs font-bold text-indigo-600">{eventTypes.length}</span>
                        </div>

                        <button
                            onClick={() => navigate(
                                activeTab === 'events' 
                                    ? `${BASE_PATH}create-event` 
                                    : `${BASE_PATH}create-event-type`
                            )}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{activeTab === 'events' ? 'Publish Event' : 'New Category'}</span>
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="max-w-7xl mx-auto flex items-center justify-between mt-3 border-t border-gray-100 pt-2.5">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setActiveTab('events')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                activeTab === 'events'
                                    ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 shadow-2xs font-semibold'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                            }`}
                        >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Events Feed</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'events' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-600'}`}>
                                {events.length}
                            </span>
                        </button>

                        <button
                            onClick={() => setActiveTab('event-types')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                activeTab === 'event-types'
                                    ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 shadow-2xs font-semibold'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                            }`}
                        >
                            <Tag className="w-3.5 h-3.5" />
                            <span>Categories & Types</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'event-types' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-600'}`}>
                                {eventTypes.length}
                            </span>
                        </button>
                    </div>

                    {activeTab === 'events' && (
                        <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-1.5 rounded-md text-xs transition-colors ${viewMode === 'grid' ? 'bg-white shadow-2xs text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                                title="Grid View"
                            >
                                <Grid className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded-md text-xs transition-colors ${viewMode === 'list' ? 'bg-white shadow-2xs text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                                title="List View"
                            >
                                <List className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-6 max-w-7xl mx-auto w-full">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-600 rounded-full animate-spin mb-3"></div>
                        <p className="text-xs">Loading events...</p>
                    </div>
                ) : activeTab === 'events' ? (
                    <div className="space-y-4">
                        {/* Filters Bar */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            {/* Search */}
                            <div className="relative flex-1 max-w-md">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by title or description..."
                                    className="w-full pl-9 pr-3.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                />
                            </div>

                            {/* Category Filter Pills */}
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                                <button
                                    onClick={() => setSelectedTypeId(null)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                                        selectedTypeId === null
                                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold'
                                            : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    All Types ({events.length})
                                </button>
                                {eventTypes.map((t) => {
                                    const isSelected = selectedTypeId === t.id;
                                    const count = events.filter((e) => e.event_type_id === t.id).length;
                                    return (
                                        <button
                                            key={t.id}
                                            onClick={() => setSelectedTypeId(isSelected ? null : t.id)}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                                                isSelected
                                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold'
                                                    : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50'
                                            }`}
                                        >
                                            <span 
                                                className="w-2 h-2 rounded-full"
                                                style={{ backgroundColor: t.color || '#6366f1' }}
                                            ></span>
                                            <span>{t.name}</span>
                                            <span className="text-[10px] text-gray-400">({count})</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Events Grid / List */}
                        {filteredEvents.length === 0 ? (
                            <div className="py-20 text-center bg-white border border-dashed border-gray-300 rounded-xl">
                                <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
                                    <Calendar className="w-6 h-6" />
                                </div>
                                <h3 className="text-sm font-bold text-gray-800 mb-1">No events found</h3>
                                <p className="text-xs text-gray-500 mb-4 max-w-sm mx-auto">
                                    {searchQuery || selectedTypeId !== null
                                        ? 'No events match your search or category filters.'
                                        : 'Broadcast your first geotagged event on the map.'}
                                </p>
                                <button
                                    onClick={() => navigate(`${BASE_PATH}create-event`)}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer"
                                >
                                    Publish Event
                                </button>
                            </div>
                        ) : (
                            <div className={
                                viewMode === 'grid'
                                    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                                    : 'space-y-2.5'
                            }>
                                {filteredEvents.map((event) => {
                                    const type = eventTypes.find((t) => t.id === event.event_type_id);
                                    const iconClass = type?.icon
                                        ? (type.icon.startsWith('fa-') ? type.icon : `fa-${type.icon}`)
                                        : 'fa-calendar';
                                    const color = type?.color || '#6366f1';
                                    const hasCoords = event.lat !== 0 && event.lng !== 0;

                                    return (
                                        <div
                                            key={event.id}
                                            className="bg-white border border-gray-200 hover:border-gray-300 hover:shadow-xs rounded-xl p-4 transition-all flex flex-col justify-between group"
                                        >
                                            <div>
                                                {/* Header row */}
                                                <div className="flex items-center justify-between gap-2 mb-2">
                                                    <div className="flex items-center gap-2 truncate">
                                                        <div
                                                            className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[10px] shrink-0 shadow-2xs"
                                                            style={{ backgroundColor: color }}
                                                        >
                                                            <i className={`fa ${iconClass}`}></i>
                                                        </div>
                                                        <span className="text-xs font-semibold text-gray-700 truncate">
                                                            {type?.name || 'General Event'}
                                                        </span>
                                                    </div>

                                                    <span className="text-[10px] text-gray-400 shrink-0">
                                                        {new Date(event.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>

                                                {/* Title */}
                                                <h3 className="font-bold text-sm text-gray-900 group-hover:text-indigo-600 transition-colors mb-1 line-clamp-1">
                                                    {event.title || 'Untitled Event'}
                                                </h3>

                                                {/* Info */}
                                                <p className="text-xs text-gray-600 line-clamp-2 mb-3">
                                                    {event.info || 'No description provided.'}
                                                </p>

                                                {/* Images Collage or Thumbnail */}
                                                {event.images && event.images.length > 0 && (
                                                    <div className="flex items-center gap-1.5 mb-3 text-[11px] text-indigo-600 font-medium">
                                                        <ImageIcon className="w-3.5 h-3.5" />
                                                        <span>{event.images.length} attachment{event.images.length === 1 ? '' : 's'}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Bottom row */}
                                            <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
                                                {hasCoords ? (
                                                    <div className="text-[10px] text-gray-500 font-mono flex items-center gap-1 truncate">
                                                        <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                                                        <span>{event.lat.toFixed(4)}, {event.lng.toFixed(4)}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-gray-400">No location</span>
                                                )}

                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <button
                                                        onClick={() => navigate(`${BASE_PATH}maps`)}
                                                        className="px-2 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-medium border border-indigo-200 flex items-center gap-1 transition-colors cursor-pointer"
                                                        title="View on Map"
                                                    >
                                                        <Compass className="w-3 h-3" />
                                                        <span>Map</span>
                                                    </button>

                                                    <button
                                                        onClick={() => handleDeleteEvent(event.id)}
                                                        disabled={deletingId === event.id}
                                                        className="p-1 rounded-md text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                                        title="Delete Event"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : (
                    /* Event Types Tab */
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-sm font-bold text-gray-900">Category Catalog</h2>
                                <p className="text-xs text-gray-500">Configure visual badges for events</p>
                            </div>

                            <button
                                onClick={() => navigate(`${BASE_PATH}create-event-type`)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Category</span>
                            </button>
                        </div>

                        {eventTypes.length === 0 ? (
                            <div className="py-16 text-center bg-white border border-dashed border-gray-300 rounded-xl">
                                <Tag className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                <p className="text-xs text-gray-500">No categories created yet.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {eventTypes.map((type) => {
                                    const iconClass = type.icon
                                        ? (type.icon.startsWith('fa-') ? type.icon : `fa-${type.icon}`)
                                        : 'fa-calendar';
                                    const count = events.filter((e) => e.event_type_id === type.id).length;

                                    return (
                                        <div
                                            key={type.id}
                                            className="bg-white border border-gray-200 hover:border-gray-300 rounded-xl p-4 shadow-xs transition-all flex flex-col justify-between"
                                        >
                                            <div className="flex items-start justify-between gap-3 mb-3">
                                                <div
                                                    className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm shadow-xs"
                                                    style={{ backgroundColor: type.color || '#6366f1' }}
                                                >
                                                    <i className={`fa ${iconClass}`}></i>
                                                </div>

                                                <button
                                                    onClick={() => handleDeleteType(type.id)}
                                                    className="p-1 rounded-md text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                                    title="Delete Category"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>

                                            <div>
                                                <h3 className="font-bold text-sm text-gray-900 mb-0.5 truncate">
                                                    {type.name}
                                                </h3>
                                                <div className="flex items-center justify-between text-xs text-gray-500">
                                                    <span>{count} event{count === 1 ? '' : 's'}</span>
                                                    <span className="font-mono text-[10px] uppercase text-gray-400">
                                                        {type.color}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Events;
