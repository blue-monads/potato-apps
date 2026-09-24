import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { type SpaceFile, formatFileSize } from "../../../lib/spaceFile";

export interface ImagePreviewModalProps {
    images: SpaceFile[];
    initialIndex?: number;
    onClose: () => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
    images,
    initialIndex = 0,
    onClose,
}) => {
    const [currentIndex, setCurrentIndex] = useState(() => {
        if (initialIndex < 0 || initialIndex >= images.length) return 0;
        return initialIndex;
    });

    const total = images.length;
    const currentImage = images[currentIndex] || images[0];

    const goToNext = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (total <= 1) return;
        setCurrentIndex((prev) => (prev + 1) % total);
    };

    const goToPrev = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (total <= 1) return;
        setCurrentIndex((prev) => (prev - 1 + total) % total);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                onClose();
            } else if (e.key === "ArrowRight") {
                e.preventDefault();
                e.stopPropagation();
                if (total > 1) {
                    setCurrentIndex((prev) => (prev + 1) % total);
                }
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                e.stopPropagation();
                if (total > 1) {
                    setCurrentIndex((prev) => (prev - 1 + total) % total);
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [total, onClose]);

    if (!currentImage || total === 0) return null;

    const modalMarkup = (
        <div
            className="fixed inset-0 z-[1000] bg-black/85 backdrop-blur-md flex flex-col justify-between select-none p-3 sm:p-5"
            onClick={(e) => {
                e.stopPropagation();
                onClose();
            }}
        >
            {/* Header */}
            <div
                className="flex items-center justify-between text-white/90 z-20 shrink-0 gap-3 pb-2"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                        <i className="fa-solid fa-image text-white/80 text-sm" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-white truncate max-w-xs sm:max-w-md" title={currentImage.name}>
                            {currentImage.name}
                        </h3>
                        <div className="flex items-center gap-2 text-[11px] text-white/60">
                            {total > 1 && (
                                <span className="font-medium text-accent-400">
                                    {currentIndex + 1} of {total}
                                </span>
                            )}
                            {currentImage.size > 0 && (
                                <span>{formatFileSize(currentImage.size)}</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    {currentImage.url && (
                        <a
                            href={currentImage.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white/90 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                            title="Open original in new tab"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <i className="fa-solid fa-up-right-from-square text-xs" />
                        </a>
                    )}
                    {(currentImage.download_url || currentImage.url) && (
                        <a
                            href={currentImage.download_url || currentImage.url}
                            target="_blank"
                            download={currentImage.name}
                            rel="noopener noreferrer"
                            className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white/90 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                            title={`Download ${currentImage.name}`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <i className="fa-solid fa-download text-xs" />
                        </a>
                    )}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                        }}
                        className="w-9 h-9 rounded-lg bg-white/10 hover:bg-rose-600/80 text-white/90 hover:text-white flex items-center justify-center transition-colors cursor-pointer ml-1"
                        title="Close (Esc)"
                    >
                        <i className="fa-solid fa-xmark text-sm" />
                    </button>
                </div>
            </div>

            {/* Main Image Stage */}
            <div
                className="relative flex-1 flex items-center justify-center min-h-0 my-2 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Previous Button */}
                {total > 1 && (
                    <button
                        type="button"
                        onClick={goToPrev}
                        className="absolute left-2 sm:left-4 z-20 w-11 h-11 rounded-full bg-black/50 hover:bg-white/25 text-white/90 hover:text-white backdrop-blur-md flex items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-xl border border-white/15"
                        title="Previous image (Left arrow)"
                    >
                        <i className="fa-solid fa-chevron-left text-base" />
                    </button>
                )}

                {/* The Image */}
                <div className="relative max-h-full max-w-full flex items-center justify-center">
                    <img
                        key={currentImage.url || currentImage.id}
                        src={currentImage.url}
                        alt={currentImage.name}
                        className="max-h-[75vh] max-w-[90vw] object-contain rounded-lg shadow-2xl transition-all"
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                                parent.innerHTML = `
                                    <div class="flex flex-col items-center justify-center p-8 bg-surface-800/80 rounded-lg text-surface-300">
                                        <i class="fa-solid fa-triangle-exclamation text-3xl mb-2 text-amber-400"></i>
                                        <p class="text-xs">Image failed to load</p>
                                    </div>
                                `;
                            }
                        }}
                    />
                </div>

                {/* Next Button */}
                {total > 1 && (
                    <button
                        type="button"
                        onClick={goToNext}
                        className="absolute right-2 sm:right-4 z-20 w-11 h-11 rounded-full bg-black/50 hover:bg-white/25 text-white/90 hover:text-white backdrop-blur-md flex items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-xl border border-white/15"
                        title="Next image (Right arrow)"
                    >
                        <i className="fa-solid fa-chevron-right text-base" />
                    </button>
                )}
            </div>

            {/* Bottom thumbnails strip */}
            {total > 1 && (
                <div
                    className="flex items-center justify-center gap-2 overflow-x-auto py-2 px-4 max-w-full shrink-0 z-20"
                    onClick={(e) => e.stopPropagation()}
                >
                    {images.map((img, idx) => {
                        const isSelected = idx === currentIndex;
                        return (
                            <button
                                key={img.id + '-' + idx}
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentIndex(idx);
                                }}
                                className={`relative w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                                    isSelected
                                        ? 'border-accent-400 scale-110 shadow-lg ring-2 ring-accent-400/50 opacity-100'
                                        : 'border-white/20 opacity-50 hover:opacity-90 hover:border-white/50'
                                }`}
                                title={img.name}
                            >
                                <img
                                    src={img.url}
                                    alt={img.name}
                                    className="w-full h-full object-cover"
                                />
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );

    return createPortal(modalMarkup, document.body);
};

export default ImagePreviewModal;
