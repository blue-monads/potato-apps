export interface LoadMoreSectionProps {
  loading: boolean;
  onLoadMore: () => void;
}

export function LoadMoreSection({ loading, onLoadMore }: LoadMoreSectionProps) {
  return (
    <div className="p-4 flex justify-center border-t border-gray-100">
      <button
        type="button"
        onClick={onLoadMore}
        disabled={loading}
        className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Loading…' : 'Load more'}
      </button>
    </div>
  );
}
