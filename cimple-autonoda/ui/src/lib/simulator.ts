import type { FlowNode, Wire, ExecutionTraceStep, RuleEvaluationResult } from '../types/workflow';

export function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  const parts = path.trim().split('.');
  let curr = obj;
  for (const p of parts) {
    if (curr === null || curr === undefined) return undefined;
    curr = curr[p];
  }
  return curr;
}

export function setNestedValue(obj: any, path: string, val: any): void {
  if (!obj || !path) return;
  const parts = path.trim().split('.');
  let curr = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!curr[p] || typeof curr[p] !== 'object') {
      curr[p] = {};
    }
    curr = curr[p];
  }
  curr[parts[parts.length - 1]] = val;
}

export function evaluateRule(rule: { field: string; op: string; value: string }, data: any): RuleEvaluationResult {
  const actualRaw = getNestedValue(data, rule.field);
  const targetStr = rule.value !== undefined ? String(rule.value).trim() : '';

  const actualNum = parseFloat(actualRaw);
  const targetNum = parseFloat(targetStr);
  const isNumericComparison = !isNaN(actualNum) && !isNaN(targetNum) && actualRaw !== '' && targetStr !== '';

  let passed = false;

  switch (rule.op) {
    case 'greater_than':
      passed = isNumericComparison ? actualNum > targetNum : String(actualRaw) > targetStr;
      break;
    case 'greater_or_equal':
      passed = isNumericComparison ? actualNum >= targetNum : String(actualRaw) >= targetStr;
      break;
    case 'less_than':
      passed = isNumericComparison ? actualNum < targetNum : String(actualRaw) < targetStr;
      break;
    case 'less_or_equal':
      passed = isNumericComparison ? actualNum <= targetNum : String(actualRaw) <= targetStr;
      break;
    case 'equals':
      if (isNumericComparison) {
        passed = actualNum === targetNum;
      } else if (typeof actualRaw === 'boolean') {
        passed = actualRaw === (targetStr.toLowerCase() === 'true');
      } else {
        passed = String(actualRaw ?? '').toLowerCase() === targetStr.toLowerCase();
      }
      break;
    case 'not_equals':
      if (isNumericComparison) {
        passed = actualNum !== targetNum;
      } else if (typeof actualRaw === 'boolean') {
        passed = actualRaw !== (targetStr.toLowerCase() === 'true');
      } else {
        passed = String(actualRaw ?? '').toLowerCase() !== targetStr.toLowerCase();
      }
      break;
    case 'contains':
      passed = String(actualRaw ?? '').toLowerCase().includes(targetStr.toLowerCase());
      break;
    case 'not_contains':
      passed = !String(actualRaw ?? '').toLowerCase().includes(targetStr.toLowerCase());
      break;
    case 'is_empty':
      passed = actualRaw === undefined || actualRaw === null || actualRaw === '';
      break;
    case 'is_not_empty':
      passed = actualRaw !== undefined && actualRaw !== null && actualRaw !== '';
      break;
    default:
      passed = false;
  }

  return {
    field: rule.field,
    op: rule.op,
    expected: rule.value,
    actual: actualRaw,
    passed,
  };
}

export interface SimulationStepResult {
  step: ExecutionTraceStep;
  activeWireId: string | null;
}

export type StepCallback = (step: ExecutionTraceStep, activeWireId: string | null, activeNodeId: string) => Promise<void> | void;

export async function simulateWorkflowExecution(
  nodes: FlowNode[],
  wires: Wire[],
  initialPayload: Record<string, any>,
  onStep: StepCallback
): Promise<ExecutionTraceStep[]> {
  const triggerNode = nodes.find(n => n.type === 'trigger');
  if (!triggerNode) {
    throw new Error('Workflow has no Trigger block. Add a Trigger block to execute.');
  }

  const trace: ExecutionTraceStep[] = [];
  let currentPayload = JSON.parse(JSON.stringify(initialPayload));
  let currentNodeId: string | null = triggerNode.id;
  let incomingWireId: string | null = null;
  const visited = new Set<string>();

  while (currentNodeId) {
    const node = nodes.find(n => n.id === currentNodeId);
    if (!node) break;

    if (visited.has(currentNodeId)) {
      console.warn('Cycle detected at node:', currentNodeId);
      break;
    }
    visited.add(currentNodeId);

    const stepId = `step_${Math.random().toString(36).substr(2, 9)}`;
    const inputSnapshot = JSON.parse(JSON.stringify(currentPayload));
    let nextPort: 'out' | 'true' | 'false' = 'out';
    let stepStatus: 'pass' | 'fail' | 'done' = 'done';
    let details: any = {};

    if (node.type === 'trigger') {
      details = {
        message: `Event '${node.config.eventType || 'webhook'}' ingested. Source: ${node.config.source || 'HTTP POST'}`,
      };
      stepStatus = 'done';
      nextPort = 'out';
    } else if (node.type === 'logic') {
      const mode = node.config.conditionMode || 'AND';
      const rules = node.config.rules || [];
      const evaluated = rules.map(r => evaluateRule(r, currentPayload));

      let passed = false;
      if (mode === 'AND') {
        passed = evaluated.length > 0 && evaluated.every(r => r.passed);
      } else {
        passed = evaluated.some(r => r.passed);
      }

      stepStatus = passed ? 'pass' : 'fail';
      details = {
        mode,
        rulesEvaluated: evaluated,
        result: passed ? 'TRUE' : 'FALSE',
        branchTaken: passed ? 'TRUE branch (green)' : 'FALSE branch (red)',
      };
      nextPort = passed ? 'true' : 'false';
    } else if (node.type === 'action') {
      stepStatus = 'done';
      if (node.subtype === 'enrich') {
        const field = node.config.enrichField || 'data.enriched';
        let val: any = node.config.enrichValue;
        if (val === 'true') val = true;
        else if (val === 'false') val = false;
        else if (!isNaN(Number(val)) && typeof val === 'string' && val.trim() !== '') val = Number(val);

        setNestedValue(currentPayload, field, val);
        details = {
          action: 'Data Enrichment',
          fieldMutated: field,
          valueAssigned: val,
          notes: node.config.enrichNotes || 'Enriched payload field',
        };
      } else if (node.subtype === 'email') {
        let body = node.config.template || '';
        body = body.replace(/\{\{([\w.]+)\}\}/g, (_, path) => {
          const v = getNestedValue(currentPayload, path);
          return v !== undefined ? String(v) : `{{${path}}}`;
        });
        let recipient = node.config.recipient || '';
        recipient = recipient.replace(/\{\{([\w.]+)\}\}/g, (_, path) => {
          const v = getNestedValue(currentPayload, path);
          return v !== undefined ? String(v) : `{{${path}}}`;
        });

        details = {
          action: 'Send Email Notification',
          to: recipient,
          subject: node.config.subject || 'Automated Flow Alert',
          interpolatedBody: body,
        };
      } else if (node.subtype === 'webhook') {
        details = {
          action: 'Dispatch HTTP Webhook',
          method: node.config.method || 'POST',
          url: node.config.url || 'https://api.external.com/endpoint',
          httpStatus: 200,
          responseMock: { ok: true, ack: Date.now() },
        };
      } else {
        details = {
          action: 'Audit Log Entry',
          level: node.config.logLevel || 'INFO',
          message: node.config.message || 'Workflow executed log step',
        };
      }
      nextPort = 'out';
    }

    const stepSnapshot: ExecutionTraceStep = {
      stepId,
      nodeId: node.id,
      nodeTitle: node.title,
      nodeType: node.type,
      nodeSubtype: node.subtype,
      timestamp: new Date().toLocaleTimeString(),
      status: stepStatus,
      inputPayload: inputSnapshot,
      outputPayload: JSON.parse(JSON.stringify(currentPayload)),
      details,
    };

    trace.push(stepSnapshot);
    await onStep(stepSnapshot, incomingWireId, node.id);

    // Find next wire
    const outgoing = wires.find(w => w.fromNode === node.id && w.fromPort === nextPort);
    if (outgoing) {
      incomingWireId = outgoing.id;
      currentNodeId = outgoing.toNode;
    } else {
      currentNodeId = null;
      incomingWireId = null;
    }
  }

  return trace;
}
