import { useState, useEffect } from "react";
import { type Datatable, type DatatableRow, type DatatableColumn } from "../../../lib/api";
import { getCellValue, formatDuration, parseTextPatternConfig } from "./columnTypes";
import {
    parseRefOptions,
    parseRefIds,
    parseReverseRefOptions,
    getRowIdentityText,
    useRefResolution,
    useReverseRefResolution,
} from "../../../lib/refCache";
import RefPickerModal from "./RefPickerModal";
import {
    parseFilesValue,
    serializeFilesValue,
    formatFileSize,
    getFileIconClass,
    openSpaceFilePicker,
    uploadSpaceFile,
    type SpaceFile,
} from "../../../lib/spaceFile";
import { BarcodeSvg } from "./BarcodeModal";

const RefFieldInput = ({
    column,
    value,
    onOpenPicker,
    onClear,
    hasError,
}: {
    column: DatatableColumn;
    value: string;
    onOpenPicker: () => void;
    onClear: () => void;
    hasError?: boolean;
}) => {
    const opts = parseRefOptions(column.options);
    const targetTableId = opts?.target_table_id;
    const resolvedRow = useRefResolution(targetTableId, value);

    if (!targetTableId) {
        return (
            <div className="text-xs text-coral-600 bg-coral-50 p-2 rounded border border-coral-200">
                Table reference not configured: target table not specified.
            </div>
        );
    }

    const identityText = getRowIdentityText(resolvedRow, opts?.identity_column);

    if (value) {
        return (
            <div className={`flex items-center justify-between p-2 rounded-lg border bg-surface-50 transition-all ${
                hasError ? 'border-coral-500' : 'border-surface-300'
            }`}>
                <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-6 h-6 rounded bg-accent-100 text-accent-700 flex items-center justify-center shrink-0">
                        <i className="fa-solid fa-link text-[10px]" />
                    </div>
                    <div className="overflow-hidden">
                        <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs text-surface-900 truncate max-w-[240px]">
                                {identityText || `#${value}`}
                            </span>
                            <span className="text-[10px] font-mono text-surface-400">#{value}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={onOpenPicker}
                        className="px-2 py-1 text-xs font-semibold text-accent-600 hover:bg-accent-50 rounded transition-colors cursor-pointer"
                    >
                        Change
                    </button>
                    <button
                        type="button"
                        onClick={onClear}
                        title="Remove reference"
                        className="w-6 h-6 flex items-center justify-center text-surface-400 hover:text-coral-600 hover:bg-coral-50 rounded transition-colors cursor-pointer"
                    >
                        <i className="fa-solid fa-xmark text-xs" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={onOpenPicker}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left bg-white border border-dashed rounded transition-colors cursor-pointer ${
                hasError
                    ? 'border-coral-500 text-coral-600'
                    : 'border-surface-300 text-surface-500 hover:border-accent-500 hover:bg-accent-50/20 hover:text-accent-700'
            }`}
        >
            <div className="flex items-center gap-2">
                <i className="fa-solid fa-arrow-up-right-from-square text-xs text-surface-400" />
                <span>Select referenced record...</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-surface-100 px-2 py-0.5 rounded text-surface-600">
                Browse
            </span>
        </button>
    );
};

const MultiRefBadge = ({
    tableId,
    rowId,
    identityColSlug,
    onRemove,
}: {
    tableId: number;
    rowId: number;
    identityColSlug?: string;
    onRemove: () => void;
}) => {
    const resolvedRow = useRefResolution(tableId, rowId);
    const identityText = getRowIdentityText(resolvedRow, identityColSlug);

    return (
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
            <i className="fa-solid fa-arrow-up-right-from-square text-[9px] text-slate-400" />
            <span className="font-semibold truncate max-w-[140px]">{identityText || `#${rowId}`}</span>
            {identityText && <span className="text-[10px] text-slate-400 font-mono">#{rowId}</span>}
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                }}
                title="Remove"
                className="text-slate-400 hover:text-coral-600 ml-0.5 cursor-pointer"
            >
                <i className="fa-solid fa-xmark text-[10px]" />
            </button>
        </span>
    );
};

const MultiRefFieldInput = ({
    column,
    value,
    onOpenPicker,
    onChange,
    hasError,
}: {
    column: DatatableColumn;
    value: string;
    onOpenPicker: () => void;
    onChange: (newValue: string) => void;
    hasError?: boolean;
}) => {
    const opts = parseRefOptions(column.options);
    const targetTableId = opts?.target_table_id;
    const ids = parseRefIds(value);

    if (!targetTableId) {
        return (
            <div className="text-xs text-coral-600 bg-coral-50 p-2 rounded border border-coral-200">
                Table reference not configured: target table not specified.
            </div>
        );
    }

    const handleRemoveId = (idToRemove: number) => {
        const nextIds = ids.filter(id => id !== idToRemove);
        onChange(nextIds.join(', '));
    };

    return (
        <div className={`p-2.5 rounded-lg border bg-white space-y-2 transition-all ${
            hasError ? 'border-coral-500' : 'border-surface-300'
        }`}>
            {ids.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 items-center">
                    {ids.map(id => (
                        <MultiRefBadge
                            key={id}
                            tableId={targetTableId}
                            rowId={id}
                            identityColSlug={opts.identity_column}
                            onRemove={() => handleRemoveId(id)}
                        />
                    ))}
                </div>
            ) : (
                <p className="text-xs text-surface-400 italic">No referenced records selected.</p>
            )}

            <div className="flex items-center justify-between pt-1 border-t border-surface-100">
                <button
                    type="button"
                    onClick={onOpenPicker}
                    className="px-2.5 py-1 text-xs font-semibold bg-accent-50 text-accent-700 hover:bg-accent-100 rounded border border-accent-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                    <i className="fa-solid fa-plus text-[10px]" />
                    <span>{ids.length > 0 ? "Edit / Add More" : "Select References"}</span>
                </button>
                {ids.length > 0 && (
                    <button
                        type="button"
                        onClick={() => onChange("")}
                        className="text-[11px] font-medium text-coral-600 hover:underline cursor-pointer"
                    >
                        Clear All ({ids.length})
                    </button>
                )}
            </div>
        </div>
    );
};

const RowRefBadge = ({
    tableId,
    rowId,
    identityColSlug,
}: {
    tableId: number;
    rowId: number;
    identityColSlug?: string;
}) => {
    const resolvedRow = useRefResolution(tableId, rowId);
    const identityText = getRowIdentityText(resolvedRow, identityColSlug);

    return (
        <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-white text-surface-700 border border-surface-200 shadow-2xs"
            title={`Referenced record #${rowId} in table ${tableId}`}
        >
            <i className="fa-solid fa-arrow-up-right-from-square text-[9px] text-accent-500" />
            <span className="truncate max-w-[150px]">{identityText || `#${rowId}`}</span>
            {identityText && <span className="text-[10px] text-surface-400 font-mono">#{rowId}</span>}
        </span>
    );
};

const ReverseRefFieldView = ({
    column,
    row,
}: {
    column: DatatableColumn;
    row?: DatatableRow;
}) => {
    const opts = parseReverseRefOptions(column.options);
    const targetTableId = opts?.target_table_id;
    const targetColSlug = opts?.target_column_slug;

    if (!row || !targetTableId || !targetColSlug) {
        return (
            <div className="p-3 bg-surface-50 border border-surface-200 rounded-lg text-xs text-surface-400 italic">
                {!row ? "Save this row first to view linked reverse references." : "Target table or foreign key column not configured."}
            </div>
        );
    }

    const { loading, refIds } = useReverseRefResolution(
        column.table_id,
        column.slug,
        row.id,
        targetTableId,
        targetColSlug
    );

    const ids = Array.isArray(refIds) ? refIds : [];

    return (
        <div className="space-y-2 p-3 bg-surface-50 border border-surface-200 rounded-lg">
            <div className="flex items-center justify-between text-xs text-surface-600">
                <span className="font-medium flex items-center gap-1.5">
                    <i className="fa-solid fa-reply text-[10px] text-accent-600" />
                    <span>Referencing Records ({loading ? "..." : ids.length})</span>
                </span>
                <span className="text-[10px] text-surface-400 font-mono">
                    Table #{targetTableId} &rarr; {targetColSlug}
                </span>
            </div>

            {loading ? (
                <div className="flex items-center gap-2 py-2 text-xs text-surface-500 animate-pulse">
                    <i className="fa-solid fa-spinner fa-spin text-accent-500" />
                    <span>Loading linked references...</span>
                </div>
            ) : ids.length === 0 ? (
                <div className="py-2 text-xs text-surface-400 italic">
                    No records in Table #{targetTableId} currently reference this row.
                </div>
            ) : (
                <div className="flex flex-wrap gap-1.5 pt-1">
                    {ids.map(id => (
                        <RowRefBadge
                            key={id}
                            tableId={targetTableId}
                            rowId={id}
                            identityColSlug={opts?.identity_column}
                        />
                    ))}
                </div>
            )}

            <div className="text-[10px] text-surface-400 border-t border-surface-200/60 pt-1.5 flex items-center gap-1">
                <i className="fa-solid fa-circle-info text-[9px]" />
                <span>Reverse references are computed automatically from records in Table #{targetTableId}.</span>
            </div>
        </div>
    );
};

const ImageFieldInput = ({
    value,
    onChange,
    hasError,
}: {
    value: string;
    onChange: (val: string) => void;
    hasError?: boolean;
}) => {
    const [uploading, setUploading] = useState(false);
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [urlText, setUrlText] = useState("");
    const [dragActive, setDragActive] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const files = parseFilesValue(value);

    const addFiles = (newFiles: SpaceFile[]) => {
        setErrorMsg(null);
        const updated = [...files, ...newFiles];
        onChange(serializeFilesValue(updated));
    };

    const removeFile = (index: number) => {
        const updated = files.filter((_, i) => i !== index);
        onChange(serializeFilesValue(updated));
    };

    const clearAll = () => {
        onChange("");
    };

    const handleFileUpload = async (fileList: FileList | File[]) => {
        const toUpload = Array.from(fileList);
        if (toUpload.length === 0) return;
        setUploading(true);
        setErrorMsg(null);
        try {
            const uploaded = await Promise.all(toUpload.map(f => uploadSpaceFile(f)));
            addFiles(uploaded);
        } catch (err: any) {
            setErrorMsg(err?.message || "Failed to upload image(s)");
        } finally {
            setUploading(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files);
        }
    };

    const handleUrlSubmit = () => {
        if (!urlText.trim()) return;
        const text = urlText.trim();
        const rawUrls = text.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
        const added: SpaceFile[] = [];
        for (const raw of rawUrls) {
            const parsed = parseFilesValue(raw);
            if (parsed.length > 0) {
                added.push(...parsed);
            }
        }
        if (added.length > 0) {
            addFiles(added);
            setUrlText("");
            setShowUrlInput(false);
        }
    };

    return (
        <div className="space-y-2">
            {files.length > 0 && (
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-surface-600 font-medium">
                        <span>{files.length} image{files.length > 1 ? "s" : ""} attached</span>
                        <button
                            type="button"
                            onClick={clearAll}
                            className="text-coral-600 hover:text-coral-700 hover:underline cursor-pointer text-[11px]"
                        >
                            Clear all
                        </button>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {files.map((file, idx) => (
                            <div
                                key={file.id + '-' + idx}
                                className="group relative rounded-lg border border-surface-200 bg-white overflow-hidden aspect-square flex flex-col justify-between hover:border-surface-300 transition-all shadow-xs"
                            >
                                <div className="w-full h-full flex items-center justify-center bg-surface-50 overflow-hidden relative">
                                    {file.url ? (
                                        <img
                                            src={file.url}
                                            alt={file.name}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.style.display = 'none';
                                                const parent = target.parentElement;
                                                if (parent) {
                                                    parent.innerHTML = '<i class="fa-solid fa-image text-surface-400 text-lg"></i>';
                                                }
                                            }}
                                        />
                                    ) : (
                                        <i className="fa-solid fa-image text-surface-400 text-lg" />
                                    )}
                                </div>
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-1">
                                    {file.url && (
                                        <a
                                            href={file.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-7 h-7 rounded-full bg-white/90 text-surface-800 hover:bg-white flex items-center justify-center text-xs shadow transition-transform hover:scale-105"
                                            title="View Full Size"
                                        >
                                            <i className="fa-solid fa-up-right-from-square text-[10px]" />
                                        </a>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => removeFile(idx)}
                                        className="w-7 h-7 rounded-full bg-rose-600 text-white hover:bg-rose-700 flex items-center justify-center text-xs shadow cursor-pointer transition-transform hover:scale-105"
                                        title="Remove"
                                    >
                                        <i className="fa-solid fa-trash text-[10px]" />
                                    </button>
                                </div>
                                <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-xs px-1.5 py-0.5 text-[10px] text-white truncate font-medium pointer-events-none">
                                    {file.name}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`p-3.5 rounded-lg border-2 border-dashed transition-all text-center ${
                    dragActive
                        ? 'border-accent-500 bg-accent-50/30'
                        : hasError && files.length === 0
                        ? 'border-coral-500 bg-coral-50/20'
                        : 'border-surface-300 bg-surface-50/50 hover:border-surface-400'
                }`}
            >
                {uploading ? (
                    <div className="flex flex-col items-center justify-center py-2 space-y-1">
                        <i className="fa-solid fa-circle-notch fa-spin text-accent-600 text-lg" />
                        <span className="text-xs text-surface-600 font-medium">Uploading image(s)...</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center space-y-1.5">
                        <div className="w-8 h-8 rounded-full bg-accent-50 text-accent-600 flex items-center justify-center">
                            <i className="fa-solid fa-image text-xs" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-surface-800">
                                {files.length > 0 ? "Add more images" : "Drag & drop image(s) here or"}
                            </p>
                            <p className="text-[10px] text-surface-400">
                                PNG, JPG, GIF, WebP or SVG (multiple supported)
                            </p>
                        </div>
                        <div className="flex items-center gap-2 pt-0.5">
                            <button
                                type="button"
                                onClick={() => openSpaceFilePicker((sf) => addFiles([sf]))}
                                className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-surface-50 text-surface-700 rounded border border-surface-300 shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                            >
                                <i className="fa-solid fa-folder-open text-accent-600 text-[10px]" />
                                <span>Browse Space</span>
                            </button>

                            <label className="px-2.5 py-1 text-xs font-semibold bg-accent-600 hover:bg-accent-700 text-white rounded shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors">
                                <i className="fa-solid fa-cloud-arrow-up text-[10px]" />
                                <span>Upload Images</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files.length > 0) {
                                            handleFileUpload(e.target.files);
                                            e.target.value = '';
                                        }
                                    }}
                                />
                            </label>
                        </div>
                    </div>
                )}
            </div>

            {errorMsg && (
                <div className="text-[11px] text-coral-600 flex items-center gap-1">
                    <i className="fa-solid fa-circle-exclamation text-[10px]" />
                    <span>{errorMsg}</span>
                </div>
            )}

            <div className="flex items-center justify-between px-1">
                <button
                    type="button"
                    onClick={() => {
                        setShowUrlInput(!showUrlInput);
                        setUrlText("");
                    }}
                    className="text-[11px] text-surface-500 hover:text-accent-600 hover:underline cursor-pointer"
                >
                    {showUrlInput ? "Hide URL input" : "or paste image URL(s)"}
                </button>
            </div>

            {showUrlInput && (
                <div className="flex items-center gap-1.5 pt-1">
                    <input
                        type="url"
                        value={urlText}
                        onChange={(e) => setUrlText(e.target.value)}
                        placeholder="https://example.com/image.jpg (or comma-separated)"
                        className="flex-1 bg-white border border-surface-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent-600 transition-colors"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleUrlSubmit();
                            }
                        }}
                    />
                    <button
                        type="button"
                        onClick={handleUrlSubmit}
                        className="px-2.5 py-1.5 bg-surface-100 hover:bg-surface-200 text-surface-700 rounded text-xs font-medium cursor-pointer transition-colors"
                    >
                        Add URL
                    </button>
                </div>
            )}
        </div>
    );
};

const FileFieldInput = ({
    value,
    onChange,
    hasError,
}: {
    value: string;
    onChange: (val: string) => void;
    hasError?: boolean;
}) => {
    const [uploading, setUploading] = useState(false);
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [urlText, setUrlText] = useState("");
    const [dragActive, setDragActive] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const files = parseFilesValue(value);

    const addFiles = (newFiles: SpaceFile[]) => {
        setErrorMsg(null);
        const updated = [...files, ...newFiles];
        onChange(serializeFilesValue(updated));
    };

    const removeFile = (index: number) => {
        const updated = files.filter((_, i) => i !== index);
        onChange(serializeFilesValue(updated));
    };

    const clearAll = () => {
        onChange("");
    };

    const handleFileUpload = async (fileList: FileList | File[]) => {
        const toUpload = Array.from(fileList);
        if (toUpload.length === 0) return;
        setUploading(true);
        setErrorMsg(null);
        try {
            const uploaded = await Promise.all(toUpload.map(f => uploadSpaceFile(f)));
            addFiles(uploaded);
        } catch (err: any) {
            setErrorMsg(err?.message || "Failed to upload file(s)");
        } finally {
            setUploading(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files);
        }
    };

    const handleUrlSubmit = () => {
        if (!urlText.trim()) return;
        const text = urlText.trim();
        const rawUrls = text.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
        const added: SpaceFile[] = [];
        for (const raw of rawUrls) {
            const parsed = parseFilesValue(raw);
            if (parsed.length > 0) {
                added.push(...parsed);
            }
        }
        if (added.length > 0) {
            addFiles(added);
            setUrlText("");
            setShowUrlInput(false);
        }
    };

    return (
        <div className="space-y-2">
            {files.length > 0 && (
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-surface-600 font-medium">
                        <span>{files.length} file{files.length > 1 ? "s" : ""} attached</span>
                        <button
                            type="button"
                            onClick={clearAll}
                            className="text-coral-600 hover:text-coral-700 hover:underline cursor-pointer text-[11px]"
                        >
                            Clear all
                        </button>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                        {files.map((file, idx) => {
                            const iconClass = getFileIconClass(file.mime || file.name);
                            const downloadUrl = file.download_url || file.url;
                            return (
                                <div
                                    key={file.id + '-' + idx}
                                    className="flex items-center gap-2.5 p-2 rounded-lg border border-surface-200 bg-white hover:border-surface-300 transition-all text-xs"
                                >
                                    <div className="shrink-0 w-8 h-8 rounded border border-surface-200 bg-surface-50 flex items-center justify-center">
                                        <i className={`${iconClass} text-sm`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-surface-900 truncate" title={file.name}>
                                            {file.name}
                                        </div>
                                        {file.size > 0 && (
                                            <div className="text-[10px] text-surface-400 font-mono">
                                                {formatFileSize(file.size)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {downloadUrl && (
                                            <a
                                                href={downloadUrl}
                                                target="_blank"
                                                download={file.name}
                                                rel="noopener noreferrer"
                                                className="w-7 h-7 rounded hover:bg-surface-100 text-surface-600 hover:text-surface-900 flex items-center justify-center transition-colors"
                                                title="Download"
                                            >
                                                <i className="fa-solid fa-download text-[11px]" />
                                            </a>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => removeFile(idx)}
                                            className="w-7 h-7 rounded hover:bg-coral-50 text-surface-400 hover:text-coral-600 flex items-center justify-center transition-colors cursor-pointer"
                                            title="Remove"
                                        >
                                            <i className="fa-solid fa-trash text-[11px]" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`p-3.5 rounded-lg border-2 border-dashed transition-all text-center ${
                    dragActive
                        ? 'border-accent-500 bg-accent-50/30'
                        : hasError && files.length === 0
                        ? 'border-coral-500 bg-coral-50/20'
                        : 'border-surface-300 bg-surface-50/50 hover:border-surface-400'
                }`}
            >
                {uploading ? (
                    <div className="flex flex-col items-center justify-center py-2 space-y-1">
                        <i className="fa-solid fa-circle-notch fa-spin text-accent-600 text-lg" />
                        <span className="text-xs text-surface-600 font-medium">Uploading file(s)...</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center space-y-1.5">
                        <div className="w-8 h-8 rounded-full bg-accent-50 text-accent-600 flex items-center justify-center">
                            <i className="fa-solid fa-paperclip text-xs" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-surface-800">
                                {files.length > 0 ? "Add more files" : "Drag & drop file(s) here or"}
                            </p>
                            <p className="text-[10px] text-surface-400">
                                Documents, PDFs, archives, sheets, etc. (multiple supported)
                            </p>
                        </div>
                        <div className="flex items-center gap-2 pt-0.5">
                            <button
                                type="button"
                                onClick={() => openSpaceFilePicker((sf) => addFiles([sf]))}
                                className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-surface-50 text-surface-700 rounded border border-surface-300 shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                            >
                                <i className="fa-solid fa-folder-open text-accent-600 text-[10px]" />
                                <span>Browse Space</span>
                            </button>

                            <label className="px-2.5 py-1 text-xs font-semibold bg-accent-600 hover:bg-accent-700 text-white rounded shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors">
                                <i className="fa-solid fa-cloud-arrow-up text-[10px]" />
                                <span>Upload Files</span>
                                <input
                                    type="file"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files.length > 0) {
                                            handleFileUpload(e.target.files);
                                            e.target.value = '';
                                        }
                                    }}
                                />
                            </label>
                        </div>
                    </div>
                )}
            </div>

            {errorMsg && (
                <div className="text-[11px] text-coral-600 flex items-center gap-1">
                    <i className="fa-solid fa-circle-exclamation text-[10px]" />
                    <span>{errorMsg}</span>
                </div>
            )}

            <div className="flex items-center justify-between px-1">
                <button
                    type="button"
                    onClick={() => {
                        setShowUrlInput(!showUrlInput);
                        setUrlText("");
                    }}
                    className="text-[11px] text-surface-500 hover:text-accent-600 hover:underline cursor-pointer"
                >
                    {showUrlInput ? "Hide URL/path input" : "or enter file URL(s) / path"}
                </button>
            </div>

            {showUrlInput && (
                <div className="flex items-center gap-1.5 pt-1">
                    <input
                        type="text"
                        value={urlText}
                        onChange={(e) => setUrlText(e.target.value)}
                        placeholder="https://... or file path (or comma-separated)"
                        className="flex-1 bg-white border border-surface-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent-600 transition-colors"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleUrlSubmit();
                            }
                        }}
                    />
                    <button
                        type="button"
                        onClick={handleUrlSubmit}
                        className="px-2.5 py-1.5 bg-surface-100 hover:bg-surface-200 text-surface-700 rounded text-xs font-medium cursor-pointer transition-colors"
                    >
                        Add
                    </button>
                </div>
            )}
        </div>
    );
};

const RatingFieldInput = ({
    value,
    onChange,
    hasError,
}: {
    value: string;
    onChange: (val: string) => void;
    hasError?: boolean;
}) => {
    const [hoverScore, setHoverScore] = useState<number | null>(null);

    const num = Number(value);
    const valid = value !== "" && !isNaN(num);
    const score = valid ? Math.min(5, Math.max(0, num)) : 0;
    const activeScore = hoverScore !== null ? hoverScore : score;

    const ratingLabels: Record<number, string> = {
        1: "1 - Poor",
        2: "2 - Fair",
        3: "3 - Good",
        4: "4 - Very Good",
        5: "5 - Excellent",
    };

    return (
        <div className={`p-2.5 rounded-lg border bg-surface-50/50 space-y-2 transition-all ${
            hasError ? 'border-coral-500 bg-coral-50/20' : 'border-surface-300'
        }`}>
            <div className="flex items-center justify-between">
                <div
                    className="flex items-center gap-1.5"
                    onMouseLeave={() => setHoverScore(null)}
                >
                    {[1, 2, 3, 4, 5].map((star) => {
                        const isFilled = activeScore >= star;
                        return (
                            <button
                                key={star}
                                type="button"
                                onClick={() => {
                                    if (score === star) {
                                        onChange("");
                                    } else {
                                        onChange(String(star));
                                    }
                                }}
                                onMouseEnter={() => setHoverScore(star)}
                                className="p-1 rounded-sm text-2xl transition-all transform hover:scale-125 cursor-pointer focus:outline-hidden"
                                title={`Rate ${star} star${star > 1 ? 's' : ''}`}
                            >
                                <i
                                    className={`transition-colors ${
                                        isFilled
                                            ? 'fa-solid fa-star text-amber-400 drop-shadow-xs'
                                            : 'fa-regular fa-star text-surface-300 hover:text-amber-200'
                                    }`}
                                />
                            </button>
                        );
                    })}
                </div>

                <div className="flex items-center gap-2">
                    {valid ? (
                        <div className="flex items-center gap-1.5">
                            <span className="font-mono text-sm font-bold text-surface-800 tabular-nums">
                                {value}
                            </span>
                            <span className="text-[11px] text-surface-400 font-mono">/ 5</span>
                            <button
                                type="button"
                                onClick={() => onChange("")}
                                className="w-5 h-5 rounded hover:bg-coral-50 text-surface-400 hover:text-coral-600 flex items-center justify-center transition-colors cursor-pointer ml-1"
                                title="Clear rating"
                            >
                                <i className="fa-solid fa-xmark text-xs" />
                            </button>
                        </div>
                    ) : (
                        <span className="text-xs text-surface-400 italic">No rating</span>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-surface-500 pt-1 border-t border-surface-200/60">
                <span className="font-medium text-surface-600">
                    {activeScore > 0 ? ratingLabels[Math.round(activeScore)] || `${activeScore} stars` : "Click star to rate (1–5)"}
                </span>

                <div className="flex items-center gap-1">
                    <span className="text-[10px] text-surface-400">Custom:</span>
                    <input
                        type="number"
                        min="0"
                        max="5"
                        step="0.1"
                        value={value}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val === "") {
                                onChange("");
                                return;
                            }
                            const n = Number(val);
                            if (!isNaN(n) && n >= 0 && n <= 5) {
                                onChange(val);
                            }
                        }}
                        placeholder="0 - 5"
                        className="w-14 bg-white border border-surface-200 rounded px-1.5 py-0.5 text-[11px] font-mono tabular-nums text-center outline-none focus:border-accent-600"
                    />
                </div>
            </div>
        </div>
    );
};

const BarcodeFieldInput = ({
    value,
    onChange,
    hasError,
}: {
    value: string;
    onChange: (val: string) => void;
    hasError?: boolean;
}) => {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder="Scan or enter barcode / SKU..."
                        className={`w-full bg-white border rounded px-3 py-2 text-sm font-mono tracking-wider outline-none focus:border-accent-600 transition-all pr-8 ${
                            hasError ? 'border-coral-500 focus:border-coral-600' : 'border-surface-300'
                        }`}
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-surface-400">
                        <i className="fa-solid fa-barcode text-xs" />
                    </div>
                </div>

                {value && (
                    <button
                        type="button"
                        onClick={() => onChange("")}
                        className="w-8 h-8 rounded hover:bg-coral-50 text-surface-400 hover:text-coral-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                        title="Clear barcode"
                    >
                        <i className="fa-solid fa-xmark text-xs" />
                    </button>
                )}
            </div>

            {value && (
                <div className="p-2.5 bg-surface-50 border border-surface-200 rounded-lg flex flex-col items-center justify-center overflow-x-auto">
                    <BarcodeSvg
                        value={value}
                        height={50}
                        moduleWidth={2}
                        showText={true}
                        className="border-none p-0 bg-transparent"
                    />
                </div>
            )}
        </div>
    );
};

const DurationFieldInput = ({
    value,
    onChange,
    hasError,
}: {
    value: string;
    onChange: (val: string) => void;
    hasError?: boolean;
}) => {
    const totalSec = value !== "" && !isNaN(Number(value)) ? Math.max(0, Math.round(Number(value))) : null;

    const hours = totalSec !== null ? Math.floor(totalSec / 3600) : "";
    const minutes = totalSec !== null ? Math.floor((totalSec % 3600) / 60) : "";
    const seconds = totalSec !== null ? totalSec % 60 : "";

    const updateParts = (newH: number, newM: number, newS: number) => {
        const safeH = Math.max(0, newH || 0);
        const safeM = Math.max(0, newM || 0);
        const safeS = Math.max(0, newS || 0);
        const total = safeH * 3600 + safeM * 60 + safeS;
        onChange(total > 0 ? String(total) : (newH !== 0 || newM !== 0 || newS !== 0 ? "0" : ""));
    };

    const addSeconds = (add: number) => {
        const current = totalSec || 0;
        const next = Math.max(0, current + add);
        onChange(next > 0 ? String(next) : "");
    };

    return (
        <div className={`p-2.5 rounded-lg border bg-surface-50/50 space-y-2.5 transition-all ${
            hasError ? 'border-coral-500' : 'border-surface-200'
        }`}>
            <div className="grid grid-cols-3 gap-2">
                <div>
                    <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wider block mb-1">
                        Hours
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            min="0"
                            value={hours}
                            onChange={(e) => updateParts(
                                e.target.value === "" ? 0 : Number(e.target.value),
                                typeof minutes === "number" ? minutes : 0,
                                typeof seconds === "number" ? seconds : 0
                            )}
                            placeholder="0"
                            className="w-full bg-white border border-surface-300 rounded px-2.5 py-1.5 text-xs font-mono tabular-nums outline-none focus:border-accent-600 pr-6"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-surface-400 font-medium">h</span>
                    </div>
                </div>

                <div>
                    <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wider block mb-1">
                        Minutes
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            min="0"
                            max="59"
                            value={minutes}
                            onChange={(e) => updateParts(
                                typeof hours === "number" ? hours : 0,
                                e.target.value === "" ? 0 : Number(e.target.value),
                                typeof seconds === "number" ? seconds : 0
                            )}
                            placeholder="0"
                            className="w-full bg-white border border-surface-300 rounded px-2.5 py-1.5 text-xs font-mono tabular-nums outline-none focus:border-accent-600 pr-6"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-surface-400 font-medium">m</span>
                    </div>
                </div>

                <div>
                    <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wider block mb-1">
                        Seconds
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            min="0"
                            max="59"
                            value={seconds}
                            onChange={(e) => updateParts(
                                typeof hours === "number" ? hours : 0,
                                typeof minutes === "number" ? minutes : 0,
                                e.target.value === "" ? 0 : Number(e.target.value)
                            )}
                            placeholder="0"
                            className="w-full bg-white border border-surface-300 rounded px-2.5 py-1.5 text-xs font-mono tabular-nums outline-none focus:border-accent-600 pr-6"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-surface-400 font-medium">s</span>
                    </div>
                </div>
            </div>

            {/* Presets and formatted preview */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-surface-200/70 text-[11px] flex-wrap">
                <div className="flex items-center gap-1">
                    <span className="text-[10px] text-surface-400 font-medium mr-0.5">Quick:</span>
                    {[
                        { label: "+15m", sec: 900 },
                        { label: "+30m", sec: 1800 },
                        { label: "+1h", sec: 3600 },
                        { label: "+4h", sec: 14400 },
                    ].map(p => (
                        <button
                            key={p.label}
                            type="button"
                            onClick={() => addSeconds(p.sec)}
                            className="px-1.5 py-0.5 bg-white border border-surface-200 hover:border-accent-400 rounded text-[10px] text-surface-600 hover:text-accent-700 transition-colors cursor-pointer"
                        >
                            {p.label}
                        </button>
                    ))}
                    {totalSec !== null && totalSec > 0 && (
                        <button
                            type="button"
                            onClick={() => onChange("")}
                            className="px-1.5 py-0.5 text-[10px] text-coral-600 hover:underline cursor-pointer ml-1"
                        >
                            Clear
                        </button>
                    )}
                </div>

                {totalSec !== null && (
                    <div className="font-mono text-[11px] text-surface-700 font-semibold bg-white px-2 py-0.5 rounded border border-surface-200 flex items-center gap-1">
                        <i className="fa-solid fa-stopwatch text-accent-500 text-[10px]" />
                        <span>{formatDuration(totalSec)}</span>
                        <span className="text-surface-400 font-normal text-[10px]">({totalSec.toLocaleString()}s)</span>
                    </div>
                )}
            </div>
        </div>
    );
};

interface RowCoreModalProps {
    table: Datatable;
    row?: DatatableRow;
    onSave: (values: Record<string, string>) => Promise<void>;
    onCancel: () => void;
    onDelete?: () => Promise<void>;
    submitLabel: string;
}

const RowCoreModal = ({ table, row, onSave, onCancel, onDelete, submitLabel }: RowCoreModalProps) => {
    const [cellValues, setCellValues] = useState<Record<string, string>>({});
    const [validationErrors, setValidationErrors] = useState<Record<string, string | boolean>>({});
    const [pickerColumn, setPickerColumn] = useState<DatatableColumn | null>(null);

    useEffect(() => {
        if (row) {
            const initialValues: Record<string, string> = {};
            table.columns?.forEach(column => {
                initialValues[column.slug] = getCellValue(row, column);
            });
            setCellValues(initialValues);
        }
    }, [row, table.columns]);

    const validateAndSave = () => {
        const errors: Record<string, string | boolean> = {};
        let hasErrors = false;

        table.columns?.forEach(column => {
            if (column.column_type === 'reverse_ref') return;
            const value = cellValues[column.slug] || "";

            if (column.required) {
                if (!value.trim() || value === "[]") {
                    errors[column.slug] = "This field is required";
                    hasErrors = true;
                    return;
                }
            }

            // Regex validation for text columns
            if (column.column_type === 'text' && value.trim()) {
                const patternConfig = parseTextPatternConfig(column.options);
                if (patternConfig.pattern) {
                    try {
                        const regex = new RegExp(patternConfig.pattern);
                        if (!regex.test(value)) {
                            errors[column.slug] = patternConfig.description || `Must match pattern: ${patternConfig.pattern}`;
                            hasErrors = true;
                        }
                    } catch {
                        // Ignore malformed regex in config
                    }
                }
            }
        });

        setValidationErrors(errors);

        if (!hasErrors) {
            const payload: Record<string, string> = {};
            table.columns?.forEach(column => {
                if (column.column_type !== 'reverse_ref') {
                    payload[column.slug] = cellValues[column.slug] !== undefined ? cellValues[column.slug] : "";
                }
            });
            onSave(payload);
        }
    };

    const handleValueChange = (slug: string, value: string) => {
        setCellValues(prev => ({ ...prev, [slug]: value }));
        if (validationErrors[slug]) {
            setValidationErrors(prev => {
                const next = { ...prev };
                delete next[slug];
                return next;
            });
        }
    };

    const renderFieldEditor = (column: DatatableColumn, currentValue: string) => {
        const baseInputClasses = `w-full bg-white border rounded px-3 py-2 text-sm outline-none focus:border-accent-600 transition-all ${
            validationErrors[column.slug] 
                ? 'border-coral-500 focus:border-coral-600' 
                : 'border-surface-300'
        }`;

        const onChange = (val: string) => handleValueChange(column.slug, val);

        switch (column.column_type) {
            case 'reverse_ref':
                return (
                    <ReverseRefFieldView
                        column={column}
                        row={row}
                    />
                );

            case 'ref':
                return (
                    <RefFieldInput
                        column={column}
                        value={currentValue}
                        onOpenPicker={() => setPickerColumn(column)}
                        onClear={() => onChange("")}
                        hasError={!!validationErrors[column.slug]}
                    />
                );

            case 'multiref':
                return (
                    <MultiRefFieldInput
                        column={column}
                        value={currentValue}
                        onOpenPicker={() => setPickerColumn(column)}
                        onChange={onChange}
                        hasError={!!validationErrors[column.slug]}
                    />
                );

            case 'textarea':
                return (
                    <textarea
                        value={currentValue}
                        onChange={(e) => onChange(e.target.value)}
                        className={baseInputClasses}
                        rows={4}
                    />
                );

            case 'checkbox':
                const isChecked = currentValue.toLowerCase() === 'true' || currentValue === '1';
                return (
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
                            className="w-5 h-5 text-accent-600 border-surface-300 rounded focus:ring-accent-500 focus:ring-2"
                        />
                        <span className="text-sm text-surface-600">
                            {isChecked ? 'Yes' : 'No'}
                        </span>
                    </label>
                );

            case 'date':
                return (
                    <div className="relative">
                        <input
                            type="date"
                            value={currentValue}
                            onChange={(e) => onChange(e.target.value)}
                            className={baseInputClasses}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-surface-400">
                            <i className="fa-solid fa-calendar text-[10px]"></i>
                        </div>
                    </div>
                );

            case 'datetime':
            case 'date_time':
            case 'date-time':
                return (
                    <div className="relative">
                        <input
                            type="datetime-local"
                            value={currentValue}
                            onChange={(e) => onChange(e.target.value)}
                            className={baseInputClasses}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-surface-400">
                            <i className="fa-solid fa-calendar-days text-[10px]"></i>
                        </div>
                    </div>
                );

            case 'time':
                return (
                    <div className="relative">
                        <input
                            type="time"
                            value={currentValue}
                            onChange={(e) => onChange(e.target.value)}
                            className={baseInputClasses}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-surface-400">
                            <i className="fa-regular fa-clock text-[10px]"></i>
                        </div>
                    </div>
                );

            case 'duration':
                return (
                    <DurationFieldInput
                        value={currentValue}
                        onChange={onChange}
                        hasError={!!validationErrors[column.slug]}
                    />
                );

            case 'number':
                return (
                    <input
                        type="number"
                        value={currentValue}
                        onChange={(e) => onChange(e.target.value)}
                        className={baseInputClasses}
                        placeholder="0"
                    />
                );

            case 'email':
                return (
                    <div className="relative">
                        <input
                            type="email"
                            value={currentValue}
                            onChange={(e) => onChange(e.target.value)}
                            className={baseInputClasses}
                            placeholder="user@example.com"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-surface-400">
                            <i className="fa-solid fa-envelope text-[10px]"></i>
                        </div>
                    </div>
                );

            case 'percent': {
                const numVal = Number(currentValue);
                const validPercent = currentValue !== "" && !isNaN(numVal);
                const clampedVal = validPercent ? Math.min(100, Math.max(0, numVal)) : 0;
                return (
                    <div className="space-y-1.5">
                        <div className="relative">
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="any"
                                value={currentValue}
                                onChange={(e) => onChange(e.target.value)}
                                className={`${baseInputClasses} pr-8 font-mono tabular-nums`}
                                placeholder="0 - 100"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-surface-400 font-semibold text-xs">
                                %
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={clampedVal}
                                onChange={(e) => onChange(e.target.value)}
                                className="flex-1 accent-accent-600 h-1.5 bg-surface-200 rounded-lg cursor-pointer"
                            />
                            <div className="flex items-center gap-1 shrink-0">
                                {[0, 25, 50, 75, 100].map(p => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => onChange(String(p))}
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                                            currentValue === String(p)
                                                ? 'bg-accent-600 text-white font-bold'
                                                : 'bg-surface-100 hover:bg-surface-200 text-surface-600'
                                        }`}
                                    >
                                        {p}%
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            }

            case 'rating':
                return (
                    <RatingFieldInput
                        value={currentValue}
                        onChange={onChange}
                        hasError={!!validationErrors[column.slug]}
                    />
                );

            case 'barcode':
                return (
                    <BarcodeFieldInput
                        value={currentValue}
                        onChange={onChange}
                        hasError={!!validationErrors[column.slug]}
                    />
                );

            case 'link':
                return (
                    <div className="space-y-1">
                        <div className="relative">
                            <input
                                type="url"
                                value={currentValue}
                                onChange={(e) => onChange(e.target.value)}
                                className={baseInputClasses}
                                placeholder="https://example.com"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-surface-400">
                                <i className="fa-solid fa-link text-[10px]"></i>
                            </div>
                        </div>
                        {currentValue && (
                            <a 
                                href={currentValue} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[10px] text-accent-600 hover:text-accent-700 flex items-center gap-1"
                            >
                                <i className="fa-solid fa-external-link"></i>
                                Open link
                            </a>
                        )}
                    </div>
                );

            case 'image':
                return (
                    <ImageFieldInput
                        value={currentValue}
                        onChange={onChange}
                        hasError={!!validationErrors[column.slug]}
                    />
                );

            case 'file':
                return (
                    <FileFieldInput
                        value={currentValue}
                        onChange={onChange}
                        hasError={!!validationErrors[column.slug]}
                    />
                );

            case 'dropdown':
            case 'radio': {
                const options = column.options ? column.options.split(',').map((opt: string) => opt.trim()).filter((opt: string) => opt) : [];
                if (options.length > 0) {
                    return (
                        <div className="relative">
                            <select
                                value={currentValue}
                                onChange={(e) => onChange(e.target.value)}
                                className={`${baseInputClasses} appearance-none cursor-pointer pr-10`}
                            >
                                <option value="">-- Select --</option>
                                {options.map((option: string, idx: number) => (
                                    <option key={idx} value={option}>{option}</option>
                                ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-surface-400">
                                <i className="fa-solid fa-chevron-down text-[10px]"></i>
                            </div>
                        </div>
                    );
                }
                return (
                    <input
                        type="text"
                        value={currentValue}
                        onChange={(e) => onChange(e.target.value)}
                        className={baseInputClasses}
                    />
                );
            }

            case 'multiselect': {
                const options = column.options ? column.options.split(',').map((opt: string) => opt.trim()).filter((opt: string) => opt) : [];
                const selectedValues = currentValue ? currentValue.split(',').map((v: string) => v.trim()) : [];
                
                if (options.length > 0) {
                    return (
                        <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                                {options.map((option: string, idx: number) => {
                                    const isSelected = selectedValues.includes(option);
                                    return (
                                        <label
                                            key={idx}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm cursor-pointer border transition-all ${
                                                isSelected
                                                    ? 'bg-accent-50 text-accent-700 border-accent-300'
                                                    : 'bg-white text-surface-600 border-surface-300 hover:border-accent-300'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={(e) => {
                                                    let newValues: string[];
                                                    if (e.target.checked) {
                                                        newValues = [...selectedValues, option];
                                                    } else {
                                                        newValues = selectedValues.filter((v: string) => v !== option);
                                                    }
                                                    onChange(newValues.join(', '));
                                                }}
                                                className="w-4 h-4 text-accent-600 border-surface-300 rounded focus:ring-accent-500"
                                            />
                                            <span className="text-[11px] font-medium">{option}</span>
                                        </label>
                                    );
                                })}
                            </div>
                            {selectedValues.length > 0 && (
                                <p className="text-[10px] text-surface-400">Selected: {selectedValues.join(', ')}</p>
                            )}
                        </div>
                    );
                }
                return (
                    <input
                        type="text"
                        value={currentValue}
                        onChange={(e) => onChange(e.target.value)}
                        className={baseInputClasses}
                    />
                );
            }

            case 'text':
            default: {
                const patternConfig = parseTextPatternConfig(column.options);
                return (
                    <div className="space-y-1">
                        <div className="relative">
                            <input
                                type="text"
                                value={currentValue}
                                onChange={(e) => onChange(e.target.value)}
                                className={baseInputClasses}
                                placeholder={patternConfig.pattern ? `Matches: ${patternConfig.pattern}` : undefined}
                            />
                            {patternConfig.pattern && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-surface-400" title={`Pattern: ${patternConfig.pattern}`}>
                                    <i className="fa-solid fa-code text-[10px]"></i>
                                </div>
                            )}
                        </div>
                        {patternConfig.description && (
                            <p className="text-[10px] text-surface-400 flex items-center gap-1">
                                <i className="fa-solid fa-circle-info text-[9px]" />
                                <span>{patternConfig.description}</span>
                            </p>
                        )}
                    </div>
                );
            }
        }
    };

    return (
        <div className="space-y-4">
            <div className="max-h-[50vh] overflow-y-auto pr-2 space-y-4">
                {table.columns?.map((column) => {
                    const currentValue = cellValues[column.slug] || "";

                    return (
                        <div key={column.id} className="space-y-1">
                            <label className="text-[11px] font-bold text-surface-500 uppercase tracking-tight">
                                {column.name}
                                {column.required && <span className="text-coral-600 ml-1">*</span>}
                            </label>
                            {renderFieldEditor(column, currentValue)}
                            {validationErrors[column.slug] && (
                                <p className="text-[10px] text-coral-600 mt-0.5">
                                    {typeof validationErrors[column.slug] === 'string'
                                        ? validationErrors[column.slug]
                                        : 'This field is required'}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className={`flex ${onDelete ? 'justify-between' : 'justify-end'} pt-4 border-t border-surface-100`}>
                {onDelete && (
                    <button
                        onClick={onDelete}
                        className="px-3 py-2 text-sm font-bold text-coral-600 hover:bg-coral-50 rounded transition-colors"
                    >
                        Delete Row
                    </button>
                )}
                <div className="flex gap-2">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50 rounded transition-colors"
                    >
                        {onDelete ? 'Discard' : 'Cancel'}
                    </button>
                    <button
                        onClick={validateAndSave}
                        className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700 transition-all shadow-sm"
                    >
                        {submitLabel}
                    </button>
                </div>
            </div>

            {/* Table Ref Picker Modal Overlay */}
            {pickerColumn && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
                    onClick={() => setPickerColumn(null)}
                >
                    <div 
                        className="bg-white rounded-xl shadow-2xl border border-surface-200 w-full max-w-2xl overflow-hidden p-5 animate-scale-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between pb-3 mb-3 border-b border-surface-200">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded bg-accent-50 text-accent-600 flex items-center justify-center">
                                    <i className={`fa-solid fa-${pickerColumn.column_type === 'multiref' ? 'layer-group' : 'arrow-up-right-from-square'} text-xs`} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-surface-900">
                                        Select {pickerColumn.name} {pickerColumn.column_type === 'multiref' ? '(Multi-Ref)' : ''}
                                    </h3>
                                    <p className="text-[11px] text-surface-500">
                                        {pickerColumn.column_type === 'multiref'
                                            ? 'Select multiple referenced records to link to this field'
                                            : 'Pick a referenced record to link to this field'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPickerColumn(null)}
                                className="text-surface-400 hover:text-surface-600 transition-colors p-1 cursor-pointer"
                            >
                                <i className="fa-solid fa-xmark text-sm" />
                            </button>
                        </div>
                        <RefPickerModal
                            tableId={parseRefOptions(pickerColumn.options)?.target_table_id || 0}
                            isMulti={pickerColumn.column_type === 'multiref'}
                            selectedRowId={pickerColumn.column_type !== 'multiref' ? cellValues[pickerColumn.slug] : undefined}
                            selectedRowIds={pickerColumn.column_type === 'multiref' ? parseRefIds(cellValues[pickerColumn.slug]) : undefined}
                            identityColumnSlug={parseRefOptions(pickerColumn.options)?.identity_column}
                            onSelect={(selectedRow) => {
                                handleValueChange(pickerColumn.slug, String(selectedRow.id));
                                setPickerColumn(null);
                            }}
                            onSelectMulti={(selectedRows) => {
                                handleValueChange(pickerColumn.slug, selectedRows.map(r => r.id).join(', '));
                                setPickerColumn(null);
                            }}
                            onClear={() => {
                                handleValueChange(pickerColumn.slug, "");
                                setPickerColumn(null);
                            }}
                            onCancel={() => setPickerColumn(null)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default RowCoreModal;
