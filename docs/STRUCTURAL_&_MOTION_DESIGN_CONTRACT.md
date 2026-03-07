DELTA – STRUCTURAL & MOTION DESIGN CONTRACT
Version 1.0
This document is authoritative. Deviations require explicit instruction.

------------------------------------------------------------
I. STRUCTURAL DESIGN RULES
------------------------------------------------------------

CORE PRINCIPLE
Hierarchy is expressed through spacing, typography, and interaction.
Hierarchy is NOT expressed through nested bordered containers.

Progressive disclosure > visual nesting.

SURFACE TYPES (DO NOT MIX)

1) Execution Surface (Calendar, Active View)
- Flat layout
- Minimal borders
- No visible configuration UI by default
- No nested bento structures
- Dividers allowed only between rows

2) Configuration Surface (Drawer, Popover, Sheet)
- Temporary layer above execution surface
- Opened via inline text buttons
- No permanent nested containers
- No card-within-card stacks
- Item/list settings open as an anchored slide-out options rail from the settings trigger (not a detached modal).

3) Persistent Content Surface (Lists, Threads)
- Rows separated by hairline dividers
- Inline editing preferred
- Borderless text entry by default
- No boxed textareas unless categorically required

BORDER RULES

Allowed:
- Single outer container if structurally required
- 1px dividers
- Subtle background contrast blocks

Not Allowed:
- Card inside card inside card
- Nested bordered containers
- Shadow stacking for hierarchy
- Bordered textareas for descriptions
- Visual grouping via boxes when spacing works

TEXT ENTRY RULE

Descriptions and notes must:
- Be borderless by default
- Feel like typing into the page
- Use subtle focus indication (underline or light background)
- Not render as boxed textarea fields

NESTING DEPTH LIMIT

Maximum visible nesting depth: 2 levels.

Acceptable:
Section
  Row
    Expandable region

Unacceptable:
Card
  Card
    Card
      Form

If nesting depth exceeds 2, refactor.

COLOR RULES

Primary accent color: #00C7FF

Blue is reserved for:
- Primary CTA buttons
- AI triggers
- Brand accents

All other UI:
- Grayscale only
- Dark gray buttons (not pure black)
- Very light gray hover states
- No hue-shift hover variants
- Hover changes lightness only

BUTTON HIERARCHY RULE (STRICT)

- Secondary and tertiary buttons are plain text only by default.
- Secondary and tertiary buttons do not use persistent fill or border.
- Secondary and tertiary hover/focus may use only a light gray background.
- Close (`X`) buttons always follow the same plain-text rule.
- Per surface (screen, modal, drawer, popover), only one colored action button is allowed, the primary action.

ANTI-DRIFT RULE

If grouping can be achieved with spacing and typography, do not add borders.
If editing can be inline, do not create a form container.
Prefer flatter layouts.
Prefer fewer containers.
Hide configuration until needed.

------------------------------------------------------------
II. MOTION & ANIMATION RULES
------------------------------------------------------------

CORE PRINCIPLE

Motion must be directional, intentional, and consistent.
Slide-based motion is primary.
Fade is secondary and minimal.

No random instant appearance of structural UI.

SURFACE MOTION STANDARDS

Drawer (bottom or side):
- Slide from origin edge
- 220–260ms
- Easing: cubic-bezier(0.22, 1, 0.36, 1)
- No scale
- No fade on entry
- Exit mirrors entry
- Content does NOT animate independently

Popover (anchored floating panel):
- Slide 8–12px from anchor direction
- 160–200ms
- Optional minimal opacity ramp (0.95 → 1)
- No scale animation
- Reverse slide on exit

Settings slide-out (anchored to icon trigger):
- Horizontal slide from trigger edge
- 160–200ms
- Easing: cubic-bezier(0.22, 1, 0.36, 1)
- No bounce, no independent child animation

Inline expand/collapse:
- Height reveal using overflow hidden
- 160–200ms
- No fade + slide combo
- Content revealed via boundary movement

Page transitions:
- Horizontal slide only
- 240–300ms
- No cross-fade
- No zoom
- No parallax

REVEAL EFFECT STANDARD

When opening panels:
- Container moves.
- Content remains visually stable.
- Use transform on container.
- Avoid animating children.
- Avoid opacity-only reveal.
- Prefer overflow clipping.

FORBIDDEN MOTION PATTERNS

- Fade-only modal entrances
- Slide + fade + scale combos
- Bounce or spring overshoot
- Mixed animation styles for same component type
- Instant appearance for structural surfaces

DURATION STANDARDS

Micro interactions: 120–150ms
Popovers: 160–200ms
Inline reveal: 160–200ms
Drawers: 220–260ms
Page transitions: 240–300ms

All easing curves must match:
cubic-bezier(0.22, 1, 0.36, 1)

No mixed easing curves across the app.

------------------------------------------------------------
III. IMPLEMENTATION CONSTRAINTS
------------------------------------------------------------

When modifying UI:

- Do not introduce new card containers unless explicitly required.
- Do not restyle unrelated components.
- Do not introduce new animation libraries.
- Do not mix fade + slide arbitrarily.
- Structural UI must animate.
- Micro-interactions may be instant.

When uncertain:
Prefer flatter.
Prefer sliding over fading.
Prefer inline over boxed.
Prefer progressive disclosure over nesting.

------------------------------------------------------------
END OF CONTRACT
------------------------------------------------------------
