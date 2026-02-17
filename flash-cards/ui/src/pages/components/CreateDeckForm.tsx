import { useState } from 'react';
import { IconPicker } from './IconPicker';

export const CreateDeckForm = ({ onSave }: { onSave: (name: string) => void }) => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('book');

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Deck Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="e.g. Spanish Basics"
          autoFocus
        />
      </div>
        <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Select Icon</label>
        <IconPicker selected={icon} onSelect={setIcon} />
      </div>


      <button
        onClick={() => onSave(name)}
        className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
      >
        Save Deck
      </button>
    </div>
  );
};

