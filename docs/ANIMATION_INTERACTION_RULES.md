# ANIMATION_INTERACTION_RULES.md

## Naming Manifest (Canonical References)

| Concept | Canonical Name | Notes |
| ---| ---| --- |
| Hover State | HoverState | Visual feedback on buttons, cards, list items |
| Focus State | FocusState | When an input or interactive element is selected |
| Click/Tap Animation | ClickAnimation | Feedback for press action on buttons, cards, toggles |
| Expand/Collapse | ExpandCollapse | Cards, Docs, Projects, TimeBlocks |
| Slide Transition | SlideTransition | Horizontal or vertical movement (e.g., mobile task swipe) |
| Stale State | StaleState | Visual cue for inactive or completed items |
| Loading State | LoadingState | Temporary placeholder while content loads |
| Recurrence Refresh | RecurrenceRefresh | Animation for recurring Tasks or TimeBlocks updating in view |

## General Principles

*   Subtlety: Animations must support clarity, not distract.
*   Direction first: slide/reveal motion is primary for structural UI.
*   Performance: Keep transitions lightweight for desktop and mobile.
*   Consistency: Use one easing family across the app.
*   Modular Application: Apply motion per element type; avoid mixed animation stacks.
*   Baseline easing: `cubic-bezier(0.22, 1, 0.36, 1)`.

## Hover & Focus Rules

*   Buttons: Lightness shift only; no hue shift.
*   Inputs/Fields: Subtle neutral focus indication; no glow-heavy effects.
*   Timing: Hover ~120-150ms, focus ~160-200ms.
*   Keep non-primary interactions grayscale.
*   Launchpad card action controls (expand/add): hidden by default, then revealed via fast opacity fade on hover/focus-within (no abrupt pop).

## Click & Tap Rules

*   Button Press: Slight scale down (0.98x) + subtle opacity change; revert after release.
*   Card Interaction: Soft lift/shadow while interacting; maintain spatial consistency.
*   Slide Swipes: Linear horizontal or vertical translation; snap to target position.

## Expand/Collapse Rules

*   Animation: Height reveal/collapse with overflow clipping, 160-200ms.
*   Prefer boundary movement over content fade.
*   Persistence: Expanded state should remain stable across page reloads or recurrence refresh.
*   Expanded launchpad card uses centered overlay behavior with click-out close region retained around the card.

## Ask Delta and AI Panel Motion

*   Ask Delta button may use subtle brightness/glow while preserving accent hue (`#00C7FF`).
*   AI panel uses directional slide entrance/exit (no scale).
*   Avoid fade-only structural entrances.
*   AI panel must respect header boundary while animating.

## Stale & Loading States

*   Stale Items: Reduce opacity slightly (0.5–0.7), optional light gray overlay; no flashy indicators.
*   Loading Placeholders: Skeleton blocks for cards, tasks, Docs; subtle shimmer if necessary.

## Recurrence Refresh

*   New Instances: Prefer directional slide or reveal from source location.
*   Persistent Comments/Tasks: No animation on reload to avoid jarring repetition.
*   Recurrence Completion: Subtle opacity change + checkmark animation; does not remove content immediately.

## Mobile Specific Animations

*   Swipe to CommentThread: Smooth horizontal slide over 220-260ms.
*   Task Collapse/Expand: Vertical height reveal, 160-200ms.
*   Minimal Gesture Feedback: Avoid large-scale visual disruptions; maintain context of Launchpad.

## Edge Guidelines

*   Animations must never obscure text or interactive elements.
*   Modular construction: each animated element has its own CSS/JS class for control and debugging.
*   Hover and click states are additive only; do not conflict with Expand/Collapse or SlideTransition animations.

## Contract Precedence

When motion rules conflict across docs, follow:
1. `STRUCTURAL_&_MOTION_DESIGN_CONTRACT.md`
2. `MOBILE_INTERACTION_SOFTNESS_STANDARD.md`
3. This file (`ANIMATION_INTERACTION_RULES.md`)
