import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
    pageSizeOptions?: number[];
    itemLabel?: string;
    className?: string;
}

export function getPageNumbers(current: number, total: number): (number | string)[] {
    if (total <= 7) {
        return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (current <= 4) {
        return [1, 2, 3, 4, 5, '...', total];
    }
    if (current >= total - 3) {
        return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    }
    return [1, '...', current - 1, current, current + 1, '...', total];
}

export const Pagination: React.FC<PaginationProps> = ({
    currentPage,
    totalPages,
    totalCount,
    pageSize,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = [10, 15, 25, 50, 100],
    itemLabel = 'items',
    className = '',
}) => {
    if (totalCount === 0) return null;

    const startItem = (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(totalCount, currentPage * pageSize);

    return (
        <div className={`px-5 py-4 bg-[#FAFBF9] border-t border-[#E1E3DB] flex flex-col sm:flex-row items-center justify-between gap-4 select-none print:hidden ${className}`}>
            {/* Info & Per Page selector */}
            <div className="flex items-center gap-3 text-xs text-stone-600">
                <span>
                    Showing <span className="font-semibold text-stone-900">{startItem}</span> to{' '}
                    <span className="font-semibold text-stone-900">{endItem}</span> of{' '}
                    <span className="font-semibold text-stone-900">{totalCount}</span> {itemLabel}
                </span>

                {onPageSizeChange && (
                    <div className="flex items-center gap-1.5 pl-3 border-l border-[#E1E3DB]">
                        <span className="text-stone-500">Per page:</span>
                        <select
                            value={pageSize}
                            onChange={(e) => onPageSizeChange(Number(e.target.value))}
                            className="bg-white border border-[#CBCEC3] rounded-lg px-2 py-1 text-xs font-medium text-stone-800 focus:outline-hidden focus:border-[#2E6E52] cursor-pointer"
                        >
                            {pageSizeOptions.map((opt) => (
                                <option key={opt} value={opt}>
                                    {opt}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Navigation buttons */}
            {totalPages > 1 && (
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() => {
                            onPageChange(1);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="p-1.5 rounded-lg border border-[#E1E3DB] text-stone-600 hover:bg-stone-50 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                        title="First page"
                    >
                        <ChevronsLeft className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() => {
                            onPageChange(Math.max(1, currentPage - 1));
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="p-1.5 rounded-lg border border-[#E1E3DB] text-stone-600 hover:bg-stone-50 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                        title="Previous page"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>

                    {/* Page Numbers */}
                    <div className="flex items-center gap-1 mx-1">
                        {getPageNumbers(currentPage, totalPages).map((p, idx) => {
                            if (p === '...') {
                                return (
                                    <span key={`ellipsis-${idx}`} className="px-1.5 text-xs text-stone-400">
                                        …
                                    </span>
                                );
                            }
                            const pageNum = Number(p);
                            const isActive = pageNum === currentPage;
                            return (
                                <button
                                    key={pageNum}
                                    type="button"
                                    onClick={() => {
                                        onPageChange(pageNum);
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className={`min-w-8 h-8 px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                        isActive
                                            ? 'bg-[#2E6E52] text-white shadow-xs'
                                            : 'bg-white hover:bg-stone-100 text-stone-700 border border-[#E1E3DB]'
                                    }`}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}
                    </div>

                    <button
                        type="button"
                        disabled={currentPage >= totalPages}
                        onClick={() => {
                            onPageChange(Math.min(totalPages, currentPage + 1));
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="p-1.5 rounded-lg border border-[#E1E3DB] text-stone-600 hover:bg-stone-50 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                        title="Next page"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        disabled={currentPage >= totalPages}
                        onClick={() => {
                            onPageChange(totalPages);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="p-1.5 rounded-lg border border-[#E1E3DB] text-stone-600 hover:bg-stone-50 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                        title="Last page"
                    >
                        <ChevronsRight className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
};
