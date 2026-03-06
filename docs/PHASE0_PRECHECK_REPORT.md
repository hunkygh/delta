# Phase 0 Precheck Report (2026-03-02)

## Scope
On-the-fly execution surface prechecks for:
- schema presence
- RLS presence
- auth ownership pattern
- canonical service ownership

## Findings

### 1) Required schema migrations in repo
- `lanes.mode` present:
  - `src/database/migrations/20260302_list_modes_item_occurrences_mvp.sql`
- `item_occurrences` present:
  - `src/database/migrations/20260302_list_modes_item_occurrences_mvp.sql`
- `time_block_content_rules` present:
  - `src/database/migrations/20260302_time_block_content_rules_mvp.sql`
- `threads/comments` with `timeblock|item|action` scopes present:
  - `src/database/migrations/20260302_signal_threads_phase1.sql`

### 2) RLS policy coverage in repo migrations
- `item_occurrences`: present in migration above
- `time_block_content_rules`: present in migration above
- `threads`: present in `20260302_signal_threads_phase1.sql`
- `comments`: present in `20260302_signal_threads_phase1.sql`

### 3) Auth ownership pattern
- Canonical auth provider exists:
  - `src/context/AuthContext.tsx`
- App shell consumes provider state:
  - `src/components/AppShell.tsx`

### 4) Canonical service modules
- `calendarService`: present at `src/services/calendarService.js`
- `focalBoardService`: present at `src/services/focalBoardService.js`
- `threadService`: missing as standalone module (thread/comment access currently embedded in `focalBoardService.js`)

## Verification Blocker
Runtime confirmation of migration application in the target Supabase project was not possible from this workspace because Supabase CLI is not linked:
- `supabase migration list` -> `Cannot find project ref. Have you run supabase link?`

Phase 0 schema/RLS confirmation above is repository-level (migration/source) verification.
