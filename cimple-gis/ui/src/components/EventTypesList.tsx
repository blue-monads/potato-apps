import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { eventTypesApi, type EventType } from '../lib/eventTypesApi';
import { Plus, Clock, Tag } from 'lucide-react';
import { BASE_PATH } from '../lib/base';

interface EventTypesListProps {
    showHeader?: boolean;
    showCreateButton?: boolean;
    className?: string;
}

const EventTypesList = ({ 
    showHeader = true,
    showCreateButton = true,
    className = ''
}: EventTypesListProps) => {
    const navigate = useNavigate();
    const [eventTypes, setEventTypes] = useState<EventType[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadEventTypes();
    }, []);

    const loadEventTypes = async () => {
        try {
            setLoading(true);
            const types = await eventTypesApi.list();
            setEventTypes(types);
        } catch (error) {
            console.error('Failed to load event types:', error);
            setEventTypes([]);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString();
    };

    return (
        <div className={`flex flex-col h-full ${className}`}>
            {showHeader && (
                <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white">
                    <h2 className="text-xl font-semibold text-gray-800">Event Types</h2>
                    {showCreateButton && (
                        <button
                            onClick={() => navigate(`${BASE_PATH}create-event-type`)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            New
                        </button>
                    )}
                </div>
            )}
            
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="p-4 text-center text-gray-500">Loading event types...</div>
                ) : eventTypes.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                        {showCreateButton ? (
                            <>
                                <p className="mb-2">No event types yet</p>
                                <button
                                    onClick={() => navigate(`${BASE_PATH}create-event-type`)}
                                    className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    Create First Event Type
                                </button>
                            </>
                        ) : (
                            <p>No event types yet</p>
                        )}
                    </div>
                ) : (
                    <div className={showHeader ? "divide-y divide-gray-100" : "space-y-4 p-4"}>
                        {eventTypes.map((eventType) => {
                            return (
                                <div
                                    key={eventType.id}
                                    className={`${
                                        showHeader 
                                            ? `p-4 hover:bg-gray-50 transition-colors`
                                            : `bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow`
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <i 
                                            className={`fa ${eventType.icon.startsWith('fa-') ? eventType.icon : `fa-${eventType.icon}`} text-lg mt-0.5`}
                                            style={{ color: eventType.color || '#3B82F6' }}
                                        ></i>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className={`font-semibold text-gray-900 ${showHeader ? 'truncate' : 'text-lg'}`}>
                                                    {eventType.name || 'Unnamed Event Type'}
                                                </h3>
                                                {eventType.event_type && (
                                                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                                        {eventType.event_type}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                                <div className="flex items-center gap-1">
                                                    <Tag className="w-3 h-3" />
                                                    <span>Icon: {eventType.icon}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    <span>{formatDate(eventType.created_at)}</span>
                                                </div>
                                            </div>
                                            <div className="mt-2 flex items-center gap-2">
                                                <span className="text-xs text-gray-500">Color:</span>
                                                <div 
                                                    className="w-6 h-6 rounded border border-gray-300"
                                                    style={{ backgroundColor: eventType.color || '#3B82F6' }}
                                                ></div>
                                                <span className="text-xs text-gray-600">{eventType.color}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default EventTypesList;
