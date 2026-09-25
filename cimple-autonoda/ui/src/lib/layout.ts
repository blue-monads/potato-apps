import type { FlowNode, Wire } from '../types/workflow';

export interface AutoLayoutConfig {
  nodeWidth: number;
  nodeHeight: number;
  gapX: number;
  gapY: number;
  startX: number;
  startY: number;
}

const DEFAULT_CONFIG: AutoLayoutConfig = {
  nodeWidth: 260,
  nodeHeight: 140,
  gapX: 60,
  gapY: 70,
  startX: 400,
  startY: 50,
};

interface SubtreeInfo {
  width: number;
  height: number;
}

/**
 * Computes a clean vertical tree DAG layout for Autonoda workflows.
 * Handles single triggers, sequential actions, and dual-branching logic blocks (TRUE & FALSE).
 * Unconnected or auxiliary nodes are placed in a tidy auxiliary column.
 */
export function computeAutoLayout(
  nodes: FlowNode[],
  wires: Wire[],
  config: Partial<AutoLayoutConfig> = {}
): Record<string, { x: number; y: number }> {
  const cfg: AutoLayoutConfig = { ...DEFAULT_CONFIG, ...config };
  const positions: Record<string, { x: number; y: number }> = {};

  if (nodes.length === 0) return positions;

  // Build adjacency mappings
  const incomingMap = new Map<string, Wire[]>();
  const outgoingMap = new Map<string, Wire[]>();

  nodes.forEach((n) => {
    incomingMap.set(n.id, []);
    outgoingMap.set(n.id, []);
  });

  wires.forEach((w) => {
    if (incomingMap.has(w.toNode)) {
      incomingMap.get(w.toNode)!.push(w);
    }
    if (outgoingMap.has(w.fromNode)) {
      outgoingMap.get(w.fromNode)!.push(w);
    }
  });

  // Identify root nodes: nodes without incoming wires
  const rootNodes = nodes.filter((n) => {
    const inc = incomingMap.get(n.id) || [];
    return inc.length === 0;
  });

  // If no root node (e.g. cycle), pick trigger or first node
  const effectiveRoots =
    rootNodes.length > 0
      ? rootNodes
      : [nodes.find((n) => n.type === 'trigger') || nodes[0]];

  const visited = new Set<string>();

  // Pass 1: Compute subtree widths recursively
  function getSubtreeInfo(nodeId: string): SubtreeInfo {
    visited.add(nodeId);
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return { width: cfg.nodeWidth, height: cfg.nodeHeight };

    const outgoing = outgoingMap.get(nodeId) || [];
    if (outgoing.length === 0) {
      return { width: cfg.nodeWidth, height: cfg.nodeHeight };
    }

    if (node.type === 'logic') {
      const trueWire = outgoing.find((w) => w.fromPort === 'true');
      const falseWire = outgoing.find((w) => w.fromPort === 'false');

      const trueInfo = trueWire && !visited.has(trueWire.toNode)
        ? getSubtreeInfo(trueWire.toNode)
        : null;
      const falseInfo = falseWire && !visited.has(falseWire.toNode)
        ? getSubtreeInfo(falseWire.toNode)
        : null;

      const leftW = trueInfo ? trueInfo.width : cfg.nodeWidth;
      const rightW = falseInfo ? falseInfo.width : cfg.nodeWidth;
      const totalW = Math.max(cfg.nodeWidth, leftW + cfg.gapX + rightW);
      const maxChildH = Math.max(trueInfo ? trueInfo.height : 0, falseInfo ? falseInfo.height : 0);

      return {
        width: totalW,
        height: cfg.nodeHeight + cfg.gapY + maxChildH,
      };
    }

    // Linear or multi-out action/trigger node
    let totalChildW = 0;
    let maxChildH = 0;
    const validChildren = outgoing
      .map((w) => w.toNode)
      .filter((id) => !visited.has(id));

    if (validChildren.length === 0) {
      return { width: cfg.nodeWidth, height: cfg.nodeHeight };
    }

    validChildren.forEach((childId, idx) => {
      const childInfo = getSubtreeInfo(childId);
      totalChildW += childInfo.width + (idx > 0 ? cfg.gapX : 0);
      maxChildH = Math.max(maxChildH, childInfo.height);
    });

    return {
      width: Math.max(cfg.nodeWidth, totalChildW),
      height: cfg.nodeHeight + cfg.gapY + maxChildH,
    };
  }

  // Pass 2: Assign (x, y) coordinates recursively
  const placed = new Set<string>();

  function assignPositions(nodeId: string, x: number, y: number, allocatedWidth: number) {
    if (placed.has(nodeId)) return;
    placed.add(nodeId);

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // Center node in its allocated width
    const nodeX = Math.round(x + (allocatedWidth - cfg.nodeWidth) / 2);
    const nodeY = Math.round(y);
    positions[nodeId] = { x: nodeX, y: nodeY };

    const outgoing = outgoingMap.get(nodeId) || [];
    if (outgoing.length === 0) return;

    const nextY = y + cfg.nodeHeight + cfg.gapY;

    if (node.type === 'logic') {
      const trueWire = outgoing.find((w) => w.fromPort === 'true');
      const falseWire = outgoing.find((w) => w.fromPort === 'false');

      // Temporarily compute widths for remaining
      visited.clear();
      const trueW = trueWire && !placed.has(trueWire.toNode) ? getSubtreeInfo(trueWire.toNode).width : cfg.nodeWidth;
      visited.clear();
      const falseW = falseWire && !placed.has(falseWire.toNode) ? getSubtreeInfo(falseWire.toNode).width : cfg.nodeWidth;

      const totalBranchW = trueW + cfg.gapX + falseW;
      const leftStartX = x + (allocatedWidth - totalBranchW) / 2;
      const rightStartX = leftStartX + trueW + cfg.gapX;

      if (trueWire && !placed.has(trueWire.toNode)) {
        assignPositions(trueWire.toNode, leftStartX, nextY, trueW);
      }
      if (falseWire && !placed.has(falseWire.toNode)) {
        assignPositions(falseWire.toNode, rightStartX, nextY, falseW);
      }
      return;
    }

    // Non-logic children
    const unplacedChildren = outgoing.map((w) => w.toNode).filter((id) => !placed.has(id));
    if (unplacedChildren.length === 1) {
      assignPositions(unplacedChildren[0], x, nextY, allocatedWidth);
    } else if (unplacedChildren.length > 1) {
      let curX = x;
      unplacedChildren.forEach((childId) => {
        visited.clear();
        const childW = getSubtreeInfo(childId).width;
        assignPositions(childId, curX, nextY, childW);
        curX += childW + cfg.gapX;
      });
    }
  }

  // Layout all root trees
  let currentTreeX = cfg.startX;
  effectiveRoots.forEach((root) => {
    visited.clear();
    const info = getSubtreeInfo(root.id);
    assignPositions(root.id, currentTreeX, cfg.startY, info.width);
    currentTreeX += info.width + cfg.gapX * 1.5;
  });

  // Handle any remaining unplaced/orphan nodes
  let orphanY = cfg.startY;
  const orphanX = currentTreeX + 40;
  nodes.forEach((n) => {
    if (!positions[n.id]) {
      positions[n.id] = { x: orphanX, y: orphanY };
      orphanY += cfg.nodeHeight + cfg.gapY;
    }
  });

  return positions;
}
