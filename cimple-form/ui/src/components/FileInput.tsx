import React, { useState, useRef } from 'react';
import type { FileValue } from '../pages/Builder/sub/ftype';
import {
  openSpaceFilePicker,
  uploadSpaceFile,
  formatFileSize,
  getFileIconClass,
  isImageFile,
  getSpaceToken,
} from '../lib/spaceFile';

interface FileInputProps {
  value?: FileValue | null | string;
  onChange: (val: FileValue | null) => void;
  accept?: string;
  placeholder?: string;
  disabled?: boolean;
}

export const FileInput: React.FC<FileInputProps> = ({
  value,
  onChange,
  accept,
  placeholder,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Normalize value if it was saved as a string url or id
  const currentFile: FileValue | null = React.useMemo(() => {
    if (!value) return null;
    if (typeof value === 'object' && value.id) {
      return value as FileValue;
    }
    if (typeof value === 'string' && value.trim()) {
      return {
        id: value,
        name: value.split('/').pop() || 'Attached file',
        size: 0,
        url: value.startsWith('http') || value.startsWith('/zz') ? value : `/zz/api/core/space_file/preview/${value}`,
        download_url: value.startsWith('http') || value.startsWith('/zz') ? value : `/zz/api/core/space_file/download/${value}`,
      };
    }
    return null;
  }, [value]);

  const handleNativeUpload = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    try {
      const uploaded = await uploadSpaceFile(file);
      onChange(uploaded);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleNativeUpload(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isUploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleNativeUpload(file);
    }
  };

  const handleOpenPicker = () => {
    if (disabled || isUploading) return;
    setUploadError(null);
    const opened = openSpaceFilePicker((file) => {
      onChange(file);
    });

    // Fallback: if space picker modal is not available, open native file selector
    if (!opened && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const hasSpaceToken = Boolean(getSpaceToken());

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />

      {currentFile ? (
        <div className="flex items-center justify-between p-3 bg-white border border-[#CBCEC3] rounded-xl shadow-xs transition-all hover:border-[#2E6E52]/60">
          <div className="flex items-center gap-3 min-w-0">
            {isImageFile(currentFile.name || currentFile.mime) && currentFile.url ? (
              <img
                src={currentFile.url}
                alt={currentFile.name}
                className="w-10 h-10 rounded-lg object-cover border border-[#E1E3DB] flex-shrink-0 bg-gray-50"
              />
            ) : (
              <span className="w-10 h-10 rounded-lg bg-[#FAFAF7] border border-[#E1E3DB] flex items-center justify-center text-lg flex-shrink-0">
                <i className={getFileIconClass(currentFile.name || currentFile.mime)}></i>
              </span>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate" title={currentFile.name}>
                {currentFile.name}
              </p>
              <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                {currentFile.size > 0 ? formatFileSize(currentFile.size) : 'File attached'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
            {currentFile.url && (
              <a
                href={currentFile.url}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-[#EEF0EA] rounded-md transition-colors text-xs"
                title="Preview file"
              >
                <i className="fa-solid fa-arrow-up-right-from-square"></i>
              </a>
            )}
            {currentFile.download_url && (
              <a
                href={currentFile.download_url}
                download={currentFile.name}
                className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-[#EEF0EA] rounded-md transition-colors text-xs"
                title="Download file"
              >
                <i className="fa-solid fa-download"></i>
              </a>
            )}
            {!disabled && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2 py-1 text-[11px] font-semibold text-gray-600 hover:text-gray-900 hover:bg-[#EEF0EA] rounded-md transition-colors"
                  title="Replace file"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={() => onChange(null)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors text-xs"
                  title="Remove file"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-5 text-center transition-all ${
            isDragging
              ? 'border-[#2E6E52] bg-[#2E6E52]/5'
              : 'border-[#CBCEC3] hover:border-gray-400 bg-[#FAFAF7]'
          } ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-2">
              <i className="fa-solid fa-circle-notch fa-spin text-xl text-[#2E6E52]"></i>
              <span className="text-xs font-semibold text-gray-700">Uploading file to space...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-10 h-10 rounded-full bg-white border border-[#E1E3DB] shadow-xs flex items-center justify-center text-gray-500 text-sm">
                <i className="fa-solid fa-cloud-arrow-up"></i>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-800">
                  {placeholder || 'Drop file here, or choose an option below'}
                </p>
                {accept && (
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Accepted formats: {accept}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-[#CBCEC3] rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-laptop text-[11px] text-gray-500"></i>
                  <span>Upload from device</span>
                </button>

                {hasSpaceToken && (
                  <button
                    type="button"
                    onClick={handleOpenPicker}
                    className="px-3 py-1.5 text-xs font-semibold text-[#2E6E52] bg-[#2E6E52]/10 hover:bg-[#2E6E52]/15 border border-[#2E6E52]/20 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-folder-open text-[11px]"></i>
                    <span>Space Files</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {uploadError && (
        <p className="text-xs text-red-500 font-medium mt-1.5 flex items-center gap-1">
          <i className="fa-solid fa-circle-exclamation"></i>
          <span>{uploadError}</span>
        </p>
      )}
    </div>
  );
};
