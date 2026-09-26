import { useState, useEffect, useRef, useCallback } from 'react';
import type { Workflow, FlowNode, NodeType } from '../types/workflow';
import { workflowsApi } from '../lib/api';
import { simulateWorkflowExecution } from '../lib/simulator';
import { computeAutoLayout } from '../lib/layout';
import { Header } from '../components/Header';
import { Canvas } from '../components/Canvas';
import { InspectorDrawer } from '../components/InspectorDrawer';
import { TraceDrawer } from '../components/TraceDrawer';
import { PayloadModal } from '../components/PayloadModal';
import { HistoryModal } from '../components/HistoryModal';

export default function Home() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | number | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // UI layout states (cimple-eventmap inspired)
  const [autoAlignEnabled, setAutoAlignEnabled] = useState<boolean>(true);
  const [fitViewTrigger, setFitViewTrigger] = useState<number>(0);

  // Execution & Simulation state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [activeWireId, setActiveWireId] = useState<string | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [nodeExecStatuses, setNodeExecStatuses] = useState<
    Record<string, 'pass' | 'fail' | 'done' | 'running'>
  >({});
  const [trace, setTrace] = useState<any[]>([]);
  const [isTraceOpen, setIsTraceOpen] = useState<boolean>(false);

  // Modals state
  const [isPayloadModalOpen, setIsPayloadModalOpen] = useState<boolean>(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'ready'>('ready');

  // Debounce auto-save ref
  const saveTimeoutRef = useRef<any>(null);

  // Initial load
  useEffect(() => {
    workflowsApi.list().then((list) => {
      setWorkflows(list);
      if (list.length > 0) {
        setActiveWorkflowId(list[0].id);
      }
    });
  }, []);

  const activeWorkflow = workflows.find((w) => String(w.id) === String(activeWorkflowId)) || null;
  const selectedNode = activeWorkflow?.nodes.find((n) => n.id === selectedNodeId) || null;

  // Auto-save helper
  const triggerAutoSave = (updated: Workflow) => {
    setSaveStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      workflowsApi.update(updated.id, updated).then(() => {
        setSaveStatus('saved');
      });
    }, 600);
  };

  const updateActiveWorkflow = (updates: Partial<Workflow>) => {
    if (!activeWorkflow) return;
    const updated: Workflow = {
      ...activeWorkflow,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    setWorkflows((prev) => prev.map((w) => (w.id === activeWorkflow.id ? updated : w)));
    triggerAutoSave(updated);
  };

  // Auto-Layout Execution
  const applyAutoLayout = useCallback(
    (customNodes?: FlowNode[], customWires?: any[]) => {
      if (!activeWorkflow) return;
      const targetNodes = customNodes || activeWorkflow.nodes;
      const targetWires = customWires || activeWorkflow.wires;

      const newPositions = computeAutoLayout(targetNodes, targetWires);
      const updatedNodes = targetNodes.map((n) => {
        const pos = newPositions[n.id];
        return pos ? { ...n, x: pos.x, y: pos.y } : n;
      });

      updateActiveWorkflow({ nodes: updatedNodes });
    },
    [activeWorkflow]
  );

  // Node operations
  const handleUpdateNodePosition = (nodeId: string, x: number, y: number) => {
    if (!activeWorkflow) return;
    const newNodes = activeWorkflow.nodes.map((n) => (n.id === nodeId ? { ...n, x, y } : n));
    updateActiveWorkflow({ nodes: newNodes });
  };

  const handleUpdateNode = (nodeId: string, updates: Partial<FlowNode>) => {
    if (!activeWorkflow) return;
    const newNodes = activeWorkflow.nodes.map((n) => (n.id === nodeId ? { ...n, ...updates } : n));
    updateActiveWorkflow({ nodes: newNodes });
  };

  const handleDeleteNode = (nodeId: string) => {
    if (!activeWorkflow) return;
    const newNodes = activeWorkflow.nodes.filter((n) => n.id !== nodeId);
    const newWires = activeWorkflow.wires.filter(
      (w) => w.fromNode !== nodeId && w.toNode !== nodeId
    );
    if (selectedNodeId === nodeId) setSelectedNodeId(null);

    if (autoAlignEnabled) {
      const newPositions = computeAutoLayout(newNodes, newWires);
      const remappedNodes = newNodes.map((n) =>
        newPositions[n.id] ? { ...n, x: newPositions[n.id].x, y: newPositions[n.id].y } : n
      );
      updateActiveWorkflow({ nodes: remappedNodes, wires: newWires });
    } else {
      updateActiveWorkflow({ nodes: newNodes, wires: newWires });
    }
  };

  const handleAddNode = (type: NodeType, subtype: string, name: string, dropX?: number, dropY?: number) => {
    if (!activeWorkflow) return;
    const x = dropX !== undefined ? dropX : 340;
    const y = dropY !== undefined ? dropY : 120 + activeWorkflow.nodes.length * 150;

    let config: any = {};
    if (type === 'trigger') {
      config = { eventType: 'custom.event', source: 'Webhook Ingest' };
    } else if (type === 'logic') {
      config = {
        conditionMode: 'AND',
        rules: [{ field: 'order.total', op: 'greater_than', value: '100' }],
      };
    } else if (type === 'action') {
      if (subtype === 'webhook') {
        config = { url: 'https://api.example.com/webhook', method: 'POST' };
      } else if (subtype === 'email') {
        config = { recipient: '{{customer.email}}', subject: 'Workflow Notification' };
      } else if (subtype === 'enrich') {
        config = { enrichField: 'data.enriched', enrichValue: 'true' };
      } else {
        config = { logLevel: 'INFO', message: 'Flow checkpoint logged' };
      }
    }

    const newNode: FlowNode = {
      id: `node_${type}_${Math.random().toString(36).substr(2, 7)}`,
      type,
      subtype,
      title: name,
      x,
      y,
      config,
    };

    const newNodes = [...activeWorkflow.nodes, newNode];

    if (autoAlignEnabled && activeWorkflow.wires.length > 0) {
      const newPositions = computeAutoLayout(newNodes, activeWorkflow.wires);
      const remapped = newNodes.map((n) =>
        newPositions[n.id] ? { ...n, x: newPositions[n.id].x, y: newPositions[n.id].y } : n
      );
      updateActiveWorkflow({ nodes: remapped });
    } else {
      updateActiveWorkflow({ nodes: newNodes });
    }

    setSelectedNodeId(newNode.id);
  };

  const handleAddNodeAndConnect = (
    fromNodeId: string,
    fromPort: 'out' | 'true' | 'false',
    type: NodeType,
    insertWireId?: string
  ) => {
    if (!activeWorkflow) return;

    let subtype = 'webhook';
    let title = 'Action Block';
    let config: any = {};

    if (type === 'action') {
      subtype = 'webhook';
      title = 'Action Block';
      config = {
        url: 'https://api.example.com/webhook',
        method: 'POST',
      };
    } else if (type === 'logic') {
      subtype = 'condition';
      title = 'Condition Logic';
      config = {
        conditionMode: 'AND',
        rules: [{ field: 'order.total', op: 'greater_than', value: '100' }],
      };
    } else if (type === 'trigger') {
      subtype = 'webhook';
      title = 'Event Trigger';
      config = {
        eventType: 'custom.event',
        source: 'Webhook Ingest',
      };
    }

    const newNode: FlowNode = {
      id: `node_${type}_${Math.random().toString(36).substr(2, 7)}`,
      type,
      subtype,
      title,
      x: 340,
      y: 200,
      config,
    };

    let newWires = [...activeWorkflow.wires];

    if (insertWireId) {
      const existingWire = newWires.find((w) => w.id === insertWireId);
      if (existingWire) {
        newWires = newWires.filter((w) => w.id !== insertWireId);
        newWires.push({
          id: `wire_${Math.random().toString(36).substr(2, 7)}`,
          fromNode: existingWire.fromNode,
          fromPort: existingWire.fromPort,
          toNode: newNode.id,
          toPort: 'in',
        });
        newWires.push({
          id: `wire_${Math.random().toString(36).substr(2, 7)}`,
          fromNode: newNode.id,
          fromPort: 'out',
          toNode: existingWire.toNode,
          toPort: existingWire.toPort,
        });
      }
    } else {
      const existingWire = newWires.find(
        (w) => w.fromNode === fromNodeId && w.fromPort === fromPort
      );
      if (existingWire) {
        // Splice in-between
        newWires = newWires.filter((w) => w.id !== existingWire.id);
        newWires.push({
          id: `wire_${Math.random().toString(36).substr(2, 7)}`,
          fromNode: fromNodeId,
          fromPort,
          toNode: newNode.id,
          toPort: 'in',
        });
        newWires.push({
          id: `wire_${Math.random().toString(36).substr(2, 7)}`,
          fromNode: newNode.id,
          fromPort: 'out',
          toNode: existingWire.toNode,
          toPort: existingWire.toPort,
        });
      } else {
        // Direct connect
        newWires.push({
          id: `wire_${Math.random().toString(36).substr(2, 7)}`,
          fromNode: fromNodeId,
          fromPort,
          toNode: newNode.id,
          toPort: 'in',
        });
      }
    }

    const newNodes = [...activeWorkflow.nodes, newNode];

    // Auto-organize layout seamlessly
    const newPositions = computeAutoLayout(newNodes, newWires);
    const remappedNodes = newNodes.map((n) =>
      newPositions[n.id] ? { ...n, x: newPositions[n.id].x, y: newPositions[n.id].y } : n
    );

    updateActiveWorkflow({ nodes: remappedNodes, wires: newWires });
    setSelectedNodeId(newNode.id);
  };

  const handleAddTrigger = () => {
    if (!activeWorkflow) return;
    const newTrigger: FlowNode = {
      id: `node_trigger_${Date.now()}`,
      type: 'trigger',
      subtype: 'webhook',
      title: 'Event Trigger',
      x: 340,
      y: 60,
      config: { eventType: 'custom.event', source: 'Webhook Ingest' },
    };
    updateActiveWorkflow({ nodes: [newTrigger] });
    setSelectedNodeId(newTrigger.id);
  };

  // Wire operations
  const handleConnectWire = (
    fromNode: string,
    fromPort: 'out' | 'true' | 'false',
    toNode: string,
    toPort: 'in'
  ) => {
    if (!activeWorkflow) return;
    const exists = activeWorkflow.wires.some(
      (w) =>
        w.fromNode === fromNode &&
        w.fromPort === fromPort &&
        w.toNode === toNode &&
        w.toPort === toPort
    );
    if (exists) return;

    const newWire = {
      id: `wire_${Math.random().toString(36).substr(2, 7)}`,
      fromNode,
      fromPort,
      toNode,
      toPort,
    };
    const newWires = [...activeWorkflow.wires, newWire];

    if (autoAlignEnabled) {
      const newPositions = computeAutoLayout(activeWorkflow.nodes, newWires);
      const remappedNodes = activeWorkflow.nodes.map((n) =>
        newPositions[n.id] ? { ...n, x: newPositions[n.id].x, y: newPositions[n.id].y } : n
      );
      updateActiveWorkflow({ nodes: remappedNodes, wires: newWires });
    } else {
      updateActiveWorkflow({ wires: newWires });
    }
  };

  const handleDeleteWire = (wireId: string) => {
    if (!activeWorkflow) return;
    const newWires = activeWorkflow.wires.filter((w) => w.id !== wireId);

    if (autoAlignEnabled) {
      const newPositions = computeAutoLayout(activeWorkflow.nodes, newWires);
      const remappedNodes = activeWorkflow.nodes.map((n) =>
        newPositions[n.id] ? { ...n, x: newPositions[n.id].x, y: newPositions[n.id].y } : n
      );
      updateActiveWorkflow({ nodes: remappedNodes, wires: newWires });
    } else {
      updateActiveWorkflow({ wires: newWires });
    }
  };

  // Workflow management
  const handleCreateWorkflow = async () => {
    const created = await workflowsApi.create({
      name: `Untitled Workflow ${workflows.length + 1}`,
      description: 'Custom event automation pipeline',
      nodes: [
        {
          id: `node_trigger_${Date.now()}`,
          type: 'trigger',
          subtype: 'webhook',
          title: 'Event Trigger',
          x: 340,
          y: 40,
          config: { eventType: 'custom.event' },
        },
      ],
      wires: [],
      samplePayload: { event: 'sample', value: 123 },
    });
    setWorkflows((prev) => [...prev, created]);
    setActiveWorkflowId(created.id);
    setSelectedNodeId(null);
    setTrace([]);
  };

  const handleDeleteWorkflow = async (id: string | number) => {
    await workflowsApi.delete(id);
    const remaining = workflows.filter((w) => w.id !== id);
    setWorkflows(remaining);
    if (remaining.length > 0) {
      setActiveWorkflowId(remaining[0].id);
    } else {
      handleCreateWorkflow();
    }
    setSelectedNodeId(null);
  };

  // Execute workflow
  const handleRunWorkflow = async () => {
    if (!activeWorkflow || isRunning) return;

    setNodeExecStatuses({});
    setActiveWireId(null);
    setActiveNodeId(null);
    setTrace([]);
    setIsRunning(true);
    setIsTraceOpen(true);

    const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const startTime = Date.now();

    try {
      const recordedTrace = await simulateWorkflowExecution(
        activeWorkflow.nodes,
        activeWorkflow.wires,
        activeWorkflow.samplePayload || {},
        async (step, wireId, nodeId) => {
          setActiveWireId(wireId);
          setActiveNodeId(nodeId);
          setNodeExecStatuses((prev) => ({
            ...prev,
            [nodeId]: 'running',
          }));

          await delay(600);

          setNodeExecStatuses((prev) => ({
            ...prev,
            [nodeId]: step.status,
          }));

          setTrace((prev) => [...prev, step]);
        }
      );

      const durationMs = Date.now() - startTime;
      await delay(300);

      workflowsApi.recordExecution({
        workflow_id: activeWorkflow.id,
        status: 'success',
        duration_ms: durationMs,
        initial_payload: activeWorkflow.samplePayload,
        final_payload: recordedTrace[recordedTrace.length - 1]?.outputPayload || {},
        steps_trace: recordedTrace,
      });
    } catch (err: any) {
      alert(`Simulation error: ${err.message}`);
    } finally {
      setIsRunning(false);
      setActiveWireId(null);
      setActiveNodeId(null);
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
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, activeWorkflow]);

  if (!activeWorkflow) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 text-slate-500 text-xs">
        Loading Autonoda...
      </div>
    );
  }

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-slate-50 font-sans">
      {/* Top Header in cimple-eventmap style */}
      <Header
        workflow={activeWorkflow}
        allWorkflows={workflows}
        onSelectWorkflow={(id) => {
          setActiveWorkflowId(id);
          setSelectedNodeId(null);
          setTrace([]);
        }}
        onUpdateTitle={(title) => updateActiveWorkflow({ name: title })}
        onCreateWorkflow={handleCreateWorkflow}
        onDeleteWorkflow={handleDeleteWorkflow}
        onAutoLayout={() => applyAutoLayout()}
        onFitView={() => setFitViewTrigger((prev) => prev + 1)}
        onOpenPayloadModal={() => setIsPayloadModalOpen(true)}
        onOpenHistoryModal={() => setIsHistoryModalOpen(true)}
        onRunWorkflow={handleRunWorkflow}
        isRunning={isRunning}
        saveStatus={saveStatus}
        autoAlignEnabled={autoAlignEnabled}
        onToggleAutoAlign={() => setAutoAlignEnabled((prev) => !prev)}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Visual Graph Canvas with Auto-Layout & In-Graph (+) Step Insertion */}
        <Canvas
          nodes={activeWorkflow.nodes}
          wires={activeWorkflow.wires}
          selectedNodeId={selectedNodeId}
          activeWireId={activeWireId}
          activeNodeId={activeNodeId}
          nodeExecStatuses={nodeExecStatuses}
          onSelectNode={(id) => setSelectedNodeId(id)}
          onUpdateNodePosition={handleUpdateNodePosition}
          onDeleteNode={handleDeleteNode}
          onConnectWire={handleConnectWire}
          onDeleteWire={handleDeleteWire}
          onDropNewNode={(type, subtype, name, x, y) => handleAddNode(type, subtype, name, x, y)}
          onAddNodeAndConnect={handleAddNodeAndConnect}
          onAddTrigger={handleAddTrigger}
          onAutoLayout={() => applyAutoLayout()}
          fitViewTrigger={fitViewTrigger}
        />

        {/* Right Inspector Drawer */}
        {selectedNode && (
          <InspectorDrawer
            node={selectedNode}
            onClose={() => setSelectedNodeId(null)}
            onUpdateNode={handleUpdateNode}
          />
        )}
      </div>

      {/* Bottom Trace & Payload Inspector */}
      <TraceDrawer
        trace={trace}
        isOpen={isTraceOpen}
        onToggle={() => setIsTraceOpen((open) => !open)}
      />

      {/* Payload Editor Modal */}
      <PayloadModal
        isOpen={isPayloadModalOpen}
        payload={activeWorkflow.samplePayload || {}}
        onClose={() => setIsPayloadModalOpen(false)}
        onSave={(newPayload) => updateActiveWorkflow({ samplePayload: newPayload })}
      />

      {/* Execution History Modal */}
      <HistoryModal
        isOpen={isHistoryModalOpen}
        workflowId={activeWorkflow.id}
        onClose={() => setIsHistoryModalOpen(false)}
        onLoadTrace={(loadedTrace) => {
          setTrace(loadedTrace);
          setIsTraceOpen(true);
        }}
      />
    </div>
  );
}
