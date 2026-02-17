import { 
  Book, Music, Code, Heart, Languages, 
  Terminal, Palette, Coffee, Globe, GraduationCap 
} from 'lucide-react';

export const ICON_LIST = [
  { name: 'book', Icon: Book },
  { name: 'music', Icon: Music },
  { name: 'code', Icon: Code },
  { name: 'heart', Icon: Heart },
  { name: 'languages', Icon: Languages },
  { name: 'terminal', Icon: Terminal },
  { name: 'palette', Icon: Palette },
  { name: 'coffee', Icon: Coffee },
  { name: 'globe', Icon: Globe },
  { name: 'cap', Icon: GraduationCap },
];

export const IconPicker = ({ selected, onSelect }: { selected: string, onSelect: (n: string) => void }) => (
  <div className="grid grid-cols-5 gap-2 mt-2">
    {ICON_LIST.map(({ name, Icon }) => (
      <button
        key={name}
        type="button"
        onClick={() => onSelect(name)}
        className={`p-2 rounded-lg border flex items-center justify-center transition-all ${
          selected === name 
            ? 'bg-blue-100 border-blue-500 text-blue-600' 
            : 'border-gray-200 hover:bg-gray-50 text-gray-400'
        }`}
      >
        {Icon && <Icon size={20} />}
      </button>
    ))}
  </div>
);