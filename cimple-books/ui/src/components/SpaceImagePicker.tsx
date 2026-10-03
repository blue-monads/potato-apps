import React, { useState, useRef } from 'react';
import { Upload, FolderOpen, X, Link as LinkIcon, Image as ImageIcon, Loader2, ExternalLink } from 'lucide-react';
import {
    openSpaceFilePicker,
    uploadSpaceFile,
    hasSpaceFilePicker,
    getFilePreviewUrl,
    isImageFile,
    type SpaceFile
} from '../lib/spaceFile';

interface BaseProps {
    folderPath?: string;
    label?: string;
    description?: string;
    disabled?: boolean;
}

interface SinglePickerProps extends BaseProps {
    multiple?: false;
    value?: string;
    onChange: (value: string) => void;
}

interface MultiPickerProps extends BaseProps {
    multiple: true;
    value?: string[];
    onChange: (value: string[]) => void;
}

export type SpaceImagePickerProps = SinglePickerProps | MultiPickerProps;

export const SpaceImagePicker: React.FC<SpaceImagePickerProps> = (props) => {
    const {
        multiple = false,
        folderPath = 'cimple-books/products',
        label,
        description,
        disabled = false,
    } = props;

    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [rawUrlInput, setRawUrlInput] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const singleValue: string = typeof props.value === 'string' ? props.value : '';
    const multiValue: string[] = Array.isArray(props.value) ? props.value : (typeof props.value === 'string' && props.value ? [props.value] : []);

    const handleSpacePicker = () => {
        setUploadError(null);
        const opened = openSpaceFilePicker((file: SpaceFile) => {
            const chosenUrl = file.url || file.id;
            if (!chosenUrl) return;

            if (multiple) {
                const current = multiValue;
                if (!current.includes(chosenUrl)) {
                    (props.onChange as (val: string[]) => void)([...current, chosenUrl]);
                }
            } else {
                (props.onChange as (val: string) => void)(chosenUrl);
            }
        });

        if (!opened) {
            setUploadError('Potatoverse Space file picker is not available. Please use "Upload from Device" or paste a URL.');
        }
    };

    const handleNativeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!isImageFile(file.name) && !file.type.startsWith('image/')) {
            setUploadError('Please select a valid image file (PNG, JPG, WebP, SVG, GIF).');
            return;
        }

        setUploadError(null);
        setIsUploading(true);

        try {
            const uploaded = await uploadSpaceFile(file, folderPath);
            const chosenUrl = uploaded.url || uploaded.id;

            if (multiple) {
                const current = multiValue;
                if (!current.includes(chosenUrl)) {
                    (props.onChange as (val: string[]) => void)([...current, chosenUrl]);
                }
            } else {
                (props.onChange as (val: string) => void)(chosenUrl);
            }
        } catch (err: any) {
            setUploadError(err.message || 'Failed to upload image.');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleAddDirectUrl = () => {
        const trimmed = rawUrlInput.trim();
        if (!trimmed) return;

        if (multiple) {
            const current = multiValue;
            if (!current.includes(trimmed)) {
                (props.onChange as (val: string[]) => void)([...current, trimmed]);
            }
        } else {
            (props.onChange as (val: string) => void)(trimmed);
        }

        setRawUrlInput('');
        setShowUrlInput(false);
    };

    const handleRemoveImage = (targetUrl: string, index?: number) => {
        if (multiple) {
            const current = [...multiValue];
            if (typeof index === 'number') {
                current.splice(index, 1);
            } else {
                const idx = current.indexOf(targetUrl);
                if (idx > -1) current.splice(idx, 1);
            }
            (props.onChange as (val: string[]) => void)(current);
        } else {
            (props.onChange as (val: string) => void)('');
        }
    };

    const canUseSpacePicker = hasSpaceFilePicker();

    return (
        <div className="w-full space-y-2 font-sans">
            {/* Hidden native file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleNativeUpload}
                disabled={disabled || isUploading}
                className="hidden"
            />

            {/* Label and Header */}
            {label && (
                <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-[#2E6E52]" />
                        {label}
                    </label>
                    {multiple && multiValue.length > 0 && (
                        <span className="text-xs text-stone-500 font-medium">
                            {multiValue.length} {multiValue.length === 1 ? 'image' : 'images'}
                        </span>
                    )}
                </div>
            )}

            {description && (
                <p className="text-xs text-stone-500 -mt-1">{description}</p>
            )}

            {/* Single Image View */}
            {!multiple && singleValue ? (
                <div className="flex items-center justify-between p-3 bg-white border border-[#E1E3DB] rounded-xl shadow-xs transition-all hover:border-[#2E6E52]/50">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="relative group w-14 h-14 rounded-lg overflow-hidden border border-[#E1E3DB] bg-[#FAFBF9] flex-shrink-0">
                            <img
                                src={getFilePreviewUrl(singleValue)}
                                alt="Selected preview"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    // Fallback if image fails loading
                                    (e.target as HTMLElement).style.display = 'none';
                                }}
                            />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-stone-800 truncate" title={singleValue}>
                                {singleValue.split('/').pop() || 'Selected image'}
                            </p>
                            <p className="text-[11px] text-stone-400 font-mono truncate mt-0.5" title={singleValue}>
                                {singleValue}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                        <a
                            href={getFilePreviewUrl(singleValue)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-[#EEF0EA] rounded-md transition-colors"
                            title="Open full image"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        {!disabled && (
                            <>
                                <button
                                    type="button"
                                    onClick={handleSpacePicker}
                                    className="px-2 py-1 text-xs font-semibold text-stone-600 hover:text-[#2E6E52] hover:bg-[#EEF0EA] rounded-md transition-colors flex items-center gap-1"
                                    title="Choose another from Space"
                                >
                                    <FolderOpen className="w-3.5 h-3.5" />
                                    <span>Space</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-2 py-1 text-xs font-semibold text-stone-600 hover:text-[#2E6E52] hover:bg-[#EEF0EA] rounded-md transition-colors flex items-center gap-1"
                                    title="Upload new image"
                                >
                                    <Upload className="w-3.5 h-3.5" />
                                    <span>Upload</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveImage(singleValue)}
                                    className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                    title="Remove image"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            ) : null}

            {/* Multiple Images Gallery */}
            {multiple && multiValue.length > 0 && (
                <div className="flex flex-wrap gap-2.5 mb-2">
                    {multiValue.map((imgUrl, idx) => (
                        <div
                            key={`${imgUrl}-${idx}`}
                            className="relative group w-20 h-20 rounded-xl overflow-hidden border border-[#E1E3DB] bg-[#FAFBF9] shadow-xs hover:border-[#2E6E52]/60 transition-all"
                        >
                            <img
                                src={getFilePreviewUrl(imgUrl)}
                                alt={`Product image ${idx + 1}`}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                                <a
                                    href={getFilePreviewUrl(imgUrl)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 bg-white/90 hover:bg-white text-stone-800 rounded-md shadow"
                                    title="Preview"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                                {!disabled && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveImage(imgUrl, idx)}
                                        className="p-1 bg-red-600 text-white hover:bg-red-700 rounded-md shadow"
                                        title="Remove image"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                            {idx === 0 && (
                                <span className="absolute bottom-1 left-1 bg-[#2E6E52] text-white text-[9px] font-bold px-1 py-0.2 rounded shadow">
                                    Primary
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Actions / Drop Zone when needed */}
            {(!singleValue || multiple) && (
                <div className="border border-dashed border-[#CBCEC3] rounded-xl p-3.5 bg-[#FAFBF9] hover:border-[#2E6E52]/40 transition-colors">
                    {isUploading ? (
                        <div className="flex items-center justify-center gap-2 py-3 text-stone-600 text-xs font-semibold">
                            <Loader2 className="w-4 h-4 animate-spin text-[#2E6E52]" />
                            <span>Uploading image to Potatoverse Space...</span>
                        </div>
                    ) : (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2 text-xs text-stone-600">
                                <div className="w-8 h-8 rounded-lg bg-white border border-[#E1E3DB] flex items-center justify-center text-stone-400">
                                    <ImageIcon className="w-4 h-4" />
                                </div>
                                <span className="text-stone-600 font-medium">
                                    {multiple
                                        ? 'Select or upload additional product photos'
                                        : 'Choose image from Space files or device'}
                                </span>
                            </div>

                            <div className="flex items-center flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={handleSpacePicker}
                                    disabled={disabled}
                                    className="px-3 py-1.5 bg-[#2E6E52] hover:bg-[#255842] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                    title={canUseSpacePicker ? 'Open Potatoverse Space File Picker' : 'Space File Picker'}
                                >
                                    <FolderOpen className="w-3.5 h-3.5" />
                                    <span>Browse Space Files</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={disabled}
                                    className="px-3 py-1.5 bg-white hover:bg-stone-50 border border-[#E1E3DB] text-stone-700 text-xs font-medium rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    <Upload className="w-3.5 h-3.5 text-[#2E6E52]" />
                                    <span>Upload from Device</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setShowUrlInput(!showUrlInput)}
                                    className="px-2 py-1.5 text-stone-500 hover:text-stone-800 text-xs rounded-lg transition-colors flex items-center gap-1"
                                    title="Paste URL manually"
                                >
                                    <LinkIcon className="w-3 h-3" />
                                    <span>Link URL</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Collapsible Direct URL input */}
                    {showUrlInput && (
                        <div className="mt-3 pt-3 border-t border-[#E1E3DB] flex gap-2">
                            <input
                                type="text"
                                value={rawUrlInput}
                                onChange={(e) => setRawUrlInput(e.target.value)}
                                placeholder="Paste image URL (https://... or space path)..."
                                className="flex-1 px-3 py-1.5 text-xs bg-white border border-[#E1E3DB] rounded-lg focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddDirectUrl();
                                    }
                                }}
                            />
                            <button
                                type="button"
                                onClick={handleAddDirectUrl}
                                disabled={!rawUrlInput.trim()}
                                className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 disabled:opacity-50 text-stone-700 text-xs font-semibold rounded-lg transition-colors"
                            >
                                Add
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowUrlInput(false)}
                                className="px-2 py-1.5 text-stone-400 hover:text-stone-600 text-xs"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Error Message */}
            {uploadError && (
                <p className="text-xs text-red-600 font-medium flex items-center gap-1 mt-1">
                    <X className="w-3.5 h-3.5" />
                    <span>{uploadError}</span>
                </p>
            )}
        </div>
    );
};
