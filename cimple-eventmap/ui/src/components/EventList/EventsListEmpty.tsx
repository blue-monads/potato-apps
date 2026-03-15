export interface EventsListEmptyProps {
  showCreateButton: boolean;
  onNavigateCreate: () => void;
}

export function EventsListEmpty({
  showCreateButton,
  onNavigateCreate,
}: EventsListEmptyProps) {
  return (
    <div className="p-4 text-center text-gray-500">
      {showCreateButton ? (
        <>
          <p className="mb-2">No events yet</p>
          <button
            onClick={onNavigateCreate}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create First Event
          </button>
        </>
      ) : (
        <p>No events yet</p>
      )}
    </div>
  );
}
