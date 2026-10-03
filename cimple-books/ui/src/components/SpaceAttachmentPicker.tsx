import React, { useState, useRef } from 'react';
import {
    Paperclip,
    FolderOpen,
    Upload,
    X,
    FileText,
    FileSpreadsheet,
    File,
    ExternalLink,
    Download,
    Loader2,
    Link as LinkIcon,
} from 'lucide-react';
import {
    openSpaceFilePicker,
    uploadSpaceFile,
    hasSpaceFilePicker,
    getFilePreviewUrl,
    getFileDownloadUrl,
    isImageFile,
    isPdfFile,
    getFileName,
    parseAttachments,
    serializeAttachments,
    type SpaceFile
} from '../lib/spaceFile';

export interface SpaceAttachmentPickerProps {
    value?: string;
    onChange: (value: string) => void;
    folderPath?: string;
    label?: string;
    description?: string;
    disabled?: boolean;
}

export const SpaceAttachmentPicker: React.FC<SpaceAttachmentPickerProps> = ({
    value = '',
    onChange,
    folderPath = 'cimple-books/stockin',
    label = 'Supporting Documents (Bills, Invoices)',
    description = 'Attach supplier bills, vendor invoices, delivery receipts, or warranty slips',
    disabled = false,
}) => {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [rawUrlInput, setRawUrlInput] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fileList = parseAttachments(value);

    const handleSpacePicker = () => {
        setUploadError(null);
        const opened = openSpaceFilePicker((file: SpaceFile) => {
            const chosen = file.url || file.id;
            if (!chosen) return;
            if (!fileList.includes(chosen)) {
                const updated = [...fileList, chosen];
                onChange(serializeAttachments(updated));
            }
        });

        if (!opened) {
            setUploadError('Potatoverse Space file picker is not available. Please use "Upload from Device" or link a URL.');
        }
    };

    const handleNativeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadError(null);
        setIsUploading(true);

        try {
            const uploaded = await uploadSpaceFile(file, folderPath);
            const chosen = uploaded.url || uploaded.id;
            if (!fileList.includes(chosen)) {
                const updated = [...fileList, chosen];
                onChange(serializeAttachments(updated));
            }
        } catch (err: any) {
            setUploadError(err.message || 'Failed to upload document.');
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

        if (!fileList.includes(trimmed)) {
            const updated = [...fileList, trimmed];
            onChange(serializeAttachments(updated));
        }

        setRawUrlInput('');
        setShowUrlInput(false);
    };

    const handleRemoveFile = (index: number) => {
        const updated = [...fileList];
        updated.splice(index, 1);
        onChange(serializeAttachments(updated));
    };

    const renderFileIcon = (filePath: string) => {
        if (isImageFile(filePath)) {
            return (
                <div className="w-9 h-9 rounded-lg overflow-hidden border border-[#E1E3DB] bg-[#FAFBF9] shrink-0">
                    <img
                        src={getFilePreviewUrl(filePath)}
                        alt="attachment preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                        }}
                    />
                </div>
            );
        }
        if (isPdfFile(filePath)) {
            return (
                <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shrink-0">
                    <FileText className="w-4 h-4" />
                </div>
            );
        }
        if (filePath.endsWith('.xls') || filePath.endsWith('.xlsx') || filePath.endsWith('.csv')) {
            return (
                <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                </div>
            );
        }
        return (
            <div className="w-9 h-9 rounded-lg bg-stone-100 border border-[#E1E3DB] flex items-center justify-center text-stone-600 shrink-0">
                <File className="w-4 h-4" />
            </div>
        );
    };

    const canUseSpacePicker = hasSpaceFilePicker();

    return (
        <div className="w-full space-y-3 font-sans">
            {/* Hidden native file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*,application/pdf"
                onChange={handleNativeUpload}
                disabled={disabled || isUploading}
                className="hidden"
            />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Paperclip className="w-3.5 h-3.5 text-[#2E6E52]" />
                        {label}
                    </label>
                    {description && (
                        <p className="text-xs text-stone-500 mt-0.5">{description}</p>
                    )}
                </div>
                {fileList.length > 0 && (
                    <span className="text-xs text-[#2E6E52] bg-[#EAF3EE] border border-[#2E6E52]/20 font-bold px-2.5 py-0.5 rounded-full">
                        {fileList.length} {fileList.length === 1 ? 'doc' : 'docs'}
                    </span>
                )}
            </div>

            {/* List of Attached Files */}
            {fileList.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {fileList.map((filePath, idx) => {
                        const fileName = getFileName(filePath);
                        const previewUrl = getFilePreviewUrl(filePath);
                        const downloadUrl = getFileDownloadUrl(filePath);

                        return (
                            <div
                                key={`${filePath}-${idx}`}
                                className="flex items-center justify-between p-2.5 bg-white border border-[#E1E3DB] rounded-xl hover:border-[#2E6E52]/40 transition-colors shadow-2xs"
                            >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                                    {renderFileIcon(filePath)}
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-semibold text-stone-800 truncate" title={fileName}>
                                            {fileName}
                                        </p>
                                        <p className="text-[11px] text-stone-400 font-mono truncate mt-0.5" title={filePath}>
                                            {filePath}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                    <a
                                        href={previewUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="p-1.5 text-stone-500 hover:text-[#2E6E52] hover:bg-[#EEF0EA] rounded-md transition-colors"
                                        title="Preview / Open Document"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                    <a
                                        href={downloadUrl}
                                        download={fileName}
                                        className="p-1.5 text-stone-500 hover:text-[#2E6E52] hover:bg-[#EEF0EA] rounded-md transition-colors"
                                        title="Download Document"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                    </a>
                                    {!disabled && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveFile(idx)}
                                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                            title="Remove attachment"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Action Zone (Only if not disabled) */}
            {!disabled && (
                <div className="border border-dashed border-[#CBCEC3] rounded-xl p-3 bg-[#FAFBF9] hover:border-[#2E6E52]/40 transition-colors">
                    {isUploading ? (
                        <div className="flex items-center justify-center gap-2 py-2 text-stone-600 text-xs font-semibold">
                            <Loader2 className="w-4 h-4 animate-spin text-[#2E6E52]" />
                            <span>Uploading document to Potatoverse Space...</span>
                        </div>
                    ) : (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
                            <span className="text-xs text-stone-600 font-medium">
                                {fileList.length === 0
                                    ? 'Attach vendor invoice, bill scan, or receipt to this Stock In'
                                    : 'Add another bill or supporting document'}
                            </span>

                            <div className="flex items-center flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={handleSpacePicker}
                                    className="px-3 py-1.5 bg-[#2E6E52] hover:bg-[#255842] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                                    title={canUseSpacePicker ? 'Select from Potatoverse Space files' : 'Space File Picker'}
                                >
                                    <FolderOpen className="w-3.5 h-3.5" />
                                    <span>Browse Space Files</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-3 py-1.5 bg-white hover:bg-stone-50 border border-[#E1E3DB] text-stone-700 text-xs font-medium rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Upload className="w-3.5 h-3.5 text-[#2E6E52]" />
                                    <span>Upload Document</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setShowUrlInput(!showUrlInput)}
                                    className="px-2 py-1.5 text-stone-500 hover:text-stone-800 text-xs rounded-lg transition-colors flex items-center gap-1"
                                    title="Link by URL or Space path"
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
                                placeholder="Paste document URL (https://... or space file path)..."
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
