export type ShellNodeFieldType = 'status' | 'select' | 'text' | 'number' | 'date' | 'boolean' | 'contact';
export type ShellNodeFieldSemanticRole =
  | 'routing'
  | 'scheduling'
  | 'contact'
  | 'qualification'
  | 'follow_up'
  | 'ownership'
  | 'activity_log'
  | 'other';
export type ShellNodeFieldConfidenceImportance = 'critical' | 'preferred' | 'optional';

export interface ShellNodeOptionConfig {
  id: string;
  label: string;
}

export interface ShellNodeFieldConfig {
  id: string;
  name: string;
  type: ShellNodeFieldType;
  required?: boolean;
  pinned?: boolean;
  usedFor?: string[];
  semanticRole?: ShellNodeFieldSemanticRole;
  confidenceImportance?: ShellNodeFieldConfidenceImportance;
  options?: ShellNodeOptionConfig[];
}

export interface ShellNodeStatusConfig {
  id: string;
  name: string;
  color?: string;
  default?: boolean;
}

export interface ShellNodeListConfig {
  id: string;
  name: string;
  itemLabel?: string;
  taskLabel?: string;
  statuses: ShellNodeStatusConfig[];
  fields: ShellNodeFieldConfig[];
}

export interface ShellNodePlanningConfig {
  locationFieldName?: string;
  useLocationForRouting?: boolean;
  useLocationForDayPlanning?: boolean;
  defaultTaskPlacement?: 'standalone' | 'inside_time_block';
  noteIngestionMode?: 'strict' | 'assistive' | 'autonomous';
  timeBlockNaming?: ShellNodeTimeBlockNamingRule[];
}

export interface ShellNodeTimeBlockNamingRule {
  id: string;
  label: string;
  aliases: string[];
  template: string;
}

export interface ShellNodeWorkspaceBlueprintConfig {
  primarySpaces: string[];
  primaryLists: string[];
  planningModel: string;
  routeModel: string;
  activityLogModel: string;
  taskInTimeBlockModel: string;
}

export interface ShellNodeDataRule {
  id: string;
  label: string;
  semanticRole: ShellNodeFieldSemanticRole;
  required: boolean;
  fallbackAssumption?: string;
}

export interface ShellNodeMissingDataConfig {
  doNotBlockOnPartialData: boolean;
  buildFromBestAvailableData: boolean;
  surfaceHighValueGapsInBatches: boolean;
  avoidItemByItemNagging: boolean;
}

export interface ShellNodeSetupWizardConfig {
  detectMissingLists: boolean;
  detectMissingStatuses: boolean;
  detectMissingFields: boolean;
  offerMappingBeforeCreate: boolean;
  offerRepairActionsInBatches: boolean;
  allowPartialDataExecution: boolean;
  prioritizeHighValueRepairs: boolean;
}

export interface ShellNodeAutomationRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
}

export interface ShellNodeBehaviorConfig {
  primaryOperatingModes: string[];
  actionPriorityRules: string[];
  schedulingBehavior: string[];
  activityLoggingBehavior: string[];
  missingDataHandling: ShellNodeMissingDataConfig;
  setupWizardRules: ShellNodeSetupWizardConfig;
  automationRules: ShellNodeAutomationRule[];
}

export interface ShellNodeStructureConfig {
  userFacingDescription: string;
  workspaceBlueprint: ShellNodeWorkspaceBlueprintConfig;
  lists: ShellNodeListConfig[];
  planning: ShellNodePlanningConfig;
  dataPolicy: {
    requiredFields: ShellNodeDataRule[];
    optionalFields: ShellNodeDataRule[];
  };
  behavior: ShellNodeBehaviorConfig;
}

export interface ShellNodeDefinition {
  id: string;
  slug: string;
  name: string;
  summary: string;
  version: string;
  category: string;
  setupSummary: string;
  setupPrompt: string;
  structureBlueprint: string;
  structureConfig: ShellNodeStructureConfig;
  setupLogic: string;
  operateLogic: string;
  ownerUserId?: string | null;
  iconKey?: 'compass' | 'app' | 'computer_dollar';
  versionNotes?: string;
}

export interface ShellInstalledNode {
  id?: string;
  nodeId: string;
  installedAt: string;
  assignedFocalIds: string[];
  setupCompleted: boolean;
}

export const createDefaultNodeStructureConfig = (): ShellNodeStructureConfig => ({
  userFacingDescription: '',
  workspaceBlueprint: {
    primarySpaces: [],
    primaryLists: [],
    planningModel: '',
    routeModel: '',
    activityLogModel: '',
    taskInTimeBlockModel: ''
  },
  lists: [],
  planning: {
    locationFieldName: '',
    useLocationForRouting: false,
    useLocationForDayPlanning: false,
    defaultTaskPlacement: 'standalone',
    noteIngestionMode: 'assistive',
    timeBlockNaming: []
  },
  dataPolicy: {
    requiredFields: [],
    optionalFields: []
  },
  behavior: {
    primaryOperatingModes: [],
    actionPriorityRules: [],
    schedulingBehavior: [],
    activityLoggingBehavior: [],
    missingDataHandling: {
      doNotBlockOnPartialData: true,
      buildFromBestAvailableData: true,
      surfaceHighValueGapsInBatches: true,
      avoidItemByItemNagging: true
    },
    setupWizardRules: {
      detectMissingLists: true,
      detectMissingStatuses: true,
      detectMissingFields: true,
      offerMappingBeforeCreate: true,
      offerRepairActionsInBatches: true,
      allowPartialDataExecution: true,
      prioritizeHighValueRepairs: true
    },
    automationRules: []
  }
});

export const cloneNodeStructureConfig = (value?: ShellNodeStructureConfig | null): ShellNodeStructureConfig =>
  value
    ? {
        userFacingDescription: value.userFacingDescription || '',
        workspaceBlueprint: {
          primarySpaces: [...(value.workspaceBlueprint?.primarySpaces || [])],
          primaryLists: [...(value.workspaceBlueprint?.primaryLists || [])],
          planningModel: value.workspaceBlueprint?.planningModel || '',
          routeModel: value.workspaceBlueprint?.routeModel || '',
          activityLogModel: value.workspaceBlueprint?.activityLogModel || '',
          taskInTimeBlockModel: value.workspaceBlueprint?.taskInTimeBlockModel || ''
        },
        lists: (value.lists || []).map((list) => ({
          ...list,
          statuses: (list.statuses || []).map((status) => ({ ...status })),
          fields: (list.fields || []).map((field) => ({
            ...field,
            usedFor: [...(field.usedFor || [])],
            options: (field.options || []).map((option) => ({ ...option }))
          }))
        })),
        planning: {
          locationFieldName: value.planning?.locationFieldName || '',
          useLocationForRouting: Boolean(value.planning?.useLocationForRouting),
          useLocationForDayPlanning: Boolean(value.planning?.useLocationForDayPlanning),
          defaultTaskPlacement: value.planning?.defaultTaskPlacement || 'standalone',
          noteIngestionMode: value.planning?.noteIngestionMode || 'assistive',
          timeBlockNaming: (value.planning?.timeBlockNaming || []).map((rule) => ({
            id: rule.id,
            label: rule.label,
            aliases: [...(rule.aliases || [])],
            template: rule.template
          }))
        },
        dataPolicy: {
          requiredFields: (value.dataPolicy?.requiredFields || []).map((rule) => ({ ...rule })),
          optionalFields: (value.dataPolicy?.optionalFields || []).map((rule) => ({ ...rule }))
        },
        behavior: {
          primaryOperatingModes: [...(value.behavior?.primaryOperatingModes || [])],
          actionPriorityRules: [...(value.behavior?.actionPriorityRules || [])],
          schedulingBehavior: [...(value.behavior?.schedulingBehavior || [])],
          activityLoggingBehavior: [...(value.behavior?.activityLoggingBehavior || [])],
          missingDataHandling: {
            doNotBlockOnPartialData: value.behavior?.missingDataHandling?.doNotBlockOnPartialData ?? true,
            buildFromBestAvailableData: value.behavior?.missingDataHandling?.buildFromBestAvailableData ?? true,
            surfaceHighValueGapsInBatches: value.behavior?.missingDataHandling?.surfaceHighValueGapsInBatches ?? true,
            avoidItemByItemNagging: value.behavior?.missingDataHandling?.avoidItemByItemNagging ?? true
          },
          setupWizardRules: {
            detectMissingLists: value.behavior?.setupWizardRules?.detectMissingLists ?? true,
            detectMissingStatuses: value.behavior?.setupWizardRules?.detectMissingStatuses ?? true,
            detectMissingFields: value.behavior?.setupWizardRules?.detectMissingFields ?? true,
            offerMappingBeforeCreate: value.behavior?.setupWizardRules?.offerMappingBeforeCreate ?? true,
            offerRepairActionsInBatches: value.behavior?.setupWizardRules?.offerRepairActionsInBatches ?? true,
            allowPartialDataExecution: value.behavior?.setupWizardRules?.allowPartialDataExecution ?? true,
            prioritizeHighValueRepairs: value.behavior?.setupWizardRules?.prioritizeHighValueRepairs ?? true
          },
          automationRules: (value.behavior?.automationRules || []).map((rule) => ({ ...rule }))
        }
      }
    : createDefaultNodeStructureConfig();

export const shellNodeCatalog: ShellNodeDefinition[] = [
  {
    id: 'outside-sales-node',
    slug: 'outside-sales',
    name: 'Outside Sales Node',
    summary:
      'Turns a workspace into an account, outreach, visit, follow-up, and calendar execution system for field sales.',
    version: '0.1.0',
    category: 'Sales',
    setupSummary:
      'For solo field sellers and territory reps who want Delta to install and run a lean execution system for follow-ups, visits, and route-aware planning.',
    setupPrompt:
      'Begin Outside Sales Node setup.',
    structureBlueprint:
      [
        'Primary space structure: Accounts, Pipeline, Visits, Follow-Ups.',
        'Accounts/items should carry location context and ownership context.',
        'Tasks and time blocks should use that location context to shape routing and the day plan.',
        'Lists, statuses, and fields should support territory work, outreach cadence, visit planning, and follow-up execution.'
      ].join(' '),
    structureConfig: {
      userFacingDescription:
        'Installs an outside-sales execution layer for leads, follow-ups, visits, route planning, and time-blocked daily work.',
      workspaceBlueprint: {
        primarySpaces: ['Outside Sales'],
        primaryLists: ['Accounts', 'Follow-Ups', 'Visits'],
        planningModel: 'Plan days around route-aware prospecting, follow-up, and visit blocks.',
        routeModel: 'Use account or visit location to group work geographically and reduce windshield time.',
        activityLogModel: 'Capture the latest contact/update as structured activity and only use comments for leftover nuance.',
        taskInTimeBlockModel: 'Prefer tasks inside the relevant time block so work is executed in context.'
      },
      lists: [
        {
          id: 'accounts',
          name: 'Accounts',
          itemLabel: 'Account',
          taskLabel: 'Follow-up',
          statuses: [
            { id: 'prospect', name: 'Prospect', color: '#94a3b8', default: true },
            { id: 'contacted', name: 'Contacted', color: '#f59e0b' },
            { id: 'visit_scheduled', name: 'Visit Scheduled', color: '#22c55e' },
            { id: 'closed', name: 'Closed', color: '#38bdf8' }
          ],
          fields: [
            { id: 'location', name: 'Location', type: 'text', required: true, pinned: true, usedFor: ['routing', 'day_planning'], semanticRole: 'routing', confidenceImportance: 'critical' },
            { id: 'owner', name: 'Owner', type: 'contact', pinned: true, usedFor: ['assignment'], semanticRole: 'ownership', confidenceImportance: 'preferred' },
            { id: 'next_visit', name: 'Next Visit', type: 'date', usedFor: ['scheduling'], semanticRole: 'scheduling', confidenceImportance: 'preferred' }
          ]
        },
        {
          id: 'pipeline',
          name: 'Pipeline',
          itemLabel: 'Opportunity',
          taskLabel: 'Action',
          statuses: [
            { id: 'new', name: 'New', color: '#94a3b8', default: true },
            { id: 'active', name: 'Active', color: '#22c55e' },
            { id: 'stalled', name: 'Stalled', color: '#f59e0b' },
            { id: 'won', name: 'Won', color: '#38bdf8' }
          ],
          fields: [
            { id: 'account', name: 'Account', type: 'text', pinned: true, usedFor: ['linking'], semanticRole: 'qualification', confidenceImportance: 'preferred' },
            { id: 'value', name: 'Deal Value', type: 'number', usedFor: ['prioritization'], semanticRole: 'qualification', confidenceImportance: 'optional' }
          ]
        },
        {
          id: 'visits',
          name: 'Visits',
          itemLabel: 'Visit',
          taskLabel: 'Visit task',
          statuses: [
            { id: 'planned', name: 'Planned', color: '#94a3b8', default: true },
            { id: 'confirmed', name: 'Confirmed', color: '#22c55e' },
            { id: 'complete', name: 'Complete', color: '#38bdf8' }
          ],
          fields: [
            { id: 'account_ref', name: 'Account', type: 'text', pinned: true, usedFor: ['routing'], semanticRole: 'follow_up', confidenceImportance: 'preferred' },
            { id: 'visit_location', name: 'Visit Location', type: 'text', required: true, pinned: true, usedFor: ['routing', 'day_planning'], semanticRole: 'routing', confidenceImportance: 'critical' }
          ]
        },
        {
          id: 'follow_ups',
          name: 'Follow-Ups',
          itemLabel: 'Follow-Up',
          taskLabel: 'Touch',
          statuses: [
            { id: 'queued', name: 'Queued', color: '#94a3b8', default: true },
            { id: 'due_today', name: 'Due Today', color: '#f59e0b' },
            { id: 'done', name: 'Done', color: '#22c55e' }
          ],
          fields: [
            { id: 'account_link', name: 'Account', type: 'text', pinned: true, usedFor: ['linking'], semanticRole: 'follow_up', confidenceImportance: 'preferred' },
            { id: 'channel', name: 'Channel', type: 'select', semanticRole: 'contact', confidenceImportance: 'preferred', options: [{ id: 'call', label: 'Call' }, { id: 'email', label: 'Email' }, { id: 'visit', label: 'Visit' }] }
          ]
        }
      ],
      planning: {
        locationFieldName: 'Location',
        useLocationForRouting: true,
        useLocationForDayPlanning: true,
        defaultTaskPlacement: 'inside_time_block',
        noteIngestionMode: 'assistive',
        timeBlockNaming: [
          {
            id: 'prospecting',
            label: 'Prospecting',
            aliases: ['prospecting', 'prospect'],
            template: 'Prospecting Block {n}'
          },
          {
            id: 'follow_up',
            label: 'Follow-Up',
            aliases: ['follow up', 'follow-up', 'followups'],
            template: 'Follow-Up Block {n}'
          },
          {
            id: 'visits',
            label: 'Visits',
            aliases: ['visit', 'visits', 'field visit'],
            template: 'Visit Block {n}'
          }
        ]
      },
      dataPolicy: {
        requiredFields: [
          {
            id: 'req-location',
            label: 'Account or visit location must exist for route-aware planning',
            semanticRole: 'routing',
            required: true,
            fallbackAssumption: 'If missing, still allow action planning but surface high-value records needing location data.'
          }
        ],
        optionalFields: [
          {
            id: 'opt-owner',
            label: 'Owner/contact improves assignment and outreach quality',
            semanticRole: 'ownership',
            required: false,
            fallbackAssumption: 'Assume self-owned work unless a clearer owner is present.'
          },
          {
            id: 'opt-next-visit',
            label: 'Next Visit improves scheduling quality',
            semanticRole: 'scheduling',
            required: false,
            fallbackAssumption: 'Use latest follow-up context and open time blocks when this is absent.'
          }
        ]
      },
      behavior: {
        primaryOperatingModes: ['route planning', 'follow-up execution', 'visit preparation', 'activity ingestion'],
        actionPriorityRules: [
          'Update structured fields first',
          'Create or update task and time-block links second',
          'Log activity after structured updates',
          'Use comments only for leftover nuance'
        ],
        schedulingBehavior: [
          'Prefer proposing or creating named work blocks when the user references a block that does not exist',
          'Bias tasks into relevant time blocks rather than leaving them standalone'
        ],
        activityLoggingBehavior: [
          'Convert meaningful notes into structured follow-up context before appending freeform comments',
          'Preserve recent activity context for the next route or follow-up decision'
        ],
        missingDataHandling: {
          doNotBlockOnPartialData: true,
          buildFromBestAvailableData: true,
          surfaceHighValueGapsInBatches: true,
          avoidItemByItemNagging: true
        },
        setupWizardRules: {
          detectMissingLists: true,
          detectMissingStatuses: true,
          detectMissingFields: true,
          offerMappingBeforeCreate: true,
          offerRepairActionsInBatches: true,
          allowPartialDataExecution: true,
          prioritizeHighValueRepairs: true
        },
        automationRules: [
          {
            id: 'auto-follow-up-after-visit',
            name: 'Create follow-up after completed visit',
            trigger: 'Visit marked complete',
            action: 'Create a follow-up task if no next step exists'
          }
        ]
      }
    },
    setupLogic:
      [
        'Active node: Outside Sales Node.',
        'Inspect the assigned space structure and compare it against a strong outside-sales operating model.',
        'Identify missing or mismatched lists, statuses, columns, expected values, and task/calendar workflows.',
        'Recommend concrete setup changes as executable steps the app can apply.',
        'Keep the setup collaborative, concise, and execution-first.'
      ].join(' '),
    operateLogic:
      [
        'Active node: Outside Sales Node.',
        'Operate like a delegated outside-sales assistant.',
        'Interpret notes and requests in terms of accounts, follow-ups, visits, outreach, scheduling, next steps, and carry-forward work.',
        'Prefer action-family routing over item-only routing when the request is clearly about scheduling, planning, or execution.',
        'Use the workspace as source of truth and keep actions app-native.'
      ].join(' '),
    iconKey: 'computer_dollar',
    versionNotes: 'Initial published node release with installable setup flow, sales-space assignment, and executable workspace scaffolding.'
  }
];
