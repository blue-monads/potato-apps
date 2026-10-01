import { API_BASE_PATH } from "./base";
import type { EventTrigger, RuleBlock, Rule, Target, TriggerGraph } from "../types/workflow";

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

// Local mock storage for standalone offline preview (new schema only)
const STORAGE_PREFIX = 'autonoda_relational_';

function getLocalGraph(triggerId: number): TriggerGraph {
  const trigRaw = localStorage.getItem(`${STORAGE_PREFIX}trigger_${triggerId}`);
  const rbsRaw = localStorage.getItem(`${STORAGE_PREFIX}rbs_${triggerId}`);
  const rulesRaw = localStorage.getItem(`${STORAGE_PREFIX}rules_${triggerId}`);
  const tgtsRaw = localStorage.getItem(`${STORAGE_PREFIX}targets_${triggerId}`);

  const trigger: EventTrigger = trigRaw
    ? JSON.parse(trigRaw)
    : { id: triggerId, name: 'Sample Event Trigger', description: 'Triggered upon customer events' };
  const rule_blocks: RuleBlock[] = rbsRaw ? JSON.parse(rbsRaw) : [];
  const rules: Rule[] = rulesRaw ? JSON.parse(rulesRaw) : [];
  const targets: Target[] = tgtsRaw ? JSON.parse(tgtsRaw) : [];

  return { trigger, rule_blocks, rules, targets };
}

function saveLocalGraph(graph: TriggerGraph) {
  const tid = graph.trigger.id;
  localStorage.setItem(`${STORAGE_PREFIX}trigger_${tid}`, JSON.stringify(graph.trigger));
  localStorage.setItem(`${STORAGE_PREFIX}rbs_${tid}`, JSON.stringify(graph.rule_blocks));
  localStorage.setItem(`${STORAGE_PREFIX}rules_${tid}`, JSON.stringify(graph.rules));
  localStorage.setItem(`${STORAGE_PREFIX}targets_${tid}`, JSON.stringify(graph.targets));
}

export const autonodaApi = {
  // Setup
  runSetup: async () => {
    return apiRequest<{ message: string }>('/setup', { method: 'POST' });
  },

  // Triggers
  listTriggers: async (): Promise<EventTrigger[]> => {
    const res = await apiRequest<EventTrigger[]>('/triggers', { method: 'GET' });
    if (!res.error && Array.isArray(res.data) && res.data.length > 0) {
      return res.data;
    }
    // Fallback to local
    const local = getLocalGraph(1);
    return [local.trigger];
  },

  getTrigger: async (id: number): Promise<EventTrigger> => {
    const res = await apiRequest<EventTrigger>(`/triggers/${id}`, { method: 'GET' });
    if (!res.error && res.data) return res.data;
    return getLocalGraph(id).trigger;
  },

  getTriggerGraph: async (id: number): Promise<TriggerGraph> => {
    const res = await apiRequest<TriggerGraph>(`/triggers/${id}/graph`, { method: 'GET' });
    if (!res.error && res.data) {
      // Parse targetMeta JSON if received as string
      if (res.data.targets) {
        res.data.targets = res.data.targets.map(t => ({
          ...t,
          targetMeta: typeof t.targetMeta === 'string' ? JSON.parse(t.targetMeta || '{}') : (t.targetMeta || {})
        }));
      }
      return res.data;
    }
    return getLocalGraph(id);
  },

  saveTriggerGraph: async (id: number, graph: TriggerGraph): Promise<TriggerGraph> => {
    saveLocalGraph(graph);
    const res = await apiRequest<TriggerGraph>(`/triggers/${id}/graph`, {
      method: 'PUT',
      body: JSON.stringify({
        trigger: graph.trigger,
        rule_blocks: graph.rule_blocks,
        rules: graph.rules,
        targets: graph.targets,
      }),
    });
    if (!res.error && res.data) {
      if (res.data.targets) {
        res.data.targets = res.data.targets.map(t => ({
          ...t,
          targetMeta: typeof t.targetMeta === 'string' ? JSON.parse(t.targetMeta || '{}') : (t.targetMeta || {})
        }));
      }
      return res.data;
    }
    return graph;
  },

  createTrigger: async (data: Partial<EventTrigger>): Promise<EventTrigger> => {
    const res = await apiRequest<EventTrigger>('/triggers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.error && res.data) return res.data;
    const newTrig: EventTrigger = {
      id: Date.now(),
      name: data.name || 'Untitled Trigger',
      description: data.description || '',
    };
    saveLocalGraph({ trigger: newTrig, rule_blocks: [], rules: [], targets: [] });
    return newTrig;
  },

  updateTrigger: async (id: number, updates: Partial<EventTrigger>): Promise<EventTrigger> => {
    const res = await apiRequest<EventTrigger>(`/triggers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    const local = getLocalGraph(id);
    local.trigger = { ...local.trigger, ...updates };
    saveLocalGraph(local);
    if (!res.error && res.data) return res.data;
    return local.trigger;
  },

  deleteTrigger: async (id: number): Promise<void> => {
    await apiRequest<void>(`/triggers/${id}`, { method: 'DELETE' });
    localStorage.removeItem(`${STORAGE_PREFIX}trigger_${id}`);
    localStorage.removeItem(`${STORAGE_PREFIX}rbs_${id}`);
    localStorage.removeItem(`${STORAGE_PREFIX}rules_${id}`);
    localStorage.removeItem(`${STORAGE_PREFIX}targets_${id}`);
  },

  // Rule Blocks
  createRuleBlock: async (data: Partial<RuleBlock>): Promise<RuleBlock> => {
    const res = await apiRequest<RuleBlock>('/rule-blocks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.error && res.data) return res.data;
    const local = getLocalGraph(data.triggerId || 1);
    const newRb: RuleBlock = {
      id: Date.now(),
      triggerId: data.triggerId || 1,
      blockType: data.blockType || 'ALL_OF',
      parentRuleBlockId: data.parentRuleBlockId || null,
      branch: data.branch || 'TRUE',
      delaySeconds: data.delaySeconds || 0,
      rules: [],
    };
    local.rule_blocks.push(newRb);
    saveLocalGraph(local);
    return newRb;
  },

  updateRuleBlock: async (id: number, triggerId: number, updates: Partial<RuleBlock>): Promise<void> => {
    await apiRequest<void>(`/rule-blocks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    const local = getLocalGraph(triggerId);
    local.rule_blocks = local.rule_blocks.map(rb => rb.id === id ? { ...rb, ...updates } : rb);
    saveLocalGraph(local);
  },

  deleteRuleBlock: async (id: number, triggerId: number): Promise<void> => {
    await apiRequest<void>(`/rule-blocks/${id}`, { method: 'DELETE' });
    const local = getLocalGraph(triggerId);
    local.rule_blocks = local.rule_blocks.filter(rb => rb.id !== id);
    local.rules = local.rules.filter(r => r.ruleBlockId !== id);
    // Unlink targets or child blocks linked to this block
    local.targets = local.targets.map(t => t.linkedBlockId === id ? { ...t, linkedBlockId: null } : t);
    local.rule_blocks = local.rule_blocks.map(rb => rb.parentRuleBlockId === id ? { ...rb, parentRuleBlockId: null } : rb);
    saveLocalGraph(local);
  },

  // Rules
  createRule: async (data: Partial<Rule>): Promise<Rule> => {
    const res = await apiRequest<Rule>('/rules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.error && res.data) return res.data;
    const local = getLocalGraph(data.triggerId || 1);
    const newRule: Rule = {
      id: Date.now(),
      triggerId: data.triggerId || 1,
      ruleBlockId: data.ruleBlockId || 0,
      ruleType: data.ruleType || 'EQUAL',
      variable: data.variable || '',
      operator: data.operator || 'equals',
      value: data.value || '',
      extraData: data.extraData || '',
      order: data.order || 0,
    };
    local.rules.push(newRule);
    saveLocalGraph(local);
    return newRule;
  },

  updateRule: async (id: number, triggerId: number, updates: Partial<Rule>): Promise<void> => {
    await apiRequest<void>(`/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    const local = getLocalGraph(triggerId);
    local.rules = local.rules.map(r => r.id === id ? { ...r, ...updates } : r);
    saveLocalGraph(local);
  },

  deleteRule: async (id: number, triggerId: number): Promise<void> => {
    await apiRequest<void>(`/rules/${id}`, { method: 'DELETE' });
    const local = getLocalGraph(triggerId);
    local.rules = local.rules.filter(r => r.id !== id);
    saveLocalGraph(local);
  },

  // Targets
  createTarget: async (data: Partial<Target>): Promise<Target> => {
    const res = await apiRequest<Target>('/targets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.error && res.data) {
      return {
        ...res.data,
        targetMeta: typeof res.data.targetMeta === 'string' ? JSON.parse(res.data.targetMeta || '{}') : (res.data.targetMeta || {})
      };
    }
    const local = getLocalGraph(data.triggerId || 1);
    const newTarget: Target = {
      id: Date.now(),
      triggerId: data.triggerId || 1,
      linkedBlockId: data.linkedBlockId || null,
      linkedTargetId: data.linkedTargetId || null,
      branch: data.branch || 'TRUE',
      targetType: data.targetType || 'WEBHOOK',
      targetMeta: data.targetMeta || {},
    };
    local.targets.push(newTarget);
    saveLocalGraph(local);
    return newTarget;
  },

  updateTarget: async (id: number, triggerId: number, updates: Partial<Target>): Promise<void> => {
    await apiRequest<void>(`/targets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    const local = getLocalGraph(triggerId);
    local.targets = local.targets.map(t => t.id === id ? { ...t, ...updates } : t);
    saveLocalGraph(local);
  },

  deleteTarget: async (id: number, triggerId: number): Promise<void> => {
    await apiRequest<void>(`/targets/${id}`, { method: 'DELETE' });
    const local = getLocalGraph(triggerId);
    local.targets = local.targets.filter(t => t.id !== id);
    local.targets = local.targets.map(t => t.linkedTargetId === id ? { ...t, linkedTargetId: null } : t);
    saveLocalGraph(local);
  },
};