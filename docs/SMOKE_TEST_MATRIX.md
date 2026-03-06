# Delta Smoke Test Matrix

## Scope
Quick validation for auth bootstrap, focals loading, and degraded behavior when Supabase is unavailable.

## Preconditions
- Run app locally with `npm run dev`.
- Ensure the configured Supabase project is reachable for the "online" scenarios.
- Use a valid test account that has at least one focal with lanes/items.

## Scenario 1: Signed Out Bootstrap
1. Open the app in a fresh/private browser session.
2. Navigate to `/`.
3. Confirm you are redirected to `/login`.

Expected:
- No infinite loading state.
- No repeated auth flicker between routes.

## Scenario 2: Sign In Flow
1. On `/login`, sign in with a valid account.
2. Confirm redirect to `/`.
3. Navigate to `/focals`.

Expected:
- App shell renders without delay loops.
- Focals page loads and shows either data or an empty state.

## Scenario 3: Focals CRUD Smoke
1. In sidebar, create a new focal.
2. Open that focal in `/focals`.
3. Add one lane and one item.

Expected:
- Creates succeed without stuck loaders.
- New focal/lane/item appears after reload.

## Scenario 4: Hard Refresh Session Persistence
1. While signed in, hard refresh browser tab on `/focals`.
2. Navigate between `/`, `/calendar`, `/focals`.

Expected:
- Session remains active.
- No forced sign-out from storage wipes.

## Scenario 5: Offline/Unreachable Supabase
1. Temporarily block network for Supabase domain (or disable network).
2. Reload `/focals`.

Expected:
- Loading ends with a clear error message.
- No permanent spinner.
- Returning network and retrying recovers.

## Scenario 6: Missing Table Degradation
1. Use an environment/project where `lanes`/`items` tables are missing.
2. Open `/focals` and select a focal.

Expected:
- App remains usable.
- Focal view degrades gracefully (empty lane/item data) instead of crashing.

## Scenario 7: Sign Out
1. Use sidebar settings logout.
2. Confirm route goes to `/login`.
3. Reload page.

Expected:
- User remains signed out.
- No stale authenticated UI artifacts.

## Pass Criteria
- All scenarios complete without white screen, infinite loading, or uncaught runtime errors.
- Any expected failures (offline/missing-table) are user-visible and recoverable.
