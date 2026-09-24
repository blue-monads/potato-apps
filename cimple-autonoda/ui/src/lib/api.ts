import { API_BASE_PATH } from "./base";
import type { Workflow, ExecutionRecord } from "../types/workflow";

const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return (window as any).spaceGetToken?.('cimple-autonoda') || null;
};

interface ApiResponse<T> {
  status: number;
  data?: T;
  error?: string;
}

export async function apiRequest<T>(
  path: string, 
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = token;
  }

  try {
    const response = await fetch(`${API_BASE_PATH}${path}`, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    return {
      status: response.status,
      data: response.ok ? (data as T) : undefined,
      error: response.ok ? undefined : (data.error || `HTTP ${response.status}`),
    };
  } catch (err: any) {
    return {
      status: 0,
      error: err.message || 'Network request failed',
    };
  }
}

// Local Storage Fallback Presets
export const DEFAULT_PRESET_WORKFLOWS: Workflow[] = [
  {
    id: 1,
    name: "E-Commerce VIP & Fraud Router",
    description: "Evaluates customer tier and order total to route high-value VIP orders through priority concierge and fulfillment.",
    status: "active",
    samplePayload: {
      eventId: "evt_998124",
      timestamp: new Date().toISOString(),
      order: {
        id: "ORD-58291",
        total: 185.50,
        currency: "USD",
        itemsCount: 3,
        channel: "web_checkout"
      },
      customer: {
        name: "Sophia Martinez",
        email: "sophia.m@example.com",
        tier: "gold",
        country: "US",
        lifetimeOrders: 8
      }
    },
    nodes: [
      {
        id: "node_trigger_1",
        type: "trigger",
        subtype: "webhook",
        title: "New Order Placed",
        x: 340,
        y: 40,
        config: {
          eventType: "ecommerce.order.created",
          source: "Shopify Webhook"
        }
      },
      {
        id: "node_logic_1",
        type: "logic",
        subtype: "condition",
        title: "VIP Order Rule",
        x: 340,
        y: 220,
        config: {
          conditionMode: "AND",
          rules: [
            { field: "order.total", op: "greater_than", value: "100" },
            { field: "customer.tier", op: "equals", value: "gold" }
          ]
        }
      },
      {
        id: "node_action_vip",
        type: "action",
        subtype: "enrich",
        title: "Enrich: VIP Perks & Tag",
        x: 180,
        y: 440,
        config: {
          enrichField: "order.isVipPriority",
          enrichValue: "true",
          enrichNotes: "Applied express 1-day free shipping"
        }
      },
      {
        id: "node_action_email",
        type: "action",
        subtype: "email",
        title: "Send VIP Concierge Email",
        x: 180,
        y: 640,
        config: {
          recipient: "{{customer.email}}",
          subject: "VIP Priority: Order {{order.id}} Confirmed!",
          template: "Hello {{customer.name}}, thank you for being a Gold VIP member! Your order {{order.id}} has been expedited."
        }
      },
      {
        id: "node_action_std",
        type: "action",
        subtype: "webhook",
        title: "Standard Fulfillment Webhook",
        x: 500,
        y: 440,
        config: {
          url: "https://warehouse.internal/api/orders",
          method: "POST"
        }
      }
    ],
    wires: [
      { id: "w1", fromNode: "node_trigger_1", fromPort: "out", toNode: "node_logic_1", toPort: "in" },
      { id: "w2", fromNode: "node_logic_1", fromPort: "true", toNode: "node_action_vip", toPort: "in" },
      { id: "w3", fromNode: "node_action_vip", fromPort: "out", toNode: "node_action_email", toPort: "in" },
      { id: "w4", fromNode: "node_logic_1", fromPort: "false", toNode: "node_action_std", toPort: "in" }
    ]
  },
  {
    id: 2,
    name: "Enterprise Lead Qualification",
    description: "Routes inbound website contact requests based on company size and budget to Salesforce enterprise queue or self-serve nurture.",
    status: "active",
    samplePayload: {
      leadId: "lead_448",
      lead: {
        companyName: "Apex Cloud Technologies",
        employees: 450,
        annualBudget: 75000,
        industry: "Fintech",
        contact: {
          email: "cto@apexcloud.io",
          fullName: "Marcus Vance"
        }
      }
    },
    nodes: [
      {
        id: "node_lead_start",
        type: "trigger",
        subtype: "webhook",
        title: "Demo Request Submitted",
        x: 340,
        y: 40,
        config: { eventType: "form.demo_request" }
      },
      {
        id: "node_lead_logic",
        type: "logic",
        subtype: "condition",
        title: "Enterprise Criteria",
        x: 340,
        y: 220,
        config: {
          conditionMode: "OR",
          rules: [
            { field: "lead.annualBudget", op: "greater_than", value: "50000" },
            { field: "lead.employees", op: "greater_or_equal", value: "200" }
          ]
        }
      },
      {
        id: "node_lead_crm",
        type: "action",
        subtype: "webhook",
        title: "Salesforce Enterprise Queue",
        x: 180,
        y: 440,
        config: {
          url: "https://api.salesforce.com/leads/v1/enterprise",
          method: "POST"
        }
      },
      {
        id: "node_lead_nurture",
        type: "action",
        subtype: "log",
        title: "Self-Serve Nurture Campaign",
        x: 500,
        y: 440,
        config: {
          logLevel: "INFO",
          message: "Routing lead to self-serve onboarding sequence"
        }
      }
    ],
    wires: [
      { id: "w_lead_1", fromNode: "node_lead_start", fromPort: "out", toNode: "node_lead_logic", toPort: "in" },
      { id: "w_lead_2", fromNode: "node_lead_logic", fromPort: "true", toNode: "node_lead_crm", toPort: "in" },
      { id: "w_lead_3", fromNode: "node_lead_logic", fromPort: "false", toNode: "node_lead_nurture", toPort: "in" }
    ]
  }
];

const LOCAL_STORAGE_KEY = 'cimple_autonoda_workflows';
const LOCAL_STORAGE_EXECS_KEY = 'cimple_autonoda_executions';

function getLocalWorkflows(): Workflow[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_PRESET_WORKFLOWS));
      return DEFAULT_PRESET_WORKFLOWS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_PRESET_WORKFLOWS;
  }
}

function saveLocalWorkflows(workflows: Workflow[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(workflows));
  } catch (err) {
    console.warn('LocalStorage save failed:', err);
  }
}

function serializeWorkflowForServer(wf: Workflow) {
  return {
    name: wf.name,
    description: wf.description,
    status: wf.status,
    nodes_json: JSON.stringify(wf.nodes),
    wires_json: JSON.stringify(wf.wires),
    sample_payload_json: JSON.stringify(wf.samplePayload || {}),
  };
}

function deserializeWorkflowFromServer(raw: any): Workflow {
  return {
    id: raw.id,
    name: raw.name || "Untitled Workflow",
    description: raw.description || "",
    status: raw.status || "active",
    nodes: typeof raw.nodes_json === 'string' ? JSON.parse(raw.nodes_json || '[]') : (raw.nodes_json || []),
    wires: typeof raw.wires_json === 'string' ? JSON.parse(raw.wires_json || '[]') : (raw.wires_json || []),
    samplePayload: typeof raw.sample_payload_json === 'string' ? JSON.parse(raw.sample_payload_json || '{}') : (raw.sample_payload_json || {}),
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

export const workflowsApi = {
  list: async (): Promise<Workflow[]> => {
    const res = await apiRequest<any[]>('/workflows', { method: 'GET' });
    if (!res.error && Array.isArray(res.data) && res.data.length > 0) {
      return res.data.map(deserializeWorkflowFromServer);
    }
    // Fallback to local storage
    return getLocalWorkflows();
  },

  get: async (id: number | string): Promise<Workflow> => {
    const res = await apiRequest<any>(`/workflows/${id}`, { method: 'GET' });
    if (!res.error && res.data && res.data.id) {
      return deserializeWorkflowFromServer(res.data);
    }
    const locals = getLocalWorkflows();
    const found = locals.find(w => String(w.id) === String(id));
    if (!found) throw new Error("Workflow not found");
    return found;
  },

  create: async (workflow: Partial<Workflow>): Promise<Workflow> => {
    const payload = serializeWorkflowForServer(workflow as Workflow);
    const res = await apiRequest<any>('/workflows', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!res.error && res.data && res.data.id) {
      return deserializeWorkflowFromServer(res.data);
    }

    // Local save
    const locals = getLocalWorkflows();
    const newWf: Workflow = {
      id: Date.now(),
      name: workflow.name || "New Workflow",
      description: workflow.description || "",
      status: workflow.status || "active",
      nodes: workflow.nodes || [],
      wires: workflow.wires || [],
      samplePayload: workflow.samplePayload || {},
      created_at: new Date().toISOString(),
    };
    locals.push(newWf);
    saveLocalWorkflows(locals);
    return newWf;
  },

  update: async (id: number | string, updates: Partial<Workflow>): Promise<Workflow> => {
    const locals = getLocalWorkflows();
    const idx = locals.findIndex(w => String(w.id) === String(id));
    if (idx !== -1) {
      locals[idx] = { ...locals[idx], ...updates, updated_at: new Date().toISOString() };
      saveLocalWorkflows(locals);
    }

    // Try backend update
    const payload = serializeWorkflowForServer(updates as Workflow);
    await apiRequest<any>(`/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    return locals[idx] || (updates as Workflow);
  },

  delete: async (id: number | string): Promise<void> => {
    const locals = getLocalWorkflows().filter(w => String(w.id) !== String(id));
    saveLocalWorkflows(locals);

    await apiRequest<any>(`/workflows/${id}`, {
      method: 'DELETE',
    });
  },

  recordExecution: async (exec: { workflow_id: number | string; status: string; duration_ms: number; initial_payload: any; final_payload: any; steps_trace: any }): Promise<void> => {
    try {
      const existingRaw = localStorage.getItem(LOCAL_STORAGE_EXECS_KEY);
      const list = existingRaw ? JSON.parse(existingRaw) : [];
      list.unshift({
        id: Date.now(),
        workflow_id: exec.workflow_id,
        status: exec.status,
        started_at: new Date().toISOString(),
        duration_ms: exec.duration_ms,
        initial_payload: JSON.stringify(exec.initial_payload),
        final_payload: JSON.stringify(exec.final_payload),
        steps_trace_json: JSON.stringify(exec.steps_trace),
      });
      // Keep last 30 executions
      localStorage.setItem(LOCAL_STORAGE_EXECS_KEY, JSON.stringify(list.slice(0, 30)));
    } catch {}

    // Send to backend
    await apiRequest<any>(`/workflows/${exec.workflow_id}/run`, {
      method: 'POST',
      body: JSON.stringify({
        trigger_type: 'manual',
        payload: exec.initial_payload,
      }),
    });
  },

  listExecutions: async (workflow_id: number | string): Promise<ExecutionRecord[]> => {
    const res = await apiRequest<ExecutionRecord[]>(`/workflows/${workflow_id}/executions`, { method: 'GET' });
    if (!res.error && Array.isArray(res.data) && res.data.length > 0) {
      return res.data;
    }
    try {
      const existingRaw = localStorage.getItem(LOCAL_STORAGE_EXECS_KEY);
      const list: ExecutionRecord[] = existingRaw ? JSON.parse(existingRaw) : [];
      return list.filter(e => String(e.workflow_id) === String(workflow_id));
    } catch {
      return [];
    }
  }
};