import type { EditorNode, InferredWire } from '../types/workflow';

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
 * Computes a clean vertical tree DAG layout for Autonoda relational nodes.
 * Accurately branches TRUE paths to the left and FALSE paths to the right.
 */
export function computeAutoLayout(
  nodes: EditorNode[],
  wires: InferredWire[],
  config: Partial<AutoLayoutConfig> = {}
): Record<string, { x: number; y: number }> {
  const cfg: AutoLayoutConfig = { ...DEFAULT_CONFIG, ...config };
  const positions: Record<string, { x: number; y: number }> = {};

  if (nodes.length === 0) return positions;

  // Build adjacency mappings
  const incomingMap = new Map<string, InferredWire[]>();
  const outgoingMap = new Map<string, InferredWire[]>();

  nodes.forEach((n) => {
    incomingMap.set(n.id, []);
    outgoingMap.set(n.id, []);
  });

  wires.forEach((w) => {
    if (incomingMap.has(w.toNodeId)) {
      incomingMap.get(w.toNodeId)!.push(w);
    }
    if (outgoingMap.has(w.fromNodeId)) {
      outgoingMap.get(w.fromNodeId)!.push(w);
    }
  });

  // Identify root nodes: nodes without incoming wires
  const rootNodes = nodes.filter((n) => {
    const inc = incomingMap.get(n.id) || [];
    return inc.length === 0;
  });

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

    if (node.type === 'rule_block') {
      const trueWires = outgoing.filter((w) => w.fromPort === 'true' && !visited.has(w.toNodeId));
      const falseWires = outgoing.filter((w) => w.fromPort === 'false' && !visited.has(w.toNodeId));

      let leftW = 0;
      let leftH = 0;
      trueWires.forEach((w, i) => {
        const inf = getSubtreeInfo(w.toNodeId);
        leftW += inf.width + (i > 0 ? cfg.gapX : 0);
        leftH = Math.max(leftH, inf.height);
      });

      let rightW = 0;
      let rightH = 0;
      falseWires.forEach((w, i) => {
        const inf = getSubtreeInfo(w.toNodeId);
        rightW += inf.width + (i > 0 ? cfg.gapX : 0);
        rightH = Math.max(rightH, inf.height);
      });

      const totalBranchW = Math.max(cfg.nodeWidth, leftW + (leftW > 0 && rightW > 0 ? cfg.gapX : 0) + rightW);
      return {
        width: totalBranchW,
        height: cfg.nodeHeight + cfg.gapY + Math.max(leftH, rightH),
      };
    }

    let totalChildW = 0;
    let maxChildH = 0;
    const validChildren = outgoing
      .map((w) => w.toNodeId)
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

    if (node.type === 'rule_block') {
      const trueWires = outgoing.filter((w) => w.fromPort === 'true' && !placed.has(w.toNodeId));
      const falseWires = outgoing.filter((w) => w.fromPort === 'false' && !placed.has(w.toNodeId));

      let leftW = 0;
      visited.clear();
      trueWires.forEach((w, i) => {
        const inf = getSubtreeInfo(w.toNodeId);
        leftW += inf.width + (i > 0 ? cfg.gapX : 0);
      });

      let rightW = 0;
      visited.clear();
      falseWires.forEach((w, i) => {
        const inf = getSubtreeInfo(w.toNodeId);
        rightW += inf.width + (i > 0 ? cfg.gapX : 0);
      });

      const totalW = Math.max(cfg.nodeWidth, leftW + (leftW > 0 && rightW > 0 ? cfg.gapX : 0) + rightW);
      let curLeftX = x + (allocatedWidth - totalW) / 2;
      let curRightX = curLeftX + leftW + (leftW > 0 && rightW > 0 ? cfg.gapX : 0);

      trueWires.forEach((w) => {
        visited.clear();
        const inf = getSubtreeInfo(w.toNodeId);
        assignPositions(w.toNodeId, curLeftX, nextY, inf.width);
        curLeftX += inf.width + cfg.gapX;
      });

      falseWires.forEach((w) => {
        visited.clear();
        const inf = getSubtreeInfo(w.toNodeId);
        assignPositions(w.toNodeId, curRightX, nextY, inf.width);
        curRightX += inf.width + cfg.gapX;
      });
      return;
    }

    const unplacedChildren = outgoing.map((w) => w.toNodeId).filter((id) => !placed.has(id));

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
