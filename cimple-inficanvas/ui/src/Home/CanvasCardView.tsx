import { useState } from 'react';
import type { NodeCard, HandlePosition, CheckItem } from './types';
import { getFilePreviewUrl } from '../lib/spaceFile';
import { getCardImages } from './cardPresets';
import {
  FileText,
  StickyNote,
  Image as ImageIcon,
  Link2,
  Quote,
  CheckSquare,
  MoreHorizontal,
  ExternalLink,
  Plus,
  Trash2,
  Copy,
  Edit3,
  GitBranch,
} from 'lucide-react';

interface CanvasCardViewProps {
  card: NodeCard;
  isSelected: boolean;
  isConnectingSource: boolean;
  isSearchMatch?: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onStartDrag: (e: React.MouseEvent, cardId: number) => void;
  onHandleClick: (handle: HandlePosition, e: React.MouseEvent) => void;
  onAddBranch: (direction: HandlePosition, e: React.MouseEvent) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onUpdate: (updated: Partial<NodeCard>) => void;
}

export const CanvasCardView: React.FC<CanvasCardViewProps> = ({
  card,
  isSelected,
  isConnectingSource,
  isSearchMatch,
  onSelect,
  onStartDrag,
  onHandleClick,
  onAddBranch,
  onEdit,
  onDuplicate,
  onDelete,
  onUpdate,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(card.title);
  const [newItemText, setNewItemText] = useState('');

  const type = card.card_type;
  const isSticky = type === 'note';

  const getTypeIcon = () => {
    switch (type) {
      case 'text': return <FileText className="w-3.5 h-3.5" />;
      case 'note': return <StickyNote className="w-3.5 h-3.5" />;
      case 'image': return <ImageIcon className="w-3.5 h-3.5" />;
      case 'link': return <Link2 className="w-3.5 h-3.5" />;
      case 'quote': return <Quote className="w-3.5 h-3.5" />;
      case 'list': return <CheckSquare className="w-3.5 h-3.5" />;
    }
  };

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (titleDraft.trim() !== card.title) {
      onUpdate({ title: titleDraft.trim() || 'Untitled' });
    }
  };

  const toggleCheckItem = (itemId: string) => {
    const items: CheckItem[] = card.card_data.items || [];
    const updated = items.map((it) => (it.id === itemId ? { ...it, done: !it.done } : it));
    onUpdate({
      card_data: { ...card.card_data, items: updated },
    });
  };

  const addCheckItem = () => {
    if (!newItemText.trim()) return;
    const items: CheckItem[] = card.card_data.items || [];
    const newItem: CheckItem = {
      id: Date.now().toString(),
      text: newItemText.trim(),
      done: false,
    };
    onUpdate({
      card_data: { ...card.card_data, items: [...items, newItem] },
    });
    setNewItemText('');
  };

  const removeCheckItem = (itemId: string) => {
    const items: CheckItem[] = card.card_data.items || [];
    onUpdate({
      card_data: { ...card.card_data, items: items.filter((it) => it.id !== itemId) },
    });
  };

  const handleBodyBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const text = e.currentTarget.innerText;
    if (text !== card.description) {
      onUpdate({ description: text });
    }
  };

  const cardStyle: React.CSSProperties = {
    transform: `translate3d(${card.position_x}px, ${card.position_y}px, 0)`,
    width: `${card.size_x}px`,
  };

  const accentColor = card.color || '#3b82f6';

  return (
    <div
      style={cardStyle}
      className={`absolute select-none rounded-xl transition-shadow group ${
        isSticky
          ? 'bg-amber-100/90 text-amber-950 border border-amber-300 shadow-md'
          : 'bg-white text-slate-800 border border-slate-200/90 shadow-sm hover:shadow-md'
      } ${
        isSelected
          ? 'ring-2 ring-blue-500 shadow-lg'
          : isConnectingSource
          ? 'ring-2 ring-dashed ring-blue-400'
          : ''
      } ${isSearchMatch ? 'ring-4 ring-yellow-400 animate-pulse' : ''}`}
      data-card-id={card.id}
      onClick={onSelect}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onEdit();
      }}
    >
      {/* Anchor Handles on 4 Sides */}
      {/* Right Handle */}
      <div
        className="absolute -right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-20 group/handle"
        onClick={(e) => {
          e.stopPropagation();
          onHandleClick('r', e);
        }}
      >
        <button
          title="Connect or drag to link"
          className="w-3.5 h-3.5 rounded-full bg-slate-400 border-2 border-white shadow hover:scale-125 hover:bg-blue-600 transition-transform cursor-crosshair"
        />
        <button
          title="Add branch to right"
          onClick={(e) => {
            e.stopPropagation();
            onAddBranch('r', e);
          }}
          className="hidden group-hover/handle:flex w-4 h-4 rounded-full bg-blue-500 text-white items-center justify-center text-[10px] hover:bg-blue-600 shadow"
        >
          <Plus className="w-2.5 h-2.5" />
        </button>
      </div>

      {/* Left Handle */}
      <div
        className="absolute -left-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-20 group/handle"
        onClick={(e) => {
          e.stopPropagation();
          onHandleClick('l', e);
        }}
      >
        <button
          title="Add branch to left"
          onClick={(e) => {
            e.stopPropagation();
            onAddBranch('l', e);
          }}
          className="hidden group-hover/handle:flex w-4 h-4 rounded-full bg-blue-500 text-white items-center justify-center text-[10px] hover:bg-blue-600 shadow"
        >
          <Plus className="w-2.5 h-2.5" />
        </button>
        <button
          title="Connect or drag to link"
          className="w-3.5 h-3.5 rounded-full bg-slate-400 border-2 border-white shadow hover:scale-125 hover:bg-blue-600 transition-transform cursor-crosshair"
        />
      </div>

      {/* Top Handle */}
      <div
        className="absolute left-1/2 -top-2 -translate-x-1/2 flex flex-col items-center gap-1 z-20 group/handle"
        onClick={(e) => {
          e.stopPropagation();
          onHandleClick('t', e);
        }}
      >
        <button
          title="Add branch above"
          onClick={(e) => {
            e.stopPropagation();
            onAddBranch('t', e);
          }}
          className="hidden group-hover/handle:flex w-4 h-4 rounded-full bg-blue-500 text-white items-center justify-center text-[10px] hover:bg-blue-600 shadow"
        >
          <Plus className="w-2.5 h-2.5" />
        </button>
        <button
          title="Connect or drag to link"
          className="w-3.5 h-3.5 rounded-full bg-slate-400 border-2 border-white shadow hover:scale-125 hover:bg-blue-600 transition-transform cursor-crosshair"
        />
      </div>

      {/* Bottom Handle */}
      <div
        className="absolute left-1/2 -bottom-2 -translate-x-1/2 flex flex-col items-center gap-1 z-20 group/handle"
        onClick={(e) => {
          e.stopPropagation();
          onHandleClick('b', e);
        }}
      >
        <button
          title="Connect or drag to link"
          className="w-3.5 h-3.5 rounded-full bg-slate-400 border-2 border-white shadow hover:scale-125 hover:bg-blue-600 transition-transform cursor-crosshair"
        />
        <button
          title="Add branch below"
          onClick={(e) => {
            e.stopPropagation();
            onAddBranch('b', e);
          }}
          className="hidden group-hover/handle:flex w-4 h-4 rounded-full bg-blue-500 text-white items-center justify-center text-[10px] hover:bg-blue-600 shadow"
        >
          <Plus className="w-2.5 h-2.5" />
        </button>
      </div>

      {/* Card Header */}
      <div
        onMouseDown={(e) => onStartDrag(e, card.id)}
        className={`px-3 py-2 flex items-center justify-between border-b rounded-t-xl cursor-move transition-colors ${
          isSticky
            ? 'border-amber-200/80 bg-amber-200/40'
            : 'border-slate-100 bg-slate-50/60 hover:bg-slate-100/60'
        }`}
      >
        <div className="flex items-center gap-2 overflow-hidden flex-1 mr-2">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: accentColor }}
          />
          <span className="text-slate-400 shrink-0">{getTypeIcon()}</span>

          {isEditingTitle ? (
            <input
              type="text"
              value={titleDraft}
              autoFocus
              className="font-semibold text-xs px-1 py-0.5 border border-blue-400 rounded bg-white w-full outline-none"
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSubmit();
                if (e.key === 'Escape') {
                  setTitleDraft(card.title);
                  setIsEditingTitle(false);
                }
              }}
            />
          ) : (
            <span
              className="font-semibold text-xs truncate cursor-text"
              title="Double click to edit title"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditingTitle(true);
              }}
            >
              {card.title || 'Untitled'}
            </span>
          )}
        </div>

        {/* 3-dots actions menu button */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>

          {showMenu && (
            <div
              className="absolute right-0 top-7 w-40 bg-white border border-slate-200 shadow-xl rounded-lg py-1 z-50 text-xs font-medium text-slate-700"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-50 text-left"
                onClick={() => {
                  setShowMenu(false);
                  onEdit();
                }}
              >
                <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                Edit Details
              </button>
              <button
                className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-50 text-left"
                onClick={() => {
                  setShowMenu(false);
                  onAddBranch('r', {} as any);
                }}
              >
                <GitBranch className="w-3.5 h-3.5 text-emerald-500" />
                Add Branch
              </button>
              <button
                className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-50 text-left"
                onClick={() => {
                  setShowMenu(false);
                  onDuplicate();
                }}
              >
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                Duplicate
              </button>
              <hr className="my-1 border-slate-100" />
              <button
                className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-rose-50 text-rose-600 text-left"
                onClick={() => {
                  setShowMenu(false);
                  onDelete();
                }}
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                Delete Card
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Card Body by Type */}
      <div className="p-3 text-xs leading-relaxed overflow-hidden">
        {/* TEXT NOTE / STICKY */}
        {(type === 'text' || type === 'note') && (
          <div
            contentEditable
            suppressContentEditableWarning
            onBlur={handleBodyBlur}
            className={`min-h-[60px] outline-none rounded p-1 cursor-text select-text whitespace-pre-wrap ${
              isSticky ? 'text-amber-950 font-normal' : 'text-slate-600'
            }`}
          >
            {card.description || 'Start typing a thought...'}
          </div>
        )}

        {/* IMAGE / COLLAGE */}
        {type === 'image' && (() => {
          const images = getCardImages(card.card_data);
          return (
            <div className="space-y-2">
              {images.length === 0 ? (
                <div className="h-32 rounded-lg bg-slate-100 flex flex-col items-center justify-center text-slate-400 gap-1">
                  <ImageIcon className="w-5 h-5 text-slate-300" />
                  <span className="text-[11px]">No images in collage</span>
                </div>
              ) : images.length === 1 ? (
                <div className="overflow-hidden rounded-lg border border-slate-100 bg-slate-100 h-44">
                  <img
                    src={getFilePreviewUrl(images[0])}
                    alt={card.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.opacity = '0.3';
                    }}
                  />
                </div>
              ) : images.length === 2 ? (
                <div className="grid grid-cols-2 gap-1.5 h-36">
                  {images.map((img, idx) => (
                    <div key={idx} className="overflow-hidden rounded-md border border-slate-100 bg-slate-100 h-full">
                      <img
                        src={getFilePreviewUrl(img)}
                        alt={`Collage ${idx + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLElement).style.opacity = '0.3'; }}
                      />
                    </div>
                  ))}
                </div>
              ) : images.length === 3 ? (
                <div className="grid grid-cols-2 gap-1.5 h-44">
                  <div className="col-span-2 overflow-hidden rounded-md border border-slate-100 bg-slate-100 h-24">
                    <img
                      src={getFilePreviewUrl(images[0])}
                      alt="Collage 1"
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLElement).style.opacity = '0.3'; }}
                    />
                  </div>
                  {images.slice(1, 3).map((img, idx) => (
                    <div key={idx} className="overflow-hidden rounded-md border border-slate-100 bg-slate-100 h-18">
                      <img
                        src={getFilePreviewUrl(img)}
                        alt={`Collage ${idx + 2}`}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLElement).style.opacity = '0.3'; }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1.5 h-44">
                  {images.slice(0, 4).map((img, idx) => (
                    <div key={idx} className="relative overflow-hidden rounded-md border border-slate-100 bg-slate-100 h-20">
                      <img
                        src={getFilePreviewUrl(img)}
                        alt={`Collage ${idx + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLElement).style.opacity = '0.3'; }}
                      />
                      {idx === 3 && images.length > 4 && (
                        <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center text-white font-bold text-xs rounded-md">
                          +{images.length - 3}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {card.card_data.caption && (
                <div className="text-[11px] text-slate-500 italic px-1">
                  {card.card_data.caption}
                </div>
              )}
            </div>
          );
        })()}

        {/* LINK */}
        {type === 'link' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                {card.card_data.domain || 'LINK'}
              </span>
              {card.card_data.url && (
                <a
                  href={card.card_data.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-700 flex items-center gap-1 font-medium text-[11px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  Visit <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <div className="font-medium text-slate-800">
              {card.card_data.linkTitle || card.title}
            </div>
            {card.description && (
              <p className="text-slate-500 text-[11px] line-clamp-2">
                {card.description}
              </p>
            )}
          </div>
        )}

        {/* QUOTE */}
        {type === 'quote' && (
          <div className="relative pl-5 py-1">
            <Quote className="absolute left-0 top-0 w-4 h-4 text-amber-400/80 -scale-x-100" />
            <p className="italic font-medium text-slate-700 leading-normal text-[13px]">
              "{card.description || 'Words to remember...'}"
            </p>
            {card.card_data.source && (
              <div className="mt-2 text-right text-[11px] text-slate-500 font-semibold">
                — {card.card_data.source}
              </div>
            )}
          </div>
        )}

        {/* CHECKLIST */}
        {type === 'list' && (
          <div className="space-y-2">
            {/* Progress Bar */}
            {card.card_data.items && card.card_data.items.length > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                  <span>Progress</span>
                  <span>
                    {card.card_data.items.filter((i) => i.done).length} /{' '}
                    {card.card_data.items.length}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-500 transition-all duration-300"
                    style={{
                      width: `${
                        (card.card_data.items.filter((i) => i.done).length /
                          card.card_data.items.length) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Checklist items */}
            <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
              {(card.card_data.items || []).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 group/item hover:bg-slate-50 p-1 rounded"
                >
                  <label className="flex items-center gap-2 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => toggleCheckItem(item.id)}
                      className="rounded text-rose-500 focus:ring-rose-400 w-3.5 h-3.5 cursor-pointer accent-rose-500"
                    />
                    <span
                      className={`text-xs ${
                        item.done ? 'line-through text-slate-400' : 'text-slate-700'
                      }`}
                    >
                      {item.text}
                    </span>
                  </label>
                  <button
                    onClick={() => removeCheckItem(item.id)}
                    className="opacity-0 group-hover/item:opacity-100 text-slate-400 hover:text-rose-500 p-0.5"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Quick Add item inline */}
            <div className="flex items-center gap-1 pt-1 border-t border-slate-100">
              <input
                type="text"
                placeholder="Add checklist item..."
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCheckItem();
                  }
                }}
                className="w-full text-xs px-2 py-1 bg-slate-50 rounded border border-slate-200 outline-none focus:border-rose-400 focus:bg-white"
              />
              <button
                onClick={addCheckItem}
                disabled={!newItemText.trim()}
                className="p-1 rounded bg-rose-500 text-white disabled:opacity-40 hover:bg-rose-600 shrink-0"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
