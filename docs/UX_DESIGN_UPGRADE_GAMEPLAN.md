# UX Design Upgrade Game Plan (Incremental, No Drift)

## Objective
Upgrade Delta UX to fully comply with:
- `STRUCTURAL_&_MOTION_DESIGN_CONTRACT.md`
- `UI_TONE_AND_VISUAL_SOFTNESS_STANDARD.md`
- `MOBILE_INTERACTION_SOFTNESS_STANDARD.md`

This plan is incremental by surface, with explicit acceptance criteria per phase.

## Guardrails
1. No broad restyle churn in feature branches.
2. One surface family per phase, merged only after verification.
3. No nested bordered containers unless interaction-surface separation is required.
4. Structural motion must be directional and consistent (slide/reveal first).
5. Grayscale-first everywhere except explicit primary/AI accent actions.

## Delivery Sequence

### Phase 1 — Global Shell + Tokens Baseline
Scope:
- Header strip, sidebar shell, routed content frame
- Global spacing/radius/state token usage in new edits

Actions:
- Normalize shell spacing rhythm and vertical offsets.
- Remove any residual tinted/non-neutral hover/focus in shell controls.
- Ensure sidebar and header controls follow grayscale interaction states.
- Verify primary accent only on explicit primary/AI actions.

Acceptance:
- Shell has no nested-bento visual hierarchy.
- Hover/focus in shell is grayscale-only.
- Header/sidebar boundaries remain stable across desktop/mobile.

### Phase 2 — Calendar Execution Surface (Primary Runtime Surface)
Scope:
- Week grid, event cards, active execution rows

Actions:
- Keep execution area flat; reduce unnecessary visual framing.
- Ensure occurrence item rows read as rows + separators, not boxed cards.
- Enforce selected-row treatment via fill, not border emphasis.
- Maintain compact scanability and consistent row rhythm.

Acceptance:
- Execution surface shows minimal border noise.
- Hierarchy readable through spacing/typography only.
- Occurrence actions are discoverable without opening deep nested UI.

### Phase 3 — Configuration Surfaces (Drawers/Popovers/Sheets)
Scope:
- Event drawer, content-rule controls, popovers

Actions:
- Remove card-within-card patterns where possible.
- Keep configuration hidden until explicitly opened.
- Convert heavy boxed text-entry to borderless/inline where applicable.
- Ensure drawer/popover structure never exceeds visible nesting depth 2.

Acceptance:
- No card-in-card stacks for configuration.
- Notes/description feel inline and low-friction.
- Settings remain progressive-disclosure based.

### Phase 4 — List + Item + Thread Surfaces (Persistent Content)
Scope:
- List view, item modal/detail, comment thread panes

Actions:
- Reduce visual grouping to separators and spacing.
- Keep item/action hierarchy via indentation and type scale.
- Normalize row heights, control sizing, and neutral interaction states.
- Preserve thread scope clarity (Item/Action/Timeblock) without adding nested containers.

Acceptance:
- List and thread surfaces read as clean row systems.
- Child rows are visually subordinate to parent rows.
- No unnecessary boxed form shells in persistent content surfaces.

### Phase 5 — Motion System Alignment
Scope:
- Drawers, popovers, inline reveals, page transitions

Actions:
- Standardize durations:
  - micro: 120-150ms
  - popover/inline: 160-200ms
  - drawer: 220-260ms
  - page: 240-300ms
- Standardize easing: `cubic-bezier(0.22, 1, 0.36, 1)`.
- Remove fade-only structural entries and mixed animation stacks.
- Ensure container-led motion (content stable during movement).

Acceptance:
- Structural UI always has directional reveal.
- Motion language is consistent across surfaces.
- No mixed slide+fade+scale combos for same component types.

### Phase 6 — Mobile Interaction Softness Hardening
Scope:
- Mobile nav, calendar drawer flow, list/detail interactions

Actions:
- Enforce minimum touch target baselines.
- Ensure no hover-only critical affordances.
- Improve thumb reach and spacing in high-frequency controls.
- Keep modal/drawer behavior context-preserving and non-jarring.

Acceptance:
- Core controls hit touch size baseline.
- Mobile interactions remain stable under keyboard and gesture use.
- No structural UI appears abruptly without directional motion.

## Cross-Surface Audit Checklist

Use this checklist each phase before merge:
1. Color:
   - Any non-primary accent leakage?
   - Any hue-shift hover/focus?
2. Borders:
   - Any nested bordered containers introduced?
   - Can grouping be achieved with spacing/dividers instead?
3. Entry fields:
   - Are notes/descriptions borderless/inline where appropriate?
4. Motion:
   - Correct duration tier?
   - Correct easing?
   - Directional reveal for structural UI?
5. Mobile:
   - Touch targets adequate?
   - No hover-only critical interaction?

## Verification Matrix Per Phase
1. Desktop smoke:
   - open/close structural surfaces
   - hover/focus paths
   - row selection + inline edits
2. Mobile smoke:
   - navigation and drawer interactions
   - keyboard/input flows
   - occurrence completion and item open paths
3. Regression checks:
   - no auth/layout breakage
   - no proposal/apply behavior regressions
   - no recurrence execution regressions

## Prioritized Surface Backlog
Order by user impact:
1. Calendar execution + event drawer
2. Sidebar/navigation shell
3. List/detail/thread surfaces
4. Popovers/menus/system overlays
5. Low-frequency settings surfaces

## Implementation Strategy
1. Open a branch per phase.
2. Limit file touch set per phase.
3. Add before/after screenshots (desktop/mobile) to PR notes.
4. Merge only after checklist + matrix pass.
