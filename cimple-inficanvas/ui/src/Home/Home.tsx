import { useState, useEffect, useRef, useCallback } from 'react';
import type { NodeCard, NodeLink, Viewport, HandlePosition, CardType } from './types';
import {
  cardsApi,
  linksApi,
  canvasApi,
} from '../lib/api';
import type {
  CanvasCard,
  CardLink,
} from '../lib/api';
import {
  parseCardData,
  createDefaultCard,
} from './cardPresets';
import { CanvasCardView } from './CanvasCardView';
import { CardEditorDrawer } from './CardEditorDrawer';
import { AddCardModal } from './AddCardModal';
import { Minimap } from './Minimap';
import {
  Plus,
  GitBranch,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Search,
  HelpCircle,
  Sparkles,
  FileText,
  StickyNote,
  Image as ImageIcon,
  Link2,
  Quote,
  CheckSquare,
  X,
  Database,
  CloudCheck,
  FolderOpen,
  Upload,
} from 'lucide-react';
import { openSpaceFilePicker, uploadSpaceFile, isImageFile } from '../lib/spaceFile';
import type { SpaceFile } from '../lib/spaceFile';

const LOCAL_STORAGE_KEY = 'cimple-inficanvas-state';

export const Home: React.FC = () => {
  // Canvas Viewport State
  const [viewport, setViewport] = useState<Viewport>({ x: 80, y: 60, scale: 1 });
  const [cards, setCards] = useState<NodeCard[]>([]);
  const [links, setLinks] = useState<NodeLink[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);

  // Connection mode state
  const [isConnectMode, setIsConnectMode] = useState(false);
  const [connectingFrom, setConnectingFrom] = useState<{
    cardId: number;
    handle: HandlePosition;
  } | null>(null);
  const [pointerWorld, setPointerWorld] = useState<{ x: number; y: number } | null>(null);

  // UI Modals & Drawers
  const [editingCard, setEditingCard] = useState<NodeCard | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'offline'>('saved');
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dragging card or Panning canvas
  const isDraggingCardRef = useRef<{
    cardId: number;
    startX: number;
    startY: number;
    initialCardX: number;
    initialCardY: number;
  } | null>(null);

  const isPanningRef = useRef<{
    startX: number;
    startY: number;
    initialViewX: number;
    initialViewY: number;
  } | null>(null);

  const isSpacePressedRef = useRef(false);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<any>(null);

  // -------------------------------------------------------------
  // Coords Transformation
  // -------------------------------------------------------------
  const screenToWorld = useCallback(
    (sx: number, sy: number) => {
      return {
        x: (sx - viewport.x) / viewport.scale,
        y: (sy - viewport.y) / viewport.scale,
      };
    },
    [viewport]
  );

  // -------------------------------------------------------------
  // Data Loading & Syncing
  // -------------------------------------------------------------
  const loadCanvasData = useCallback(async () => {
    try {
      const [remoteCards, remoteLinks] = await Promise.all([
        cardsApi.list(),
        linksApi.list(),
      ]);

      if (remoteCards && remoteCards.length > 0) {
        const parsedCards: NodeCard[] = remoteCards.map((c: CanvasCard) => ({
          ...c,
          card_data: parseCardData(c.card_data),
        }));
        const parsedLinks: NodeLink[] = remoteLinks.map((l: CardLink) => ({
          ...l,
          source_handle: l.source_handle || 'r',
          linked_handle: l.linked_handle || 'l',
        }));

        setCards(parsedCards);
        setLinks(parsedLinks);
        setSaveStatus('saved');
        return;
      }
    } catch {
      // Standalone dev or server offline, fall back to localStorage
    }

    // Fallback: check localStorage
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.cards && parsed.cards.length > 0) {
          setCards(parsed.cards);
          setLinks(parsed.links || []);
          if (parsed.viewport) setViewport(parsed.viewport);
          setSaveStatus('offline');
          return;
        }
      } catch {}
    }

    // Default starter template
    const starterCards: NodeCard[] = [
      {
        id: 1,
        title: 'Mindmap & Research Hub',
        description: 'Infinite canvas for brainstorming, organizing research, and connecting thoughts.',
        card_type: 'text',
        size_x: 320,
        size_y: 180,
        position_x: 420,
        position_y: 260,
        color: '#3b82f6',
        card_data: {},
      },
      {
        id: 2,
        title: 'Visual References',
        description: 'Curated visual ideas and diagrams for rapid synthesis.',
        card_type: 'image',
        size_x: 320,
        size_y: 280,
        position_x: 30,
        position_y: 80,
        color: '#8b5cf6',
        card_data: {
          url: 'https://images.unsplash.com/photo-1507842229451-7f01be7fe0ab?auto=format&fit=crop&w=800&q=80',
          caption: 'Exploring architectures and mental models',
        },
      },
      {
        id: 3,
        title: 'Knowledge Repositories',
        description: 'Essential links and documentation.',
        card_type: 'link',
        size_x: 320,
        size_y: 190,
        position_x: 860,
        position_y: 100,
        color: '#10b981',
        card_data: {
          url: 'https://en.wikipedia.org/wiki/Mind_map',
          linkTitle: 'Mind Map Theory & Cognition',
          domain: 'wikipedia.org',
        },
      },
      {
        id: 4,
        title: 'Guiding Principle',
        description: 'Simplicity is prerequisite for reliability.',
        card_type: 'quote',
        size_x: 320,
        size_y: 190,
        position_x: 40,
        position_y: 440,
        color: '#f59e0b',
        card_data: {
          source: 'Edsger W. Dijkstra',
        },
      },
      {
        id: 5,
        title: 'Action Checklist',
        description: 'Key next milestones for exploration.',
        card_type: 'list',
        size_x: 320,
        size_y: 240,
        position_x: 860,
        position_y: 380,
        color: '#ec4899',
        card_data: {
          items: [
            { id: '1', text: 'Structure main research branches', done: true },
            { id: '2', text: 'Connect supporting hypotheses', done: true },
            { id: '3', text: 'Synthesize actionable insights', done: false },
          ],
        },
      },
      {
        id: 6,
        title: 'Eureka Note!',
        description: 'Connecting disparate nodes creates unexpected cognitive sparks. Keep notes atomic!',
        card_type: 'note',
        size_x: 260,
        size_y: 190,
        position_x: 450,
        position_y: 20,
        color: '#eab308',
        card_data: {},
      },
    ];

    const starterLinks: NodeLink[] = [
      { id: 1, source_card_id: 1, linked_card_id: 2, source_handle: 'l', linked_handle: 'r', label: 'visuals', color: '#8b5cf6' },
      { id: 2, source_card_id: 1, linked_card_id: 3, source_handle: 'r', linked_handle: 'l', label: 'references', color: '#10b981' },
      { id: 3, source_card_id: 1, linked_card_id: 4, source_handle: 'l', linked_handle: 'r', label: 'philosophy', color: '#f59e0b' },
      { id: 4, source_card_id: 1, linked_card_id: 5, source_handle: 'r', linked_handle: 'l', label: 'milestones', color: '#ec4899' },
      { id: 5, source_card_id: 1, linked_card_id: 6, source_handle: 't', linked_handle: 'b', label: 'spark', color: '#eab308' },
    ];

    setCards(starterCards);
    setLinks(starterLinks);
  }, []);

  useEffect(() => {
    loadCanvasData();
  }, [loadCanvasData]);

  // Persist to local storage and sync to Potato API
  const persistChanges = useCallback(
    (newCards: NodeCard[], newLinks: NodeLink[]) => {
      setSaveStatus('saving');
      clearTimeout(saveTimeoutRef.current);

      // Always save to localStorage immediately for instant offline resilience
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify({ cards: newCards, links: newLinks, viewport })
      );

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          // Check if server is accessible
          setSaveStatus('saved');
        } catch {
          setSaveStatus('offline');
        }
      }, 300);
    },
    [viewport]
  );

  // -------------------------------------------------------------
  // Card Actions
  // -------------------------------------------------------------
  const handleAddCard = useCallback(
    async (type: CardType, pos?: { x: number; y: number }) => {
      const position = pos || {
        x: Math.round(-viewport.x / viewport.scale + 250),
        y: Math.round(-viewport.y / viewport.scale + 180),
      };

      const newCard = createDefaultCard(type, position.x, position.y);

      // Try creating on server
      try {
        const created = await cardsApi.create(newCard);
        if (created && created.id) {
          const parsed: NodeCard = {
            ...created,
            card_data: parseCardData(created.card_data),
          };
          const updated = [...cards, parsed];
          setCards(updated);
          setSelectedCardId(parsed.id);
          persistChanges(updated, links);
          return parsed;
        }
      } catch {
        // Fallback local ID
      }

      const updated = [...cards, newCard];
      setCards(updated);
      setSelectedCardId(newCard.id);
      persistChanges(updated, links);
      return newCard;
    },
    [cards, links, viewport, persistChanges]
  );

  const handleAddSpaceImage = useCallback(
    async (file: SpaceFile, pos?: { x: number; y: number }) => {
      const position = pos || {
        x: Math.round(-viewport.x / viewport.scale + 250),
        y: Math.round(-viewport.y / viewport.scale + 180),
      };

      const newCard = createDefaultCard('image', position.x, position.y);
      newCard.title = file.name ? file.name.replace(/\.[^/.]+$/, '') : 'Image Reference';
      newCard.card_data = {
        url: file.url || file.id,
        caption: file.name || '',
      };

      try {
        const created = await cardsApi.create(newCard);
        if (created && created.id) {
          newCard.id = created.id;
        }
      } catch {}

      const updated = [...cards, newCard];
      setCards(updated);
      setSelectedCardId(newCard.id);
      persistChanges(updated, links);
      return newCard;
    },
    [cards, links, viewport, persistChanges]
  );

  const handleDropFiles = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingFiles(false);
      const fileList = Array.from(e.dataTransfer.files || []);
      if (fileList.length === 0) return;

      const dropWorld = screenToWorld(e.clientX, e.clientY);
      const imageFiles = fileList.filter((f) => isImageFile(f.name) || f.type.startsWith('image/'));
      const otherFiles = fileList.filter((f) => !isImageFile(f.name) && !f.type.startsWith('image/'));

      if (imageFiles.length === 1) {
        const uploaded = await uploadSpaceFile(imageFiles[0], 'cimple-inficanvas/images');
        await handleAddSpaceImage(uploaded, { x: dropWorld.x, y: dropWorld.y });
      } else if (imageFiles.length > 1) {
        const uploadedUrls: string[] = [];
        for (const f of imageFiles) {
          const up = await uploadSpaceFile(f, 'cimple-inficanvas/images');
          uploadedUrls.push(up.url || up.id);
        }
        const newCard = createDefaultCard('image', dropWorld.x, dropWorld.y);
        newCard.title = `${imageFiles.length} Photos Collage`;
        newCard.card_data = {
          images: uploadedUrls,
          caption: `${imageFiles.length} images collage`,
        };
        try {
          const created = await cardsApi.create(newCard);
          if (created && created.id) newCard.id = created.id;
        } catch {}
        const updated = [...cards, newCard];
        setCards(updated);
        setSelectedCardId(newCard.id);
        persistChanges(updated, links);
      }

      for (let i = 0; i < otherFiles.length; i++) {
        const file = otherFiles[i];
        const posX = Math.round(dropWorld.x + (imageFiles.length > 0 ? 340 : 0) + i * 30);
        const posY = Math.round(dropWorld.y + i * 30);
        const newCard = createDefaultCard('text', posX, posY);
        newCard.title = file.name;
        newCard.description = `Attached file: ${file.name} (${Math.round(file.size / 1024)} KB)`;
        try {
          const created = await cardsApi.create(newCard);
          if (created && created.id) newCard.id = created.id;
        } catch {}
        setCards((prev) => [...prev, newCard]);
      }
    },
    [screenToWorld, handleAddSpaceImage, cards, links, persistChanges]
  );

  const handleUpdateCard = useCallback(
    async (cardId: number, fields: Partial<NodeCard>) => {
      const updated = cards.map((c) => (c.id === cardId ? { ...c, ...fields } : c));
      setCards(updated);
      persistChanges(updated, links);

      try {
        await cardsApi.update(cardId, fields);
      } catch {}
    },
    [cards, links, persistChanges]
  );

  const handleDeleteCard = useCallback(
    async (cardId: number) => {
      const updatedCards = cards.filter((c) => c.id !== cardId);
      const updatedLinks = links.filter(
        (l) => l.source_card_id !== cardId && l.linked_card_id !== cardId
      );
      setCards(updatedCards);
      setLinks(updatedLinks);
      if (selectedCardId === cardId) setSelectedCardId(null);
      if (editingCard?.id === cardId) setEditingCard(null);

      persistChanges(updatedCards, updatedLinks);

      try {
        await cardsApi.delete(cardId);
      } catch {}
    },
    [cards, links, selectedCardId, editingCard, persistChanges]
  );

  const handleDuplicateCard = useCallback(
    async (cardId: number) => {
      const source = cards.find((c) => c.id === cardId);
      if (!source) return;

      const newCard: NodeCard = {
        ...source,
        id: Date.now(),
        position_x: source.position_x + 35,
        position_y: source.position_y + 35,
        title: `${source.title} (Copy)`,
      };

      try {
        const created = await cardsApi.create(newCard);
        if (created && created.id) {
          newCard.id = created.id;
        }
      } catch {}

      const updated = [...cards, newCard];
      setCards(updated);
      setSelectedCardId(newCard.id);
      persistChanges(updated, links);
    },
    [cards, links, persistChanges]
  );

  // -------------------------------------------------------------
  // Mindmap Branching (+) & Connections
  // -------------------------------------------------------------
  const handleAddBranch = useCallback(
    async (sourceCardId: number, direction: HandlePosition) => {
      const source = cards.find((c) => c.id === sourceCardId);
      if (!source) return;

      let newX = source.position_x;
      let newY = source.position_y;
      let targetHandle: HandlePosition = 'l';

      if (direction === 'r') {
        newX = source.position_x + source.size_x + 80;
        newY = source.position_y;
        targetHandle = 'l';
      } else if (direction === 'l') {
        newX = source.position_x - source.size_x - 80;
        newY = source.position_y;
        targetHandle = 'r';
      } else if (direction === 't') {
        newX = source.position_x;
        newY = source.position_y - source.size_y - 80;
        targetHandle = 'b';
      } else if (direction === 'b') {
        newX = source.position_x;
        newY = source.position_y + source.size_y + 80;
        targetHandle = 't';
      }

      // Create new child card
      const newCard = createDefaultCard('text', newX, newY);
      newCard.title = 'Sub-topic';
      newCard.description = 'Detail thoughts expanding on the parent node.';
      newCard.color = source.color || '#3b82f6';

      try {
        const created = await cardsApi.create(newCard);
        if (created && created.id) {
          newCard.id = created.id;
        }
      } catch {}

      // Create link between source and new child
      const newLink: NodeLink = {
        id: Date.now(),
        source_card_id: sourceCardId,
        linked_card_id: newCard.id,
        source_handle: direction,
        linked_handle: targetHandle,
        color: source.color || '#3b82f6',
      };

      try {
        const createdLink = await linksApi.create(newLink);
        if (createdLink && createdLink.id) {
          newLink.id = createdLink.id;
        }
      } catch {}

      const updatedCards = [...cards, newCard];
      const updatedLinks = [...links, newLink];

      setCards(updatedCards);
      setLinks(updatedLinks);
      setSelectedCardId(newCard.id);
      persistChanges(updatedCards, updatedLinks);
    },
    [cards, links, persistChanges]
  );

  const handleHandleClick = useCallback(
    async (cardId: number, handle: HandlePosition) => {
      if (!connectingFrom) {
        // Start connection
        setConnectingFrom({ cardId, handle });
        setIsConnectMode(true);
        return;
      }

      // If clicking same card handle, cancel
      if (connectingFrom.cardId === cardId) {
        setConnectingFrom(null);
        setIsConnectMode(false);
        return;
      }

      // Complete connection
      const duplicate = links.some(
        (l) =>
          (l.source_card_id === connectingFrom.cardId && l.linked_card_id === cardId) ||
          (l.source_card_id === cardId && l.linked_card_id === connectingFrom.cardId)
      );

      if (!duplicate) {
        const sourceCard = cards.find((c) => c.id === connectingFrom.cardId);
        const newLink: NodeLink = {
          id: Date.now(),
          source_card_id: connectingFrom.cardId,
          linked_card_id: cardId,
          source_handle: connectingFrom.handle,
          linked_handle: handle,
          color: sourceCard?.color || '#94a3b8',
        };

        try {
          const created = await linksApi.create(newLink);
          if (created && created.id) {
            newLink.id = created.id;
          }
        } catch {}

        const updatedLinks = [...links, newLink];
        setLinks(updatedLinks);
        persistChanges(cards, updatedLinks);
      }

      setConnectingFrom(null);
      setIsConnectMode(false);
    },
    [connectingFrom, links, cards, persistChanges]
  );

  const handleDeleteLink = useCallback(
    async (linkId: number) => {
      const updated = links.filter((l) => l.id !== linkId);
      setLinks(updated);
      persistChanges(cards, updated);
      try {
        await linksApi.delete(linkId);
      } catch {}
    },
    [links, cards, persistChanges]
  );

  // -------------------------------------------------------------
  // Auto-Layout Algorithm (Hierarchical Mindmap)
  // -------------------------------------------------------------
  const handleAutoLayout = useCallback(() => {
    if (cards.length === 0) return;

    // Build adjacency list
    const incomingCount: Record<number, number> = {};
    const adj: Record<number, number[]> = {};

    cards.forEach((c) => {
      incomingCount[c.id] = 0;
      adj[c.id] = [];
    });

    links.forEach((l) => {
      if (adj[l.source_card_id]) {
        adj[l.source_card_id].push(l.linked_card_id);
      }
      incomingCount[l.linked_card_id] = (incomingCount[l.linked_card_id] || 0) + 1;
    });

    // Root nodes: 0 incoming, or card with ID 1
    const roots = cards.filter((c) => incomingCount[c.id] === 0);
    const primaryRoots = roots.length > 0 ? roots : [cards[0]];

    const visited = new Set<number>();
    const newPositions: Record<number, { x: number; y: number }> = {};

    let rootY = 150;
    primaryRoots.forEach((root) => {
      let currentLevelY = rootY;

      const placeTree = (nodeId: number, level: number) => {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);

        const card = cards.find((c) => c.id === nodeId);
        if (!card) return;

        newPositions[nodeId] = {
          x: 200 + level * 380,
          y: currentLevelY,
        };

        const children = adj[nodeId] || [];
        children.forEach((childId) => {
          placeTree(childId, level + 1);
        });

        currentLevelY += card.size_y + 50;
      };

      placeTree(root.id, 0);
      rootY = currentLevelY + 100;
    });

    // Any remaining disconnected nodes
    cards.forEach((c) => {
      if (!visited.has(c.id)) {
        newPositions[c.id] = {
          x: 200,
          y: rootY,
        };
        rootY += c.size_y + 50;
      }
    });

    const updatedCards = cards.map((c) => {
      const pos = newPositions[c.id];
      return pos ? { ...c, position_x: pos.x, position_y: pos.y } : c;
    });

    setCards(updatedCards);
    persistChanges(updatedCards, links);

    // Sync positions
    updatedCards.forEach((c) => {
      cardsApi.update(c.id, { position_x: c.position_x, position_y: c.position_y }).catch(() => {});
    });
  }, [cards, links, persistChanges]);

  // -------------------------------------------------------------
  // Canvas Zoom & Pan Controls
  // -------------------------------------------------------------
  const handleZoom = useCallback(
    (factor: number, centerX?: number, centerY?: number) => {
      const cx = centerX ?? (workspaceRef.current?.clientWidth ?? 800) / 2;
      const cy = centerY ?? (workspaceRef.current?.clientHeight ?? 600) / 2;

      const before = screenToWorld(cx, cy);
      const newScale = Math.max(0.2, Math.min(2.5, viewport.scale * factor));

      const after = {
        x: before.x * newScale + viewport.x,
        y: before.y * newScale + viewport.y,
      };

      setViewport({
        scale: newScale,
        x: viewport.x + (cx - after.x),
        y: viewport.y + (cy - after.y),
      });
    },
    [viewport, screenToWorld]
  );

  const handleFitAll = useCallback(() => {
    if (cards.length === 0 || !workspaceRef.current) return;

    const minX = Math.min(...cards.map((c) => c.position_x));
    const maxX = Math.max(...cards.map((c) => c.position_x + c.size_x));
    const minY = Math.min(...cards.map((c) => c.position_y));
    const maxY = Math.max(...cards.map((c) => c.position_y + c.size_y));

    const pad = 100;
    const vw = workspaceRef.current.clientWidth - pad * 2;
    const vh = workspaceRef.current.clientHeight - pad * 2;

    const spanW = maxX - minX || 1;
    const spanH = maxY - minY || 1;

    const scale = Math.max(0.3, Math.min(1.5, Math.min(vw / spanW, vh / spanH)));
    const x = pad + (vw - spanW * scale) / 2 - minX * scale;
    const y = pad + (vh - spanH * scale) / 2 - minY * scale;

    setViewport({ x: Math.round(x), y: Math.round(y), scale });
  }, [cards]);

  const handleResetView = useCallback(() => {
    setViewport({ x: 80, y: 60, scale: 1 });
  }, []);

  // -------------------------------------------------------------
  // Mouse & Keyboard Event Handlers
  // -------------------------------------------------------------
  const handleStartCardDrag = useCallback(
    (e: React.MouseEvent, cardId: number) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      setSelectedCardId(cardId);

      const targetCard = cards.find((c) => c.id === cardId);
      if (!targetCard) return;

      isDraggingCardRef.current = {
        cardId,
        startX: e.clientX,
        startY: e.clientY,
        initialCardX: targetCard.position_x,
        initialCardY: targetCard.position_y,
      };
    },
    [cards]
  );

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      // Clicked on blank canvas
      setSelectedCardId(null);

      // Start Pan
      isPanningRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        initialViewX: viewport.x,
        initialViewY: viewport.y,
      };
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'grabbing';
      }
    },
    [viewport]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Update pointer world pos for live wire
      const currentWorld = screenToWorld(e.clientX, e.clientY);
      setPointerWorld(currentWorld);

      // Dragging a card
      if (isDraggingCardRef.current) {
        const { cardId, startX, startY, initialCardX, initialCardY } = isDraggingCardRef.current;
        const dx = (e.clientX - startX) / viewport.scale;
        const dy = (e.clientY - startY) / viewport.scale;

        setCards((prev) =>
          prev.map((c) =>
            c.id === cardId
              ? {
                  ...c,
                  position_x: Math.round(initialCardX + dx),
                  position_y: Math.round(initialCardY + dy),
                }
              : c
          )
        );
        return;
      }

      // Panning the canvas
      if (isPanningRef.current) {
        const { startX, startY, initialViewX, initialViewY } = isPanningRef.current;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        setViewport((prev) => ({
          ...prev,
          x: Math.round(initialViewX + dx),
          y: Math.round(initialViewY + dy),
        }));
      }
    },
    [viewport, screenToWorld]
  );

  const handleMouseUp = useCallback(() => {
    // End card drag
    if (isDraggingCardRef.current) {
      const draggedCardId = isDraggingCardRef.current.cardId;
      isDraggingCardRef.current = null;
      const currentCard = cards.find((c) => c.id === draggedCardId);
      if (currentCard) {
        persistChanges(cards, links);
        cardsApi.update(draggedCardId, {
          position_x: currentCard.position_x,
          position_y: currentCard.position_y,
        }).catch(() => {});
      }
    }

    // End canvas pan
    if (isPanningRef.current) {
      isPanningRef.current = null;
      if (canvasRef.current) {
        canvasRef.current.style.cursor = isSpacePressedRef.current ? 'grab' : 'default';
      }
    }
  }, [cards, links, persistChanges]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.09 : 0.91;
      handleZoom(zoomFactor, e.clientX, e.clientY);
    },
    [handleZoom]
  );

  const handleCanvasDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      // Create new text node at cursor position
      const worldPos = screenToWorld(e.clientX, e.clientY);
      handleAddCard('text', {
        x: Math.round(worldPos.x - 150),
        y: Math.round(worldPos.y - 70),
      });
    },
    [screenToWorld, handleAddCard]
  );

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) {
        return;
      }

      if (e.code === 'Space' && !e.repeat) {
        isSpacePressedRef.current = true;
        if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedCardId !== null) {
          e.preventDefault();
          handleDeleteCard(selectedCardId);
        }
      }

      if (e.key === 'Escape') {
        setSelectedCardId(null);
        setConnectingFrom(null);
        setIsConnectMode(false);
        setEditingCard(null);
        setIsAddModalOpen(false);
        setIsHelpModalOpen(false);
      }

      if (e.key === '+' || e.key === '=') {
        handleZoom(1.15);
      }
      if (e.key === '-') {
        handleZoom(0.85);
      }
      if (e.key === '0') {
        handleResetView();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
        if (canvasRef.current && !isPanningRef.current) {
          canvasRef.current.style.cursor = 'default';
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedCardId, handleDeleteCard, handleZoom, handleResetView]);

  // Clipboard Paste Support for Images
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const blob = items[i].getAsFile();
          if (blob) {
            e.preventDefault();
            const file = new File([blob], `clipboard-${Date.now()}.png`, { type: blob.type });
            const uploaded = await uploadSpaceFile(file, 'cimple-inficanvas/images');
            const centerWorld = screenToWorld(
              (workspaceRef.current?.clientWidth || 800) / 2,
              (workspaceRef.current?.clientHeight || 600) / 2
            );
            await handleAddSpaceImage(uploaded, centerWorld);
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [screenToWorld, handleAddSpaceImage]);

  // -------------------------------------------------------------
  // Bezier Calculation for Links
  // -------------------------------------------------------------
  const getAnchorCoords = (card: NodeCard, handle: HandlePosition) => {
    const el = document.querySelector(`[data-card-id="${card.id}"]`) as HTMLElement | null;
    const w = el ? el.offsetWidth : (card.size_x || 310);
    const h = el ? el.offsetHeight : (card.size_y || 190);
    switch (handle) {
      case 'r': return { x: card.position_x + w, y: card.position_y + h / 2 };
      case 'l': return { x: card.position_x, y: card.position_y + h / 2 };
      case 't': return { x: card.position_x + w / 2, y: card.position_y };
      case 'b': return { x: card.position_x + w / 2, y: card.position_y + h };
    }
  };

  const getBezierPath = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    s1: HandlePosition,
    s2: HandlePosition
  ) => {
    const dist = Math.max(50, Math.min(180, Math.hypot(x2 - x1, y2 - y1) * 0.45));
    const vec = (h: HandlePosition) => {
      switch (h) {
        case 'r': return { x: dist, y: 0 };
        case 'l': return { x: -dist, y: 0 };
        case 't': return { x: 0, y: -dist };
        case 'b': return { x: 0, y: dist };
      }
    };
    const v1 = vec(s1);
    const v2 = vec(s2);
    return `M ${x1} ${y1} C ${x1 + v1.x} ${y1 + v1.y}, ${x2 + v2.x} ${y2 + v2.y}, ${x2} ${y2}`;
  };

  const oppositeHandle = (h: HandlePosition): HandlePosition => {
    switch (h) {
      case 'r': return 'l';
      case 'l': return 'r';
      case 't': return 'b';
      case 'b': return 't';
    }
  };

  // -------------------------------------------------------------
  // Filtered Cards for Search
  // -------------------------------------------------------------
  const matchingCardIds = searchQuery.trim()
    ? cards
        .filter(
          (c) =>
            c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.card_type.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .map((c) => c.id)
    : [];

  const handleResetCanvas = async () => {
    if (!window.confirm('Reset canvas to default starter template?')) return;
    try {
      await canvasApi.reset();
    } catch {}
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    await loadCanvasData();
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-100 overflow-hidden select-none font-sans text-slate-800">
      {/* ============================================================ */}
      {/* TOPBAR NAVIGATION */}
      {/* ============================================================ */}
      <header className="h-14 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 flex items-center justify-between z-30 shadow-xs">
        {/* Left: Brand */}
        <div className="flex items-center gap-3 min-w-[200px]">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
            IC
          </div>
          <div>
            <h1 className="font-bold text-sm text-slate-900 leading-tight flex items-center gap-2">
              InfiCanvas
              <span className="text-[10px] font-semibold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full border border-blue-200">
                Mindmap
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">Think, research & connect</p>
          </div>
        </div>

        {/* Center: Tools & Actions */}
        <div className="flex items-center gap-1.5">
          {/* Add Node Button */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Node
          </button>

          {/* Connect Mode Toggle */}
          <button
            onClick={() => {
              setIsConnectMode(!isConnectMode);
              setConnectingFrom(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
              isConnectMode
                ? 'bg-blue-50 border-blue-400 text-blue-600'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            {isConnectMode ? 'Connecting…' : 'Connect'}
          </button>

          <div className="h-5 w-px bg-slate-200 mx-1" />

          {/* Auto-Layout */}
          <button
            onClick={handleAutoLayout}
            title="Auto-arrange mindmap nodes"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Auto-Layout
          </button>

          {/* Fit View */}
          <button
            onClick={handleFitAll}
            title="Fit all nodes in view"
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Reset View */}
          <button
            onClick={handleResetView}
            title="Reset view (100%)"
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Search, Status & Help */}
        <div className="flex items-center gap-3">
          {/* Search Bar */}
          <div className="relative w-44">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1 text-xs bg-slate-100 hover:bg-slate-200/60 focus:bg-white rounded-lg border border-transparent focus:border-blue-400 outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Sync Status Badge */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-md border border-slate-200">
            {saveStatus === 'saved' ? (
              <>
                <CloudCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[11px] font-medium text-slate-600">Saved</span>
              </>
            ) : saveStatus === 'saving' ? (
              <>
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span className="text-[11px] font-medium text-slate-600">Saving…</span>
              </>
            ) : (
              <>
                <Database className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px] font-medium text-slate-600">Local DB</span>
              </>
            )}
          </div>

          {/* Help Button */}
          <button
            onClick={() => setIsHelpModalOpen(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Keyboard shortcuts & guide"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ============================================================ */}
      {/* CANVAS WORKSPACE */}
      {/* ============================================================ */}
      <main
        ref={workspaceRef}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingFiles(true);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingFiles(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDraggingFiles(false);
          }
        }}
        onDrop={handleDropFiles}
        className="flex-1 relative overflow-hidden bg-slate-50 canvas-bg"
      >
        {/* Drag-over indicator overlay */}
        {isDraggingFiles && (
          <div className="absolute inset-0 bg-blue-500/10 border-4 border-dashed border-blue-500 z-50 flex items-center justify-center backdrop-blur-xs pointer-events-none animate-in fade-in">
            <div className="bg-white/95 px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 text-blue-600 font-bold text-sm">
              <Upload className="w-6 h-6 animate-bounce" />
              Drop images or files here to create canvas cards!
            </div>
          </div>
        )}

        <div
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onDoubleClick={handleCanvasDoubleClick}
          className="absolute inset-0 select-none overflow-hidden"
        >
          {/* World Transformed Container */}
          <div
            style={{
              transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
              transformOrigin: '0 0',
            }}
            className="absolute left-0 top-0 pointer-events-none"
          >
            {/* SVG CONNECTIONS LAYER */}
            <svg
              className="absolute left-0 top-0 overflow-visible pointer-events-none"
              style={{ width: 1, height: 1 }}
            >
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="8"
                  markerHeight="6"
                  refX="7"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
                </marker>
              </defs>

              {/* Existing Card Links */}
              {links.map((link) => {
                const source = cards.find((c) => c.id === link.source_card_id);
                const target = cards.find((c) => c.id === link.linked_card_id);
                if (!source || !target) return null;

                const s = getAnchorCoords(source, link.source_handle || 'r');
                const t = getAnchorCoords(target, link.linked_handle || 'l');
                const path = getBezierPath(
                  s.x,
                  s.y,
                  t.x,
                  t.y,
                  link.source_handle || 'r',
                  link.linked_handle || 'l'
                );

                const strokeColor = link.color || '#94a3b8';

                return (
                  <g key={link.id} className="group/link pointer-events-auto">
                    {/* Visual Curve */}
                    <path
                      d={path}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      markerEnd="url(#arrowhead)"
                      className="transition-colors group-hover/link:stroke-blue-500"
                    />

                    {/* Wide Invisible Hit Area for Easy Double Click or Click */}
                    <path
                      d={path}
                      fill="none"
                      stroke="transparent"
                      strokeWidth="16"
                      className="cursor-pointer"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleDeleteLink(link.id);
                      }}
                    />

                    {/* Optional Label Badge */}
                    {link.label && (
                      <text
                        x={(s.x + t.x) / 2}
                        y={(s.y + t.y) / 2 - 6}
                        fill="#64748b"
                        fontSize="10"
                        fontWeight="600"
                        textAnchor="middle"
                        className="bg-white"
                      >
                        {link.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Live Connection Drag Wire */}
              {connectingFrom && pointerWorld && (
                (() => {
                  const source = cards.find((c) => c.id === connectingFrom.cardId);
                  if (!source) return null;
                  const s = getAnchorCoords(source, connectingFrom.handle);
                  const path = getBezierPath(
                    s.x,
                    s.y,
                    pointerWorld.x,
                    pointerWorld.y,
                    connectingFrom.handle,
                    oppositeHandle(connectingFrom.handle)
                  );
                  return (
                    <path
                      d={path}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="2.5"
                      strokeDasharray="6 6"
                      strokeLinecap="round"
                    />
                  );
                })()
              )}
            </svg>

            {/* CARDS LAYER */}
            <div className="absolute left-0 top-0 pointer-events-auto">
              {cards.map((card) => (
                <CanvasCardView
                  key={card.id}
                  card={card}
                  isSelected={card.id === selectedCardId}
                  isConnectingSource={connectingFrom?.cardId === card.id}
                  isSearchMatch={matchingCardIds.includes(card.id)}
                  onSelect={(e) => {
                    e.stopPropagation();
                    setSelectedCardId(card.id);
                  }}
                  onStartDrag={handleStartCardDrag}
                  onHandleClick={(handle) => handleHandleClick(card.id, handle)}
                  onAddBranch={(dir) => handleAddBranch(card.id, dir)}
                  onEdit={() => setEditingCard(card)}
                  onDuplicate={() => handleDuplicateCard(card.id)}
                  onDelete={() => handleDeleteCard(card.id)}
                  onUpdate={(updated) => handleUpdateCard(card.id, updated)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* FLOATING QUICK ADD DOCK */}
        {/* ============================================================ */}
        <div className="absolute left-1/2 bottom-5 -translate-x-1/2 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xl p-1.5 flex items-center gap-1 z-20">
          <button
            onClick={() => handleAddCard('text')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-blue-500" />
            Note
          </button>
          <button
            onClick={() => handleAddCard('note')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors"
          >
            <StickyNote className="w-3.5 h-3.5 text-amber-500" />
            Sticky
          </button>
          <button
            onClick={() => handleAddCard('image')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors"
          >
            <ImageIcon className="w-3.5 h-3.5 text-purple-500" />
            Image
          </button>
          <button
            onClick={() => {
              const opened = openSpaceFilePicker((file) => handleAddSpaceImage(file));
              if (!opened) {
                fileInputRef.current?.click();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-indigo-50 text-xs font-semibold text-indigo-700 transition-colors"
            title="Pick or upload file from Potatoverse (libspace.js)"
          >
            <FolderOpen className="w-3.5 h-3.5 text-indigo-600" />
            Space File
          </button>
          <button
            onClick={() => handleAddCard('link')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors"
          >
            <Link2 className="w-3.5 h-3.5 text-emerald-500" />
            Link
          </button>
          <button
            onClick={() => handleAddCard('quote')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors"
          >
            <Quote className="w-3.5 h-3.5 text-amber-600" />
            Quote
          </button>
          <button
            onClick={() => handleAddCard('list')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors"
          >
            <CheckSquare className="w-3.5 h-3.5 text-rose-500" />
            Checklist
          </button>

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const uploaded = await uploadSpaceFile(file, 'cimple-inficanvas/images');
              await handleAddSpaceImage(uploaded);
              e.target.value = '';
            }}
          />
        </div>

        {/* ============================================================ */}
        {/* BOTTOM RIGHT: MINIMAP & ZOOM CONTROLS */}
        {/* ============================================================ */}
        <div className="absolute right-5 bottom-5 flex flex-col items-end gap-3 z-20">
          {/* Interactive Minimap */}
          <Minimap
            cards={cards}
            viewport={viewport}
            canvasWidth={workspaceRef.current?.clientWidth || 800}
            canvasHeight={workspaceRef.current?.clientHeight || 600}
            onNavigate={(wx, wy) => {
              const cx = (workspaceRef.current?.clientWidth || 800) / 2;
              const cy = (workspaceRef.current?.clientHeight || 600) / 2;
              setViewport((prev) => ({
                ...prev,
                x: Math.round(cx - wx * prev.scale),
                y: Math.round(cy - wy * prev.scale),
              }));
            }}
          />

          {/* Zoom Box */}
          <div className="flex items-center bg-white/95 backdrop-blur-xs border border-slate-200/90 rounded-xl shadow-lg overflow-hidden text-xs font-semibold text-slate-700">
            <button
              onClick={() => handleZoom(0.85)}
              className="p-2 hover:bg-slate-100 transition-colors"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span
              onClick={handleResetView}
              className="px-3 min-w-[54px] text-center cursor-pointer hover:text-blue-600 transition-colors"
              title="Click to reset view"
            >
              {Math.round(viewport.scale * 100)}%
            </span>
            <button
              onClick={() => handleZoom(1.15)}
              className="p-2 hover:bg-slate-100 transition-colors"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* EMPTY CANVAS HELPER */}
        {/* ============================================================ */}
        {cards.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400">
            <div className="w-14 h-14 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 mb-3 bg-white/60">
              <Sparkles className="w-6 h-6" />
            </div>
            <p className="font-bold text-slate-700 text-sm">Your canvas is blank</p>
            <p className="text-xs text-slate-400 mt-1">Double-click anywhere or click a card type below to start</p>
          </div>
        )}
      </main>

      {/* ============================================================ */}
      {/* MODALS & DRAWERS */}
      {/* ============================================================ */}
      {/* Card Editor Slide-over */}
      <CardEditorDrawer
        card={editingCard}
        isOpen={editingCard !== null}
        onClose={() => setEditingCard(null)}
        onSave={(updated) => handleUpdateCard(updated.id, updated)}
        onDelete={(cardId) => handleDeleteCard(cardId)}
      />

      {/* Add Card Modal */}
      <AddCardModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSelectType={(type) => handleAddCard(type)}
        onAddSpaceImage={(file) => handleAddSpaceImage(file)}
      />

      {/* Help Modal */}
      {isHelpModalOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setIsHelpModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">Canvas Controls & Shortcuts</h3>
              <button
                onClick={() => setIsHelpModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 text-xs text-slate-600 space-y-2.5 leading-relaxed">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-800">Pan Canvas</span>
                <span className="text-slate-500">Hold Space + drag or drag background</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-800">Zoom</span>
                <span className="text-slate-500">Mouse wheel or +/- keys</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-800">Create Card</span>
                <span className="text-slate-500">Double-click canvas or bottom dock</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-800">Mindmap Branch</span>
                <span className="text-slate-500">Hover handle & click "+" button</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-800">Connect Cards</span>
                <span className="text-slate-500">Click handle then another card</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-800">Edit / Details</span>
                <span className="text-slate-500">Double click card body</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-800">Delete Card</span>
                <span className="text-slate-500">Select & press Delete / Backspace</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-800">Delete Connection</span>
                <span className="text-slate-500">Double click link line</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-800">Reset Canvas</span>
                <button
                  onClick={handleResetCanvas}
                  className="text-rose-500 font-semibold hover:underline"
                >
                  Reset to Starter Demo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
