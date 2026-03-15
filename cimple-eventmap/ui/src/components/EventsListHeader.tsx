import { Plus } from 'lucide-react';

export interface EventsListHeaderProps {
  showCreateButton?: boolean;
  onNavigateCreate: () => void;
}

export function EventsListHeader({
  showCreateButton = true,
  onNavigateCreate,
}: EventsListHeaderProps) {
  return (
    <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white">
      <h2 className="text-xl font-semibold text-gray-800">Events</h2>
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
  );
}
