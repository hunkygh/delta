# Node Runtime SSOT

## Purpose
Delta has two distinct layers:

- Core app layer: spaces, lists, items, tasks, comments, notes, activity, calendar, time blocks, statuses, fields, expected values.
- AI node layer: packaged logic that interprets, plans, mutates, and operates on top of the core app.

This document is the single source of truth for keeping those layers separate.

The core app must remain generic.
The node layer owns domain-specific logic.

## Core Principle
The app owns truth.
The AI owns interpretation and execution.
The node owns policy.

That means:

- The app should not hardcode outside-sales behavior, GTD behavior, founder behavior, or other vertical-specific operating models.
- The AI runtime should read broad context and choose the right action family.
- The node should define how a given space is structured, interpreted, prioritized, and automated.

## Capability Boundary
When deciding whether behavior belongs to the app or a node, use this rule:

- The app owns capability.
- The node owns preference, policy, and prioritization.

### App-level AI capability examples
- resolving spaces, lists, items, tasks, and time blocks from user language
- detecting a target day like `tomorrow`
- finding the first matching block on that day
- detecting that no matching block exists
- producing app-native proposals like:
- `create_action`
- `create_time_block`
- `resolve_time_conflict`
- applying approved mutations safely

These are generic capabilities every node should be able to rely on.

### Node-level policy examples
- which lists matter most in a governed space
- which statuses should be excluded or prioritized
- how to rank candidate items for prospecting
- which fields drive day planning, routing, or scheduling
- how to translate notes into actionable work for that domain

Example:

- The app should know how to interpret `my first prospecting block tomorrow` as a target-block lookup problem.
- The `Outside Sales Node` should influence which items are most important to work during that block, and what kind of tasks should be proposed.

This prevents vertical-specific workflow assumptions from leaking into the core app.

## Current Status
Current AI behavior is still mostly app-level.

Examples:

- `supabase/functions/chat/index.ts` currently contains mutation routing and business logic directly.
- Shell AI can already inspect context and perform some mutations.
- The shell now has a first frontend scaffold for node installation and setup launch.

This is transitional.

The long-term goal is to move domain behavior out of app-level AI flow and into installable nodes.

## First Reference Node
The first real node is:

- `Outside Sales Node`

This node should shape a workspace around:

- accounts
- outreach
- visits
- follow-ups
- owner/contact tracking
- calendar execution
- daily planning
- wrap-up / carry-forward

## Node Package Model
A node package should define:

- `id`
- `slug`
- `name`
- `summary`
- `version`
- `category`
- `setupSummary`
- `setupPrompt`
- `instructions`
- `mutationPolicies`
- `recommendedSchema`
- `recommendedStatuses`
- `recommendedFields`
- `planningRules`
- `automationRules`
- `autonomyDefaults`

The node package does not replace app primitives.
It only configures how the AI uses them.

## Installed Node Model
An installed node should track:

- `nodeId`
- `installedAt`
- `assignedFocalIds`
- `setupCompleted`
- future:
- `autonomyLevel`
- `permissions`
- `setupSessions`
- `lastRunAt`
- `configOverrides`

## Space Assignment
Nodes are assigned to spaces.

That means:

- one workspace can have multiple nodes installed
- one node can govern multiple spaces
- different spaces can run different logic packages

This is required for future marketplace behavior.

## Setup Wizard Chat
Each installed node must support a sticky setup chat.

Setup behavior:

- user installs a node
- user presses `Set Up`
- a sticky contextual AI thread opens
- that thread knows:
- which node is active
- which space is assigned
- what structure the node expects
- what already exists
- what still needs to be created or normalized

The setup wizard is not advisory-only.
It must be execution-capable.

Expected setup flow:

1. Inspect current structure.
2. Explain what is missing or mismatched.
3. Present executable setup actions in chat.
4. User clicks to apply.
5. AI executes mutations.
6. AI confirms exactly what changed.

This should feel like Codex/Windsurf style execution inside the app.

## Mutation Taxonomy
The mutation system must be intent-first, not item-first.

### Primitive operations
- create
- update
- move
- delete
- link
- unlink
- reorder
- schedule
- reschedule
- complete
- defer
- convert
- merge
- split

### Action families
- workspace structure
- item management
- task/action management
- calendar/time-block management
- note ingestion / interpretation
- planning / prioritization
- relationship / linking actions
- node / automation actions

### Workspace structure
- create space
- rename space
- create list
- archive list
- reorder lists
- create field
- edit field schema
- manage field options
- manage statuses
- install node scaffolding

### Item management
- create item
- update item
- move item between lists
- merge duplicate items
- convert note into item
- attach comments/context
- update field values
- change status
- delete/archive item

### Task/action management
- create task
- create subtask
- attach task to item
- detach/reassign task
- mark complete
- add completion note
- defer/reschedule
- set recurrence
- split one task into several
- convert item into tasks
- promote task to item

### Calendar/time-block management
- create time block
- reschedule time block
- resolve conflicts
- attach tasks to block
- detach tasks from block
- convert task to block
- block time for tasks
- shift a plan window
- preserve or break recurrence

### Note ingestion / interpretation
- turn raw notes into structured updates
- extract contacts/details
- detect follow-ups
- detect commitments
- detect deadlines
- detect meetings/visits
- decide whether to append to an existing record or create a new one

### Planning / prioritization
- generate a daily plan
- run wrap-up
- carry forward incomplete work
- assign work to today / tomorrow / later
- prioritize according to node policy
- rebalance a day
- fill a time block from candidate tasks

### Relationship / linking
- connect task to item
- connect item to list/space
- connect block to task/item
- deduplicate records
- infer parent/child relationships
- attach context from notes, comments, and activity

### Node / automation
- install node
- assign node to space
- launch setup wizard
- apply schema recommendations
- run node analysis
- set autonomy level
- approve or reject node plans
- run maintenance passes

## Runtime Contract
The AI runtime should:

- load broad workspace context
- load node-specific policy for the relevant space
- classify intent into the correct action family
- choose a mutation tool
- either:
- answer
- propose
- execute

Execution should always route through app-native mutations.

### Planning Action Family
Core Delta AI capability owns the planning mechanics. That includes:

- `resolve_target_block`
- `detect_missing_target_block`
- `create_target_block`
- `suggest_tasks_for_block`
- `create_tasks_for_block`
- `continue_planning_after_block_creation`

The shell should support proposal chaining so a user can approve `Create block`, and Delta immediately reruns the original planning request against the newly created block instead of forcing the user to restate intent.

Node logic does not redefine those planning mechanics. A node may influence:

- which lists are eligible for planning
- which fields/statuses matter
- how items are ranked
- how task suggestions are worded
- whether tasks prefer `standalone` or `inside_time_block` placement

## Anti-Brittleness Rules
- Do not hardcode node-specific operating models into the core app schema.
- Do not force every mutation through item resolution.
- Do not assume all scheduling actions require an item.
- Keep mutation tools generic and reusable.
- Keep node config declarative when possible.
- Separate understanding from execution.
- Preserve explicit approval paths for high-risk mutations.
- Keep app-level settings outside node packages.

## Outside Sales Node Requirements
Outside Sales Node must eventually support:

- setup wizard for lists, statuses, columns, expected values
- account/contact ingestion from notes
- follow-up and outreach generation
- visit scheduling and calendar placement
- daily planning
- wrap-up and incomplete-task carry-forward
- account-specific next-step reasoning
- AI acting like a delegated outside-sales operator

## Frontend Requirements
The shell must support:

- profile popout from bottom nav
- node config / marketplace surface
- installable nodes
- installed node visibility
- space assignment controls
- setup launch button
- future:
- node detail screen
- autonomy settings
- permissions
- setup session history
- marketplace browsing and purchase/install flow

## Immediate Implementation Direction
Build in this order:

1. Node runtime scaffold
- frontend install state
- node registry
- node assignment

2. Setup wizard thread plumbing
- sticky node setup chats
- executable setup action rendering

3. Action-family routing
- replace item-first mutation flow with intent-first routing

4. Outside Sales Node logic package
- move domain behavior into node-owned config and prompts

5. Marketplace-ready packaging
- node metadata
- versioning
- install/assignment lifecycle

## Boundary Reminder
If a behavior answers the question:

- “How should this space operate?”

it likely belongs in the node.

If a behavior answers the question:

- “What can this app store, show, schedule, or mutate?”

it belongs in the core app.
