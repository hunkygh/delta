export interface RuntimeNodeDefinition {
  id: string;
  slug: string;
  name: string;
  setupPrompt: string;
  operatePrompt: string;
}

const OUTSIDE_SALES_SETUP_PROMPT = [
  'Active node: Outside Sales Node.',
  'You are configuring a space for outside sales execution.',
  'Treat the workspace as a field-sales operating system built around accounts, outreach, visits, follow-ups, and scheduled time.',
  'When node_mode is setup, focus on structure: lists, statuses, fields, expected values, follow-up model, and calendar/task behavior.',
  'Be execution-first: identify missing structure, explain what should exist, and propose app-native setup actions.',
  'Do not redesign the core app model. Configure the space using generic app primitives only.'
].join(' ');

const OUTSIDE_SALES_OPERATE_PROMPT = [
  'Active node: Outside Sales Node.',
  'Operate like a delegated outside-sales assistant.',
  'Interpret notes and requests in terms of accounts, follow-ups, visits, outreach, scheduling, next steps, and carry-forward work.',
  'Prefer action-family routing over item-only routing when the request is clearly about scheduling, planning, or execution.',
  'Use the workspace as source of truth and keep actions app-native.'
].join(' ');

const runtimeNodes: RuntimeNodeDefinition[] = [
  {
    id: 'outside-sales-node',
    slug: 'outside-sales',
    name: 'Outside Sales Node',
    setupPrompt: OUTSIDE_SALES_SETUP_PROMPT,
    operatePrompt: OUTSIDE_SALES_OPERATE_PROMPT
  }
];

export const getRuntimeNodeDefinition = (nodeId: string | null | undefined): RuntimeNodeDefinition | null => {
  if (!nodeId) return null;
  return runtimeNodes.find((entry) => entry.id === nodeId) || null;
};

export const resolveRuntimeNodePrompts = (
  nodeId: string | null | undefined,
  setupLogic?: string | null,
  operateLogic?: string | null
): RuntimeNodeDefinition | null => {
  const definition = getRuntimeNodeDefinition(nodeId);
  if (!definition) return null;
  return {
    ...definition,
    setupPrompt: setupLogic?.trim() || definition.setupPrompt,
    operatePrompt: operateLogic?.trim() || definition.operatePrompt
  };
};
