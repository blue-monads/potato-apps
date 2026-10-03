import { useRef } from 'react';
import type { CardType } from './types';
import { TYPE_CONFIG } from './cardPresets';
import {
  X,
  FileText,
  StickyNote,
  Image as ImageIcon,
  Link2,
  Quote,
  CheckSquare,
  FolderOpen,
  Upload,
} from 'lucide-react';
import { openSpaceFilePicker, uploadSpaceFile } from '../lib/spaceFile';
import type { SpaceFile } from '../lib/spaceFile';

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: CardType) => void;
  onAddSpaceImage?: (file: SpaceFile) => void;
}

export const AddCardModal: React.FC<AddCardModalProps> = ({
  isOpen,
  onClose,
  onSelectType,
  onAddSpaceImage,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const getIcon = (type: CardType) => {
    switch (type) {
      case 'text': return <FileText className="w-5 h-5 text-blue-500" />;
      case 'note': return <StickyNote className="w-5 h-5 text-amber-500" />;
      case 'image': return <ImageIcon className="w-5 h-5 text-purple-500" />;
      case 'link': return <Link2 className="w-5 h-5 text-emerald-500" />;
      case 'quote': return <Quote className="w-5 h-5 text-amber-600" />;
      case 'list': return <CheckSquare className="w-5 h-5 text-rose-500" />;
    }
  };

  const handlePickSpaceFile = () => {
    const opened = openSpaceFilePicker((file) => {
      if (onAddSpaceImage) {
        onAddSpaceImage(file);
      }
      onClose();
    });
    if (!opened) {
      fileInputRef.current?.click();
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const uploaded = await uploadSpaceFile(file, 'cimple-inficanvas/images');
      if (onAddSpaceImage) {
        onAddSpaceImage(uploaded);
      }
      onClose();
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Add Node to Canvas</h3>
            <p className="text-xs text-slate-400 mt-0.5">Select a card type or pick an image file</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 grid grid-cols-2 gap-3">
          {(Object.keys(TYPE_CONFIG) as CardType[]).map((type) => {
            const config = TYPE_CONFIG[type];
            return (
              <button
                key={type}
                onClick={() => {
                  onSelectType(type);
                  onClose();
                }}
                className="flex flex-col items-start p-3.5 rounded-xl border border-slate-200/80 hover:border-blue-400 hover:bg-blue-50/40 transition-all text-left group"
              >
                <div className="p-2 rounded-lg bg-slate-50 group-hover:bg-white group-hover:shadow-xs transition-colors mb-2">
                  {getIcon(type)}
                </div>
                <div className="font-semibold text-xs text-slate-800 group-hover:text-blue-600">
                  {config.label}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                  {config.description}
                </div>
              </button>
            );
          })}
        </div>

        {/* Space Files Integration */}
        <div className="px-5 pb-5 pt-1 border-t border-slate-100 bg-slate-50/50">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Add from Files & Media
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePickSpaceFile}
              className="flex-1 py-2 px-3 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold shadow-xs transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              Space Files (libspace)
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold shadow-xs transition-colors"
            >
              <Upload className="w-4 h-4" />
              Upload
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleUploadFile}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
