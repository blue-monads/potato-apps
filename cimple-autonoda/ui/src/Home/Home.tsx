import { useState, useEffect, useCallback } from 'react';
import type {
  EventTrigger,
  RuleBlock,
  Rule,
  Target,
  TriggerGraph,
  EditorNode,
  InferredWire,
} from '../types/workflow';
import { inferWires } from '../types/workflow';
import { autonodaApi } from '../lib/api';
import { computeAutoLayout } from '../lib/layout';
import { Header } from '../components/Header';
import { Canvas } from '../components/Canvas';
import { InspectorDrawer } from '../components/InspectorDrawer';
import { TriggerList } from '../pages/TriggerList';

export default function Home() {
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [activeTriggerId, setActiveTriggerId] = useState<number | null>(null);

  // Lazy in-memory graph state for snappy canvas editing
  const [graph, setGraph] = useState<TriggerGraph | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'ready'>('ready');

  const [nodes, setNodes] = useState<EditorNode[]>([]);
  const [wires, setWires] = useState<InferredWire[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [fitViewTrigger, setFitViewTrigger] = useState<number>(0);

  // Synchronize EditorNodes & InferredWires whenever local graph changes
  const syncNodesFromGraph = useCallback((currentGraph: TriggerGraph) => {
    const inferred = inferWires(currentGraph.trigger, currentGraph.rule_blocks, currentGraph.targets);
    setWires(inferred);

    const editorNodes: EditorNode[] = [];

    // Trigger Node
    if (currentGraph.trigger) {
      editorNodes.push({
        id: `trigger_${currentGraph.trigger.id}`,
        entityId: currentGraph.trigger.id,
        type: 'trigger',
        title: currentGraph.trigger.name,
        x: 400,
        y: 60,
        trigger: currentGraph.trigger,
      });
    }

    // Rule Block Nodes
    for (const rb of currentGraph.rule_blocks) {
      const rbRules = currentGraph.rules.filter((r) => r.ruleBlockId === rb.id);
      editorNodes.push({
        id: `rule_block_${rb.id}`,
        entityId: rb.id,
        type: 'rule_block',
        title: `Rule Block #${rb.id}`,
        x: 400,
        y: 240,
        ruleBlock: { ...rb, rules: rbRules },
      });
    }

    // Target Nodes
    for (const tg of currentGraph.targets) {
      editorNodes.push({
        id: `target_${tg.id}`,
        entityId: tg.id,
        type: 'target',
        title: `${tg.targetType} Target`,
        x: 400,
        y: 440,
        target: tg,
      });
    }

    // Apply auto layout positions
    const layoutPositions = computeAutoLayout(editorNodes, inferred);
    const positioned = editorNodes.map((n) => ({
      ...n,
      x: layoutPositions[n.id]?.x ?? n.x,
      y: layoutPositions[n.id]?.y ?? n.y,
    }));

    setNodes(positioned);
  }, []);

  // 2. Load Active Trigger Graph from backend
  const loadGraph = useCallback(async (triggerId: number) => {
    const data = await autonodaApi.getTriggerGraph(triggerId);
    setGraph(data);
    setHasUnsavedChanges(false);
    syncNodesFromGraph(data);
  }, [syncNodesFromGraph]);

  useEffect(() => {
    if (activeTriggerId && view === 'editor') {
      loadGraph(activeTriggerId);
      setSelectedNodeId(null);
    }
  }, [activeTriggerId, view, loadGraph]);

  // Selected item
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  // Auto layout helper
  const handleAutoLayout = useCallback(() => {
    if (nodes.length === 0) return;
    const layoutPositions = computeAutoLayout(nodes, wires);
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        x: layoutPositions[n.id]?.x ?? n.x,
        y: layoutPositions[n.id]?.y ?? n.y,
      }))
    );
  }, [nodes, wires]);

  // Node position drag update (in-memory)
  const handleUpdateNodePosition = (nodeId: string, x: number, y: number) => {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, x, y } : n)));
  };

  // Disconnect Wire (in-memory)
  const handleDeleteWire = (wireId: string) => {
    if (!graph) return;
    const wire = wires.find((w) => w.id === wireId);
    if (!wire) return;

    const toNode = nodes.find((n) => n.id === wire.toNodeId);
    if (!toNode) return;

    let updatedGraph: TriggerGraph = { ...graph };
    if (toNode.type === 'rule_block') {
      updatedGraph.rule_blocks = updatedGraph.rule_blocks.map((rb) =>
        rb.id === toNode.entityId ? { ...rb, parentRuleBlockId: null } : rb
      );
    } else if (toNode.type === 'target') {
      updatedGraph.targets = updatedGraph.targets.map((tg) =>
        tg.id === toNode.entityId ? { ...tg, linkedBlockId: null, linkedTargetId: null } : tg
      );
    }

    setGraph(updatedGraph);
    setHasUnsavedChanges(true);
    syncNodesFromGraph(updatedGraph);
  };

  // Quick Add below existing node from TRUE / FALSE branch (Instant in-memory, no network reset!)
  const handleAddNodeAndConnect = (
    fromNodeId: string,
    branch: 'TRUE' | 'FALSE',
    type: 'rule_block' | 'target'
  ) => {
    if (!graph || !activeTriggerId) return;
    const fromNode = nodes.find((n) => n.id === fromNodeId);
    if (!fromNode) return;

    const newId = Date.now();
    const updatedGraph: TriggerGraph = {
      ...graph,
      rule_blocks: [...graph.rule_blocks],
      targets: [...graph.targets],
      rules: [...graph.rules],
    };

    if (type === 'rule_block') {
      const parentId = fromNode.type === 'rule_block' ? fromNode.entityId : null;
      const newRb: RuleBlock = {
        id: newId,
        triggerId: activeTriggerId,
        blockType: 'ALL_OF',
        parentRuleBlockId: parentId,
        branch: branch,
        delaySeconds: 0,
        rules: [],
      };
      updatedGraph.rule_blocks.push(newRb);
      setSelectedNodeId(`rule_block_${newId}`);
    } else {
      const linkedBlockId = fromNode.type === 'rule_block' ? fromNode.entityId : null;
      const linkedTargetId = fromNode.type === 'target' ? fromNode.entityId : null;
      const newTg: Target = {
        id: newId,
        triggerId: activeTriggerId,
        linkedBlockId: linkedBlockId,
        linkedTargetId: linkedTargetId,
        branch: branch,
        targetType: 'WEBHOOK',
        targetMeta: { url: 'https://api.example.com/webhook', method: 'POST' },
      };
      updatedGraph.targets.push(newTg);
      setSelectedNodeId(`target_${newId}`);
    }

    setGraph(updatedGraph);
    setHasUnsavedChanges(true);
    syncNodesFromGraph(updatedGraph);
  };

  // Node Deletion (in-memory)
  const handleDeleteNode = (nodeId: string) => {
    if (!graph) return;
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    let updatedGraph: TriggerGraph = {
      ...graph,
      rule_blocks: [...graph.rule_blocks],
      targets: [...graph.targets],
      rules: [...graph.rules],
    };

    if (node.type === 'rule_block') {
      updatedGraph.rule_blocks = updatedGraph.rule_blocks.filter((rb) => rb.id !== node.entityId);
      updatedGraph.rules = updatedGraph.rules.filter((r) => r.ruleBlockId !== node.entityId);
      // Unlink children
      updatedGraph.rule_blocks = updatedGraph.rule_blocks.map((rb) =>
        rb.parentRuleBlockId === node.entityId ? { ...rb, parentRuleBlockId: null } : rb
      );
      updatedGraph.targets = updatedGraph.targets.map((tg) =>
        tg.linkedBlockId === node.entityId ? { ...tg, linkedBlockId: null } : tg
      );
    } else if (node.type === 'target') {
      updatedGraph.targets = updatedGraph.targets.filter((tg) => tg.id !== node.entityId);
      updatedGraph.targets = updatedGraph.targets.map((tg) =>
        tg.linkedTargetId === node.entityId ? { ...tg, linkedTargetId: null } : tg
      );
    }

    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    setGraph(updatedGraph);
    setHasUnsavedChanges(true);
    syncNodesFromGraph(updatedGraph);
  };

  // In-memory updates from Inspector Drawer
  const handleUpdateTrigger = (_id: number, updates: Partial<EventTrigger>) => {
    if (!graph) return;
    const updatedGraph = {
      ...graph,
      trigger: { ...graph.trigger, ...updates },
    };
    setGraph(updatedGraph);
    setHasUnsavedChanges(true);
    syncNodesFromGraph(updatedGraph);
  };

  const handleUpdateRuleBlock = (id: number, updates: Partial<RuleBlock>) => {
    if (!graph) return;
    const updatedGraph = {
      ...graph,
      rule_blocks: graph.rule_blocks.map((rb) => (rb.id === id ? { ...rb, ...updates } : rb)),
    };
    setGraph(updatedGraph);
    setHasUnsavedChanges(true);
    syncNodesFromGraph(updatedGraph);
  };

  const handleAddRule = (ruleBlockId: number, rule: Partial<Rule>) => {
    if (!graph || !activeTriggerId) return;
    const newRule: Rule = {
      id: Date.now(),
      triggerId: activeTriggerId,
      ruleBlockId,
      ruleType: 'EQUAL',
      variable: rule.variable || 'data.field',
      operator: rule.operator || 'equals',
      value: rule.value || 'value',
      order: graph.rules.length,
    };
    const updatedGraph = {
      ...graph,
      rules: [...graph.rules, newRule],
    };
    setGraph(updatedGraph);
    setHasUnsavedChanges(true);
    syncNodesFromGraph(updatedGraph);
  };

  const handleUpdateRule = (id: number, updates: Partial<Rule>) => {
    if (!graph) return;
    const updatedGraph = {
      ...graph,
      rules: graph.rules.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    };
    setGraph(updatedGraph);
    setHasUnsavedChanges(true);
    syncNodesFromGraph(updatedGraph);
  };

  const handleDeleteRule = (id: number) => {
    if (!graph) return;
    const updatedGraph = {
      ...graph,
      rules: graph.rules.filter((r) => r.id !== id),
    };
    setGraph(updatedGraph);
    setHasUnsavedChanges(true);
    syncNodesFromGraph(updatedGraph);
  };

  const handleUpdateTarget = (id: number, updates: Partial<Target>) => {
    if (!graph) return;
    const updatedGraph = {
      ...graph,
      targets: graph.targets.map((tg) => (tg.id === id ? { ...tg, ...updates } : tg)),
    };
    setGraph(updatedGraph);
    setHasUnsavedChanges(true);
    syncNodesFromGraph(updatedGraph);
  };

  // Top Right Save Button: Atomic save to backend!
  const handleSave = async () => {
    if (!graph || !activeTriggerId) return;
    setSaveStatus('saving');

    try {
      const savedGraph = await autonodaApi.saveTriggerGraph(activeTriggerId, graph);
      setGraph(savedGraph);
      setHasUnsavedChanges(false);
      setSaveStatus('saved');
      syncNodesFromGraph(savedGraph);

      setTimeout(() => {
        setSaveStatus('ready');
      }, 2000);
    } catch (err) {
      alert('Error saving graph changes to database');
      setSaveStatus('ready');
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedNodeId(null);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) {
        if (!['INPUT', 'TEXTAREA', 'SELECT'].includes((document.activeElement as HTMLElement)?.tagName)) {
          handleDeleteNode(selectedNodeId);
        }
      }
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, graph, activeTriggerId]);

  // If in Listing view, render TriggerList page
  if (view === 'list') {
    return (
      <TriggerList
        onSelectTrigger={(triggerId) => {
          setActiveTriggerId(triggerId);
          setView('editor');
        }}
      />
    );
  }

  // Otherwise render Flow Graph editor view
  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-slate-50 font-sans">
      {/* Streamlined Header with Focus Center, Auto Layout, and Save Button */}
      <Header
        activeTrigger={graph?.trigger || null}
        onBackToList={() => {
          if (hasUnsavedChanges) {
            if (!confirm('You have unsaved changes. Leave without saving?')) return;
          }
          setView('list');
        }}
        onUpdateTitle={(title) => {
          if (graph?.trigger) handleUpdateTrigger(graph.trigger.id, { name: title });
        }}
        onAutoLayout={handleAutoLayout}
        onFitView={() => setFitViewTrigger((prev) => prev + 1)}
        onSave={handleSave}
        saveStatus={saveStatus}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Visual Graph Canvas with Dual-Branch TRUE/FALSE points */}
        <Canvas
          nodes={nodes}
          wires={wires}
          selectedNodeId={selectedNodeId}
          onSelectNode={(id) => setSelectedNodeId(id)}
          onUpdateNodePosition={handleUpdateNodePosition}
          onDeleteNode={handleDeleteNode}
          onDeleteWire={handleDeleteWire}
          onAddNodeAndConnect={handleAddNodeAndConnect}
          fitViewTrigger={fitViewTrigger}
        />

        {/* Right Inspector Drawer */}
        {selectedNode && (
          <InspectorDrawer
            node={selectedNode}
            onClose={() => setSelectedNodeId(null)}
            onUpdateTrigger={handleUpdateTrigger}
            onUpdateRuleBlock={handleUpdateRuleBlock}
            onAddRule={handleAddRule}
            onUpdateRule={handleUpdateRule}
            onDeleteRule={handleDeleteRule}
            onUpdateTarget={handleUpdateTarget}
          />
        )}
      </div>
    </div>
  );
}
