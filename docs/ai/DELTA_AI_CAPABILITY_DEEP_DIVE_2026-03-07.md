# Delta AI Capability Deep Dive (Current State)

Date: March 7, 2026  
Codebase snapshot: local workspace (`/Users/hunkyg/Desktop/apps/Delta`)

## 1) Executive summary

Delta currently runs two distinct AI paths:

1. `chat` edge function (user-facing Delta AI chat)
2. `optimization-pull` edge function (calendar/list proposal engine)

The chat path is intentionally hybrid:
- deterministic DB-backed answers for inventory/lookup and some create proposals
- LLM fallback (Groq) for open-ended text
- heuristic fallback when data/model is unavailable

This is resilient, but it can feel "brittle-but-silent" because failures often degrade to safe generic responses instead of hard user-visible errors.

## 2) End-to-end architecture

### 2.1 Desktop/mobile chat client path

- UI entrypoints:
  - Desktop: `src/components/Header.tsx`
  - Mobile: `src/components/mobile/MobileCalendarWireframe.tsx`
- Client transport:
  - `src/services/chatService.ts` calls `POST /functions/v1/chat`
  - Requires Supabase session access token
- Server runtime:
  - `supabase/functions/chat/index.ts`
  - Validates auth via bearer token (`getUser`, fallback `getClaims`)

### 2.2 Proposal optimization path

- Caller:
  - `focalBoardService.getOptimizationProposal(...)`
- Edge function:
  - `supabase/functions/optimization-pull/index.ts`
- Purpose:
  - Return read-only proposal contract (`field_updates`, `new_actions`, `calendar_proposals`)
  - No mutation in function; application happens client-side after explicit approval

## 3) Data sources Delta AI actually reads today

## 3.1 `chat` function snapshot reads

`buildAccountContextSnapshot(...)` queries:
- `focals`
- `lanes`
- `items`
- `actions`
- `time_blocks`
- `list_fields`
- `field_options`
- `item_field_values`
- `item_comments`

Important behavior:
- Scope-aware limits (smaller limits when scoped, larger global limits)
- Graceful partial failure: some table failures log warnings and continue with empty sets
- Snapshot is serialized into system prompt for LLM path

### 3.2 `optimization-pull` reads

- `lanes` / `items` / `actions`
- `time_blocks` / `time_block_links`
- `threads` / `comments`

This means optimization path can use thread comments, while standard chat currently uses `item_comments` (not `threads/comments`).

## 4) Context model and scope resolution

Chat context object supports:
- `focal_id`
- `list_id`
- `item_id`
- `action_id`
- `time_block_id`
- optional time-block occurrence window

Where context comes from:
- App-level events in `AppShell` (`delta:chat-context-set`, `delta:chat-context-clear`, `delta:ai-open-with-context`)
- Header source selector can switch to `Current`, specific Space, List, or Item
- Mobile builds contextual payload from active scope/date/list/item selection

Deterministic resolver behavior:
- Fuzzy matching names with token overlap + Levenshtein scoring
- Prior-message carryover for ambiguous phrases (`this`, `that`, `same`, `it`)
- Ambiguity guardrails ask user to clarify when confidence gap is small

## 5) What the AI can do right now

## 5.1 Deterministic answer routes (`chat`)

Supported intent routes:
- `focal_inventory`
- `list_inventory`
- `list_items`
- `field_inventory`
- `item_next_step`
- `action_inventory`
- `timeblock_inventory`
- `item_inventory` (defined but effectively low-hit because `items/tasks` maps to `list_items` first)

Create proposal routes:
- create space (`create_focal`)
- create list (`create_list`)
- create item (`create_item`)
- create action (`create_action`)
- plus heuristic follow-up action proposal (`create_follow_up_action`) in specific fallback paths

Approval/apply path:
- Desktop `Header` includes proposal approve buttons
- Apply calls mutate via `focalBoardService`

### 5.2 LLM route (`chat`)

When deterministic path does not answer, function calls Groq with:
- strict system instructions
- active context line
- serialized account snapshot
- last ~20 user/assistant messages

Model fallback order:
1. `llama-3.3-70b-versatile`
2. `llama-3.1-70b-versatile`
3. `llama-3.1-8b-instant`
4. `mixtral-8x7b-32768`
5. `gemma2-9b-it`

### 5.3 Memo mode

- Desktop chat mode toggle supports `memo`
- Memo messages are persisted to Docs via `docsService.createNote(...)`
- Mobile quick text/voice capture also persists Docs notes

## 6) What “indexable” means in current implementation

For Delta to "know" a value, it must be committed to DB tables queried by the function.

Example for custom fields:
- field metadata: `list_fields`, `field_options`
- per-item values: `item_field_values`
- item linkage: `item_id`

Therefore current logical chain is:
`item -> field definition (column) -> field value row`

If a value is only local UI state and not saved/upserted to DB, chat cannot read it.

## 7) Known brittleness / silent degradation points

1. Partial snapshot failures degrade silently:
- several table read failures become warnings + empty arrays
- user may get valid-looking but incomplete answers

2. Deterministic intent precedence collisions:
- `items/tasks` triggers `list_items` early
- some broad queries users expect as global item inventory may be interpreted as list-scoped

3. Dual comment systems:
- chat reads `item_comments`
- optimization reads `threads/comments`
- this can create inconsistent AI context between features

4. Snapshot truncation limits:
- global mode caps tables (`items`, `actions`, `values`, `comments`)
- larger workspaces can lose long-tail context in chat prompt

5. No hard "data freshness contract":
- user edits usually persist quickly, but if save path fails or debounced write is pending, AI sees stale state

6. Heuristic fallbacks can feel like success:
- response remains polished and non-breaking
- user may not realize data/model path failed

## 8) Capability matrix vs requested product behavior

Implemented now:
- scoped reads of spaces/lists/items/actions/time blocks
- custom field introspection
- next-step suggestion using status/date/comment hints
- approved create proposals
- memo capture to docs

Missing or partial:
- strong operational AI (multi-step autonomous updates across lists/time blocks)
- explicit action execution planner with dry-run/commit phases
- unified comment ingestion across all contexts
- recurrence-aware task completion reset model surfaced consistently to AI
- strong observability UI showing when response came from DB deterministic vs LLM vs heuristic

## 9) Race conditions / blocking conditions for indexability

Primary blockers:
- Save not completed (local edit not persisted yet)
- Save failed due to RLS/schema mismatch/network but UI did not make it obvious
- Table missing migration in target environment (frequent source of fallback behavior)
- Scope mismatch (AI context points at different list/item than user expects)

Potential race windows:
- quick edit then immediate AI ask before upsert resolves
- source selector context changed while message in-flight

## 10) Recommended hardening plan (priority order)

P0 (high impact, low risk):
1. Add user-visible response provenance chip on each assistant message:
   - `DB deterministic` / `LLM` / `fallback`
2. Add explicit warning banner in chat message when snapshot partial errors occur (which tables failed)
3. Unify comments for AI read path:
   - either migrate to `threads/comments` everywhere or mirror into a consolidated read view

P1:
4. Add "snapshot coverage stats" debug endpoint + UI panel (counts, truncation flags, missing tables)
5. Add deterministic route expansion for common asks:
   - "show field values for item X"
   - "find items where [column] = [value]"

P2:
6. Add autonomous execution queue abstraction:
   - plan -> user approve -> atomic apply -> result log
7. Add regression harness with golden prompts against synthetic workspace fixtures

## 11) Suggested instrumentation additions

- Correlation ID from client -> function logs -> returned debug meta
- Snapshot warning surface:
  - `missing_tables`
  - `truncated_counts`
  - `partial_query_failures`
- Per-intent latency and fallback metrics

## 12) Security and safety notes

- Chat function redacts UUID-like substrings from LLM output (`redactUuids`)
- Uses authenticated Supabase client for user-scoped reads
- Proposal application remains explicit user action in UI
- `optimization-pull` uses service role for broad scoped reads; currently protected by user auth gate at function entry

## 13) Direct answers to your specific concerns

### 13.1 “Can AI pull column values like location?”
Yes, if they are saved to `item_field_values` and associated field metadata exists in `list_fields`/`field_options`.

### 13.2 “What triggers indexability?”
Successful DB write. Not the AI request itself. AI can only read what is already persisted.

### 13.3 “Are there hidden blockers?”
Yes:
- unsaved local edits
- failed save flows
- missing migrations/tables
- snapshot truncation/partial failures
- context scope mismatch

## 14) Immediate next implementation recommendation

If you want this to feel less brittle right away, implement in this order:

1. Chat provenance + partial-snapshot warning in UI  
2. Unified comment read source for chat and optimization  
3. Deterministic query support for field-value retrieval/filtering  
4. Workspace AI regression suite with fixture data

