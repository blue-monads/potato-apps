import { useRef } from 'react';
import type { NodeCard, Viewport } from './types';

interface MinimapProps {
  cards: NodeCard[];
  viewport: Viewport;
  canvasWidth: number;
  canvasHeight: number;
  onNavigate: (worldX: number, worldY: number) => void;
}

export const Minimap: React.FC<MinimapProps> = ({
  cards,
  viewport,
  canvasWidth,
  canvasHeight,
  onNavigate,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapW = 160;
  const mapH = 100;

  if (cards.length === 0) return null;

  // Compute world bounding box with padding
  const minX = Math.min(-500, ...cards.map((c) => c.position_x));
  const maxX = Math.max(1500, ...cards.map((c) => c.position_x + c.size_x));
  const minY = Math.min(-300, ...cards.map((c) => c.position_y));
  const maxY = Math.max(1000, ...cards.map((c) => c.position_y + c.size_y));

  const totalW = maxX - minX || 1;
  const totalH = maxY - minY || 1;

  // World to Minimap coords
  const toMiniX = (wx: number) => ((wx - minX) / totalW) * mapW;
  const toMiniY = (wy: number) => ((wy - minY) / totalH) * mapH;

  // Viewport box in world coords
  const viewWorldLeft = -viewport.x / viewport.scale;
  const viewWorldTop = -viewport.y / viewport.scale;
  const viewWorldWidth = canvasWidth / viewport.scale;
  const viewWorldHeight = canvasHeight / viewport.scale;

  const boxX = Math.max(0, Math.min(mapW, toMiniX(viewWorldLeft)));
  const boxY = Math.max(0, Math.min(mapH, toMiniY(viewWorldTop)));
  const boxW = Math.min(mapW - boxX, (viewWorldWidth / totalW) * mapW);
  const boxH = Math.min(mapH - boxY, (viewWorldHeight / totalH) * mapH);

  const handleClick = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const targetWorldX = minX + (clickX / mapW) * totalW;
    const targetWorldY = minY + (clickY / mapH) * totalH;

    onNavigate(targetWorldX, targetWorldY);
  };

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      style={{ width: `${mapW}px`, height: `${mapH}px` }}
      className="bg-white/90 backdrop-blur-xs border border-slate-200/80 rounded-xl shadow-lg relative overflow-hidden cursor-crosshair group select-none"
      title="Click to jump to area"
    >
      {/* Thumbnail Nodes */}
      {cards.map((c) => {
        const mx = toMiniX(c.position_x);
        const my = toMiniY(c.position_y);
        const mw = Math.max(4, (c.size_x / totalW) * mapW);
        const mh = Math.max(3, (c.size_y / totalH) * mapH);

        return (
          <div
            key={c.id}
            style={{
              left: `${mx}px`,
              top: `${my}px`,
              width: `${mw}px`,
              height: `${mh}px`,
              backgroundColor: c.color || '#3b82f6',
            }}
            className="absolute rounded-xs opacity-70"
          />
        );
      })}

      {/* Viewport Box */}
      <div
        style={{
          left: `${boxX}px`,
          top: `${boxY}px`,
          width: `${Math.max(12, boxW)}px`,
          height: `${Math.max(8, boxH)}px`,
        }}
        className="absolute border border-blue-500 bg-blue-500/15 rounded-xs pointer-events-none"
      />
    </div>
  );
};
