export type NodeType = 'trigger' | 'logic' | 'action';

export type TriggerSubtype = 'webhook' | 'event' | 'schedule';
export type LogicSubtype = 'condition';
export type ActionSubtype = 'webhook' | 'email' | 'enrich' | 'log';

export type ComparisonOperator = 
  | 'greater_than' 
  | 'greater_or_equal' 
  | 'less_than' 
  | 'less_or_equal' 
  | 'equals' 
  | 'not_equals' 
  | 'contains' 
  | 'not_contains' 
  | 'is_empty' 
  | 'is_not_empty';

export interface LogicRule {
  field: string;
  op: ComparisonOperator;
  value: string;
}

export interface NodeConfig {
  // Trigger config
  eventType?: string;
  source?: string;
  
  // Logic config
  conditionMode?: 'AND' | 'OR';
  rules?: LogicRule[];
  
  // Action: Webhook
  url?: string;
  method?: 'GET' | 'POST' | 'PUT';
  headers?: Record<string, string>;
  
  // Action: Email
  recipient?: string;
  subject?: string;
  template?: string;
  
  // Action: Enrich
  enrichField?: string;
  enrichValue?: string;
  enrichNotes?: string;
  
  // Action: Log
  logLevel?: 'INFO' | 'WARN' | 'DEBUG';
  message?: string;
}

export interface FlowNode {
  id: string;
  type: NodeType;
  subtype: string;
  title: string;
  x: number;
  y: number;
  config: NodeConfig;
}

export interface Wire {
  id: string;
  fromNode: string;
  fromPort: 'out' | 'true' | 'false';
  toNode: string;
  toPort: 'in';
}

export interface Workflow {
  id: number | string;
  name: string;
  description: string;
  status: 'active' | 'draft' | 'paused';
  nodes: FlowNode[];
  wires: Wire[];
  samplePayload: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface RuleEvaluationResult {
  field: string;
  op: string;
  expected: string;
  actual: any;
  passed: boolean;
}

export interface ExecutionTraceStep {
  stepId: string;
  nodeId: string;
  nodeTitle: string;
  nodeType: NodeType;
  nodeSubtype: string;
  timestamp: string;
  status: 'pass' | 'fail' | 'done';
  inputPayload: Record<string, any>;
  outputPayload: Record<string, any>;
  details: {
    message?: string;
    mode?: 'AND' | 'OR';
    rulesEvaluated?: RuleEvaluationResult[];
    result?: 'TRUE' | 'FALSE';
    branchTaken?: string;
    action?: string;
    fieldMutated?: string;
    valueAssigned?: any;
    to?: string;
    subject?: string;
    interpolatedBody?: string;
    url?: string;
    method?: string;
    httpStatus?: number;
    level?: string;
    [key: string]: any;
  };
}

export interface ExecutionRecord {
  id: number;
  workflow_id: number;
  status: 'success' | 'failure' | 'running';
  trigger_type: string;
  started_at: string;
  duration_ms: number;
  initial_payload: string;
  final_payload: string;
  steps_trace_json: string;
  error_message?: string;
}
