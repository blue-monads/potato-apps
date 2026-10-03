import { useState, useEffect, useRef } from 'react';
import type { NodeCard, CardType, CheckItem } from './types';
import { CARD_COLORS, TYPE_CONFIG, getCardImages } from './cardPresets';
import { X, Trash2, Plus, ExternalLink, FolderOpen, Upload, Loader2, Image as ImageIcon } from 'lucide-react';
import { openSpaceFilePicker, uploadSpaceFile, getFilePreviewUrl } from '../lib/spaceFile';

interface CardEditorDrawerProps {
  card: NodeCard | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: NodeCard) => void;
  onDelete: (cardId: number) => void;
}

export const CardEditorDrawer: React.FC<CardEditorDrawerProps> = ({
  card,
  isOpen,
  onClose,
  onSave,
  onDelete,
}) => {
  const [draft, setDraft] = useState<NodeCard | null>(card);
  const [newItemText, setNewItemText] = useState('');
  const [urlDraft, setUrlDraft] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(card ? { ...card, card_data: { ...(card.card_data || {}) } } : null);
  }, [card]);

  if (!isOpen || !draft) return null;

  const handleFieldChange = (field: keyof NodeCard, value: any) => {
    setDraft((prev) => (prev ? { ...prev, [field]: value } : null));
  };

  const handleDataChange = (field: string, value: any) => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            card_data: {
              ...prev.card_data,
              [field]: value,
            },
          }
        : null
    );
  };

  const handleAddCheckItem = () => {
    if (!newItemText.trim()) return;
    const items: CheckItem[] = draft.card_data.items || [];
    const updated = [
      ...items,
      { id: Date.now().toString(), text: newItemText.trim(), done: false },
    ];
    handleDataChange('items', updated);
    setNewItemText('');
  };

  const handleRemoveCheckItem = (id: string) => {
    const items: CheckItem[] = draft.card_data.items || [];
    handleDataChange(
      'items',
      items.filter((i) => i.id !== id)
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (draft) {
      onSave(draft);
      onClose();
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl border-l border-slate-200 z-50 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: draft.color || '#3b82f6' }}
          />
          <h2 className="text-sm font-bold text-slate-800">Edit Card</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Form Body */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
        {/* Title */}
        <div>
          <label className="block text-slate-600 font-semibold mb-1">Title</label>
          <input
            type="text"
            value={draft.title}
            onChange={(e) => handleFieldChange('title', e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="Card title..."
          />
        </div>

        {/* Card Type */}
        <div>
          <label className="block text-slate-600 font-semibold mb-1">Card Type</label>
          <select
            value={draft.card_type}
            onChange={(e) => handleFieldChange('card_type', e.target.value as CardType)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
          >
            {(Object.keys(TYPE_CONFIG) as CardType[]).map((typeKey) => (
              <option key={typeKey} value={typeKey}>
                {TYPE_CONFIG[typeKey].label}
              </option>
            ))}
          </select>
        </div>

        {/* Color Presets */}
        <div>
          <label className="block text-slate-600 font-semibold mb-1.5">Color Accent</label>
          <div className="flex items-center gap-2 flex-wrap">
            {CARD_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => handleFieldChange('color', c.hex)}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                  draft.color === c.hex ? 'scale-125 border-slate-900 shadow' : 'border-transparent'
                }`}
                style={{ backgroundColor: c.hex }}
                title={c.name}
              />
            ))}
          </div>
        </div>

        {/* Description / Content (for Text, Sticky, Quote, Link) */}
        {(draft.card_type === 'text' || draft.card_type === 'note' || draft.card_type === 'quote') && (
          <div>
            <label className="block text-slate-600 font-semibold mb-1">
              {draft.card_type === 'quote' ? 'Quote Text' : 'Content / Notes'}
            </label>
            <textarea
              rows={4}
              value={draft.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-normal leading-relaxed"
              placeholder="Detailed content..."
            />
          </div>
        )}

        {/* QUOTE SOURCE */}
        {draft.card_type === 'quote' && (
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Author / Source</label>
            <input
              type="text"
              value={draft.card_data.source || ''}
              onChange={(e) => handleDataChange('source', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
              placeholder="e.g. Richard Feynman"
            />
          </div>
        )}

        {/* IMAGE / COLLAGE FIELDS */}
        {draft.card_type === 'image' && (() => {
          const currentImages = getCardImages(draft.card_data);

          const handleRemoveImage = (indexToRemove: number) => {
            const updated = currentImages.filter((_, idx) => idx !== indexToRemove);
            handleDataChange('images', updated);
            handleDataChange('url', updated[0] || '');
          };

          const handleAddImages = (newUrls: string[]) => {
            const valid = newUrls.map((u) => u.trim()).filter(Boolean);
            if (valid.length === 0) return;
            const updated = [...currentImages, ...valid];
            handleDataChange('images', updated);
            handleDataChange('url', updated[0] || '');
          };

          return (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-slate-600 font-semibold">Images in Collage</label>
                  <span className="text-[10px] font-bold bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full border border-purple-200">
                    {currentImages.length} {currentImages.length === 1 ? 'image' : 'images'}
                  </span>
                </div>

                {/* Thumbnails grid */}
                {currentImages.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {currentImages.map((img, idx) => (
                      <div key={idx} className="relative group/thumb rounded-lg overflow-hidden border border-slate-200 bg-slate-100 aspect-square">
                        <img
                          src={getFilePreviewUrl(img)}
                          alt={`Thumbnail ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="absolute top-1 right-1 p-1 rounded-full bg-slate-900/70 hover:bg-rose-600 text-white transition-colors"
                          title="Remove image"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400 text-center mb-3 gap-1">
                    <ImageIcon className="w-6 h-6 text-slate-300" />
                    <span>No images added yet</span>
                  </div>
                )}

                {/* Quick Action Buttons to add images to collage */}
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      const opened = openSpaceFilePicker((file) => {
                        handleAddImages([file.url || file.id]);
                        if (!draft.card_data.caption && file.name) {
                          handleDataChange('caption', file.name);
                        }
                      });
                      if (!opened) {
                        fileInputRef.current?.click();
                      }
                    }}
                    className="flex-1 py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg flex items-center justify-center gap-1.5 font-semibold text-xs transition-colors"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    + Space Files
                  </button>

                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-1.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg flex items-center justify-center gap-1.5 font-semibold text-xs transition-colors disabled:opacity-50"
                  >
                    {isUploading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    {isUploading ? 'Uploading...' : '+ Upload Photos'}
                  </button>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length === 0) return;
                      setIsUploading(true);
                      try {
                        const newUrls: string[] = [];
                        for (const f of files) {
                          const uploaded = await uploadSpaceFile(f, 'cimple-inficanvas/images');
                          newUrls.push(uploaded.url || uploaded.id);
                        }
                        handleAddImages(newUrls);
                        if (!draft.card_data.caption && files[0]?.name) {
                          handleDataChange('caption', files[0].name);
                        }
                      } finally {
                        setIsUploading(false);
                        e.target.value = '';
                      }
                    }}
                  />
                </div>

                {/* Add via URL */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={urlDraft}
                    onChange={(e) => setUrlDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (urlDraft.trim()) {
                          handleAddImages([urlDraft.trim()]);
                          setUrlDraft('');
                        }
                      }
                    }}
                    className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-xs"
                    placeholder="Paste image URL..."
                  />
                  <button
                    type="button"
                    disabled={!urlDraft.trim()}
                    onClick={() => {
                      if (urlDraft.trim()) {
                        handleAddImages([urlDraft.trim()]);
                        setUrlDraft('');
                      }
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white font-semibold rounded-lg text-xs"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Caption</label>
                <input
                  type="text"
                  value={draft.card_data.caption || ''}
                  onChange={(e) => handleDataChange('caption', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-xs"
                  placeholder="Describe collage..."
                />
              </div>
            </div>
          );
        })()}

        {/* LINK FIELDS */}
        {draft.card_type === 'link' && (
          <div className="space-y-3">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Link URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={draft.card_data.url || ''}
                  onChange={(e) => {
                    const url = e.target.value;
                    let domain = '';
                    try {
                      domain = new URL(url).hostname.replace(/^www\./, '');
                    } catch {}
                    handleDataChange('url', url);
                    if (domain) handleDataChange('domain', domain);
                  }}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                  placeholder="https://example.com"
                />
                {draft.card_data.url && (
                  <a
                    href={draft.card_data.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 border border-slate-200 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Link Display Title</label>
              <input
                type="text"
                value={draft.card_data.linkTitle || ''}
                onChange={(e) => handleDataChange('linkTitle', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                placeholder="Page Title or Resource Name"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Notes / Summary</label>
              <textarea
                rows={2}
                value={draft.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                placeholder="Brief takeaway..."
              />
            </div>
          </div>
        )}

        {/* CHECKLIST ITEMS */}
        {draft.card_type === 'list' && (
          <div className="space-y-2">
            <label className="block text-slate-600 font-semibold mb-1">Checklist Items</label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {(draft.card_data.items || []).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 p-1.5 bg-slate-50 rounded border border-slate-200"
                >
                  <span
                    className={`flex-1 truncate ${
                      item.done ? 'line-through text-slate-400' : 'text-slate-700'
                    }`}
                  >
                    {item.text}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCheckItem(item.id)}
                    className="text-slate-400 hover:text-rose-500 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <input
                type="text"
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                placeholder="New item..."
                className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCheckItem();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddCheckItem}
                className="px-3 py-1.5 bg-rose-500 text-white rounded-lg hover:bg-rose-600 flex items-center gap-1 font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
          </div>
        )}

        {/* Drawer Footer Actions */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onDelete(draft.id)}
            className="px-3 py-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg font-semibold flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-sm"
            >
              Save Changes
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
