export type BlockType = 'ALL_OF' | 'ANY_OF';

export type ComparisonOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_or_equal'
  | 'less_or_equal'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'is_empty'
  | 'is_not_empty';

export type TargetType = 'WEBHOOK' | 'EMAIL' | 'SMS' | 'PUSH' | 'TRANSFORM' | 'CODE';

export interface EventTrigger {
  id: number;
  name: string;
  description: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Rule {
  id: number;
  triggerId: number;
  ruleBlockId: number;
  ruleType: string;
  variable: string;
  operator: ComparisonOperator | string;
  value: string;
  extraData?: string;
  order: number;
}

export interface RuleBlock {
  id: number;
  triggerId: number;
  blockType: BlockType;
  parentRuleBlockId: number | null;
  branch?: 'TRUE' | 'FALSE';
  delaySeconds: number;
  createdAt?: string;
  updatedAt?: string;
  rules?: Rule[];
}

export interface Target {
  id: number;
  triggerId: number;
  linkedBlockId: number | null;
  linkedTargetId: number | null;
  branch?: 'TRUE' | 'FALSE';
  targetType: TargetType;
  ruleBlockId?: number | null;
  targetMeta: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface TriggerGraph {
  trigger: EventTrigger;
  rule_blocks: RuleBlock[];
  rules: Rule[];
  targets: Target[];
}

export type EditorNodeType = 'trigger' | 'rule_block' | 'target';

export interface EditorNode {
  id: string; // e.g. "trigger_1", "rule_block_2", "target_3"
  entityId: number;
  type: EditorNodeType;
  title: string;
  x: number;
  y: number;
  trigger?: EventTrigger;
  ruleBlock?: RuleBlock;
  target?: Target;
}

export interface InferredWire {
  id: string;
  fromNodeId: string;
  fromPort: 'out' | 'true' | 'false';
  toNodeId: string;
  toPort: 'in';
}

export function inferWires(
  trigger: EventTrigger | null | undefined,
  ruleBlocks: RuleBlock[] | null | undefined,
  targets: Target[] | null | undefined
): InferredWire[] {
  const wires: InferredWire[] = [];
  if (!trigger) return wires;

  const safeRuleBlocks = Array.isArray(ruleBlocks) ? ruleBlocks : [];
  const safeTargets = Array.isArray(targets) ? targets : [];
  const triggerNodeId = `trigger_${trigger.id}`;

  // 1. Trigger -> Root RuleBlocks (no parent rule block)
  for (const rb of safeRuleBlocks) {
    if (rb.triggerId === trigger.id && !rb.parentRuleBlockId) {
      wires.push({
        id: `wire_trig_${trigger.id}_rb_${rb.id}`,
        fromNodeId: triggerNodeId,
        fromPort: 'out',
        toNodeId: `rule_block_${rb.id}`,
        toPort: 'in',
      });
    }
  }

  // 2. Parent RuleBlock -> Child RuleBlock (from TRUE or FALSE branch)
  for (const rb of safeRuleBlocks) {
    if (rb.parentRuleBlockId) {
      wires.push({
        id: `wire_rb_${rb.parentRuleBlockId}_rb_${rb.id}`,
        fromNodeId: `rule_block_${rb.parentRuleBlockId}`,
        fromPort: rb.branch === 'FALSE' ? 'false' : 'true',
        toNodeId: `rule_block_${rb.id}`,
        toPort: 'in',
      });
    }
  }

  // 3. RuleBlock -> Target (from TRUE or FALSE branch)
  for (const tg of safeTargets) {
    if (tg.linkedBlockId) {
      wires.push({
        id: `wire_rb_${tg.linkedBlockId}_target_${tg.id}`,
        fromNodeId: `rule_block_${tg.linkedBlockId}`,
        fromPort: tg.branch === 'FALSE' ? 'false' : 'true',
        toNodeId: `target_${tg.id}`,
        toPort: 'in',
      });
    }
  }

  // 4. Target -> Child Target
  for (const tg of safeTargets) {
    if (tg.linkedTargetId) {
      wires.push({
        id: `wire_target_${tg.linkedTargetId}_target_${tg.id}`,
        fromNodeId: `target_${tg.linkedTargetId}`,
        fromPort: 'out',
        toNodeId: `target_${tg.id}`,
        toPort: 'in',
      });
    }
  }

  // 5. Trigger -> Direct Target (not linked to any rule block or previous target)
  for (const tg of safeTargets) {
    if (tg.triggerId === trigger.id && !tg.linkedBlockId && !tg.linkedTargetId) {
      wires.push({
        id: `wire_trig_${trigger.id}_target_${tg.id}`,
        fromNodeId: triggerNodeId,
        fromPort: 'out',
        toNodeId: `target_${tg.id}`,
        toPort: 'in',
      });
    }
  }

  return wires;
}
