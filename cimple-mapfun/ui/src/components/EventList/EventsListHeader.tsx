import { Plus, RefreshCcw } from 'lucide-react';

export interface EventsListHeaderProps {
  showCreateButton?: boolean;
  onNavigateCreate: () => void;
  onRefresh?: () => void;
}

export function EventsListHeader({
  showCreateButton = true,
  onNavigateCreate,
  onRefresh,
}: EventsListHeaderProps) {
  return (
    <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white">
      <h2 className="text-xl font-semibold text-gray-800">Events</h2>
      <div className="flex items-center gap-2">
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="flex items-center gap-1 px-3 py-1.5 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            aria-label="Refresh events"
          >
            <RefreshCcw className="w-4 h-4" />            
          </button>
        )}
        {showCreateButton && (
          <button
            onClick={onNavigateCreate}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New
          </button>
        )}
      </div>
    </div>
  );
}
