import React from 'react';

const COMMON_ICONS = [
  '📄', '📝', '📖', '💡', '🚀', '🎯', '📌', '📋',
  '⚡', '🏗️', '🧠', '🌿', '⭐', '☕', '🔍', '🎨',
  '📊', '🛠️', '💼', '📦', '🔖', '📅', '💬', '🏆',
  '🔥', '✨', '🌍', '🏠', '💻', '🔒', '🔑', '🏷️',
];

interface IconPickerProps {
  currentIcon: string;
  onSelect: (icon: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

export const IconPicker: React.FC<IconPickerProps> = ({
  currentIcon,
  onSelect,
  onClose,
  isOpen,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={onClose}>
      <div 
        className="w-72 rounded-xl border border-[#d9d9d4] bg-white p-3 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#77776f]">
          <span>Select Icon</span>
          <button 
            onClick={onClose} 
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        <div className="grid grid-cols-6 gap-1.5 py-1">
          {COMMON_ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              onClick={() => {
                onSelect(icon);
                onClose();
              }}
              className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-colors hover:bg-[#f1f1ed] ${
                currentIcon === icon ? 'bg-[#edf3ff] ring-1 ring-[#2f6fed]' : ''
              }`}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
