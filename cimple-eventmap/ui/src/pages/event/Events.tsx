import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Calendar, Tag } from 'lucide-react';
import { BASE_PATH } from '../../lib/base';
import EventsList from '../../components/EventList/EventsList';
import EventTypesList from '../../components/EventTypesList';
import { Header } from '../../components/Header';

type TabType = 'events' | 'event-types';

const Events = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabType>('events');
    
    return (
        <div className="h-screen w-full flex flex-col bg-slate-50">
            <Header />
            <div className="p-4 md:p-6 border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Calendar className="w-6 h-6 text-indigo-600" />
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Events Explorer</h1>
                            <p className="text-xs text-gray-500">Manage broadcasted events and event types</p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate(
                            activeTab === 'events' 
                                ? `${BASE_PATH}create-event`
                                : `${BASE_PATH}create-event-type`
                        )}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs md:text-sm font-semibold rounded-lg hover:bg-indigo-700 shadow-xs transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        <span>{activeTab === 'events' ? 'New Event' : 'New Event Type'}</span>
                    </button>
                </div>
                
                {/* Tab Navigation */}
                <div className="flex gap-2 border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('events')}
                        className={`px-4 py-2 font-medium text-xs md:text-sm transition-colors relative ${
                            activeTab === 'events'
                                ? 'text-indigo-600 font-bold'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>Events Feed</span>
                        </div>
                        {activeTab === 'events' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"></div>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('event-types')}
                        className={`px-4 py-2 font-medium text-xs md:text-sm transition-colors relative ${
                            activeTab === 'event-types'
                                ? 'text-indigo-600 font-bold'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <Tag className="w-4 h-4" />
                            <span>Event Types</span>
                        </div>
                        {activeTab === 'event-types' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"></div>
                        )}
                    </button>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto max-w-6xl mx-auto w-full">
                {activeTab === 'events' ? (
                    <EventsList
                        showHeader={false}
                        showCreateButton={false}
                        className="p-4 md:p-6"
                    />
                ) : (
                    <EventTypesList
                        showHeader={false}
                        showCreateButton={false}
                        className="p-4 md:p-6"
                    />
                )}
            </div>
        </div>
    );
};

export default Events;
