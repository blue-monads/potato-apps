import type { CardType, CardData, CheckItem } from '../lib/api';

export type { CardType, CardData, CheckItem };

export interface NodeCard {
  id: number;
  title: string;
  description: string;
  card_type: CardType;
  size_x: number;
  size_y: number;
  position_x: number;
  position_y: number;
  color: string;
  card_data: CardData;
  created_at?: string;
  updated_at?: string;
}

export interface NodeLink {
  id: number;
  source_card_id: number;
  linked_card_id: number;
  source_handle: 'l' | 'r' | 't' | 'b';
  linked_handle: 'l' | 'r' | 't' | 'b';
  label?: string;
  color?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export type HandlePosition = 'l' | 'r' | 't' | 'b';
