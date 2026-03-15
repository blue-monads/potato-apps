import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Calendar, Tag } from 'lucide-react';
import { BASE_PATH } from '../../lib/base';
import EventsList from '../../components/EventsList';
import EventTypesList from '../../components/EventTypesList';

type TabType = 'events' | 'event-types';

const Events = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabType>('events');
    
    return (
        <div className="h-screen w-full flex flex-col">
            <div className="p-6 border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Calendar className="w-6 h-6 text-gray-700" />
                        <h1 className="text-2xl font-bold text-gray-900">Events</h1>
                    </div>
                    <button
                        onClick={() => navigate(
                            activeTab === 'events' 
                                ? `${BASE_PATH}create-event`
                                : `${BASE_PATH}create-event-type`
                        )}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        {activeTab === 'events' ? 'New Event' : 'New Event Type'}
                    </button>
                </div>
                
                {/* Tab Navigation */}
                <div className="flex gap-1 border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('events')}
                        className={`px-4 py-2 font-medium text-sm transition-colors relative ${
                            activeTab === 'events'
                                ? 'text-blue-600'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>Events</span>
                        </div>
                        {activeTab === 'events' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('event-types')}
                        className={`px-4 py-2 font-medium text-sm transition-colors relative ${
                            activeTab === 'event-types'
                                ? 'text-blue-600'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <Tag className="w-4 h-4" />
                            <span>Event Types</span>
                        </div>
                        {activeTab === 'event-types' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                        )}
                    </button>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
                {activeTab === 'events' ? (
                    <EventsList
                        showHeader={false}
                        showCreateButton={false}
                        className="p-6"
                    />
                ) : (
                    <EventTypesList
                        showHeader={false}
                        showCreateButton={false}
                        className="p-6"
                    />
                )}
            </div>
        </div>
    );
};

export default Events;
