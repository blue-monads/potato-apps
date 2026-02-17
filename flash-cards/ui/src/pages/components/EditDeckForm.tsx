import { useState } from 'react';
import { IconPicker } from './IconPicker';



export const EditDeckForm = ({ 
  initialName, 
  initialIcon, 
  onSave, 
  onDelete 
}: { 
  initialName: string, 
  initialIcon: string, 
  onSave: (name: string, icon: string) => void,
  onDelete: () => void 
}) => {
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState(initialIcon);

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Deck Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Update Icon</label>
        <IconPicker selected={icon} onSelect={setIcon} />
      </div>

      <div className="flex flex-col gap-3 pt-4 border-t border-gray-100">
        <button
          onClick={() => onSave(name, icon)}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all"
        >
          Save Changes
        </button>
        
        <button
          onClick={() => {
            if (window.confirm("Are you sure? This will delete all cards in this deck.")) {
              onDelete();
            }
          }}
          className="w-full bg-red-50 text-red-600 py-2 rounded-xl font-medium hover:bg-red-100 transition-all"
        >
          Delete Deck
        </button>
      </div>
    </div>
  );
};