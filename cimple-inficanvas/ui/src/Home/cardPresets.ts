import type { CardType, CardData, NodeCard } from './types';

export const CARD_COLORS = [
  { name: 'Default Blue', hex: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', badge: '#2563eb' },
  { name: 'Emerald', hex: '#10b981', bg: '#ecfdf5', border: '#a7f3d0', badge: '#059669' },
  { name: 'Amber', hex: '#f59e0b', bg: '#fffbeb', border: '#fde68a', badge: '#d97706' },
  { name: 'Purple', hex: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe', badge: '#7c3aed' },
  { name: 'Rose', hex: '#ec4899', bg: '#fdf2f8', border: '#fbcfe8', badge: '#db2777' },
  { name: 'Slate', hex: '#64748b', bg: '#f8fafc', border: '#cbd5e1', badge: '#475569' },
  { name: 'Sticky Yellow', hex: '#eab308', bg: '#fef9c3', border: '#fef08a', badge: '#ca8a04' },
];

export const TYPE_CONFIG: Record<CardType, { label: string; icon: string; defaultColor: string; description: string }> = {
  text: {
    label: 'Text Note',
    icon: 'FileText',
    defaultColor: '#3b82f6',
    description: 'Notes, synthesis, hypotheses, or ideas',
  },
  note: {
    label: 'Sticky Note',
    icon: 'StickyNote',
    defaultColor: '#eab308',
    description: 'Quick thought or colorful reminder',
  },
  image: {
    label: 'Image',
    icon: 'Image',
    defaultColor: '#8b5cf6',
    description: 'Visual reference or diagram',
  },
  link: {
    label: 'Link / Bookmark',
    icon: 'Link2',
    defaultColor: '#10b981',
    description: 'Web reference with preview and domain',
  },
  quote: {
    label: 'Quote',
    icon: 'Quote',
    defaultColor: '#f59e0b',
    description: 'Highlighted passage and attribution',
  },
  list: {
    label: 'Checklist',
    icon: 'CheckSquare',
    defaultColor: '#ec4899',
    description: 'Action items and milestone checklist',
  },
};

export function getCardImages(data?: CardData): string[] {
  if (!data) return [];
  if (Array.isArray(data.images) && data.images.length > 0) {
    return data.images.filter((img) => Boolean(img && String(img).trim()));
  }
  if (data.url && typeof data.url === 'string' && data.url.trim()) {
    return [data.url.trim()];
  }
  return [];
}

export function parseCardData(raw: string | CardData | undefined): CardData {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function createDefaultCard(type: CardType, x: number, y: number, customId?: number): NodeCard {
  const id = customId || Date.now();
  const base = {
    id,
    card_type: type,
    position_x: Math.round(x),
    position_y: Math.round(y),
    size_x: 310,
    size_y: 190,
    color: TYPE_CONFIG[type].defaultColor,
  };

  switch (type) {
    case 'text':
      return {
        ...base,
        title: 'New Research Note',
        description: 'Record key insights, questions, or analytical deductions here.',
        card_data: {},
      };
    case 'note':
      return {
        ...base,
        title: 'Sticky Idea',
        description: 'Keep thoughts atomic and easy to rearrange on the canvas.',
        size_x: 260,
        size_y: 180,
        color: '#eab308',
        card_data: {},
      };
    case 'image':
      return {
        ...base,
        title: 'Visual References',
        description: '',
        color: '#8b5cf6',
        card_data: {
          images: [
            'https://images.unsplash.com/photo-1507842229451-7f01be7fe0ab?auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=800&q=80',
          ],
          caption: 'Visual stimulus and inspiration',
        },
      };
    case 'link':
      return {
        ...base,
        title: 'Web Reference',
        description: 'Curated knowledge resource',
        size_y: 185,
        color: '#10b981',
        card_data: {
          url: 'https://wikipedia.org',
          linkTitle: 'Wikipedia Knowledge Base',
          domain: 'wikipedia.org',
        },
      };
    case 'quote':
      return {
        ...base,
        title: 'Core Maxim',
        description: 'The journey of a thousand miles begins with a single step.',
        size_y: 180,
        color: '#f59e0b',
        card_data: {
          source: 'Lao Tzu',
        },
      };
    case 'list':
      return {
        ...base,
        title: 'Key Milestones',
        description: '',
        size_y: 240,
        color: '#ec4899',
        card_data: {
          items: [
            { id: '1', text: 'Define problem boundaries', done: true },
            { id: '2', text: 'Map foundational links', done: false },
            { id: '3', text: 'Synthesize conclusions', done: false },
          ],
        },
      };
  }
}
