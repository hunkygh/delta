# STYLE CONFLICT AUDIT

## 1. Summary
Visible token changes are muted mostly because `src/styles/global.css` contains multiple late override layers (including broad `!important` blocks) that restyle shared primitives after `components.css`.

Primary conflict sources:
- `src/styles/global.css` (largest source; duplicate shared selector definitions + broad overrides)
- `src/styles/responsive.css` (mobile `!important` white-surface override block)
- `src/styles/hover-focus.css` (small, but overlaps hover/focus states defined elsewhere)

Recommendation: do cleanup before further token migration, otherwise each migration will need more override pressure.

## 2. Duplicate selector conflicts

- Selector: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`
  - Locations:
    - `src/styles/components.css:7-88` (tokenized base system)
    - `src/styles/global.css:3662-3708` (legacy button system)
    - `src/styles/global.css:5437-5475` (mid-file `!important` overrides)
    - `src/styles/global.css:6305-6435` (late token migration block with `!important`)
  - Conflict summary: same button family is defined 4 times, with different border/background/transform/focus behavior.

- Selector: `.card`
  - Locations:
    - `src/styles/components.css:144-151` (tokenized card primitive)
    - `src/styles/global.css:3622-3628` (legacy card primitive)
    - `src/styles/global.css:6577-6589` (late `!important` card migration block)
  - Conflict summary: tokenized primitive exists, but global legacy + late override layers compete.

- Selector: `.launchpad-card`
  - Locations:
    - `src/styles/global.css:1341-1354` (base card)
    - `src/styles/global.css:3789-3795` (border override)
    - `src/styles/global.css:4007-4014` (shadow override)
    - `src/styles/global.css:5355-5369` and `6578-6602` (broad migration overrides)
    - `src/styles/hover-focus.css:1-3` (extra hover shadow)
  - Conflict summary: multiple stacked shadow/border/background rules with mixed token + literals.

- Selector: `.lane-table-card`
  - Locations:
    - `src/styles/global.css:1031-1037` (base)
    - `src/styles/global.css:3789-3795` (border override)
    - `src/styles/global.css:4007-4014` (shadow override)
    - `src/styles/global.css:5355-5369` and `6579-6602` (broad migration overrides)
  - Conflict summary: base now tokenized, but later sections can still replace depth/border behavior.

- Selector: `.week-event-card`
  - Locations:
    - `src/styles/global.css:1925-1960` (base + hover + active)
    - `src/styles/global.css:6298-6299` (forced white surface `!important`)
    - `src/styles/global.css:6585-6617` (shared card migration/active state `!important`)
  - Conflict summary: multiple active/hover depth definitions and forced surface overrides.

- Selector cluster: `.list-status-group`, `.list-recurring-shell`, `.list-proposal-panel`, `.proposal-review`, `.focal-overview-card`
  - Locations:
    - `src/styles/global.css:5327-5369` (shared background/border reset block)
    - `src/styles/global.css:6577-6617` (late card token migration block)
    - plus component/page files with local styles
  - Conflict summary: two different global shared-surface passes are both active.

- Selector: `.sidebar-nav`, `.sidebar-nav-item`
  - Locations:
    - `src/styles/global.css:373-598` (one system)
    - `src/styles/global.css:4870-4912` (second system)
    - `src/styles/global.css:5256-5277` (third system)
    - `src/styles/global.css:5825-5863` (forced anti-hover/anti-shift overrides)
  - Conflict summary: repeated sidebar systems increase cascade unpredictability globally.

## 3. `!important` conflict inventory

High-impact:
- `.card, .launchpad-card, .lane-table-card, ...` background/border/shadow
  - `src/styles/global.css:6577-6617`
  - Impact: High (forces card outcomes regardless of upstream component styles).

- `.btn*` migration block (background/color/border/box-shadow/focus/disabled)
  - `src/styles/global.css:6305-6435`
  - Impact: High (suppresses component-level button variants and some page-specific intent).

- Input migration block for `.space-input`, `.calendar-*`, `.ai-input-field`, `.delta-ai-input-field`
  - `src/styles/global.css:6505-6571`
  - Impact: High (wins against most local form control styles).

- Shared surface reset block (`border-color`, `box-shadow`, `background`) for cards/panels/modals
  - `src/styles/global.css:5327-5369`
  - Impact: High (broadly flattens depth and can conflict with later tokenized depth rules).

- App/page background forcing (`background: #f7f8fa !important`)
  - `src/styles/global.css:5798-5842`
  - Impact: High (overrides page/surface token experiments).

- Mobile white-surface override cluster
  - `src/styles/responsive.css:2104-2120`
  - Impact: High on mobile (forces many surfaces to white).

Medium-impact:
- `.launchpad-card` border-color override
  - `src/styles/global.css:3795`
  - Impact: Medium (can block token border tuning).

- Misc legacy `!important` chunks around fullscreen close/button visuals
  - `src/styles/global.css:1375-1398`, `3366-3443`
  - Impact: Medium (local but can conflict during cleanup).

Low-impact:
- Layout utility `!important` in responsive (display/margins/overflow)
  - `src/styles/responsive.css:145-169`
  - Impact: Low for token rollout, high for layout behavior.

## 4. Hardcoded literal override inventory (high-signal)

Background literals overriding token intent:
- `#f7f8fa` page/surface forcing in global shared blocks
  - `src/styles/global.css:5318-5339`, `5798-5842`
- `#ffffff` forced on large surface sets
  - `src/styles/global.css:5355-5369`
  - `src/styles/responsive.css:2104-2120` (mobile)

Border literals overriding token intent:
- `#e4e4e7`, `#e4e6ea`, `#d8dce3` in shared card/sidebar override sections
  - `src/styles/global.css:3795`, `5351`, `5833`

Shadow literals overriding token intent:
- Mixed hardcoded shadow stacks for core cards:
  - `src/styles/global.css:4007-4014` (`launchpad-card`, `lane-table-card`)
  - `src/styles/global.css:1925-1960` (`week-event-card` depth states)
  - `src/styles/hover-focus.css:1-3` (`launchpad-card:hover`)

Text color literals still hardcoded in shared areas:
- `#2f343d`, `#252b3c`, `#666`, `#333`, etc. in shared global blocks
  - examples: `src/styles/global.css:5448`, `1031-1062`, `1375-1398`

## 5. Conflict clusters

### Cluster A: Shared primitive duplication (Buttons/Inputs/Cards)
- Files: `components.css` vs multiple `global.css` blocks.
- Blocking: tokenized primitives in `components.css` are frequently bypassed by later global rules.

### Cluster B: Broad surface reset cluster
- Files: `global.css` around `5318-5369`, plus `5798-5842`.
- Blocking: collapses nuanced surface hierarchy and can flatten card depth.

### Cluster C: Late migration patch cluster (`!important`)
- Files: `global.css` around `6305-6617`.
- Blocking: stabilizes current output but makes future targeted component migrations harder.

### Cluster D: Mobile forced-white override cluster
- Files: `responsive.css:2104-2120`.
- Blocking: mobile component surfaces cannot express tokenized selected/hover/elevation variants.

### Cluster E: Hover/focus split cluster
- Files: `hover-focus.css` + `global.css` + `components.css`.
- Blocking: hover/focus effects compete (especially for cards/buttons).

## 6. Safe cleanup candidates (analysis only)

Likely safe to consolidate/remove in a cleanup pass (after QA):
- Duplicate `.btn*` legacy block in `global.css:3662-3708` (if late token block remains).
- Duplicate shared card primitive in `global.css:3622-3628` (if `components.css` or one canonical global token block remains).
- `hover-focus.css` `.launchpad-card:hover` duplicate shadow (if hover is centralized).
- One of the two shared card reset layers:
  - `global.css:5327-5369` OR `global.css:6577-6617` (keep one canonical system, not both).
- `global.css:4007-4014` hardcoded card shadow stack (if replaced by token shadows).

## 7. Needs manual review

Higher risk blocks requiring visual QA before removal:
- `global.css:5798-5863` sidebar + background + anti-shift cluster (touches interaction behavior, not just colors).
- `responsive.css:2104-2120` mobile white override cluster (affects many mobile surfaces).
- `global.css:3372-3443` calendar/list action override cluster (`!important` heavy).
- `global.css:3789-3795` / `4007-4014` shared card border/shadow patches tied to calendar drawer polish.

## 8. Recommended next cleanup pass

1. **Button override cluster cleanup**
   - Keep one canonical shared button definition path; remove duplicate legacy global button block.
2. **Input override cluster cleanup**
   - Keep one canonical shared input system; reduce broad selector blast radius in global.
3. **Card override cluster cleanup**
   - Merge to one shared card token layer; delete earlier/later duplicate reset block.
4. **Background/surface reset cleanup**
   - Remove broad `background: #f7f8fa/#ffffff !important` sweeps; reintroduce via semantic tokens per surface role.
5. **Responsive/mobile override cleanup**
   - Replace forced mobile white-surface block with narrower component-scoped token rules.
6. **Hover/focus centralization**
   - Centralize hover/focus in one layer (`components.css` or dedicated interaction file), remove duplicates.

