import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FolderArchive, 
  Link as LinkIcon, 
  X, 
  Image as ImageIcon,
  Check
} from 'lucide-react';
import { 
  openSpaceFilePicker, 
  uploadSpaceFile, 
  hasSpaceFilePicker, 
  isImageFile 
} from '../lib/spaceFile';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (imageUrl: string, caption?: string) => void;
}

export const ImageModal: React.FC<ImageModalProps> = ({
  isOpen,
  onClose,
  onInsert,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'space' | 'link'>('upload');
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isImageFile(file.name) && !file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file (PNG, JPG, GIF, WebP, SVG).');
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    try {
      const spaceFile = await uploadSpaceFile(file, 'doks/images');
      const finalUrl = spaceFile.url || '';
      setImageUrl(finalUrl);
      setPreviewUrl(finalUrl);
      if (!caption) {
        // Set filename as default caption hint if empty
        const cleanName = file.name.replace(/\.[^/.]+$/, '');
        setCaption(cleanName);
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadError('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenSpacePicker = () => {
    setUploadError(null);
    const opened = openSpaceFilePicker((file) => {
      if (file.url) {
        setImageUrl(file.url);
        setPreviewUrl(file.url);
        if (!caption && file.name) {
          setCaption(file.name.replace(/\.[^/.]+$/, ''));
        }
      }
    });

    if (!opened) {
      setUploadError('Space file picker is not available in this environment.');
    }
  };

  const handleInsert = () => {
    const targetUrl = imageUrl.trim() || previewUrl.trim();
    if (!targetUrl) return;

    onInsert(targetUrl, caption.trim());
    // Reset state
    setImageUrl('');
    setCaption('');
    setPreviewUrl('');
    setUploadError(null);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-xs select-none"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg rounded-2xl border border-[#dfdfda] bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#e7e7e3]">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#edf3ff] text-[#2f6fed]">
              <ImageIcon className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-[#20201d]">Insert Image</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#8a8a81] hover:bg-[#f1f1ed] hover:text-[#20201d]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-3 flex gap-1 rounded-lg bg-[#f1f1ed] p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition-colors ${
              activeTab === 'upload'
                ? 'bg-white text-[#20201d] shadow-xs'
                : 'text-[#67675f] hover:text-[#20201d]'
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('space')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition-colors ${
              activeTab === 'space'
                ? 'bg-white text-[#20201d] shadow-xs'
                : 'text-[#67675f] hover:text-[#20201d]'
            }`}
          >
            <FolderArchive className="h-3.5 w-3.5" />
            Space Files
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition-colors ${
              activeTab === 'link'
                ? 'bg-white text-[#20201d] shadow-xs'
                : 'text-[#67675f] hover:text-[#20201d]'
            }`}
          >
            <LinkIcon className="h-3.5 w-3.5" />
            Embed Link
          </button>
        </div>

        {/* Tab Body */}
        <div className="mt-4">
          {activeTab === 'upload' && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#d9d9d4] bg-[#fafaf8] p-6 text-center cursor-pointer transition-colors hover:border-[#2f6fed] hover:bg-[#f7f9ff]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f1f1ed] text-[#67675f] mb-2">
                  <Upload className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold text-[#20201d]">
                  Click to select an image or drag & drop
                </p>
                <p className="text-[11px] text-[#9a9a92] mt-0.5">
                  PNG, JPG, GIF, WebP or SVG up to 10MB
                </p>
              </div>
            </div>
          )}

          {activeTab === 'space' && (
            <div className="text-center py-4">
              <p className="text-xs text-[#67675f] mb-3">
                Select an image from your Potatoverse Space library.
              </p>
              <button
                type="button"
                onClick={handleOpenSpacePicker}
                className="inline-flex items-center gap-2 rounded-lg bg-[#242421] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#343430]"
              >
                <FolderArchive className="h-4 w-4" />
                Browse Space Files
              </button>
              {!hasSpaceFilePicker() && (
                <p className="text-[11px] text-[#9a9a92] mt-2 italic">
                  Note: Space File Picker is available when running inside Potatoverse.
                </p>
              )}
            </div>
          )}

          {activeTab === 'link' && (
            <div>
              <label className="block text-xs font-medium text-[#67675f] mb-1">
                Image Web Link
              </label>
              <div className="flex items-center rounded-lg border border-[#d9d9d4] bg-white px-2.5 py-1.5 focus-within:border-[#2f6fed]">
                <LinkIcon className="h-3.5 w-3.5 text-[#9a9a92] mr-2 flex-shrink-0" />
                <input
                  type="url"
                  placeholder="https://example.com/image.png"
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    setPreviewUrl(e.target.value);
                  }}
                  className="w-full text-xs text-[#20201d] outline-none placeholder:text-[#9a9a92]"
                />
              </div>
            </div>
          )}

          {/* Loading or Error states */}
          {isUploading && (
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-[#2f6fed]">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#2f6fed] border-t-transparent" />
              <span>Uploading image…</span>
            </div>
          )}

          {uploadError && (
            <p className="mt-2 text-xs text-red-600">{uploadError}</p>
          )}

          {/* Preview & Caption (if an image is selected) */}
          {previewUrl && (
            <div className="mt-4 rounded-xl border border-[#e7e7e3] bg-[#fafaf8] p-3">
              <div className="relative max-h-48 overflow-hidden rounded-lg bg-white border border-[#e7e7e3] flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-48 w-auto object-contain"
                  onError={() => setUploadError('Could not load image from provided URL.')}
                />
              </div>

              <div className="mt-2.5">
                <label className="block text-[11px] font-medium text-[#67675f] mb-1">
                  Caption (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Add a caption for this image…"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full rounded-md border border-[#e7e7e3] bg-white px-2.5 py-1 text-xs text-[#20201d] outline-none focus:border-[#2f6fed]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-5 flex items-center justify-end gap-2 border-t border-[#e7e7e3] pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#67675f] hover:bg-[#f1f1ed] hover:text-[#20201d]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!previewUrl || isUploading}
            onClick={handleInsert}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#242421] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#343430] disabled:opacity-40 disabled:pointer-events-none"
          >
            <Check className="h-3.5 w-3.5" />
            Insert Image
          </button>
        </div>
      </div>
    </div>
  );
};
