# On-The-Fly Execution Surface Contract (No Drift)

## Goal
Build Delta/Life OS on-the-fly execution pipeline:
- quick capture -> structured proposals -> explicit approval -> deterministic writes
- recurring-safe surfacing inside calendar time blocks
- persistent thread context for `timeblock|item|action`

This is not a redesign pass.

## Non-Negotiable Principles
- No configuration modals unless already present in app.
- Grayscale UI everywhere. Electric blue `#00C7FF` only for primary AI-trigger actions.
- No nested bento stacking for settings surfaces.
- No component-level Supabase calls. Service-only DB access.
- AI/edge functions are proposal-only and never auto-mutate data.

## Scope Constraints
Implement only the three pillars:
1. Quick capture + AI parse -> proposals
2. Surfacing items/actions inside time block occurrences
3. Persistent threads across recurring instances

Do not add analytics, drag/drop, automation builders, or board systems.

## Phase Plan

### Phase 0 — Prechecks
- [ ] Confirm schema + migration coverage:
  - `lanes.mode` (`one_off|recurring`)
  - `item_occurrences`
  - `time_block_content_rules`
  - `threads/comments` with scopes `timeblock|item|action`
- [ ] Confirm RLS exists for:
  - `item_occurrences`
  - `time_block_content_rules`
  - `threads`
  - `comments`
- [ ] Confirm single auth owner (`AuthProvider` / `AppShell`)
- [ ] Confirm canonical services:
  - `calendarService`
  - `focalBoardService`
  - `threadService` (create if missing)

### Phase 1 — Canonical Data Contracts
- [ ] Strict Proposal Contract shared type/schema + runtime validator
- [ ] Capture Event contract shared type/schema + validator
- [ ] Malformed proposal rejection with heuristic-empty fallback
- [ ] No UI work in this phase

Proposal Contract (strict JSON):
- `source`: `"ai" | "heuristic"`
- `confidence`: `number` between 0..1
- `reasoning`: `string` (short, max 1-2 sentences)
- `field_updates`: `Array<{ entity: "item"|"action"|"list"|"time_block"; id: string; changes: Record<string, string|number|boolean|null> }>`
- `new_actions`: `Array<{ item_id: string; title: string; due_at_utc?: string|null; notes?: string|null }>`
- `calendar_proposals`: `Array<{ action_id?: string; item_id?: string; time_block_id?: string; scheduled_start_utc: string; scheduled_end_utc?: string|null; title: string; notes?: string|null }>`

Hard rules:
- AI proposes only; explicit user approval is required before mutation.
- No silent calendar placement guesses outside explicit datetime extraction or explicit block-scoped optimize action.

### Phase 2 — Services Only
- [ ] `calendarService`: deterministic occurrence/content-rule functions
- [ ] `threadService`: thread/comment single source of truth
- [ ] `focalBoardService`: list mode + list/item reads
- [ ] No supabase calls added in components

### Phase 3 — Edge Function (Proposal-Only)
- [ ] Auth required
- [ ] Scoped context assembly
- [ ] Groq path with safe fallback
- [ ] Output = Proposal Contract JSON only
- [ ] No DB writes
- [ ] Strict output validation before returning

### Phase 4 — UI: Quick Capture + Threads
- [ ] Time block drawer notes -> timeblock thread
- [ ] Single blue AI trigger in drawer
- [ ] Item detail thread scope toggle (`item` default, `action` when selected)

### Phase 5 — UI: Proposal Review + Apply
- [ ] Reusable proposal review table
- [ ] Explicit approval checkboxes + bulk apply
- [ ] Deterministic apply path via services only

### Phase 6 — Execution Surface in Time Blocks
- [ ] Show resolved occurrence items in block drawer/card
- [ ] Per-occurrence completion writes to `item_occurrences`
- [ ] Recurring lists keep stable items (no status-pipeline completion move)

### Phase 7 — Weekday Content Rule UX
- [ ] Minimal controls:
  - `Same every time | By weekday`
  - weekday selectors, list selector, in-place item checklist
- [ ] Persist/read through `time_block_content_rules`

### Phase 8 — Hardening
- [ ] Error boundaries for AppShell + CalendarView
- [ ] Dev-only logging
- [ ] Proposal source visibility (`ai|heuristic`)
- [ ] StrictMode-safe subscription cleanup
- [ ] Build-path cleanup for dead/corrupt artifacts

## No-Drift Implementation Rules
- Touch only files needed for current phase.
- Do not rename core concepts.
- Do not globally restyle existing components.
- Prefer whitespace + hairline separators over extra borders.
